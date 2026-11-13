/**
 * Debug IPC — 暴露 Agent 内部状态给 DevPanel
 *
 * 遵循架构分层：ipc/ → agent/, tools/, storage/, memory/, mcp/
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { registerSecureIpcHandler } from './ipc-security'
import type { DebugTracesSnapshot } from '../../../src/shared/types'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ToolRegistry } from '../tools/registry'
import { characterDefinitionFromRolePack, compileMainChatPrompt } from '../prompts/compiler'
import { getPromptAssets, getPromptAssetTraces } from '../prompts/registry'
import { getCharacterPromptAssetKeys } from '../prompts/dependencies'
import { PROMPT_KEYS } from '../prompts/keys'
import { loadActiveAssembleInput } from '../companion/orchestrator'
import { getAllSettings } from '../storage/settings-store'
import { buildUserProfile } from '../storage/memory-store'
import { createLogger } from '../utils/logger'
import { getRecentSpans, getCallerStats, getTokenLaneStats } from '../utils/tracer'
import { getDailyUsage } from '../agent/token-budget'
import { getPersonaEvalReport, listPersonaEvalReports } from '../debug/persona-eval-reports'
import { getSkillEvalReport, listSkillEvalReports } from '../debug/skill-eval-reports'
import { DebugEvalRunner } from '../debug/eval-runner'
import { getModelContextAssets } from '../debug/model-context-assets'
import { getDebugEvidenceScope, queryCompanionEvidence } from '../debug/companion-evidence'
import { queryDiagnosticHistory } from '../debug/diagnostic-history-service'
import { assetUsageStore } from '../storage/asset-usage-store'
import {
  llmDebugStore,
} from '../storage/llm-debug-store'
import type {
  AgentAssetUsageQuery,
  DebugEvalSuite,
  LLMCallQuery,
  PersonaEvalHumanReviewDeleteInput,
  PersonaEvalHumanReviewInput,
} from '../../../src/shared/types'
import {
  deletePersonaEvalHumanReview,
  listPersonaEvalHumanReviews,
  upsertPersonaEvalHumanReview,
} from '../storage/persona-eval-review-store'

const log = createLogger('DebugIPC')
let llmDebugUnsubscribe: (() => void) | null = null
let evalRunner: DebugEvalRunner | null = null
let evalRunnerUnsubscribe: (() => void) | null = null

export function registerDebugIPC(toolRegistry: ToolRegistry): void {
  registerSecureIpcHandler('debug:history-query', (_event, input: unknown) => {
    try { return queryDiagnosticHistory(input) } catch { log.warn('Diagnostic history query rejected or unavailable'); throw new Error('无法读取运行历史，请检查查询范围后重试') }
  })
  registerSecureIpcHandler('debug:companion-evidence-scope', () => {
    try { return getDebugEvidenceScope() } catch { log.warn('Debug evidence scope unavailable'); throw new Error('无法读取人物诊断范围') }
  })
  registerSecureIpcHandler('debug:companion-evidence-query', (_event, input: unknown) => {
    try { return queryCompanionEvidence(input) } catch { log.warn('Debug evidence query rejected or unavailable'); throw new Error('无法读取诊断证据，请检查人物、日期与查询范围') }
  })
  if (!evalRunner) {
    evalRunner = new DebugEvalRunner(process.env.APP_ROOT || process.cwd())
  }
  if (!evalRunnerUnsubscribe) {
    evalRunnerUnsubscribe = evalRunner.subscribe((payload) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('debug:eval-run-event', payload)
      }
    })
  }
  if (!llmDebugUnsubscribe) {
    llmDebugUnsubscribe = llmDebugStore.subscribe((event) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('debug:llm-call-event', event)
      }
    })
  }

  registerSecureIpcHandler('debug:system-prompt', async () => {
    try {
      const settings = await getAllSettings()
      const { pack, mutableBody } = await loadActiveAssembleInput()
      const character = characterDefinitionFromRolePack(pack, mutableBody)
      const toolNames = toolRegistry.getAll().map(t => t.name)

      let userProfile: { identity: string; workflow: string; voice: string } | undefined
      try {
        const profile = await buildUserProfile()
        if (profile) userProfile = profile
      } catch { /* memory not available */ }

      const customPrompt = settings.systemPrompt || undefined
      const compiled = compileMainChatPrompt({
        character,
        platform: { toolNames },
        behavior: {
          key: 'main-chat',
          purpose: '在当前人物与会话情境中回应用户并完成请求。',
          customInstructions: customPrompt,
        },
        situation: { userProfile },
        currentDate: new Date().toLocaleDateString('sv-SE'),
      })

      return {
        full: compiled.text,
        modules: compiled.modules,
        persona: { id: character.id, name: character.name },
        charCount: compiled.text.length,
        estimatedTokens: Math.ceil(compiled.text.length / 3.5),
        assets: getPromptAssetTraces([
          PROMPT_KEYS.promptCompiler, ...getCharacterPromptAssetKeys(pack, mutableBody),
          ...(customPrompt?.trim() ? [PROMPT_KEYS.settingsSystemPrompt] : []),
          ...([userProfile?.identity, userProfile?.workflow, userProfile?.voice].some((value) => value?.trim()) ? [PROMPT_KEYS.userProfileContext] : []),
        ]),
      }
    } catch (err) {
      log.error('Failed to build debug prompt', { error: String(err) })
      return {
        full: '(error)',
        modules: [],
        persona: { id: '', name: '' },
        charCount: 0,
        estimatedTokens: 0,
        assets: [],
      }
    }
  })

  /** Prompt 资产目录：由主进程生产代码和 Role Pack 资产生成，前端不维护副本。 */
  registerSecureIpcHandler('debug:prompt-assets', () => getPromptAssets())
  registerSecureIpcHandler('debug:model-context-assets', () => getModelContextAssets(toolRegistry))

  registerSecureIpcHandler('debug:tools', () => {
    const tools = toolRegistry.getAll()
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      metadata: t.metadata,
    }))
  })

  registerSecureIpcHandler('debug:system-info', async () => {
    const { buildDebugSystemInfo } = await import('../agent/debug-system-info')
    return buildDebugSystemInfo(toolRegistry)
  })

  registerSecureIpcHandler('debug:traces', (): DebugTracesSnapshot => {
    const lanes = getTokenLaneStats()
    return {
      spans: getRecentSpans(100),
      callerStats: getCallerStats(),
      tokenLanes: {
        foreground: lanes.foreground,
        background: lanes.background,
      },
      dailyTokenUsage: getDailyUsage(),
    }
  })

  /** Persona Eval 报告：Debug 只读展示 CLI 生成的真实报告，不在 UI 隐式触发付费运行。 */
  registerSecureIpcHandler('debug:persona-eval-reports', async () => {
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return listPersonaEvalReports(reportDir)
  })

  registerSecureIpcHandler('debug:persona-eval-report-get', async (_event, fileName: string) => {
    if (typeof fileName !== 'string' || !fileName.trim()) return null
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return getPersonaEvalReport(reportDir, fileName)
  })

  registerSecureIpcHandler('debug:skill-eval-reports', async () => {
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return listSkillEvalReports(reportDir)
  })

  registerSecureIpcHandler('debug:skill-eval-report-get', async (_event, fileName: string) => {
    if (typeof fileName !== 'string' || !fileName.trim()) return null
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return getSkillEvalReport(reportDir, fileName)
  })

  registerSecureIpcHandler('debug:persona-eval-human-reviews-list', async (_event, fileName: string) => {
    if (typeof fileName !== 'string' || !fileName.trim()) return []
    return listPersonaEvalHumanReviews(fileName)
  })

  registerSecureIpcHandler('debug:persona-eval-human-review-save', async (_event, input: PersonaEvalHumanReviewInput) => {
    try {
      return { ok: true, review: await upsertPersonaEvalHumanReview(input) } as const
    } catch (error) {
      log.warn('Failed to save Persona Eval human review', {
        error: error instanceof Error ? error.message : String(error),
      })
      const message = error instanceof Error ? error.message : ''
      return { ok: false, error: message.startsWith('人工审阅') ? message : '保存人工审阅失败' } as const
    }
  })

  registerSecureIpcHandler('debug:persona-eval-human-review-delete', async (_event, input: PersonaEvalHumanReviewDeleteInput) => {
    try {
      await deletePersonaEvalHumanReview(input)
      return { ok: true } as const
    } catch (error) {
      log.warn('Failed to delete Persona Eval human review', {
        error: error instanceof Error ? error.message : String(error),
      })
      const message = error instanceof Error ? error.message : ''
      return { ok: false, error: message.startsWith('人工审阅') ? message : '清空人工审阅失败' } as const
    }
  })

  registerSecureIpcHandler('debug:eval-run-plans', () => evalRunner!.getPlans())
  registerSecureIpcHandler('debug:eval-run-status', () => evalRunner!.getStatus())
  registerSecureIpcHandler('debug:eval-run-start', async (event, suite: DebugEvalSuite) => {
    if (suite !== 'mock' && suite !== 'skill' && suite !== 'persona-real') {
      return { ok: false, error: '不支持的 Eval 套件' }
    }
    if (suite === 'persona-real') {
      const owner = BrowserWindow.fromWebContents(event.sender)
      if (!owner) return { ok: false, error: '调试窗口已关闭' }
      const confirmation = await dialog.showMessageBox(owner, {
        type: 'warning',
        title: '确认运行真人格 Eval',
        message: '真人格 Eval 会调用真实模型并产生费用，是否继续？',
        detail: '将运行 B02–B07 的 pass^k 场景；API Key 不会显示在 Debug 输出中。',
        buttons: ['取消', '运行'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      if (confirmation.response !== 1) return { ok: false, error: '用户取消运行' }
    }
    return evalRunner!.start(suite)
  })
  registerSecureIpcHandler('debug:eval-run-cancel', (_event, runId: string) => {
    if (typeof runId !== 'string' || !runId.trim() || runId.length > 200) return { ok: false, error: '无效的 Eval runId' }
    return evalRunner!.cancel(runId)
  })

  /** 生产资产使用证据：只接受有界白名单过滤字段。 */
  registerSecureIpcHandler('debug:asset-usage-query', async (_event, input?: AgentAssetUsageQuery) => {
    const bounded = (value: unknown) => typeof value === 'string' && value.trim().length <= 240
      ? value.trim()
      : undefined
    return assetUsageStore.query({
      assetKey: bounded(input?.assetKey),
      spanId: bounded(input?.spanId),
      sessionId: bounded(input?.sessionId),
      interactionSpanId: bounded(input?.interactionSpanId),
      usageKind: typeof input?.usageKind === 'string' ? input.usageKind : undefined,
      limit: typeof input?.limit === 'number' ? Math.min(100, Math.max(1, input.limit)) : undefined,
      offset: typeof input?.offset === 'number' ? Math.max(0, input.offset) : undefined,
    })
  })

  /** LLM Debug 历史摘要：正文不随列表查询返回，避免侧栏加载大 payload。 */
  registerSecureIpcHandler('debug:llm-logs-query', async (_event, input?: LLMCallQuery) => {
    const bounded = (value: unknown) => typeof value === 'string' && value.trim().length <= 240
      ? value.trim()
      : undefined
    return llmDebugStore.query({
      sessionId: bounded(input?.sessionId),
      includeSubagents: input?.includeSubagents === true,
      caller: bounded(input?.caller),
      model: bounded(input?.model),
      status: input?.status === 'pending' || input?.status === 'success' || input?.status === 'error'
        ? input.status
        : undefined,
      search: bounded(input?.search),
      order: input?.order === 'desc' ? 'desc' : 'asc',
      limit: typeof input?.limit === 'number' ? input.limit : undefined,
      offset: typeof input?.offset === 'number' ? input.offset : undefined,
    })
  })

  /** 按 logId（现有 tracer Span ID）懒加载单条 Debug 正文。 */
  registerSecureIpcHandler('debug:llm-log-get', async (_event, id: string) => {
    if (typeof id !== 'string' || !id.trim() || id.length > 240) return null
    return llmDebugStore.getById(id)
  })

  registerSecureIpcHandler('debug:llm-log-export', async (event, id: string) => {
    if (typeof id !== 'string' || !id.trim() || id.length > 240) return { ok: false, error: '无效的 Debug 记录' }
    const record = await llmDebugStore.getById(id)
    if (!record) return { ok: false, error: 'Debug 记录不存在' }
    const evidence = await assetUsageStore.query({ spanId: id, limit: 100 })
    const exportRecord = { ...record, assetUsage: evidence.records }
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) return { ok: false, error: '调试窗口已关闭' }
    const result = await dialog.showSaveDialog(owner, {
      defaultPath: `my-agent-llm-debug-${id}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    try {
      await writeFile(result.filePath, JSON.stringify(exportRecord, null, 2), 'utf8')
      return { ok: true, filePath: result.filePath }
    } catch (error) {
      log.warn('Failed to export single LLM Debug log', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: '导出 Debug 记录失败' }
    }
  })

  registerSecureIpcHandler('debug:llm-subagents', async (_event, mainSessionId: string) => {
    if (typeof mainSessionId !== 'string' || !mainSessionId.trim() || mainSessionId.length > 240) return []
    return llmDebugStore.listSubagentSessions(mainSessionId)
  })

  registerSecureIpcHandler('debug:llm-logs-clear', async (_event, sessionId?: string) => {
    await llmDebugStore.clear(typeof sessionId === 'string' && sessionId.length <= 240 ? sessionId : undefined)
    return { ok: true }
  })

  registerSecureIpcHandler('debug:llm-logs-export', async (event, input?: LLMCallQuery) => {
    const bounded = (value: unknown) => typeof value === 'string' && value.trim().length <= 240
      ? value.trim()
      : undefined
    const content = await llmDebugStore.exportJsonl({
      sessionId: bounded(input?.sessionId),
      includeSubagents: input?.includeSubagents === true,
      caller: bounded(input?.caller),
      model: bounded(input?.model),
      status: input?.status === 'pending' || input?.status === 'success' || input?.status === 'error'
        ? input.status
        : undefined,
      search: bounded(input?.search),
      order: input?.order === 'desc' ? 'desc' : 'asc',
    })
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) return { ok: false, error: '调试窗口已关闭' }
    const result = await dialog.showSaveDialog(owner, {
      defaultPath: 'my-agent-llm-debug.jsonl',
      filters: [{ name: 'JSON Lines', extensions: ['jsonl'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    try {
      await writeFile(result.filePath, content, 'utf8')
      return { ok: true, filePath: result.filePath, count: content ? content.trimEnd().split('\n').length : 0 }
    } catch (error) {
      log.warn('Failed to export LLM Debug logs', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: '导出 Debug 记录失败' }
    }
  })

  /** 免伴侣上下文的 Prompt 试跑（可多轮 history；wishlist Playground） */
  registerSecureIpcHandler(
    'debug:playground-run',
    async (
      _e,
      input: {
        systemPrompt?: string
        userPrompt: string
        history?: Array<{ role: 'user' | 'assistant'; content: string }>
      },
    ) => {
      const { runPlayground } = await import('../agent/playground')
      if (!input || typeof input !== 'object') return { ok: false, error: 'Playground 参数无效' }
      return runPlayground({
        systemPrompt: typeof input.systemPrompt === 'string' ? input.systemPrompt : undefined,
        userPrompt: typeof input.userPrompt === 'string' ? input.userPrompt : '',
        history: Array.isArray(input.history) ? input.history : [],
      })
    },
  )

  /** 工具手测：真实 Registry + 权限门闸（M32-G2） */
  registerSecureIpcHandler(
    'debug:tool-run',
    async (
      _e,
      input: { name: string; args?: Record<string, unknown>; confirmRisk?: boolean },
    ) => {
      const { runDebugTool } = await import('../agent/debug-tool-run')
      const request = {
        name: typeof input?.name === 'string' ? input.name : '',
        args: input?.args && typeof input.args === 'object' && !Array.isArray(input.args) ? input.args : {},
      }
      const preview = await runDebugTool(toolRegistry, { ...request, confirmRisk: false })
      if (preview.ok || !preview.needsConfirmation || !input?.confirmRisk) return preview

      const owner = BrowserWindow.fromWebContents(_e.sender)
      if (!owner) return { ...preview, error: '调试窗口已关闭' }
      const argsText = JSON.stringify(request.args, null, 2).slice(0, 4_000)
      const confirmation = await dialog.showMessageBox(owner, {
        type: 'warning',
        title: '确认执行高风险调试工具',
        message: `是否执行工具“${request.name}”？`,
        detail: `${argsText}

该操作会走真实 Registry，并可能修改文件、Git、记忆或启动子进程。`,
        buttons: ['取消', '执行'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      if (confirmation.response !== 1) return { ...preview, error: '用户取消执行' }
      return runDebugTool(toolRegistry, { ...request, confirmRisk: true })
    },
  )

  /** 世界态只读快照（M32-G4） */
  registerSecureIpcHandler('debug:world-snapshot', async () => {
    const { buildDebugWorldSnapshot } = await import('../agent/debug-world-snapshot')
    return buildDebugWorldSnapshot()
  })

  /** Playground 模型烟测（对齐 Alice「模型测试」） */
  registerSecureIpcHandler('debug:model-smoke', async () => {
    const { runModelSmokeTest } = await import('../agent/playground-model-test')
    return runModelSmokeTest()
  })

  /** Playground：探测 thinking.disabled 并写入能力缓存 */
  registerSecureIpcHandler('debug:model-probe-thinking', async () => {
    const { probeThinkingDisable } = await import('../agent/playground-model-test')
    return probeThinkingDisable()
  })

  registerSecureIpcHandler('debug:model-test-status', async () => {
    const { getModelTestStatus } = await import('../agent/playground-model-test')
    return getModelTestStatus()
  })

  log.info('Debug IPC registered')
}
