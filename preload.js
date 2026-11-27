const { contextBridge, ipcRenderer } = require('electron');

// Puente seguro hacia el control de navegadores (proceso principal)
contextBridge.exposeInMainWorld('elixBrowser', {
  run: (accion, args) => ipcRenderer.invoke('browser:run', accion, args),
});

// Red hacia los proveedores de IA (la hace el proceso principal)
contextBridge.exposeInMainWorld('elixNet', {
  fetch: (req) => ipcRenderer.invoke('net:fetch', req),
});

// Versión instalada y estado de las actualizaciones
contextBridge.exposeInMainWorld('elixApp', {
  info: () => ipcRenderer.invoke('app:info'),
  checkUpdate: () => ipcRenderer.invoke('app:check'),
  installNow: () => ipcRenderer.invoke('app:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s)),
});

// Búsqueda en internet y lectura de páginas (sin abrir el navegador)
contextBridge.exposeInMainWorld('coraWeb', {
  search: (q) => ipcRenderer.invoke('web:search', q),
  read: (url) => ipcRenderer.invoke('web:read', url),
});

// Micrófono del celular: el PC recibe el audio, lo entiende y ejecuta la orden
contextBridge.exposeInMainWorld('coraRemote', {
  config: () => ipcRenderer.invoke('remote:config'),
  activar: (v) => ipcRenderer.invoke('remote:activar', !!v),
  nuevoCodigo: () => ipcRenderer.invoke('remote:nuevo'),
  publicar: (s) => ipcRenderer.send('remote:publicar', s),
  responder: (id, r) => ipcRenderer.send('remote:resultado', id, r),
  onVoz: (cb) => ipcRenderer.on('remote:voz', (_e, m) => cb(m)),
  onCallar: (cb) => ipcRenderer.on('remote:callar', () => cb()),
});
