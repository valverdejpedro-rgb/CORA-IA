/* Puente para la app Android (Capacitor). En el escritorio no hace nada. */
(function () {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  window.coraMobile = true;
  const P = cap.Plugins || {};
  const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

  // Internet: fetch nativo (sin CORS). Solo páginas públicas.
  const local = (h) => /^(localhost|.*\.(local|internal|localhost))$/i.test(h) || /^\[?(::1|f[cd][0-9a-f:]*|fe80[0-9a-f:]*)\]?$/i.test(h) ||
    /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(h);
  async function getText(url) {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || local(u.hostname)) throw new Error('dirección no permitida');
    const run = fetch(u.href, { headers: { 'user-agent': UA, 'accept-language': 'es-ES,es;q=0.9,en;q=0.6', accept: 'text/html,*/*;q=0.5' } })
      .then(async (r) => ({ status: r.status, html: (await r.text()).slice(0, 1500000), url: u.href }));
    return Promise.race([run, new Promise((_, rej) => setTimeout(() => rej(new Error('tardó demasiado')), 15000))]);
  }
  if (window.CoraSearch) window.coraWeb = { search: (q) => window.CoraSearch.buscar(q, getText), read: (u) => window.CoraSearch.leer(u, getText) };

  // Voz del teléfono
  if (P.TextToSpeech) {
    const langs = ['es-MX', 'es-US', 'es-ES'];
    window.coraTTS = {
      async speak(text, rate) {
        text = String(text).slice(0, 3500); let err;
        for (const lang of langs) {
          try { await P.TextToSpeech.speak({ text, lang, rate: rate || 1, pitch: 1, volume: 1, category: 'ambient', queueStrategy: 0 }); return; } catch (e) { err = e; }
        }
        throw err;
      },
      stop: () => P.TextToSpeech.stop(),
    };
  }
  // Abrir una página en el navegador del teléfono
  window.coraOpen = (url) => { try { return P.Browser ? P.Browser.open({ url }) : window.open(url, '_blank'); } catch (e) {} };
})();
