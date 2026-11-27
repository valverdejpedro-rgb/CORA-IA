# CORA-IA 1.2

Asistente de IA conversacional. En la PC se le escribe (o se le habla desde el celular); responde con voz.

## Qué hace
- Conversa de forma natural y precisa, con memoria de la charla (unos 15 turnos).
- Consulta internet **sin abrir el navegador**: búsqueda integrada de Groq (modelos gpt-oss) o, con cualquier proveedor, su propio buscador y lector de páginas.
- Abre el navegador (Brave, Chrome o Edge) solo cuando se lo pides: una página concreta, YouTube, pausar, etc.
- Herramientas simples: hora y fecha, calculadora, temporizador.
- No controla el PC (volumen, audio, energía, aplicaciones): eso es de NEXODECK.

## Primer uso (PC)
1. Pulsa **Ajustes** (se abre solo si falta la clave).
2. Elige **Groq** y pega tu clave gratuita (console.groq.com/keys).
3. Escribe tu pregunta. La voz del navegador no necesita clave; Gemini (más natural) pide la suya.

## CORA Mic (el celular como micrófono)
La app del celular **no es la IA**: solo es un micrófono. Tú hablas al celular, la voz viaja por tu Wi-Fi al PC, el PC la convierte en texto (con la clave de Groq del PC) y CORA-IA ejecuta la orden y responde en el PC. Funciona solo si **CORA-IA (PC) y CORA Mic (celular) están abiertas** y en el mismo Wi-Fi.

Vincular (una sola vez):
1. En el PC abre CORA-IA → **Ajustes**: abajo verás «Micrófono del celular» con la dirección del PC y un código de 6 números. Si Windows pregunta por el firewall, pulsa **Permitir** (red privada).
2. En el celular abre **CORA Mic**, escribe esa dirección y el código, y pulsa Conectar.
3. Toca el micrófono, habla y deja de hablar: se envía solo (o toca de nuevo para terminar). **Callar** hace que CORA-IA deje de hablar en el PC.

Seguridad: solo acepta conexiones de la red local, exige el código, bloquea 5 minutos tras 5 intentos fallidos y se puede apagar o cambiar el código en Ajustes. Si el router le cambia la dirección al PC, el celular lo vuelve a buscar solo.

## Android (APK)
Cada release genera `CORA-Mic-X.Y.Z.apk` en la página de la release. Se instala permitiendo «instalar apps de origen desconocido». Pide permiso de micrófono la primera vez.
La APK se firma con una llave que vive en los **secretos de GitHub** (`ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`), nunca dentro del proyecto.

## Actualizar
Sube los archivos a GitHub y crea la release con etiqueta `vX.Y.Z` o `X.Y.Z` (por ejemplo `v1.2.0`): el instalador .exe y la APK se generan solos.
La app instalada del PC se actualiza sola al abrirse.

## Archivos
- `main.js`, `preload.js`: ventana, actualizaciones y puente seguro.
- `remote.js`: servidor local que recibe la voz del celular.
- `browser.js`: control del navegador (Playwright). `netproxy.js`: llamadas a Groq/Gemini/OpenRouter, búsqueda web y lectura de páginas.
- `app/index.html`: interfaz y cerebro del PC.
- `mobile/index.html`: app del celular (solo micrófono). `android/`: proyecto Android.
