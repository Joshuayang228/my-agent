/**
 * Agent Runtime — 统一管理会话生命周期和后台任务。
 *
 * 职责：
 * - 维护 per-session 并发锁（AbortController）
 * - 编排 Agent Loop 执行（构建 prompt → 运行循环 → 消费事件）
 * - 管理后台 fire-and-forget 任务队列（画像提取、向量索引、智能标题）
 * - 提供统一的 start/abort 接口给 IPC 层
 *
 * Alice 方法论 Ch.2：Runtime 是编排层，持有 LLM/MCP/存储，chat() 统一入口。
 */

import { BrowserWindow, Notification } from 'electron'
import { agentLoop } from './loop'
import { buildSystemPrompt, BUILTIN_PERSONAS } from './prompt-builder'
import { maybeExtractProfile } from './profile-extractor'
import { setQuerySource } from './context-manager'
import { checkBudget, recordDailyUsage } from './token-budget'
import { ToolRegistry } from '../tools/registry'
import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import * as memory from '../storage/memory-store'
import { searchVectorStore, addToVectorStore, formatRecallForInjection } from '../memory/vector-store'
import { buildSkillSummaryForPrompt, getActiveSkill, clearActiveSkill } from '../skills/registry'
import { setCurrentSessionId as setTaskPlanSessionId } from '../services/task-plan-service'
import { getWorkspaceRoot } from './project-memory'
import { createLogger } from '../utils/logger'
import { startSpan } from '../utils/tracer'
import type { ChatMessage, LLMConfig, ExecutionMode, AgentStreamEvent, ToolContext } from '../../../src/shared/types'

const log = createLogger('Runtime')

/** 后台任务（fire-and-forget），失败只记日志 */
interface BackgroundTask {
  name: string
  fn: () => Promise<void>
}

class AgentRuntime {
  private activeControllers = new Map<string, AbortController>()
  private backgroundQueue: BackgroundTask[] = []
  private processingBackground = false

  /** 检查某会话是否正在执行 */
  isSessionActive(sessionId: string): boolean {
    return this.activeControllers.has(sessionId)
  }

  /** 中断指定会话或全部会话 */
  abort(sessionId?: string): void {
    if (sessionId) {
      const ctrl = this.activeControllers.get(sessionId)
      if (ctrl) {
        log.info('Session aborted', { sessionId })
        ctrl.abort()
        this.activeControllers.delete(sessionId)
      }
    } else {
      log.info('All sessions aborted', { count: this.activeControllers.size })
      for (const ctrl of this.activeControllers.values()) ctrl.abort()
      this.activeControllers.clear()
    }
  }

  /** 获取主对话 LLM 配置 */
  async getLLMConfig(): Promise<LLMConfig> {
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

  /** 获取辅助任务 LLM 配置（标题/画像/摘要用便宜模型） */
  async getAuxLLMConfig(): Promise<LLMConfig> {
    const main = await this.getLLMConfig()
    const auxModel = await settings.getSetting('auxModel')
    if (auxModel) {
      return { ...main, model: auxModel }
    }
    return main
  }

  /**
   * 主入口 — 启动会话的 Agent 循环。
   * 返回 AsyncGenerator 让 IPC 层消费事件并转发到渲染进程。
   */
  async *chat(
    sessionId: string,
    messages: ChatMessage[],
    toolRegistry: ToolRegistry,
    confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>,
  ): AsyncGenerator<AgentStreamEvent & { sessionId: string }> {
    const llmConfig = await this.getLLMConfig()

    if (!llmConfig.apiKey) {
      log.error('No API key configured')
      yield { type: 'error', message: '请先在设置中配置 API Key', sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    if (this.activeControllers.has(sessionId)) {
      log.warn('Session already processing', { sessionId })
      yield { type: 'error', message: '该会话正在处理中，请等待完成或先中断', sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    const budgetCheck = await checkBudget(sessionId)
    if (!budgetCheck.allowed) {
      log.warn('Budget exceeded', { sessionId, reason: budgetCheck.reason })
      yield { type: 'error', message: budgetCheck.reason!, sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    const abortController = new AbortController()
    this.activeControllers.set(sessionId, abortController)

    setTaskPlanSessionId(sessionId)

    const lastUserMsg = messages[messages.length - 1]
    if (lastUserMsg?.role === 'user') {
      await store.saveMessage(sessionId, lastUserMsg)
    }
    await store.autoTitle(sessionId)

    let assistantContent = ''
    let assistantSaved = false

    try {
      // ── 构建上下文 ──
      const personaId = await settings.getSetting('personaId')
      const customPrompt = await settings.getSetting('systemPrompt')
      const executionMode = (await settings.getSetting('executionMode') || 'auto') as ExecutionMode
      const userProfile = await memory.buildUserProfile()
      const persona = BUILTIN_PERSONAS.find(p => p.id === personaId) ?? BUILTIN_PERSONAS[0]

      const chatSpan = startSpan('chat', 'main', 'interaction', undefined, { sessionId, model: llmConfig.model })

      log.info('Chat started', { sessionId, messageCount: messages.length, model: llmConfig.model, persona: persona.id })

      const vectorContext = await this.safeVectorSearch(lastUserMsg?.content, llmConfig)

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
        memories: vectorContext,
        sessionInfo: customPrompt || undefined,
        skillSummary,
        activeSkillBody,
        executionMode,
      })

      // ── 运行 Agent Loop ──
      const toolContext: ToolContext = {
        workdir: getWorkspaceRoot() || process.cwd(),
        sessionId,
        signal: abortController.signal,
      }

      const stream = agentLoop(
        {
          config: llmConfig,
          messages,
          tools: toolRegistry.getAll(),
          confirmTool,
          systemPrompt,
          signal: abortController.signal,
          executionMode,
          toolContext,
          interactionSpanId: chatSpan.id,  // 传入父 span ID，使 loop 内的子 span 形成调用链树
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

      // ── 消费事件流 ──
      for await (const ev of stream) {
        yield { ...ev, sessionId } as AgentStreamEvent & { sessionId: string }

        if (ev.type === 'text') {
          assistantContent += ev.content
        }
        if (ev.type === 'usage') {
          store.addTokenUsage(sessionId, ev.promptTokens, ev.completionTokens).catch(() => {})
          recordDailyUsage(ev.promptTokens, ev.completionTokens)
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

          chatSpan.setAttribute('assistantContentLength', assistantContent.length)
          chatSpan.end('ok')

          const auxConfig = await this.getAuxLLMConfig()
          this.enqueuePostTasks(sessionId, messages, assistantContent, lastUserMsg, auxConfig)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (abortController.signal.aborted) {
        log.info('Chat aborted', { sessionId, assistantContentLength: assistantContent.length })
        chatSpan.end('ok')
      } else {
        log.error('Chat unhandled error', { sessionId, error: message })
        chatSpan.end('error', message)
        yield { type: 'error', message, sessionId }
      }
    } finally {
      this.activeControllers.delete(sessionId)

      if (assistantContent && !assistantSaved) {
        assistantSaved = true
        await store.saveMessage(sessionId, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        }).catch(() => {})
      }
      yield { type: 'done', reason: 'completed' as const, sessionId }
      try { clearActiveSkill() } catch { /* ok */ }

      this.sendDesktopNotification(assistantContent)
    }
  }

  /** 安全的向量搜索（失败静默） */
  private async safeVectorSearch(query: string | undefined, llmConfig: LLMConfig): Promise<string | undefined> {
    if (!query) return undefined
    try {
      const results = await searchVectorStore(query, llmConfig, { topK: 5, minScore: 0.6 })
      // G5 去重（排除 SQLite 镜像）+ G2 老化告警，逻辑抽在 formatRecallForInjection 纯函数
      const output = formatRecallForInjection(results)
      if (output) {
        log.info('Vector recall', { query: query.slice(0, 50), resultCount: results.length })
        return output
      }
    } catch (err) {
      log.warn('Vector search skipped', { error: String(err) })
    }
    return undefined
  }

  /** 将对话完成后的后台任务加入队列 */
  private enqueuePostTasks(
    sessionId: string,
    messages: ChatMessage[],
    assistantContent: string,
    lastUserMsg: ChatMessage | undefined,
    llmConfig: LLMConfig,
  ): void {
    this.backgroundQueue.push({
      name: 'profile-extract',
      fn: async () => {
        setQuerySource('memory')
        try {
          await maybeExtractProfile(messages, llmConfig, assistantContent)
        } finally {
          setQuerySource(null)
        }
      },
    })

    this.backgroundQueue.push({
      name: 'smart-title',
      fn: async () => {
        setQuerySource('title')
        try {
          await store.generateSmartTitle(sessionId, lastUserMsg?.content || '', assistantContent, llmConfig)
        } finally {
          setQuerySource(null)
        }
      },
    })

    if (lastUserMsg?.content && lastUserMsg.content.length > 20) {
      const now = Date.now()
      this.backgroundQueue.push({
        name: 'vector-index-user',
        fn: () => addToVectorStore({
          id: `conv-user-${now}`,
          text: lastUserMsg.content.slice(0, 500),
          category: 'conversation',
          sessionId,
          timestamp: now,
        }, llmConfig),
      })
    }

    // G1 自我强化循环修复：不再把 assistant 原始回复写入向量库。
    // 否则下一轮检索会把「AI 自己刚说的话」当记忆召回喂回自己（Alice Ch.5 陷阱）。
    // assistant 输出里真正有价值的信息，由 profile-extractor 提炼成结构化记忆存 SQLite，
    // 而不是整段回复堆进向量库。只索引用户消息作为语义召回源。

    this.processBackgroundQueue()
  }

  /** 串行处理后台任务队列（避免并发写冲突） */
  private async processBackgroundQueue(): Promise<void> {
    if (this.processingBackground) return
    this.processingBackground = true

    while (this.backgroundQueue.length > 0) {
      const task = this.backgroundQueue.shift()!
      try {
        await task.fn()
      } catch (err) {
        log.warn(`Background task failed: ${task.name}`, { error: String(err) })
      }
    }

    this.processingBackground = false
  }

  /** 窗口失焦时发送桌面通知 */
  private sendDesktopNotification(content: string): void {
    if (!content) return
    const win = BrowserWindow.getAllWindows()[0]
    if (win && !win.isFocused() && Notification.isSupported()) {
      const n = new Notification({
        title: 'My Agent',
        body: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        silent: false,
      })
      n.on('click', () => { win.show(); win.focus() })
      n.show()
    }
  }

  /**
   * Headless 执行 — 无 UI 运行 Agent（用于定时任务/后台任务）。
   * 创建临时会话，执行 Agent Loop，收集结果文本并返回。
   */
  async runHeadless(prompt: string, taskName?: string): Promise<string> {
    const sessionId = `headless_${Date.now()}`
    const label = taskName || 'headless'
    log.info(`Headless run starting: ${label}`, { sessionId })

    const userMsg: ChatMessage = { role: 'user', content: prompt }
    const toolRegistry = new ToolRegistry()
    const { builtinTools } = await import('../tools/builtins/index')
    for (const tool of builtinTools) {
      toolRegistry.register(tool)
    }

    let resultText = ''

    // Headless approval policy: auto-approve read-only and known-safe tools,
    // deny truly dangerous operations (like shell_exec with unknown commands).
    const HEADLESS_DENY_TOOLS = new Set(['shell_exec'])
    const headlessConfirm = async (name: string, _args: Record<string, unknown>) => {
      const tool = toolRegistry.get(name)
      if (tool?.metadata.isReadOnly) return true
      if (HEADLESS_DENY_TOOLS.has(name)) {
        log.warn(`Headless: denied destructive tool ${name}`)
        return false
      }
      return true
    }

    try {
      for await (const event of this.chat(sessionId, [userMsg], toolRegistry, headlessConfirm)) {
        if (event.type === 'text') resultText += event.content
        if (event.type === 'error') {
          log.error(`Headless error: ${label}`, { message: (event as Record<string, unknown>).message })
        }
      }
    } catch (err) {
      log.error(`Headless run failed: ${label}`, { error: err instanceof Error ? err.message : String(err) })
      throw err
    }

    log.info(`Headless run completed: ${label}`, { resultLength: resultText.length })
    return resultText
  }

  /** 优雅关闭 — 中断所有活跃会话，等待后台任务完成 */
  async shutdown(): Promise<void> {
    log.info('Runtime shutting down')
    this.abort()
    while (this.processingBackground) {
      await new Promise(r => setTimeout(r, 100))
    }
    log.info('Runtime shutdown complete')
  }
}

export const runtime = new AgentRuntime()

// Register headless runner with Scheduler
import { setHeadlessRunner } from '../scheduler/index'
setHeadlessRunner((prompt, taskName) => runtime.runHeadless(prompt, taskName))
