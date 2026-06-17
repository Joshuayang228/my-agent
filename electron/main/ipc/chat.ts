import { ipcMain, BrowserWindow, Notification } from 'electron'
import { agentLoop } from '../agent/loop'
import { buildSystemPrompt, BUILTIN_PERSONAS } from '../agent/prompt-builder'
import { maybeExtractProfile } from '../agent/profile-extractor'
import { ToolRegistry } from '../tools/registry'
import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import * as memory from '../storage/memory-store'
import { searchVectorStore, addToVectorStore } from '../memory/vector-store'
import { buildSkillSummaryForPrompt, getActiveSkill, clearActiveSkill } from '../skills/registry'
import { createLogger } from '../utils/logger'
import type { ChatMessage, LLMConfig, ExecutionMode } from '../../../src/shared/types'

const log = createLogger('ChatIPC')

const activeControllers = new Map<string, AbortController>()

async function getLLMConfig(): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
    temperature: parseFloat(s.llmTemperature) || undefined,
    topP: parseFloat(s.llmTopP) || undefined,
    maxTokens: parseInt(s.llmMaxTokens) || undefined,
  }
}

export function registerChatIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('ping', () => 'pong')

  ipcMain.handle('chat:abort', (_event, sessionId?: string) => {
    if (sessionId) {
      const ctrl = activeControllers.get(sessionId)
      if (ctrl) {
        log.info('Chat aborted by user', { sessionId })
        ctrl.abort()
        activeControllers.delete(sessionId)
      }
    } else {
      log.info('All chats aborted by user', { count: activeControllers.size })
      for (const ctrl of activeControllers.values()) ctrl.abort()
      activeControllers.clear()
    }
  })

  ipcMain.handle('chat:send', async (event, sessionId: string, messages: ChatMessage[]) => {
    const llmConfig = await getLLMConfig()
    const personaId = await settings.getSetting('personaId')
    const customPrompt = await settings.getSetting('systemPrompt')
    const executionMode = (await settings.getSetting('executionMode') || 'auto') as ExecutionMode
    const userProfile = await memory.buildUserProfile()

    const persona = BUILTIN_PERSONAS.find(p => p.id === personaId) ?? BUILTIN_PERSONAS[0]
    log.info('chat:send received', { sessionId, messageCount: messages.length, model: llmConfig.model, persona: persona.id })

    const emit = (ev: Record<string, unknown>) => {
      event.sender.send('chat:event', { ...ev, sessionId })
    }

    if (!llmConfig.apiKey) {
      log.error('No API key configured')
      emit({ type: 'error', message: '请先在设置中配置 API Key' })
      emit({ type: 'done' })
      return
    }

    if (activeControllers.has(sessionId)) {
      log.warn('Session already processing', { sessionId })
      emit({ type: 'error', message: '该会话正在处理中，请等待完成或先中断' })
      emit({ type: 'done' })
      return
    }

    const abortController = new AbortController()
    activeControllers.set(sessionId, abortController)

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

      const combinedMemories = vectorContext || undefined

      let skillSummary: string | undefined
      let activeSkillBody: string | undefined
      try {
        skillSummary = buildSkillSummaryForPrompt() || undefined
        const active = getActiveSkill()
        if (active) {
          activeSkillBody = `Skill「${active.meta.name}」已激活，请严格遵循以下操作指南：\n\n${active.body}`
        }
      } catch { /* skill system not ready */ }

      const systemPrompt = buildSystemPrompt({
        persona,
        toolNames: toolRegistry.getAll().map(t => t.name),
        userProfile: userProfile ?? undefined,
        memories: combinedMemories,
        sessionInfo: customPrompt || undefined,
        skillSummary,
        activeSkillBody,
        executionMode,
      })

      const stream = agentLoop(
        {
          config: llmConfig,
          messages,
          tools: toolRegistry.getAll(),
          confirmTool,
          systemPrompt,
          signal: abortController.signal,
          executionMode,
          filterTools: (allTools) => {
            const active = getActiveSkill()
            if (active?.meta.allowed_tools?.length) {
              const allowed = new Set(active.meta.allowed_tools)
              return allTools.filter(t => allowed.has(t.name) || t.name.startsWith('skill_invoke_'))
            }
            return allTools
          },
        },
        toolRegistry,
      )

      for await (const ev of stream) {
        emit(ev)

        if (ev.type === 'text') {
          assistantContent += ev.content
        }
        if (ev.type === 'usage') {
          store.addTokenUsage(sessionId, ev.promptTokens, ev.completionTokens).catch(() => {})
        }
        if (ev.type === 'tool_calls') {
          await store.saveMessage(sessionId, {
            id: `assistant-tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            toolCalls: ev.calls,
          })
        }
        if (ev.type === 'tool_end') {
          await store.saveMessage(sessionId, {
            id: `tool-${ev.callId}`,
            role: 'tool',
            content: ev.result,
            timestamp: Date.now(),
            toolCallId: ev.callId,
          })
        }
        if (ev.type === 'done' && assistantContent && !assistantSaved) {
          assistantSaved = true
          await store.saveMessage(sessionId, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent,
            timestamp: Date.now(),
          })

          maybeExtractProfile(messages, llmConfig, assistantContent).catch((e) =>
            log.warn('Profile extraction failed', { error: String(e) }))

          store.generateSmartTitle(sessionId, lastUserMsg?.content || '', assistantContent, llmConfig).catch(() => {})

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
        emit({ type: 'error', message })
      }
    } finally {
      activeControllers.delete(sessionId)

      if (assistantContent && !assistantSaved) {
        assistantSaved = true
        await store.saveMessage(sessionId, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        }).catch(() => {})
      }
      emit({ type: 'done' })
      try { clearActiveSkill() } catch { /* ok */ }

      if (assistantContent) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isFocused() && Notification.isSupported()) {
          const n = new Notification({
            title: 'My Agent',
            body: assistantContent.slice(0, 100) + (assistantContent.length > 100 ? '...' : ''),
            silent: false,
          })
          n.on('click', () => { win.show(); win.focus() })
          n.show()
        }
      }
    }
  })
}
