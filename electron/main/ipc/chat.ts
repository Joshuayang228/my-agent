import { ipcMain } from 'electron'
import { agentLoop } from '../agent/loop'
import { buildSystemPrompt, BUILTIN_PERSONAS } from '../agent/prompt-builder'
import { maybeExtractProfile } from '../agent/profile-extractor'
import { ToolRegistry } from '../tools/registry'
import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import * as memory from '../storage/memory-store'
import { searchVectorStore, addToVectorStore } from '../memory/vector-store'
import { createLogger } from '../utils/logger'
import type { ChatMessage, LLMConfig } from '../../../src/shared/types'

const log = createLogger('ChatIPC')

let activeAbortController: AbortController | null = null

async function getLLMConfig(): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
  }
}

export function registerChatIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('chat:abort', () => {
    if (activeAbortController) {
      log.info('Chat aborted by user')
      activeAbortController.abort()
      activeAbortController = null
    }
  })

  ipcMain.handle('chat:send', async (event, sessionId: string, messages: ChatMessage[]) => {
    const llmConfig = await getLLMConfig()
    const personaId = await settings.getSetting('personaId')
    const customPrompt = await settings.getSetting('systemPrompt')
    const memoryContext = await memory.buildMemoryContext()
    const userProfile = await memory.buildUserProfile()

    const persona = BUILTIN_PERSONAS.find(p => p.id === personaId) ?? BUILTIN_PERSONAS[0]
    log.info('chat:send received', { sessionId, messageCount: messages.length, model: llmConfig.model, persona: persona.id })

    if (!llmConfig.apiKey) {
      log.error('No API key configured')
      event.sender.send('chat:event', { type: 'error', message: '请先在设置中配置 API Key' })
      event.sender.send('chat:event', { type: 'done' })
      return
    }

    const abortController = new AbortController()
    activeAbortController = abortController

    const lastUserMsg = messages[messages.length - 1]
    if (lastUserMsg?.role === 'user') {
      await store.saveMessage(sessionId, lastUserMsg)
    }

    await store.autoTitle(sessionId)

    let assistantContent = ''
    let assistantSaved = false

    try {
      const confirmTool = (name: string, args: Record<string, unknown>): Promise<boolean> => {
        return new Promise((resolve) => {
          const requestId = `confirm-${Date.now()}`
          event.sender.send('tool:confirm-request', { requestId, name, args })
          ipcMain.once(`tool:confirm-response:${requestId}`, (_e, approved: boolean) => {
            resolve(approved)
          })
          setTimeout(() => resolve(false), 60_000)
        })
      }

      // 语义检索：用用户最新消息召回相关长期记忆
      let vectorContext = ''
      if (lastUserMsg?.content) {
        try {
          const results = await searchVectorStore(lastUserMsg.content, llmConfig, { topK: 5, minScore: 0.6 })
          if (results.length > 0) {
            vectorContext = results.map(r => `- [${r.category}] ${r.text}`).join('\n')
            log.info('Vector recall', { query: lastUserMsg.content.slice(0, 50), resultCount: results.length })
          }
        } catch (err) {
          log.warn('Vector search skipped', { error: String(err) })
        }
      }

      const combinedMemories = [memoryContext, vectorContext].filter(Boolean).join('\n\n')

      const systemPrompt = buildSystemPrompt({
        persona,
        toolNames: toolRegistry.getAll().map(t => t.name),
        userProfile: userProfile ?? undefined,
        memories: combinedMemories || undefined,
        sessionInfo: customPrompt || undefined,
      })

      const stream = agentLoop(
        {
          config: llmConfig,
          messages,
          tools: toolRegistry.getAll(),
          confirmTool,
          systemPrompt,
          signal: abortController.signal,
        },
        toolRegistry,
      )

      for await (const ev of stream) {
        event.sender.send('chat:event', ev)

        if (ev.type === 'text') {
          assistantContent += ev.content
        }
        if (ev.type === 'done' && assistantContent && !assistantSaved) {
          assistantSaved = true
          await store.saveMessage(sessionId, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            timestamp: Date.now(),
          })

          maybeExtractProfile(messages, llmConfig).catch((e) =>
            log.warn('Profile extraction failed', { error: String(e) }))

          // 异步写入向量索引（用户消息 + 助手摘要）
          const now = Date.now()
          if (lastUserMsg?.content && lastUserMsg.content.length > 20) {
            addToVectorStore({
              id: `conv-user-${now}`,
              text: lastUserMsg.content.slice(0, 500),
              category: 'conversation',
              sessionId,
              timestamp: now,
            }, llmConfig).catch(() => {})
          }
          if (assistantContent.length > 50) {
            addToVectorStore({
              id: `conv-assistant-${now}`,
              text: assistantContent.slice(0, 500),
              category: 'conversation',
              sessionId,
              timestamp: now,
            }, llmConfig).catch(() => {})
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (abortController.signal.aborted) {
        log.info('Chat send aborted', { assistantContentLength: assistantContent.length })
      } else {
        log.error('chat:send unhandled error', { error: message })
        event.sender.send('chat:event', { type: 'error', message })
      }
    } finally {
      activeAbortController = null

      if (assistantContent && !assistantSaved) {
        assistantSaved = true
        await store.saveMessage(sessionId, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        }).catch(() => {})
      }
      event.sender.send('chat:event', { type: 'done' })
    }
  })
}
