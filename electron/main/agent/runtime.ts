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
import { buildSystemPrompt, rolePackToPromptParts } from './prompt-builder'
import { describeCastPresence } from '../companion/cast/availability'
import { scheduleReflectionAfterChat } from '../companion/growth/reflection-service'
import { assertSessionRole, loadRoleAssembleInput } from '../companion/orchestrator'
import { registerStreamingProbe } from '../companion/streaming-gate'
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
import { clearSessionSubAgents } from './subagent-registry'
import { getWorkspaceRoot } from './project-memory'
import { createLogger } from '../utils/logger'
import { startSpan } from '../utils/tracer'
import { AgentErrorCode } from '../errs'
import type { ChatMessage, LLMConfig, ExecutionMode, AgentStreamEvent, ToolContext } from '../../../src/shared/types'
import { taskQueue } from '../services/task-queue'

const log = createLogger('Runtime')

class AgentRuntime {
  private activeControllers = new Map<string, AbortController>()

  constructor() {
    // 供 Companion Orchestrator 门控换角，避免 companion import agent
    registerStreamingProbe(() => this.activeControllers.size > 0)
  }

  /** 检查某会话是否正在执行 */
  isSessionActive(sessionId: string): boolean {
    return this.activeControllers.has(sessionId)
  }

  /** 是否存在任意进行中的流式会话 */
  hasAnyActiveSession(): boolean {
    return this.activeControllers.size > 0
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
  /**
   * 会话中心化入口：只接收本轮用户消息，历史从 session-store 加载。
   * UI 不再作为会话真相源（M13/架构：会话 Runtime 中心化）。
   */
  async *chat(
    sessionId: string,
    userMessage: ChatMessage,
    toolRegistry: ToolRegistry,
    confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>,
  ): AsyncGenerator<AgentStreamEvent & { sessionId: string }> {
    const llmConfig = await this.getLLMConfig()

    if (!llmConfig.apiKey) {
      log.error('No API key configured')
      yield { type: 'error', message: '请先在设置中配置 API Key', code: AgentErrorCode.CONFIG_MISSING_API_KEY, sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    if (this.activeControllers.has(sessionId)) {
      log.warn('Session already processing', { sessionId })
      yield { type: 'error', message: '该会话正在处理中，请等待完成或先中断', code: AgentErrorCode.SESSION_BUSY, sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    const budgetCheck = await checkBudget(sessionId)
    if (!budgetCheck.allowed) {
      log.warn('Budget exceeded', { sessionId, reason: budgetCheck.reason })
      yield { type: 'error', message: budgetCheck.reason!, code: AgentErrorCode.BUDGET_EXCEEDED, sessionId }
      yield { type: 'done', reason: 'model_error', sessionId }
      return
    }

    const abortController = new AbortController()
    this.activeControllers.set(sessionId, abortController)

    setTaskPlanSessionId(sessionId)

    // 先落盘用户消息，再从 DB 组装完整历史（避免 UI 本地数组与库不一致）
    if (userMessage.role === 'user') {
      await store.saveMessage(sessionId, userMessage)
    }
    const session = await store.getSession(sessionId)
    const messages = session?.messages ?? [userMessage]
    const lastUserMsg = userMessage.role === 'user'
      ? userMessage
      : messages.filter(m => m.role === 'user').at(-1)
    await store.autoTitle(sessionId)

    let assistantContent = ''
    let assistantSaved = false

    try {
      // ── 构建上下文 ──
      const customPrompt = await settings.getSetting('systemPrompt')
      const executionMode = (await settings.getSetting('executionMode') || 'auto') as ExecutionMode
      // 会话绑定 role_id 优先；与 active 不一致时仍按会话组装（禁止中途换角偷换人设）
      const sessionMeta = await store.getSession(sessionId)
      const { assembleRoleId, activeRoleId, mismatch } = await assertSessionRole(sessionMeta?.roleId)
      if (mismatch) {
        log.warn('Session role differs from activeRoleId; assembling with session binding', {
          sessionId,
          sessionRoleId: assembleRoleId,
          activeRoleId,
        })
      }
      // feedback 按会话主角分桶注入（M22-G2）
      const userProfile = await memory.buildUserProfile(assembleRoleId)
      const { pack, mutableBody, catchupSummary, rosterLines } = await loadRoleAssembleInput(assembleRoleId)
      const persona = rolePackToPromptParts(pack, mutableBody)
      const isSummon = sessionMeta?.sessionKind === 'summon'

      const chatSpan = startSpan('chat', 'main', 'interaction', undefined, { sessionId, model: llmConfig.model })

      log.info('Chat started', {
        sessionId,
        messageCount: messages.length,
        model: llmConfig.model,
        roleId: persona.id,
        activeRoleId,
        roleMismatch: mismatch,
        sessionKind: sessionMeta?.sessionKind || 'main',
      })

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

      let summonNote: string | undefined
      if (isSummon) {
        let presenceLine = ''
        try {
          const presence = await describeCastPresence(assembleRoleId)
          if (presence) {
            presenceLine = `\n你此刻的情境（来自日程摘要，可自然带一点，勿编造额外行程）：${presence}`
          }
        } catch { /* ignore */ }
        summonNote =
          '【召唤子会话】用户正在与你单独短聊；生活世界（朋友圈/衣柜/日程）仍以当前活跃主角为准，本会话不推进你的生活世界。' +
          presenceLine
      }
      const sessionInfoParts = [customPrompt, summonNote].filter(Boolean)

      const systemPrompt = buildSystemPrompt({
        persona,
        toolNames: toolRegistry.getAll().map(t => t.name),
        userProfile: userProfile ?? undefined,
        memories: vectorContext,
        sessionInfo: sessionInfoParts.length ? sessionInfoParts.join('\n\n') : undefined,
        skillSummary,
        activeSkillBody,
        executionMode,
        // 召唤不注入生活追赶摘要（不启用对方生活世界）
        catchupSummary: isSummon ? undefined : catchupSummary,
        rosterLines,
      })

      // ── 运行 Agent Loop ──
      const toolContext: ToolContext = {
        workdir: getWorkspaceRoot() || process.cwd(),
        sessionId,
        signal: abortController.signal,
        parentSpanId: chatSpan.id,  // 调用链嵌套（子 Agent span 可挂到父 span）
        registry: toolRegistry,     // 工具注册表（delegate_task 需要）
        executionMode,              // 父执行模式（子 Agent 权限只降不升，G4）
        roleId: assembleRoleId,     // feedback 记忆分桶（M22-G2）
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
        if (ev.type === 'execution_mode_changed') {
          // 安全降级必须跨当前 loop 生效到后续请求，避免下次对话又恢复 auto。
          await settings.setSetting('executionMode', ev.mode)
          log.warn('Execution mode persisted after runtime downgrade', {
            sessionId,
            mode: ev.mode,
            reason: ev.reason,
          })
        }
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
          this.enqueuePostTasks(
            sessionId,
            messages,
            assistantContent,
            lastUserMsg,
            auxConfig,
            {
              roleId: assembleRoleId,
              sessionKind: sessionMeta?.sessionKind,
            },
          )
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
      // 清理本会话的子 Agent 实例（continue 机制的实例生命周期绑定会话）
      try { clearSessionSubAgents(sessionId) } catch { /* ok */ }

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

  /** 将对话完成后的后台任务加入 TaskQueue（M11 任务生命周期） */
  private enqueuePostTasks(
    sessionId: string,
    messages: ChatMessage[],
    assistantContent: string,
    lastUserMsg: ChatMessage | undefined,
    llmConfig: LLMConfig,
    companion?: { roleId: string; sessionKind?: string },
  ): void {
    taskQueue.enqueue(sessionId, 'profile-extract', async () => {
      setQuerySource('memory')
      try {
        await maybeExtractProfile(messages, llmConfig, assistantContent, {
          roleId: companion?.roleId,
        })
      } finally {
        setQuerySource(null)
      }
    })

    taskQueue.enqueue(sessionId, 'smart-title', async () => {
      setQuerySource('title')
      try {
        await store.generateSmartTitle(sessionId, lastUserMsg?.content || '', assistantContent, llmConfig)
      } finally {
        setQuerySource(null)
      }
    })

    if (lastUserMsg?.content && lastUserMsg.content.length > 20) {
      const now = Date.now()
      taskQueue.enqueue(sessionId, 'vector-index-user', () => addToVectorStore({
        id: `conv-user-${now}`,
        text: lastUserMsg.content.slice(0, 500),
        category: 'conversation',
        sessionId,
        timestamp: now,
      }, llmConfig))
    }

    // G1 自我强化循环修复：不再把 assistant 原始回复写入向量库。
    // 只索引用户消息作为语义召回源（Alice Ch.5 陷阱）。

    if (companion?.roleId) {
      void scheduleReflectionAfterChat(
        companion.roleId,
        sessionId,
        llmConfig,
        { sessionKind: companion.sessionKind },
      )
    }
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
    const label = taskName || 'headless'
    const session = await store.createSession()
    const sessionId = session.id
    log.info(`Headless run starting: ${label}`, { sessionId })

    const userMsg: ChatMessage = {
      id: `headless-user-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }

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
      for await (const event of this.chat(sessionId, userMsg, toolRegistry, headlessConfirm)) {
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
    await taskQueue.shutdown()
    log.info('Runtime shutdown complete')
  }
}

export const runtime = new AgentRuntime()

// Register headless runner with Scheduler
import { setHeadlessRunner } from '../scheduler/index'
setHeadlessRunner((prompt, taskName) => runtime.runHeadless(prompt, taskName))
