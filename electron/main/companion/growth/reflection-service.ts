/**
 * 人格反思服务（对照 Alice PersonaReflectionService + runPersonaReflection）
 *
 * 背景：低频把互动默契固化进 MUTABLE，不碰 PROTECTED。
 * 意图：scheduleReflection / runReflectionNow；门闸 + LLM runner + setMutable。
 * 约束：仅 active 主角；召唤会话不触发；同 role 去重入队。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { chatComplete } from '../../llm/index'
import { PROMPT_KEYS, ROLE_BEHAVIOR_IDS, ROLE_BEHAVIOR_PROMPT_SUFFIX, rolePromptAssetKey } from '../../prompts/keys'
import { listFeedbackForRole } from '../../storage/memory-store'
import {
  listRecentUserMessagesForRole,
} from '../../storage/session-store'
import { createLogger } from '../../utils/logger'
import { taskQueue } from '../../services/task-queue'
import { loadRolePack } from '../identity/loader'
import { characterDefinitionFromRolePack } from '../../prompts/compiler'
import { getCharacterPromptAssetKeys } from '../../prompts/dependencies'
import { buildReflectionPrompt } from '../../prompts/companion-behaviors'
import { recordAndBroadcastMilestone } from './milestones'
import { getMutable, setMutable } from './mutable-store'
import { MUTABLE_MAX_CHARS } from './mutable-validate'
import { collectLifeSignalsForRole } from './life-signals'
import {
  LOOKBACK_MS,
  ensureGrowthStartedAt,
  shouldReflectNow,
  type ReflectGateResult,
} from './reflection-gate'
import { getReflectionState, recordReflectionRun } from './reflection-log'

const log = createLogger('PersonaReflection')

const pendingRoles = new Set<string>()

function parseReflectionJson(raw: string): { newMutable: string | null; summary: string } {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return { newMutable: null, summary: 'parse-failed' }
  try {
    const obj = JSON.parse(match[0]) as { newMutable?: unknown; summary?: unknown }
    let newMutable: string | null = null
    if (typeof obj.newMutable === 'string') {
      const t = obj.newMutable.trim()
      if (t && t.toLowerCase() !== 'null') newMutable = t.slice(0, MUTABLE_MAX_CHARS)
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
  const feedbacks = (await listFeedbackForRole(roleId, 12)).map((m) => m.content)
  const lifeSignals = await collectLifeSignalsForRole(roleId)
  const protectedSummary = pack.protected.slice(0, 400)

  const prompt = buildReflectionPrompt({
    roleName: pack.name,
    protectedSummary,
    currentMutable,
    recentUserMessages,
    feedbackNotes: feedbacks,
    lifeSignals,
    character: characterDefinitionFromRolePack(pack, currentMutable),
    behaviorPrompt: pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.reflection],
  })

  let parsed: { newMutable: string | null; summary: string }
  try {
    const raw = await chatComplete({
      config: llmConfig,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 1500,
      caller: 'persona-reflection',
      promptAssetKeys: [PROMPT_KEYS.companionReflection, PROMPT_KEYS.companionCompiler, ...getCharacterPromptAssetKeys(pack, currentMutable), ...(pack.behaviorPrompts?.[ROLE_BEHAVIOR_IDS.reflection] ? [rolePromptAssetKey(pack.id, ROLE_BEHAVIOR_PROMPT_SUFFIX.reflection)] : [])],
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
    log.info('Reflection no change', { roleId, summaryLength: parsed.summary.length })
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

  const write = await setMutable(
    roleId,
    parsed.newMutable,
    `reflection: ${parsed.summary}`,
  )
  if (!write.ok) {
    await recordReflectionRun(roleId, {
      at: now,
      changed: false,
      summary: `rejected:${write.code}`,
    })
    log.warn('Reflection mutable rejected', {
      roleId,
      code: write.code,
      error: write.error,
    })
    return {
      skipped: false,
      changed: false,
      summary: `rejected:${write.code}`,
      gate,
    }
  }
  await recordReflectionRun(roleId, {
    at: now,
    changed: true,
    summary: parsed.summary,
  })
  log.info('Reflection applied', { roleId, version: write.version, summaryLength: parsed.summary.length })

  // M30-G1：第一次反思真正写入 MUTABLE
  try {
    const pack = loadRolePack(roleId)
    void recordAndBroadcastMilestone(roleId, 'first_reflection', {
      roleDisplayName: pack.name,
    })
  } catch {
    void recordAndBroadcastMilestone(roleId, 'first_reflection')
  }

  return {
    skipped: false,
    changed: true,
    summary: parsed.summary,
    version: write.version,
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

  await ensureGrowthStartedAt(roleId)

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
  await ensureGrowthStartedAt(roleId)
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
export const __test = {
  parseReflectionJson,
  buildReflectionPrompt,
}
