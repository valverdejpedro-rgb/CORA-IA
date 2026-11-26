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
