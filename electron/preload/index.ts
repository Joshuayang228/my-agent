import { ipcRenderer, contextBridge } from 'electron'
import type { ChatMessage, ChatSession, AgentStreamEvent, TaskLifecycleEvent } from '../../src/shared/types'

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  roleId?: string
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
    add: (category: string, content: string, roleId?: string) =>
      ipcRenderer.invoke('memory:add', category, content, roleId),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id),
    update: (id: string, content: string) => ipcRenderer.invoke('memory:update', id, content),
    correctCitation: (
      id: string,
      replacement?: string,
    ): Promise<
      | { ok: true; action: 'deleted' | 'updated' | 'replaced'; id: string; newId?: string }
      | { ok: false; error: string }
    > => ipcRenderer.invoke('memory:correct-citation', id, replacement),
  },

  companion: {
    listProtagonists: (): Promise<{ id: string; name: string; description: string }[]> =>
      ipcRenderer.invoke('companion:list-protagonists'),
    getActive: (): Promise<{ id: string; name: string; description: string; universeId: string }> =>
      ipcRenderer.invoke('companion:get-active'),
    requestSwitch: (
      roleId: string,
    ): Promise<
      | {
          ok: true
          catchupQueued: boolean
          reacquaint: { title: string; body: string; toast: string }
        }
      | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE' }
    > => ipcRenderer.invoke('companion:request-switch', roleId),
    getMutable: (roleId?: string): Promise<{ roleId: string; body: string }> =>
      ipcRenderer.invoke('companion:get-mutable', roleId),
    setMutable: (
      roleId: string,
      body: string,
      summary?: string,
    ): Promise<{ ok: true; version: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke('companion:set-mutable', roleId, body, summary),
    listMutableVersions: (roleId: string) =>
      ipcRenderer.invoke('companion:list-mutable-versions', roleId),
    rollbackMutable: (
      roleId: string,
      toVersion: number,
    ): Promise<{ ok: true; version: number } | { ok: false; error: string }> =>
      ipcRenderer.invoke('companion:rollback-mutable', roleId, toVersion),
    getMoments: (opts?: { limit?: number; offset?: number }): Promise<{
      roleId: string
      items: Array<{
        id: string
        roleId: string
        eventId: string
        publishedAt: number
        text: string
        meta: Record<string, unknown>
      }>
    }> => ipcRenderer.invoke('companion:get-moments', opts),
    catchupStatus: (): Promise<{
      roleId: string
      pausedAt: number | null
      catchupSummary: string
      lastTickAt: number
      presence: string
    }> => ipcRenderer.invoke('companion:catchup-status'),
    getAssets: (opts?: { kind?: string }): Promise<{
      roleId: string
      items: Array<{
        id: string
        roleId: string
        kind: string
        name: string
        payload: Record<string, unknown>
        acquiredAt: number
        sourceEventId: string | null
      }>
    }> => ipcRenderer.invoke('companion:get-assets', opts),
    updateAsset: (
      assetId: string,
      patch: { name?: string; payload?: Record<string, unknown> },
    ): Promise<
      | {
          ok: true
          asset: {
            id: string
            roleId: string
            kind: string
            name: string
            payload: Record<string, unknown>
            acquiredAt: number
            sourceEventId: string | null
          }
        }
      | { ok: false; error: string; code?: string }
    > => ipcRenderer.invoke('companion:update-asset', assetId, patch),
    deleteAsset: (
      assetId: string,
    ): Promise<{ ok: true } | { ok: false; error: string; code?: string }> =>
      ipcRenderer.invoke('companion:delete-asset', assetId),
    getRoster: (): Promise<{
      roleId: string
      lines: Array<{
        otherId: string
        otherName: string
        relationType: string
        text: string
      }>
      cast: Array<{
        id: string
        name: string
        description: string
        summary: string
        canBeProtagonist: boolean
        summonHint: string
      }>
    }> => ipcRenderer.invoke('companion:get-roster'),
    summonBrief: (roleId: string): Promise<
      | {
          ok: true
          brief: {
            id: string
            name: string
            description: string
            summary: string
            canBeProtagonist: boolean
            summonHint: string
          }
        }
      | { ok: false; error: string }
    > => ipcRenderer.invoke('companion:summon-brief', roleId),
    checkCastAvailability: (roleId: string): Promise<
      | {
          available: boolean
          roleId: string
          name: string
          reason?: string
          alternative?: string
          presence?: string
        }
      | { ok: false; error: string }
    > => ipcRenderer.invoke('companion:check-cast-availability', roleId),
    startSummon: (
      roleId: string,
      force?: boolean,
    ): Promise<
      | {
          ok: true
          sessionId: string
          roleId: string
          name: string
          sessionKind: 'main' | 'summon'
          activeRoleId: string
          presence?: string
        }
      | {
          ok: false
          error: string
          reason?: string
          alternative?: string
          presence?: string
        }
    > => ipcRenderer.invoke('companion:start-summon', roleId, force),
    reflectionStatus: (roleId?: string) =>
      ipcRenderer.invoke('companion:reflection-status', roleId),
    runReflection: (roleId?: string, force?: boolean) =>
      ipcRenderer.invoke('companion:run-reflection', roleId, force),
    listMilestones: (roleId?: string): Promise<{
      roleId: string
      kinds: Array<'first_role_switch' | 'first_reflection' | 'first_rapport'>
    }> => ipcRenderer.invoke('companion:list-milestones', roleId),
    onMilestone: (
      callback: (payload: {
        roleId: string
        kind: 'first_role_switch' | 'first_reflection' | 'first_rapport'
        toast: string
      }) => void,
    ) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        payload: {
          roleId: string
          kind: 'first_role_switch' | 'first_reflection' | 'first_rapport'
          toast: string
        },
      ) => callback(payload)
      ipcRenderer.on('companion:milestone', handler)
      return () => ipcRenderer.removeListener('companion:milestone', handler)
    },
    onMomentTip: (
      callback: (payload: { roleId: string; toast: string; published: number }) => void,
    ) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        payload: { roleId: string; toast: string; published: number },
      ) => callback(payload)
      ipcRenderer.on('companion:moment-tip', handler)
      return () => ipcRenderer.removeListener('companion:moment-tip', handler)
    },
    onProactiveGreeting: (
      callback: (payload: { roleId: string; toast: string; momentId: string }) => void,
    ) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        payload: { roleId: string; toast: string; momentId: string },
      ) => callback(payload)
      ipcRenderer.on('companion:proactive-greeting', handler)
      return () => ipcRenderer.removeListener('companion:proactive-greeting', handler)
    },
    onRoleChanged: (
      callback: (payload: {
        roleId: string
        catchupQueued: boolean
        previousRoleId: string
        reacquaint?: { title: string; body: string; toast: string }
      }) => void,
    ) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        payload: {
          roleId: string
          catchupQueued: boolean
          previousRoleId: string
          reacquaint?: { title: string; body: string; toast: string }
        },
      ) => callback(payload)
      ipcRenderer.on('companion:role-changed', handler)
      return () => ipcRenderer.removeListener('companion:role-changed', handler)
    },
  },

  mcp: {
    connect: (config: {
      id: string
      name: string
      transport?: 'stdio' | 'sse'
      command: string
      args: string[]
      env?: Record<string, string>
      url?: string
      enabled: boolean
    }) => ipcRenderer.invoke('mcp:connect', config),
    disconnect: (serverId: string) => ipcRenderer.invoke('mcp:disconnect', serverId),
    status: (): Promise<Array<{ id: string; name: string; status: string; toolCount: number; resourceCount?: number; error?: string }>> =>
      ipcRenderer.invoke('mcp:status'),
    listTools: (serverId?: string) => ipcRenderer.invoke('mcp:list-tools', serverId),
    listResources: (serverId?: string) => ipcRenderer.invoke('mcp:list-resources', serverId),
    readResource: (serverId: string, uri: string) =>
      ipcRenderer.invoke('mcp:read-resource', serverId, uri),
    onElicitRequest: (
      callback: (data: {
        requestId: string
        serverId: string
        message: string
        schema: Record<string, unknown>
      }) => void,
    ) => {
      const handler = (
        _e: Electron.IpcRendererEvent,
        data: { requestId: string; serverId: string; message: string; schema: Record<string, unknown> },
      ) => callback(data)
      ipcRenderer.on('mcp:elicit-request', handler)
      return () => ipcRenderer.off('mcp:elicit-request', handler)
    },
    elicitResponse: (requestId: string, values: Record<string, unknown> | null) =>
      ipcRenderer.send(`mcp:elicit-response:${requestId}`, values),
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
    traces: () => ipcRenderer.invoke('debug:traces'),
    playgroundRun: (input: {
      systemPrompt?: string
      userPrompt: string
    }): Promise<
      | { ok: true; text: string; ms: number; model: string }
      | { ok: false; error: string }
    > => ipcRenderer.invoke('debug:playground-run', input),
    toolRun: (input: {
      name: string
      args?: Record<string, unknown>
      confirmRisk?: boolean
    }): Promise<
      | {
          ok: true
          content: string
          isError?: boolean
          ms: number
          permission: {
            allowed: boolean | 'needs_approval'
            reason: string
            decisionType: string
            matchedRule?: string
            chain: string
          }
        }
      | {
          ok: false
          error: string
          needsConfirmation?: boolean
          permission?: {
            allowed: boolean | 'needs_approval'
            reason: string
            decisionType: string
            matchedRule?: string
            chain: string
          }
        }
    > => ipcRenderer.invoke('debug:tool-run', input),
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
    /** 只传本轮用户消息；完整历史由主进程 session-store 加载 */
    send: (sessionId: string, userMessage: ChatMessage) =>
      ipcRenderer.invoke('chat:send', sessionId, userMessage),
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

  tasks: {
    list: (sessionId?: string) => ipcRenderer.invoke('task:list', sessionId),
    sync: (sessionId?: string) => ipcRenderer.invoke('task:sync', sessionId),
    cancel: (taskId: string) => ipcRenderer.invoke('task:cancel', taskId),
    onEvent: (callback: (event: TaskLifecycleEvent) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, ev: TaskLifecycleEvent) => callback(ev)
      ipcRenderer.on('task:event', handler)
      return () => ipcRenderer.off('task:event', handler)
    },
  },
})
