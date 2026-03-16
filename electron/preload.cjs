const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  finishSetup: (config) => ipcRenderer.invoke('finish-setup', config),
  quit: () => ipcRenderer.invoke('quit-setup'),
});
