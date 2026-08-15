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
import { formatSummonSceneBlock } from '../companion/cast/scene-prompts'
import { summonParentDelegationHint } from '../companion/cast/summon-delegation'
import { scheduleReflectionAfterChat } from '../companion/growth/reflection-service'
import {
  formatRelationshipStageForPrompt,
  resolveRelationshipStageForRole,
} from '../companion/growth/relationship-stage'
import {
  getMilestonePromptHint,
  recordAndBroadcastMilestone,
} from '../companion/growth/milestones'
import {
  formatExpertiseLevelForPrompt,
  resolveExpertiseLevel,
} from './expertise-level'
import { assertSessionRole, loadRoleAssembleInput } from '../companion/orchestrator'
import { registerStreamingProbe } from '../companion/streaming-gate'
import { maybeExtractProfile } from './profile-extractor'
import { setQuerySource } from './context-manager'
import { checkBudget, recordDailyUsage } from './token-budget'
import { ToolRegistry } from '../tools/registry'
import * as store from '../storage/session-store'
import * as settings from '../storage/settings-store'
import * as memory from '../storage/memory-store'
import {
  searchVectorStore,
  addToVectorStore,
  extractMemoryCitations,
  formatRecallForInjection,
} from '../memory/vector-store'
import type { MemoryCitation } from '../../../src/shared/types'
import { recordAssetUsage } from '../utils/asset-usage'
import { MEMORY_STRATEGY_ASSET_KEYS } from '../memory/asset-keys'
import { buildSkillSummaryForPrompt, getActiveSkill, getActiveSkillTrace, clearActiveSkill } from '../skills/registry'
import { setCurrentSessionId as setTaskPlanSessionId } from '../services/task-plan-service'
import { clearSessionSubAgents } from './subagent-registry'
import { detectReplyStance, formatReplyStanceForPrompt } from './reply-stance'
import { formatToneControlForPrompt, resolveToneControl } from './tone-control'
import { getWorkspaceRoot } from './project-memory'
import { createLogger, hashForLog } from '../utils/logger'
import {
  DEFAULT_TRACE_USER_ID,
  runWithTraceContextAsyncGen,
  updateTraceContext,
} from '../utils/trace-context'
import { startSpan } from '../utils/tracer'
import { AgentErrorCode } from '../errs'
import type { ChatMessage, LLMConfig, ExecutionMode, AgentStreamEvent, ToolContext, PromptAssetKeyList, TerminalReason } from '../../../src/shared/types'
import { taskQueue } from '../services/task-queue'
import { PROMPT_KEYS, rolePromptAssetKey } from '../prompts/keys'

const log = createLogger('Runtime')

/**
 * 决定 Runtime finally 是否需要补发 done。
 *
 * 背景：Agent Loop 本身已经会发出带 TerminalReason 的 done；Runtime 只应在
 * Loop 异常中断且尚未发出终态时补发一次，不能把 aborted / max_turns 改写成 completed。
 * 设计意图：把终态去重规则提取成纯函数，避免清理逻辑再次引入重复 done。
 * 关键约束：已有 done 永不重复发送；未收到终态的异常路径默认归为 model_error。
 */
export function resolveRuntimeDone(
  doneEmitted: boolean,
  terminalReason?: TerminalReason,
): { emit: boolean; reason: TerminalReason } {
  return {
    emit: !doneEmitted,
    reason: terminalReason ?? 'model_error',
  }
}

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

  /** 获取主对话 LLM 配置（唯一入口：loadMainLLMConfig） */
  async getLLMConfig(): Promise<LLMConfig> {
    const { loadMainLLMConfig } = await import('../llm/aux-config')
    return loadMainLLMConfig()
  }

  /** 获取辅助任务 LLM 配置（唯一入口：loadAuxLLMConfig，含 thinking 策略） */
  async getAuxLLMConfig(): Promise<LLMConfig> {
    const { loadAuxLLMConfig } = await import('../llm/aux-config')
    return loadAuxLLMConfig()
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

    // M14：整段对话在 TraceContext 内，子 span / Observer 自动带 sessionId·userId
    yield* runWithTraceContextAsyncGen(
      { sessionId, userId: DEFAULT_TRACE_USER_ID },
      () => this.chatTracked(sessionId, userMessage, toolRegistry, confirmTool),
    )
  }

  /** chat 主体（须在 TraceContext 内调用） */
  private async *chatTracked(
    sessionId: string,
    userMessage: ChatMessage,
    toolRegistry: ToolRegistry,
    confirmTool?: (name: string, args: Record<string, unknown>) => Promise<boolean>,
  ): AsyncGenerator<AgentStreamEvent & { sessionId: string }> {
    const llmConfig = await this.getLLMConfig()
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
    let terminalReason: TerminalReason | undefined
    let doneEmitted = false

    try {
      // ── 构建上下文 ──
      const customPrompt = await settings.getSetting('systemPrompt')
      const executionMode = (await settings.getSetting('executionMode') || 'auto') as ExecutionMode
      const expertiseOverride = await settings.getSetting('userExpertiseLevel')
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
      const {
        pack,
        mutableBody,
        catchupSummary,
        worldSlice,
        recentMomentsSlice,
        bookshelfSlice,
        rosterLines,
      } = await loadRoleAssembleInput(assembleRoleId)
      const persona = rolePackToPromptParts(pack, mutableBody)
      const isSummon = sessionMeta?.sessionKind === 'summon'

      const chatSpan = startSpan('chat', 'main', 'interaction', undefined, { sessionId, model: llmConfig.model })
      // 供后台 task linked span 追溯（非父子，不拉长主对话耗时）
      updateTraceContext({ interactionSpanId: chatSpan.id })

      log.info('Chat started', {
        sessionId,
        messageCount: messages.length,
        model: llmConfig.model,
        roleId: persona.id,
        activeRoleId,
        roleMismatch: mismatch,
        sessionKind: sessionMeta?.sessionKind || 'main',
      })

      const { text: vectorContext, citations: memoryCitations } =
        await this.safeVectorSearch(lastUserMsg?.content, llmConfig)
      if (memoryCitations.length > 0) {
        yield { type: 'memory_citations', items: memoryCitations, sessionId }
      }

      let skillSummary: string | undefined
      let activeSkillBody: string | undefined
      let activeSkillTrace = getActiveSkillTrace()
      try {
        skillSummary = buildSkillSummaryForPrompt() || undefined
        const active = getActiveSkill()
        if (active) {
          activeSkillBody = `Skill「${active.meta.name}」已激活，请严格遵循以下操作指南：\n\n${active.body}`
          activeSkillTrace = getActiveSkillTrace()
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
        // M26-G3：互动/执行场景组（NPC 有专文；主角走派生默认）
        let sceneBlock = ''
        try {
          sceneBlock = '\n\n' + formatSummonSceneBlock(assembleRoleId)
        } catch { /* ignore */ }
        summonNote =
          '【召唤子会话】用户正在与你单独短聊；生活世界（朋友圈/衣柜/日程）仍以当前活跃主角为准，本会话不推进你的生活世界。' +
          presenceLine +
          '\n' +
          summonParentDelegationHint() +
          sceneBlock
      }
      const sessionInfoParts = [customPrompt, summonNote].filter(Boolean)

      // M27-G1/G3：立场 + 语气收放（不拦 Loop）
      const userText = lastUserMsg?.content ?? ''
      const stance = detectReplyStance(userText, { executionMode })
      const replyStanceHint = formatReplyStanceForPrompt(stance) || undefined
      const tone = resolveToneControl({
        stance: stance.primary,
        executionMode,
        sessionKind: isSummon ? 'summon' : 'main',
        userText,
      })
      const toneControlHint = formatToneControlForPrompt(tone)
      // M28-G1：关系阶段（召唤强制陌生客人）
      let relationshipStageHint: string | undefined
      let milestoneHint: string | undefined
      let expertiseHint: string | undefined
      try {
        const rel = await resolveRelationshipStageForRole(assembleRoleId, {
          sessionKind: isSummon ? 'summon' : 'main',
        })
        relationshipStageHint = formatRelationshipStageForPrompt(rel)
        // M30-G1：主会话首次进入默契密度时记里程碑
        if (!isSummon && rel.stage === 'rapport') {
          void recordAndBroadcastMilestone(assembleRoleId, 'first_rapport', {
            roleDisplayName: persona.name,
          }).catch(() => {})
        }
        if (!isSummon) {
          milestoneHint = await getMilestonePromptHint(assembleRoleId)
        }
        // M30-G3：专家度 → 解释粒度
        const profileText = userProfile
          ? [userProfile.identity, userProfile.workflow, userProfile.voice].filter(Boolean).join('\n')
          : ''
        const recentUserTexts = messages
          .filter((m) => m.role === 'user')
          .slice(-6)
          .map((m) => m.content || '')
        const expertise = resolveExpertiseLevel({
          override: expertiseOverride,
          profileText,
          recentUserTexts,
        })
        expertiseHint = formatExpertiseLevelForPrompt(expertise)
        log.debug('Reply stance / tone / relationship / expertise', {
          stance: stance.primary,
          tone: tone.register,
          aside: tone.asidePolicy,
          relationship: rel.stage,
          expertise: expertise.level,
        })
      } catch (err) {
        log.warn('Relationship stage resolve failed', { err })
        log.debug('Reply stance / tone', {
          stance: stance.primary,
          tone: tone.register,
          aside: tone.asidePolicy,
        })
      }

      const systemPrompt = buildSystemPrompt({
        persona,
        toolNames: toolRegistry.getAll().map(t => t.name),
        userProfile: userProfile ?? undefined,
        memories: vectorContext,
        sessionInfo: sessionInfoParts.length ? sessionInfoParts.join('\n\n') : undefined,
        skillSummary,
        activeSkillBody,
        executionMode,
        // 召唤不注入生活追赶 / 世界薄片 / 近 Moment（不启用对方生活世界）
        catchupSummary: isSummon ? undefined : catchupSummary,
        worldSlice: isSummon ? undefined : worldSlice,
        recentMomentsSlice: isSummon ? undefined : recentMomentsSlice,
        bookshelfSlice: isSummon ? undefined : bookshelfSlice,
        rosterLines,
        replyStanceHint,
        toneControlHint,
        relationshipStageHint,
        milestoneHint,
        expertiseHint,
      })

      // 调用点只声明稳定 key；来源、版本与 locale 由 LLM 统一入口从注册表解析。
      // Role Pack 只标注本次实际读取的文件，动态 MUTABLE 与场景 Prompt 不冒充默认正文。
      const promptAssetKeys: PromptAssetKeyList = [
        PROMPT_KEYS.systemLayers,
        rolePromptAssetKey(assembleRoleId, 'protected.md'),
        ...(mutableBody === pack.mutableDefault
          ? [rolePromptAssetKey(assembleRoleId, 'mutable.default.md')]
          : [PROMPT_KEYS.companionMutableState]),
        ...(pack.voice?.trim() ? [rolePromptAssetKey(assembleRoleId, 'voice.md')] : []),
        ...(customPrompt?.trim() ? [PROMPT_KEYS.settingsSystemPrompt] : []),
        ...([userProfile?.identity, userProfile?.workflow, userProfile?.voice].some((value) => value?.trim())
          ? [PROMPT_KEYS.userProfileContext]
          : []),
        ...(vectorContext.trim() ? [PROMPT_KEYS.memoryRecallContext] : []),
        PROMPT_KEYS.replyStance,
        PROMPT_KEYS.toneControl,
        ...(relationshipStageHint?.trim() ? [PROMPT_KEYS.relationshipStage] : []),
        ...(milestoneHint?.trim() ? [PROMPT_KEYS.relationshipMilestones] : []),
        ...(expertiseHint?.trim() ? [PROMPT_KEYS.expertiseLevel] : []),
        ...(skillSummary?.trim() || activeSkillBody?.trim() ? [PROMPT_KEYS.skillContext] : []),
        ...(summonNote?.trim() || catchupSummary?.trim() || worldSlice?.trim()
          || recentMomentsSlice?.trim() || bookshelfSlice?.trim() || rosterLines?.trim()
          ? [PROMPT_KEYS.companionContext]
          : []),
      ]

      // ── 运行 Agent Loop ──
      const toolContext: ToolContext = {
        workdir: getWorkspaceRoot() || process.cwd(),
        sessionId,
        signal: abortController.signal,
        parentSpanId: chatSpan.id,  // 调用链嵌套（子 Agent span 可挂到父 span）
        registry: toolRegistry,     // 工具注册表（delegate_task 需要）
        executionMode,              // 父执行模式（子 Agent 权限只降不升，G4）
        roleId: assembleRoleId,     // feedback 记忆分桶（M22-G2）
        sessionKind: isSummon ? 'summon' : 'main', // M26-G2：子 Agent 任务工边界
        skillActivations: activeSkillTrace ? [activeSkillTrace] : [],
        assetUsageReporter: (report) => {
          void recordAssetUsage({
            ...report,
            sessionId,
            interactionSpanId: chatSpan.id,
            parentSpanId: chatSpan.id,
          })
        },
      }

      const stream = agentLoop(
        {
          config: llmConfig,
          messages,
          tools: toolRegistry.getAll(),
          confirmTool,
          systemPrompt,
          promptAssetKeys,
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
        if (ev.type === 'done') {
          terminalReason = ev.reason
          doneEmitted = true
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
        if (ev.type === 'done' && ev.reason === 'completed' && assistantContent && !assistantSaved) {
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
        terminalReason = 'aborted'
        log.info('Chat aborted', { sessionId, assistantContentLength: assistantContent.length })
        chatSpan.end('ok')
      } else {
        terminalReason = 'model_error'
        log.error('Chat unhandled error', { sessionId, error: message })
        chatSpan.end('error', message)
        yield { type: 'error', message, sessionId }
      }
    } finally {
      this.activeControllers.delete(sessionId)

      // 只在真正 completed 时保存完整 assistant 回复；取消 / 错误 / 超限不能把半截内容伪装成成功回复。
      if (terminalReason === 'completed' && assistantContent && !assistantSaved) {
        assistantSaved = true
        await store.saveMessage(sessionId, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
        }).catch(() => {})
      }
      const runtimeDone = resolveRuntimeDone(doneEmitted, terminalReason)
      if (runtimeDone.emit) {
        yield { type: 'done', reason: runtimeDone.reason, sessionId }
      }
      try { clearActiveSkill() } catch { /* ok */ }
      // 清理本会话的子 Agent 实例（continue 机制的实例生命周期绑定会话）
      try { clearSessionSubAgents(sessionId) } catch { /* ok */ }

      if (terminalReason === 'completed') this.sendDesktopNotification(assistantContent)
    }
  }

  /**
   * 安全的向量搜索（失败静默）。
   * 同时返回注入文本与可指认芯片（M29-G1）。
   */
  private async safeVectorSearch(
    query: string | undefined,
    llmConfig: LLMConfig,
  ): Promise<{ text?: string; citations: MemoryCitation[] }> {
    if (!query) return { citations: [] }
    try {
      const results = await searchVectorStore(query, llmConfig, { topK: 5, minScore: 0.6 })
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.vectorRecall,
        relation: 'used',
        usageKind: 'memory-operation',
        status: 'success',
        metadata: { attempted: true, resultCount: results.length },
      })
      // G5 去重（排除 SQLite 镜像）+ G2 老化告警，逻辑抽在 formatRecallForInjection 纯函数
      const output = formatRecallForInjection(results)
      const citations = extractMemoryCitations(results)
      if (output) {
        log.info('Vector recall', {
          query: query.slice(0, 50),
          resultCount: results.length,
          citationCount: citations.length,
        })
        return { text: output, citations }
      }
      return { citations: [] }
    } catch (err) {
      log.warn('Vector search skipped', { error: String(err) })
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.vectorRecall,
        relation: 'used', usageKind: 'memory-operation', status: 'error',
        metadata: { attempted: true, resultCount: 0 },
      })
    }
    return { citations: [] }
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
          sessionId,
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
        body: '回复已完成，点击查看。',
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
    const labelMeta = { labelHash: hashForLog(label), labelLength: label.length }
    const session = await store.createSession()
    const sessionId = session.id
    log.info('Headless run starting', { sessionId, ...labelMeta })

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
        log.warn('Headless denied destructive tool', { toolName: name, ...labelMeta })
        return false
      }
      return true
    }

    try {
      for await (const event of this.chat(sessionId, userMsg, toolRegistry, headlessConfirm)) {
        if (event.type === 'text') resultText += event.content
        if (event.type === 'error') {
          const errorMessage = String((event as Record<string, unknown>).message || '')
          log.error('Headless agent event error', { ...labelMeta, errorType: 'agent_event', errorLength: errorMessage.length })
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      log.error('Headless run failed', { ...labelMeta, errorType: err instanceof Error ? err.name : 'unknown', errorLength: errorMessage.length })
      throw err
    }

    log.info('Headless run completed', { ...labelMeta, resultLength: resultText.length })
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
