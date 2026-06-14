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
      persona: {
        list: () => Promise<Array<{ id: string; name: string; description: string }>>
        getCurrent: () => Promise<{ id: string; name: string; description: string }>
      }
      chat: {
        send: (sessionId: string, messages: ChatMessage[]) => Promise<void>
        onEvent: (callback: (event: AgentStreamEvent) => void) => () => void
        onConfirmRequest: (callback: (data: { requestId: string; name: string; args: Record<string, unknown> }) => void) => () => void
        confirmResponse: (requestId: string, approved: boolean) => void
      }
    }
  }
}
