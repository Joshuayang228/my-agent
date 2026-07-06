import { ipcRenderer, contextBridge } from 'electron'
import type { ChatMessage, ChatSession, AgentStreamEvent } from '../../src/shared/types'

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),

  session: {
    list: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list'),
    create: (): Promise<ChatSession> => ipcRenderer.invoke('session:create'),
    get: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke('session:get', id),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('session:delete', id),
    rename: (id: string, title: string): Promise<void> => ipcRenderer.invoke('session:rename', id, title),
    deleteMessage: (messageId: string): Promise<void> => ipcRenderer.invoke('message:delete', messageId),
    fork: (sessionId: string, upToMessageId: string): Promise<ChatSession> =>
      ipcRenderer.invoke('session:fork', sessionId, upToMessageId),
    tokenUsage: (sessionId: string): Promise<{ promptTokens: number; completionTokens: number }> =>
      ipcRenderer.invoke('session:tokenUsage', sessionId),
    regenerateTitle: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('session:regenerateTitle', sessionId),
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

  mcp: {
    connect: (config: { id: string; name: string; command: string; args: string[]; env?: Record<string, string>; enabled: boolean }) =>
      ipcRenderer.invoke('mcp:connect', config),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
    status: (): Promise<Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>> =>
      ipcRenderer.invoke('mcp:status'),
    listTools: (serverId?: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
  },

  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    get: (name: string) => ipcRenderer.invoke('skills:get', name),
    save: (name: string, content: string) => ipcRenderer.invoke('skills:save', name, content),
    delete: (name: string) => ipcRenderer.invoke('skills:delete', name),
    reload: () => ipcRenderer.invoke('skills:reload'),
    versions: (name: string) => ipcRenderer.invoke('skills:versions', name),
    rollback: (name: string, version: number) => ipcRenderer.invoke('skills:rollback', name, version),
  },

  data: {
    export: () => ipcRenderer.invoke('data:export'),
    import: () => ipcRenderer.invoke('data:import'),
  },

  project: {
    browse: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke('project:browse'),
    list: (): Promise<{ path: string; name: string }[]> =>
      ipcRenderer.invoke('project:list'),
    set: (dirPath: string | null): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('project:set', dirPath),
    get: (): Promise<{ path: string; name: string } | null> =>
      ipcRenderer.invoke('project:get'),
    listFiles: (dirPath: string, depth?: number): Promise<FileEntry[]> =>
      ipcRenderer.invoke('project:listFiles', dirPath, depth),
    readFile: (filePath: string): Promise<{ content?: string; size?: number; error?: string }> =>
      ipcRenderer.invoke('project:readFile', filePath),
  },

  debug: {
    systemPrompt: () => ipcRenderer.invoke('debug:system-prompt'),
    tools: () => ipcRenderer.invoke('debug:tools'),
    systemInfo: () => ipcRenderer.invoke('debug:system-info'),
  },

  rag: {
    list: () => ipcRenderer.invoke('rag:list'),
    ingest: () => ipcRenderer.invoke('rag:ingest'),
    delete: (docId: string) => ipcRenderer.invoke('rag:delete', docId),
  },

  scheduler: {
    list: () => ipcRenderer.invoke('scheduler:list'),
    create: (opts: { name: string; prompt: string; cron?: string; intervalMs?: number }) =>
      ipcRenderer.invoke('scheduler:create', opts),
    update: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke('scheduler:update', id, updates),
    delete: (id: string) => ipcRenderer.invoke('scheduler:delete', id),
    onTriggered: (cb: (info: { taskId: string; name: string; prompt: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { taskId: string; name: string; prompt: string }) => cb(info)
      ipcRenderer.on('scheduler:triggered', handler)
      return () => ipcRenderer.off('scheduler:triggered', handler)
    },
  },

  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onAvailable: (cb: (info: { version: string; releaseNotes?: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { version: string; releaseNotes?: string }) => cb(info)
      ipcRenderer.on('updater:available', handler)
      return () => ipcRenderer.off('updater:available', handler)
    },
    onProgress: (cb: (info: { percent: number }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { percent: number }) => cb(info)
      ipcRenderer.on('updater:progress', handler)
      return () => ipcRenderer.off('updater:progress', handler)
    },
    onDownloaded: (cb: (info: { version: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, info: { version: string }) => cb(info)
      ipcRenderer.on('updater:downloaded', handler)
      return () => ipcRenderer.off('updater:downloaded', handler)
    },
  },

  chat: {
    send: (sessionId: string, messages: ChatMessage[]) =>
      ipcRenderer.invoke('chat:send', sessionId, messages),
    abort: (sessionId?: string) => ipcRenderer.invoke('chat:abort', sessionId),
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
