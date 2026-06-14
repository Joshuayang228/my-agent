import { ipcRenderer, contextBridge } from 'electron'
import type { ChatMessage, ChatSession, AgentStreamEvent } from '../../src/shared/types'

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),

  session: {
    list: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list'),
    create: (): Promise<ChatSession> => ipcRenderer.invoke('session:create'),
    get: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke('session:get', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('session:delete', id),
    rename: (id: string, title: string): Promise<void> => ipcRenderer.invoke('session:rename', id, title),
  },

  settings: {
    get: (): Promise<Record<string, string>> => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: string): Promise<void> => ipcRenderer.invoke('settings:set', key, value),
  },

  memory: {
    list: (category?: string) => ipcRenderer.invoke('memory:list', category),
    add: (category: string, content: string) => ipcRenderer.invoke('memory:add', category, content),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    update: (id: string, content: string) => ipcRenderer.invoke('memory:update', id, content),
  },

  persona: {
    list: (): Promise<{ id: string; name: string; description: string }[]> =>
      ipcRenderer.invoke('persona:list'),
    getCurrent: (): Promise<{ id: string; name: string; description: string }> =>
      ipcRenderer.invoke('persona:get-current'),
  },

  chat: {
    send: (sessionId: string, messages: ChatMessage[]) =>
      ipcRenderer.invoke('chat:send', sessionId, messages),
    abort: () => ipcRenderer.invoke('chat:abort'),
    onEvent: (callback: (event: AgentStreamEvent) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, ev: AgentStreamEvent) => callback(ev)
      ipcRenderer.on('chat:event', handler)
      return () => ipcRenderer.off('chat:event', handler)
    },
    onConfirmRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: { requestId: string; name: string; args: Record<string, unknown> }) => callback(data)
      ipcRenderer.on('tool:confirm-request', handler)
      return () => ipcRenderer.off('tool:confirm-request', handler)
    },
    confirmResponse: (requestId: string, approved: boolean) =>
      ipcRenderer.send(`tool:confirm-response:${requestId}`, approved),
  },
})
