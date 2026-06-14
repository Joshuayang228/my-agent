import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  on(channel: string, callback: (...args: unknown[]) => void) {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  },
  send(channel: string, ...args: unknown[]) {
    ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  },
})
