/// <reference types="vite/client" />

import type { ChatMessage, ChatSession, AgentStreamEvent } from './shared/types'

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>
      session: {
        list: () => Promise<SessionSummary[]>
        create: () => Promise<ChatSession>
        get: (id: string) => Promise<ChatSession | null>
        delete: (id: string) => Promise<void>
        rename: (id: string, title: string) => Promise<void>
        deleteMessage: (messageId: string) => Promise<void>
        fork: (sessionId: string, upToMessageId: string) => Promise<ChatSession>
        tokenUsage: (sessionId: string) => Promise<{ promptTokens: number; completionTokens: number }>
        regenerateTitle: (sessionId: string) => Promise<{ success: boolean; error?: string }>
      }
      rag: {
        list: () => Promise<Array<{ id: string; name: string; filePath: string; chunkCount: number; createdAt: number }>>
        ingest: () => Promise<Array<{ id: string; name: string; filePath: string; chunkCount: number; createdAt: number }>>
        delete: (docId: string) => Promise<void>
      }
      scheduler: {
        list: () => Promise<Array<{ id: string; name: string; prompt: string; cron?: string; intervalMs?: number; enabled: boolean; lastRunAt?: number; nextRunAt?: number; createdAt: number }>>
        create: (opts: { name: string; prompt: string; cron?: string; intervalMs?: number }) => Promise<unknown>
        update: (id: string, updates: Record<string, unknown>) => Promise<void>
        delete: (id: string) => Promise<void>
        onTriggered: (cb: (info: { taskId: string; name: string; prompt: string }) => void) => () => void
      }
      updater: {
        check: () => Promise<{ available: boolean; version?: string }>
        download: () => Promise<void>
        install: () => void
        onAvailable: (cb: (info: { version: string }) => void) => () => void
        onProgress: (cb: (info: { percent: number }) => void) => () => void
        onDownloaded: (cb: (info: { version: string }) => void) => () => void
      }
      settings: {
        get: () => Promise<Record<string, string>>
        set: (key: string, value: string) => Promise<void>
      }
      memory: {
        list: (category?: string) => Promise<Array<{ id: string; category: string; content: string; createdAt: number; updatedAt: number }>>
        add: (category: string, content: string) => Promise<{ id: string; category: string; content: string; createdAt: number; updatedAt: number }>
        delete: (id: string) => Promise<void>
        update: (id: string, content: string) => Promise<void>
      }
      companion: {
        listProtagonists: () => Promise<Array<{ id: string; name: string; description: string }>>
        getActive: () => Promise<{ id: string; name: string; description: string; universeId: string }>
        requestSwitch: (roleId: string) => Promise<
          | { ok: true; catchupQueued: boolean }
          | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE' }
        >
      }
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
        }) => Promise<{ success: boolean; toolCount?: number; error?: string }>
        disconnect: (serverId: string) => Promise<{ success: boolean }>
        status: () => Promise<Array<{ id: string; name: string; status: string; toolCount: number; resourceCount?: number; error?: string }>>
        listTools: (serverId?: string) => Promise<Array<{ serverId: string; serverName: string; name: string; description: string }>>
        listResources: (serverId?: string) => Promise<Array<{
          serverId: string
          serverName: string
          uri: string
          name: string
          description?: string
          mimeType?: string
        }>>
        readResource: (serverId: string, uri: string) => Promise<{ success: boolean; content?: string; error?: string }>
        onElicitRequest: (callback: (data: {
          requestId: string
          serverId: string
          message: string
          schema: Record<string, unknown>
        }) => void) => () => void
        elicitResponse: (requestId: string, values: Record<string, unknown> | null) => void
      }
      skills: {
        list: () => Promise<Array<{
          name: string
          description: string
          when_to_use: string
          allowed_tools: string[]
          disable_model_invocation: boolean
          version: string
          source: 'builtin' | 'user'
          filePath: string
        }>>
        get: (name: string) => Promise<string | null>
        save: (name: string, content: string) => Promise<{ success: boolean; filePath: string }>
        delete: (name: string) => Promise<{ success: boolean }>
        reload: () => Promise<{ success: boolean; count: number }>
        versions: (name: string) => Promise<number[]>
        rollback: (name: string, version: number) => Promise<{ success: boolean }>
      }
      data: {
        export: () => Promise<{ success: boolean; path?: string; error?: string; stats?: { sessions: number; memories: number } }>
        import: () => Promise<{ success: boolean; error?: string; stats?: { sessions: number; memories: number; settings: number } }>
      }
      project: {
        browse: () => Promise<{ path: string; name: string } | null>
        list: () => Promise<{ path: string; name: string }[]>
        set: (dirPath: string | null) => Promise<{ success: boolean; error?: string }>
        get: () => Promise<{ path: string; name: string } | null>
        listFiles: (dirPath: string, depth?: number) => Promise<Array<{ name: string; path: string; isDir: boolean; children?: Array<{ name: string; path: string; isDir: boolean; children?: unknown[] }> }>>
        readFile: (filePath: string) => Promise<{ content?: string; size?: number; error?: string }>
      }
      debug: {
        systemPrompt: () => Promise<{
          full: string
          layers: { l1: string; l2: string; l3: string; l4: string }
          persona: { id: string; name: string }
          charCount: number
          estimatedTokens: number
        }>
        tools: () => Promise<Array<{
          name: string
          description: string
          parameters: Record<string, unknown>
          metadata: { isReadOnly: boolean; isDestructive: boolean; isConcurrencySafe: boolean }
        }>>
        systemInfo: () => Promise<{
          electron: string
          node: string
          chrome: string
          platform: string
          arch: string
          appVersion: string
          uptime: number
          memoryUsage: { rss: number; heapUsed: number; heapTotal: number }
          settings: { model: string; baseUrl: string; activeRoleId: string; hasApiKey: boolean; hasCustomPrompt: boolean }
          mcp: Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>
          toolCount: number
        }>
        traces: () => Promise<{
          spans: Array<{
            id: string
            name: string
            type: string
            caller: string
            parentId?: string
            startTime: number
            endTime?: number
            duration?: number
            status: string
            attributes: Record<string, unknown>
            error?: string
          }>
          callerStats: Record<string, unknown>
          dailyTokenUsage: unknown
        }>
      }
      chat: {
        send: (sessionId: string, userMessage: ChatMessage) => Promise<void>
        abort: (sessionId?: string) => Promise<void>
        onEvent: (callback: (event: AgentStreamEvent) => void) => () => void
        onConfirmRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => () => void
        confirmResponse: (requestId: string, approved: boolean) => void
      }
      tasks: {
        list: (sessionId?: string) => Promise<import('./shared/types').BackgroundTaskInfo[]>
        sync: (sessionId?: string) => Promise<{
          active: import('./shared/types').BackgroundTaskInfo[]
          pendingNotify: import('./shared/types').BackgroundTaskInfo[]
        }>
        cancel: (taskId: string) => Promise<boolean>
        onEvent: (callback: (event: import('./shared/types').TaskLifecycleEvent) => void) => () => void
      }
    }
  }
}
