# CORA-IA 1.1

Asistente de IA conversacional. En la PC se le escribe; responde con voz.

## Qué hace
- Conversa de forma natural y precisa, con memoria de la charla (unos 15 turnos).
- Consulta internet **sin abrir el navegador**: búsqueda integrada de Groq (modelos gpt-oss) o, con cualquier proveedor, su propio buscador y lector de páginas.
- Abre el navegador (Brave, Chrome o Edge) solo cuando se lo pides: una página concreta, YouTube, pausar, etc.
- Herramientas simples: hora y fecha, calculadora, temporizador.
- No controla el PC (volumen, audio, energía, aplicaciones): eso es de NEXODECK.
- La entrada por voz llegará desde el celular (etapa siguiente).

## Primer uso
1. Pulsa **Ajustes** (se abre solo si falta la clave).
2. Elige **Groq** y pega tu clave gratuita (console.groq.com/keys).
3. Escribe tu pregunta. La voz del navegador no necesita clave; Gemini (más natural) pide la suya.

## Android (APK)
Cada release también genera `CORA-IA-X.Y.Z.apk` (en la misma página de la release). Se instala en el teléfono permitiendo «instalar apps de origen desconocido».
Es la misma CORA-IA: chat, voz del teléfono, búsqueda en internet y abrir páginas. No controla el navegador ni reproduce videos solos.
La clave de Groq se pega una vez en **Ajustes** del teléfono. Para actualizar, instala la APK nueva encima (conserva tus ajustes).

## Actualizar
Sube los archivos a GitHub y crea la release con etiqueta `vX.Y.Z` o `X.Y.Z` (por ejemplo `v1.1.0`): el instalador .exe y la APK se generan solos.
La app instalada se actualiza sola al abrirse.

## Archivos
- `main.js`, `preload.js`: ventana, actualizaciones y puente seguro.
- `browser.js`: control del navegador (Playwright). `netproxy.js`: llamadas a Groq/Gemini/OpenRouter, búsqueda web y lectura de páginas.
- `app/index.html`: interfaz y cerebro.
