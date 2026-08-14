/**
 * Debug IPC — 暴露 Agent 内部状态给 DevPanel
 *
 * 遵循架构分层：ipc/ → agent/, tools/, storage/, memory/, mcp/
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ToolRegistry } from '../tools/registry'
import { buildSystemPrompt, rolePackToPromptParts, type PromptContext } from '../agent/prompt-builder'
import { getPromptAssets, getRuntimePromptAssetTraces } from '../prompts/registry'
import { loadActiveAssembleInput } from '../companion/orchestrator'
import { getAllSettings } from '../storage/settings-store'
import { buildUserProfile } from '../storage/memory-store'
import { createLogger } from '../utils/logger'
import { getRecentSpans, getCallerStats, getTokenLaneStats } from '../utils/tracer'
import { getDailyUsage } from '../agent/token-budget'
import { getPersonaEvalReport, listPersonaEvalReports } from '../debug/persona-eval-reports'
import { DebugEvalRunner } from '../debug/eval-runner'
import {
  llmDebugStore,
} from '../storage/llm-debug-store'
import type {
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

  ipcMain.handle('debug:system-prompt', async () => {
    try {
      const settings = await getAllSettings()
      const { pack, mutableBody } = await loadActiveAssembleInput()
      const persona = rolePackToPromptParts(pack, mutableBody)
      const toolNames = toolRegistry.getAll().map(t => t.name)

      let userProfile: PromptContext['userProfile'] | undefined
      try {
        const profile = await buildUserProfile()
        if (profile) userProfile = profile
      } catch { /* memory not available */ }

      const customPrompt = settings.systemPrompt || undefined
      const prompt = buildSystemPrompt({
        persona,
        toolNames,
        userProfile,
        sessionInfo: customPrompt,
      })

      return {
        full: prompt,
        layers: {
          l1: `[PROTECTED]\n${persona.protected}\n[/PROTECTED]${persona.profile ? `\n\n## 人物档案\n${persona.profile}` : ''}${persona.worldProfile ? `\n\n## 默认生活世界\n${persona.worldProfile}` : ''}\n\n[MUTABLE]\n${persona.mutable}\n[/MUTABLE]`,
          l2: `Tools: ${toolNames.join(', ')}`,
          l3: userProfile
            ? `Identity: ${userProfile.identity.slice(0, 100) || '(none)'}\nWorkflow: ${userProfile.workflow.slice(0, 100) || '(none)'}\nVoice: ${userProfile.voice.slice(0, 100) || '(none)'}${customPrompt ? `\nCustom: ${customPrompt.slice(0, 100)}` : ''}`
            : customPrompt ? `Custom: ${customPrompt.slice(0, 200)}` : '(empty)',
          l4: `Time: ${new Date().toLocaleString('zh-CN')}`,
        },
        persona: { id: persona.id, name: persona.name },
        charCount: prompt.length,
        estimatedTokens: Math.ceil(prompt.length / 3.5),
        assets: getRuntimePromptAssetTraces(persona.id),
      }
    } catch (err) {
      log.error('Failed to build debug prompt', { error: String(err) })
      return {
        full: '(error)',
        layers: { l1: '', l2: '', l3: '', l4: '' },
        persona: { id: '', name: '' },
        charCount: 0,
        estimatedTokens: 0,
        assets: [],
      }
    }
  })

  /** Prompt 资产目录：由主进程生产代码和 Role Pack 资产生成，前端不维护副本。 */
  ipcMain.handle('debug:prompt-assets', () => getPromptAssets())

  ipcMain.handle('debug:tools', () => {
    const tools = toolRegistry.getAll()
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      metadata: t.metadata,
    }))
  })

  ipcMain.handle('debug:system-info', async () => {
    const { buildDebugSystemInfo } = await import('../agent/debug-system-info')
    return buildDebugSystemInfo(toolRegistry)
  })

  ipcMain.handle('debug:traces', () => {
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
  ipcMain.handle('debug:persona-eval-reports', async () => {
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return listPersonaEvalReports(reportDir)
  })

  ipcMain.handle('debug:persona-eval-report-get', async (_event, fileName: string) => {
    if (typeof fileName !== 'string' || !fileName.trim()) return null
    const reportDir = path.join(process.env.APP_ROOT || process.cwd(), 'eval-reports')
    return getPersonaEvalReport(reportDir, fileName)
  })

  ipcMain.handle('debug:persona-eval-human-reviews-list', async (_event, fileName: string) => {
    if (typeof fileName !== 'string' || !fileName.trim()) return []
    return listPersonaEvalHumanReviews(fileName)
  })

  ipcMain.handle('debug:persona-eval-human-review-save', async (_event, input: PersonaEvalHumanReviewInput) => {
    try {
      return { ok: true, review: await upsertPersonaEvalHumanReview(input) } as const
    } catch (error) {
      log.warn('Failed to save Persona Eval human review', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: error instanceof Error ? error.message : '保存人工审阅失败' } as const
    }
  })

  ipcMain.handle('debug:persona-eval-human-review-delete', async (_event, input: PersonaEvalHumanReviewDeleteInput) => {
    try {
      await deletePersonaEvalHumanReview(input)
      return { ok: true } as const
    } catch (error) {
      log.warn('Failed to delete Persona Eval human review', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: error instanceof Error ? error.message : '清空人工审阅失败' } as const
    }
  })

  ipcMain.handle('debug:eval-run-plans', () => evalRunner!.getPlans())
  ipcMain.handle('debug:eval-run-status', () => evalRunner!.getStatus())
  ipcMain.handle('debug:eval-run-start', (_event, suite: DebugEvalSuite) => {
    if (suite !== 'mock' && suite !== 'persona-real') {
      return { ok: false, error: '不支持的 Eval 套件' }
    }
    return evalRunner!.start(suite)
  })
  ipcMain.handle('debug:eval-run-cancel', (_event, runId: string) => {
    if (typeof runId !== 'string' || !runId.trim()) return { ok: false, error: '无效的 Eval runId' }
    return evalRunner!.cancel(runId)
  })

  /** LLM Debug 历史摘要：正文不随列表查询返回，避免侧栏加载大 payload。 */
  ipcMain.handle('debug:llm-logs-query', async (_event, input?: LLMCallQuery) => {
    return llmDebugStore.query({
      sessionId: typeof input?.sessionId === 'string' ? input.sessionId : undefined,
      includeSubagents: input?.includeSubagents === true,
      limit: typeof input?.limit === 'number' ? input.limit : undefined,
      offset: typeof input?.offset === 'number' ? input.offset : undefined,
    })
  })

  /** 按 logId（现有 tracer Span ID）懒加载单条 Debug 正文。 */
  ipcMain.handle('debug:llm-log-get', async (_event, id: string) => {
    if (typeof id !== 'string' || !id.trim()) return null
    return llmDebugStore.getById(id)
  })

  ipcMain.handle('debug:llm-log-export', async (event, id: string) => {
    if (typeof id !== 'string' || !id.trim()) return { ok: false, error: '无效的 Debug 记录' }
    const record = await llmDebugStore.getById(id)
    if (!record) return { ok: false, error: 'Debug 记录不存在' }
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showSaveDialog(owner, {
      defaultPath: `my-agent-llm-debug-${id}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    try {
      await writeFile(result.filePath, JSON.stringify(record, null, 2), 'utf8')
      return { ok: true, filePath: result.filePath }
    } catch (error) {
      log.warn('Failed to export single LLM Debug log', {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: '导出 Debug 记录失败' }
    }
  })

  ipcMain.handle('debug:llm-subagents', async (_event, mainSessionId: string) => {
    if (typeof mainSessionId !== 'string' || !mainSessionId.trim()) return []
    return llmDebugStore.listSubagentSessions(mainSessionId)
  })

  ipcMain.handle('debug:llm-logs-clear', async (_event, sessionId?: string) => {
    await llmDebugStore.clear(typeof sessionId === 'string' ? sessionId : undefined)
    return { ok: true }
  })

  ipcMain.handle('debug:llm-logs-export', async (event, input?: LLMCallQuery) => {
    const content = await llmDebugStore.exportJsonl({
      sessionId: typeof input?.sessionId === 'string' ? input.sessionId : undefined,
      includeSubagents: input?.includeSubagents === true,
    })
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
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
  ipcMain.handle(
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
      return runPlayground({
        systemPrompt: input?.systemPrompt,
        userPrompt: input?.userPrompt ?? '',
        history: input?.history,
      })
    },
  )

  /** 工具手测：真实 Registry + 权限门闸（M32-G2） */
  ipcMain.handle(
    'debug:tool-run',
    async (
      _e,
      input: { name: string; args?: Record<string, unknown>; confirmRisk?: boolean },
    ) => {
      const { runDebugTool } = await import('../agent/debug-tool-run')
      return runDebugTool(toolRegistry, {
        name: input?.name ?? '',
        args: input?.args,
        confirmRisk: !!input?.confirmRisk,
      })
    },
  )

  /** 世界态只读快照（M32-G4） */
  ipcMain.handle('debug:world-snapshot', async () => {
    const { buildDebugWorldSnapshot } = await import('../agent/debug-world-snapshot')
    return buildDebugWorldSnapshot()
  })

  /** Playground 模型烟测（对齐 Alice「模型测试」） */
  ipcMain.handle('debug:model-smoke', async () => {
    const { runModelSmokeTest } = await import('../agent/playground-model-test')
    return runModelSmokeTest()
  })

  /** Playground：探测 thinking.disabled 并写入能力缓存 */
  ipcMain.handle('debug:model-probe-thinking', async () => {
    const { probeThinkingDisable } = await import('../agent/playground-model-test')
    return probeThinkingDisable()
  })

  ipcMain.handle('debug:model-test-status', async () => {
    const { getModelTestStatus } = await import('../agent/playground-model-test')
    return getModelTestStatus()
  })

  log.info('Debug IPC registered')
}
