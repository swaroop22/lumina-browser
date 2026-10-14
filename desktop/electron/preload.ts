import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('luminaDesktop', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openExternal: (url: string) => ipcRenderer.send('app:open-external', url),
  onOpenUrlInTab: (callback: (url: string) => void) => {
    ipcRenderer.on('browser:open-url-in-tab', (_, url) => callback(url));
  },
});
