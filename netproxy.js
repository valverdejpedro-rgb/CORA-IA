// Llamadas de red hechas desde el proceso principal (sin CORS) hacia proveedores de IA conocidos.
// La página nunca llama a estos servidores directamente en la versión de escritorio.
const HOSTS = new Set([
  'api.groq.com',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'www.googleapis.com',
]);
const defaultAllow = (u) => u.protocol === 'https:' && HOSTS.has(u.hostname);
const HEADER_OK = /^(authorization|content-type|x-goog-api-key)$/i;

// req: { url, method, headers, body (texto), form: { fields, file: { bytes, type, name } }, timeout }
async function proxyFetch(req, allow = defaultAllow) {
  let u;
  try { u = new URL(String(req && req.url)); } catch { return { status: 0, body: 'URL no válida.' }; }
  if (!allow(u)) return { status: 0, body: 'Servidor no permitido.' };

  const headers = {};
  for (const [k, v] of Object.entries(req.headers || {})) if (HEADER_OK.test(k)) headers[k] = String(v);

  let body;
  if (req.form) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(req.form.fields || {})) fd.append(k, String(v));
    const f = req.form.file;
    if (f) fd.append('file', new Blob([Buffer.from(f.bytes)], { type: f.type || 'application/octet-stream' }), f.name || 'file');
    body = fd;
    delete headers['content-type']; delete headers['Content-Type']; // lo pone FormData con su boundary
  } else if (req.body != null) {
    body = String(req.body);
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Math.max(1000, Math.min(60000, +req.timeout || 25000)));
  try {
    const r = await fetch(u.href, { method: req.method || 'POST', headers, body, signal: ctl.signal });
    return { status: r.status, body: await r.text() };
  } catch (err) {
    return { status: 0, aborted: !!(err && err.name === 'AbortError'), body: String((err && err.message) || err).slice(0, 200) };
  } finally { clearTimeout(timer); }
}


// ---------- Internet sin abrir el navegador: buscar y leer páginas ----------
const net = require('net');
const dns = require('dns').promises;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const W = require('./app/websearch.js');

function privada(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || (l.startsWith('::ffff:') && privada(l.slice(7)));
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
// Solo páginas públicas de internet: nunca localhost ni la red local
async function esPublica(u) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const h = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;
  let addrs;
  if (net.isIP(h)) addrs = [h];
  else { try { addrs = (await dns.lookup(h, { all: true })).map((a) => a.address); } catch { return false; } }
  return addrs.length > 0 && addrs.every((a) => !privada(a));
}

async function getText(url, { timeout = 15000, max = 1500000, tipos = /text\/|html|xml/i } = {}) {
  let u = new URL(url);
  for (let hop = 0; hop < 5; hop++) {
    if (!(await esPublica(u))) throw new Error('dirección no permitida');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(u.href, { redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': UA, 'accept-language': 'es-ES,es;q=0.9,en;q=0.6', accept: 'text/html,application/xhtml+xml,*/*;q=0.5' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { u = new URL(r.headers.get('location'), u); continue; }
      const ct = r.headers.get('content-type') || '';
      if (!tipos.test(ct)) throw new Error('no es una página de texto (' + (ct.split(';')[0] || 'tipo desconocido') + ')');
      const rd = r.body.getReader(), parts = []; let n = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; if (n >= max) { try { await rd.cancel(); } catch {} break; } }
      return { status: r.status, html: Buffer.concat(parts).toString('utf8'), url: u.href };
    } finally { clearTimeout(t); }
  }
  throw new Error('demasiadas redirecciones');
}

const buscarWeb = (consulta) => W.buscar(consulta, (url) => getText(url, { timeout: 12000 }));
const leerPagina = (url) => W.leer(url, (u) => getText(u, { timeout: 15000 }));

module.exports = { proxyFetch, buscarWeb, leerPagina, _t: { parseDDG: W.parseDDG, parseBing: W.parseBing, privada, esPublica } };
