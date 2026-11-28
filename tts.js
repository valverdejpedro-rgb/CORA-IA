// Voz de CORA-IA (proceso principal): convierte texto en audio MP3.
//  - 'edge'  : voces neurales de Microsoft Edge (gratis, sin clave; hace falta internet; NO hace falta tener Edge instalado)
//  - 'eleven': ElevenLabs (con la clave del usuario)
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

async function eleven({ text, key, voiceId, rate }) {
  key = String(key || '').trim(); voiceId = String(voiceId || '').trim();
  if (!key) return { ok: false, error: 'falta la clave de ElevenLabs (Ajustes)' };
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return { ok: false, error: 'el ID de voz de ElevenLabs no es válido (Ajustes)' };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '?output_format=mp3_44100_64', {
      method: 'POST', signal: ctl.signal,
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: String(text), model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, limpiaRate(rate))) } }),
    });
    if (!r.ok) {
      let d = {}; try { d = await r.json(); } catch {}
      const det = d.detail || {}, st = String(det.status || ''), msg = String(det.message || (typeof det === 'string' ? det : '') || '').slice(0, 120);
      if (/quota/i.test(st)) return { ok: false, error: 'se acabaron los caracteres de tu plan de ElevenLabs' };
      if (r.status === 401 || r.status === 403) {
        if (/unusual/i.test(st)) return { ok: false, error: 'ElevenLabs bloqueó el plan gratis por actividad inusual (VPN o varias cuentas)' };
        if (/permission/i.test(st + ' ' + msg)) return { ok: false, error: 'a tu clave de ElevenLabs le falta el permiso «Text to Speech» (actívalo en la configuración de la clave) [' + (st || r.status) + ']' };
        if (/invalid_api_key|invalid api key/i.test(st + ' ' + msg)) return { ok: false, error: 'ElevenLabs dice que la clave no existe o está mal copiada [' + (st || r.status) + ']' };
        return { ok: false, error: 'ElevenLabs rechazó la clave: ' + (msg || st || 'error ' + r.status) };
      }
      if (r.status === 402 || /paid_plan|library/i.test(st)) return { ok: false, error: 'esa voz requiere un plan de pago de ElevenLabs; elige otra voz' };
      if (r.status === 404 || /voice_not_found/i.test(st)) return { ok: false, error: 'no encontré ese ID de voz en tu cuenta de ElevenLabs' };
      if (r.status === 429) return { ok: false, error: 'ElevenLabs está recibiendo demasiadas peticiones; prueba en un momento' };
      return { ok: false, error: 'ElevenLabs respondió con error ' + r.status + (msg ? ': ' + msg : '') };
    }
    const audio = Buffer.from(await r.arrayBuffer());
    if (audio.length < 200) return { ok: false, error: 'ElevenLabs no devolvió audio' };
    return { ok: true, audio, mime: 'audio/mpeg' };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? 'ElevenLabs tardó demasiado' : 'sin conexión con ElevenLabs' };
  } finally { clearTimeout(t); }
}

async function sintetizar(req) {
  if (!req || typeof req !== 'object') return { ok: false, error: 'petición no válida' };
  const text = String(req.text || '').trim().slice(0, MAX_TEXTO);
  if (!text) return { ok: false, error: 'no hay texto' };
  if (req.engine === 'edge') return edge({ text, voz: req.voz, rate: req.rate });
  if (req.engine === 'eleven') return eleven({ text, key: req.key, voiceId: req.voiceId, rate: req.rate });
  return { ok: false, error: 'motor de voz desconocido' };
}

module.exports = { sintetizar };
