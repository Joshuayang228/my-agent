/**
 * 人格反思服务（对照 Alice PersonaReflectionService + runPersonaReflection）
 *
 * 背景：低频把互动默契固化进 MUTABLE，不碰 PROTECTED。
 * 意图：scheduleReflection / runReflectionNow；门闸 + LLM runner + setMutable。
 * 约束：仅 active 主角；召唤会话不触发；同 role 去重入队。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { chatComplete } from '../../llm/index'
import { listMemories } from '../../storage/memory-store'
import {
  listRecentUserMessagesForRole,
} from '../../storage/session-store'
import { createLogger } from '../../utils/logger'
import { taskQueue } from '../../services/task-queue'
import { loadRolePack } from '../identity/loader'
import { getMutable, setMutable } from './mutable-store'
import {
  LOOKBACK_MS,
  ensureGrowthStartedAt,
  shouldReflectNow,
  type ReflectGateResult,
} from './reflection-gate'
import { getReflectionState, recordReflectionRun } from './reflection-log'

const log = createLogger('PersonaReflection')

const pendingRoles = new Set<string>()

const MAX_MUTABLE_CHARS = 800

function buildReflectionPrompt(input: {
  roleName: string
  protectedSummary: string
  currentMutable: string
  recentUserMessages: string[]
  feedbackNotes: string[]
}): string {
  const msgs = input.recentUserMessages.length
    ? input.recentUserMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')
    : '（无）'
  const feedback = input.feedbackNotes.length
    ? input.feedbackNotes.map((f) => `- ${f}`).join('\n')
    : '（无）'

  return `你是人格成长系统的审慎编辑。角色「${input.roleName}」是用户的数字伙伴。

## PROTECTED（不可改写，仅作防漂移锚点）
${input.protectedSummary}

## 当前 MUTABLE（可微调的行为默认值）
${input.currentMutable || '（空，尚无个人化覆盖）'}

## 近 7 日用户消息摘要
${msgs}

## 用户对协作方式的反馈记忆
${feedback}

## 任务
判断是否需要微调 MUTABLE（语气、节奏、默认表达习惯等）。

硬性要求：
1. 不得违背 PROTECTED；不得发明新身份或改变核心价值观
2. 调整幅度要小；若当前已足够好，newMutable 必须为 null
3. 新 MUTABLE 上限 ${MAX_MUTABLE_CHARS} 字；写行为默认值，不要写具体事实流水账（事实属于记忆）
4. 只输出 JSON：{"newMutable": string|null, "summary": "一句话说明"}`

}

function parseReflectionJson(raw: string): { newMutable: string | null; summary: string } {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { newMutable: null, summary: 'parse-failed' }
  try {
    const obj = JSON.parse(match[0]) as { newMutable?: unknown; summary?: unknown }
    let newMutable: string | null = null
    if (typeof obj.newMutable === 'string') {
      const t = obj.newMutable.trim()
      if (t && t.toLowerCase() !== 'null') newMutable = t.slice(0, MAX_MUTABLE_CHARS)
    }
    const summary = typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim().slice(0, 200)
      : 'reflection-complete'
    return { newMutable, summary }
  } catch {
    return { newMutable: null, summary: 'parse-failed' }
  }
}

export interface ReflectionResult {
  skipped: boolean
  reason?: string
  changed: boolean
  summary: string
  version?: number
  gate?: ReflectGateResult
}

async function runReflectionCore(
  roleId: string,
  llmConfig: LLMConfig,
  opts?: { force?: boolean; now?: number; universeId?: string },
): Promise<ReflectionResult> {
  const now = opts?.now ?? Date.now()
  const universeId = opts?.universeId ?? 'default'
  const gate = await shouldReflectNow(roleId, { now, force: opts?.force })
  if (!gate.allowed) {
    log.info('Reflection skipped by gate', { roleId, reason: gate.reason, detail: gate.detail })
    return {
      skipped: true,
      reason: gate.reason,
      changed: false,
      summary: gate.detail || gate.reason,
      gate,
    }
  }

  const pack = loadRolePack(roleId, universeId)
  const currentMutable = await getMutable(roleId, universeId)
  const recentUserMessages = await listRecentUserMessagesForRole(
    roleId,
    now - LOOKBACK_MS,
    40,
  )
  const feedbacks = (await listMemories('feedback')).slice(0, 12).map((m) => m.content)
  const protectedSummary = pack.protected.slice(0, 400)

  const prompt = buildReflectionPrompt({
    roleName: pack.name,
    protectedSummary,
    currentMutable,
    recentUserMessages,
    feedbackNotes: feedbacks,
  })

  let parsed: { newMutable: string | null; summary: string }
  try {
    const raw = await chatComplete({
      config: llmConfig,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 1500,
      caller: 'persona-reflection',
    })
    parsed = parseReflectionJson(raw)
  } catch (err) {
    log.warn('Reflection LLM failed', { roleId, error: String(err) })
    await recordReflectionRun(roleId, {
      at: now,
      changed: false,
      summary: 'llm-failed',
    })
    return {
      skipped: false,
      changed: false,
      summary: 'llm-failed',
      gate,
    }
  }

  if (!parsed.newMutable) {
    await recordReflectionRun(roleId, {
      at: now,
      changed: false,
      summary: parsed.summary || 'no-change',
    })
    log.info('Reflection no change', { roleId, summary: parsed.summary })
    return {
      skipped: false,
      changed: false,
      summary: parsed.summary || 'no-change',
      gate,
    }
  }

  // 与当前完全相同则不写版本
  if (parsed.newMutable.trim() === currentMutable.trim()) {
    await recordReflectionRun(roleId, {
      at: now,
      changed: false,
      summary: parsed.summary || 'same-as-current',
    })
    return {
      skipped: false,
      changed: false,
      summary: 'same-as-current',
      gate,
    }
  }

  const { version } = await setMutable(
    roleId,
    parsed.newMutable,
    `reflection: ${parsed.summary}`,
  )
  await recordReflectionRun(roleId, {
    at: now,
    changed: true,
    summary: parsed.summary,
  })
  log.info('Reflection applied', { roleId, version, summary: parsed.summary })
  return {
    skipped: false,
    changed: true,
    summary: parsed.summary,
    version,
    gate,
  }
}

/**
 * 对话结束后调度（低打扰）。门闸不满足则立即返回，不入队。
 */
export async function scheduleReflectionAfterChat(
  roleId: string,
  sessionId: string,
  llmConfig: LLMConfig,
  opts?: { sessionKind?: string },
): Promise<{ queued: boolean; reason?: string }> {
  if (opts?.sessionKind === 'summon') {
    return { queued: false, reason: 'summon-session' }
  }

  await ensureGrowthStartedAt()

  if (pendingRoles.has(roleId)) {
    return { queued: false, reason: 'already-queued' }
  }

  const gate = await shouldReflectNow(roleId)
  if (!gate.allowed) {
    return { queued: false, reason: gate.reason }
  }

  pendingRoles.add(roleId)
  taskQueue.enqueue(sessionId, 'persona-reflection', async () => {
    try {
      await runReflectionCore(roleId, llmConfig)
    } finally {
      pendingRoles.delete(roleId)
    }
  })
  log.info('Reflection queued', { roleId, sessionId })
  return { queued: true }
}

/** 设置页/调试：立即跑一轮（可 force） */
export async function runReflectionNow(
  roleId: string,
  llmConfig: LLMConfig,
  opts?: { force?: boolean },
): Promise<ReflectionResult> {
  await ensureGrowthStartedAt()
  return runReflectionCore(roleId, llmConfig, { force: opts?.force })
}

export async function getReflectionStatus(roleId: string): Promise<{
  gate: ReflectGateResult
  state: Awaited<ReturnType<typeof getReflectionState>>
}> {
  const gate = await shouldReflectNow(roleId)
  const state = await getReflectionState(roleId)
  return { gate, state }
}

/** 测试用：暴露解析与门闸辅助 */
export const __test = { parseReflectionJson, buildReflectionPrompt }
