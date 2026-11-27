// Micrófono del celular: un pequeño servidor SOLO para la red local (Wi-Fi de casa).
// El celular graba tu voz y la manda aquí; el PC la convierte en texto y CORA-IA la ejecuta.
// Protegido con un código de 6 dígitos y limitado a direcciones de red local.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = 38428;
const MAX_BODY = 6 * 1024 * 1024; // ~6 MB (unos 60 s de voz)

function crearRemoto({ dir, esPrivada, alVoz, alCallar }) {
  const file = path.join(dir, 'cora-celular.json');
  const cfg = { activo: true, codigo: '' };
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch {}
  const guardar = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(cfg)); } catch {} };
  const nuevoCodigo = () => { cfg.codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0'); guardar(); };
  if (!/^\d{6}$/.test(String(cfg.codigo))) nuevoCodigo();

  let ultimo = { estado: 'idle', label: 'En espera', rid: 0, respuesta: '' };
  let visto = 0;       // última vez que el celular preguntó por el estado
  let errorServidor = '';
  const fallos = new Map(); // ip -> { n, hasta }
  let server = null;

  const ipDe = (req) => String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const igual = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  function responder(res, status, obj) {
    const txt = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(txt);
  }
  function leerCuerpo(req) {
    return new Promise((resolve, reject) => {
      const partes = []; let n = 0;
      req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new Error('grande')); req.destroy(); } else partes.push(c); });
      req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
      req.on('error', reject);
    });
  }

  async function atender(req, res) {
    const ip = ipDe(req);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-cora-code');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (!esPrivada(ip)) return responder(res, 403, { error: 'Solo red local.' });
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const ruta = (req.url || '/').split('?')[0];
    // Identificación sin código (solo dice quién es; sirve para encontrar el PC en la red)
    if (req.method === 'GET' && ruta === '/hola') return responder(res, 200, { app: 'CORA-IA' });

    // Todo lo demás exige el código
    const f = fallos.get(ip);
    if (f && f.hasta > Date.now()) return responder(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
    if (!igual(req.headers['x-cora-code'] || '', cfg.codigo)) {
      const n = ((f && f.n) || 0) + 1;
      fallos.set(ip, { n: n >= 5 ? 0 : n, hasta: n >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
      return responder(res, 401, { error: 'Código incorrecto.' });
    }
    fallos.delete(ip);

    if (req.method === 'GET' && ruta === '/estado') { visto = Date.now(); return responder(res, 200, { ok: true, ...ultimo }); }
    if (req.method === 'POST' && ruta === '/callar') { try { alCallar(); } catch {} return responder(res, 200, { ok: true }); }
    if (req.method === 'POST' && ruta === '/voz') {
      let m;
      try { m = JSON.parse(await leerCuerpo(req)); } catch { return responder(res, 400, { error: 'Mensaje no válido.' }); }
      if (!m || typeof m.audio !== 'string' || m.audio.length < 100) return responder(res, 400, { error: 'No llegó audio.' });
      visto = Date.now();
      const r = await alVoz({ audio: m.audio, mime: String(m.mime || 'audio/webm').slice(0, 60) });
      return responder(res, r && r.texto ? 200 : 422, r && r.texto ? { texto: r.texto } : { error: (r && r.error) || 'No pude entender el audio.' });
    }
    return responder(res, 404, { error: 'No existe.' });
  }

  function iniciar() {
    if (server || !cfg.activo) return;
    errorServidor = '';
    server = http.createServer((req, res) => { atender(req, res).catch(() => { try { responder(res, 500, { error: 'Error interno.' }); } catch {} }); });
    server.on('error', (e) => { errorServidor = e && e.code === 'EADDRINUSE' ? 'El puerto ' + PORT + ' está ocupado por otro programa.' : String((e && e.message) || e); server = null; });
    server.listen(PORT, '0.0.0.0');
  }
  function detener() { if (!server) return; try { server.close(); server.closeAllConnections && server.closeAllConnections(); } catch {} server = null; }

  function ips() {
    const out = [];
    for (const lista of Object.values(os.networkInterfaces())) for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal && esPrivada(i.address)) out.push(i.address);
    }
    return out.sort((a, b) => (b.startsWith('192.168.') - a.startsWith('192.168.')) || a.localeCompare(b));
  }

  return {
    PORT,
    iniciar, detener,
    activar(v) { cfg.activo = !!v; guardar(); if (cfg.activo) iniciar(); else detener(); },
    nuevoCodigo() { nuevoCodigo(); fallos.clear(); },
    publicar(s) {
      if (!s || typeof s !== 'object') return;
      if (typeof s.estado === 'string') ultimo.estado = s.estado.slice(0, 20);
      if (typeof s.label === 'string') ultimo.label = s.label.slice(0, 80);
      if (typeof s.respuesta === 'string') { ultimo.respuesta = s.respuesta.slice(0, 1200); ultimo.rid++; }
    },
    info() { return { activo: cfg.activo, codigo: cfg.codigo, puerto: PORT, ips: ips(), conectado: Date.now() - visto < 8000, error: errorServidor }; },
  };
}

module.exports = { crearRemoto, PORT };
