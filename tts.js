// Voz de CORA-IA (proceso principal): convierte texto en audio MP3.
//  - 'edge': voces neurales de Microsoft Edge (gratis, sin clave; hace falta internet; NO hace falta tener Edge instalado)
// Devuelve { ok:true, audio:Buffer, mime } o { ok:false, error }.
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const MAX_TEXTO = 1500;
const esc = (t) => String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const limpiaRate = (r) => { const n = +r; return Number.isFinite(n) ? Math.min(1.5, Math.max(0.6, n)) : 1; };

async function edge({ text, voz, rate }) {
  if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/.test(String(voz || ''))) return { ok: false, error: 'Voz de Edge no válida.' };
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 10000, synthesisTimeoutMs: 30000 });
  try {
    await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(esc(text), { rate: limpiaRate(rate) });
    const partes = [];
    await new Promise((resolve, reject) => {
      audioStream.on('data', (d) => partes.push(Buffer.from(d)));
      audioStream.on('error', reject);
      audioStream.on('end', resolve);
      audioStream.on('close', resolve);
    });
    const audio = Buffer.concat(partes);
    if (audio.length < 200) return { ok: false, error: 'el servicio de voz no devolvió audio' };
    return { ok: true, audio, mime: 'audio/mpeg' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e).slice(0, 140) };
  } finally { try { tts.close(); } catch {} }
}

async function sintetizar(req) {
  if (!req || typeof req !== 'object') return { ok: false, error: 'petición no válida' };
  const text = String(req.text || '').trim().slice(0, MAX_TEXTO);
  if (!text) return { ok: false, error: 'no hay texto' };
  if (req.engine === 'edge') return edge({ text, voz: req.voz, rate: req.rate });
  return { ok: false, error: 'motor de voz desconocido' };
}

module.exports = { sintetizar };
