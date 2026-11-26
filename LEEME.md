# Radex IA 1.0

Asistente de IA conversacional. En la PC se le escribe; responde con voz.

## Qué hace
- Conversa de forma natural y precisa, con memoria de la charla (unos 15 turnos).
- Busca en internet cuando hace falta (búsqueda integrada de Groq con los modelos gpt-oss).
- Controla el navegador (Brave, Chrome o Edge): abrir páginas, buscar en YouTube y reproducir, pausar, etc.
- Herramientas simples: hora y fecha, calculadora, temporizador.
- No controla el PC (volumen, audio, energía, aplicaciones): eso es de NEXODECK.
- Ya no escucha por el micrófono de la PC. La entrada por voz llegará desde el celular (etapa siguiente).

## Primer uso
1. Doble clic en RADEX para abrir la configuración de API.
2. Elige **Groq** y pega tu clave gratuita (console.groq.com/keys). Solo con Groq hay búsqueda en internet.
3. Escribe tu pregunta.
- Voz: "Motor de voz" en Navegador (voces de Windows, sin clave) o Gemini (más natural, pide clave de Gemini).

## Actualizar (como siempre)
Sube los archivos a GitHub, crea la etiqueta `vX.Y.Z` (por ejemplo `v1.0.0`) y la release se publica sola.
La app instalada se actualiza sola al abrirse.

## Archivos
- `main.js`, `preload.js`: ventana, actualizaciones y puente seguro.
- `browser.js`: control del navegador con Playwright. `netproxy.js`: llamadas a Groq/Gemini/OpenRouter.
- `app/index.html`: toda la interfaz y el cerebro.
