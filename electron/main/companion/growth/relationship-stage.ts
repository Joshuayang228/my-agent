/**
 * 关系阶段（M28-G1 / M28-G2）
 *
 * 背景：陌生/熟悉/默契已有叙事，但未进 Prompt，模型易过度亲热或过度疏离；同时生活事件、赠礼、信物与反思必须共享同一关系事实源。
 * 意图：用与反思门闸相同的可测代理指标 + companion_relationship_state 持久化关系事实推导枚举，并叠交心/干活 lean（G2）注入 Assemble。
 * 约束：偏保守（不确定 → stranger）；task-leaning 时不上报默契口吻；不调 LLM；召唤强制陌生客人。
 */

import {
  countUserMessagesForRoleSince,
  listRecentUserMessagesForRole,
} from '../../storage/session-store'
import {
  formatFamiliarityMixForPrompt,
  resolveFamiliarityMix,
  type FamiliarityMixResult,
} from './familiarity-mix'
import {
  COLD_START_MS,
  LOOKBACK_MS,
  MIN_USER_MESSAGES,
  getGrowthStartedAt,
} from './reflection-gate'
import { getReflectionState } from './reflection-log'
import { listRelationshipStates, recordRelationshipEvent } from '../core/persistence/life-repository'

export type RelationshipStage = 'stranger' | 'familiar' | 'rapport'

export interface RelationshipStageResult {
  stage: RelationshipStage
  signals: string[]
  guidance: string
  mix?: FamiliarityMixResult
}

export interface ResolveRelationshipStageInput {
  growthStartedAt: number
  lastRunAt: number
  recentUserMessages: number
  now?: number
  /** 召唤：串门不是同居，不借用主会话默契 */
  sessionKind?: 'main' | 'summon'
  minUserMessages?: number
  coldStartMs?: number
  /** M28-G2：近窗交心/干活混合；缺省不压制阶段 */
  mix?: FamiliarityMixResult
  /** 持久化关系事实（companion_relationship_state），使生活事件/赠礼/信物/抚慰与启发式阶段共享同一真相 */
  persistedPhase?: string
  persistedSignal?: number
}

const GUIDANCE: Record<RelationshipStage, string> = {
  stranger:
    '阶段：陌生。少假定共同经历；克制连环追问与过度亲热；用户主动分享再记。aside 少用。',
  familiar:
    '阶段：熟悉。可更自然地引用已知偏好与近况；仍勿假装多年老友；高敏话题不挖。',
  rapport:
    '阶段：默契。可按已沉淀的相处习惯回应；仍可被纠正；PROTECTED 与事实优先于「熟」的语气。',
}

/**
 * 纯函数：由成长时钟 / 消息密度 / 是否已反思 + 持久化关系事实推导阶段。
 * 优先级：召唤 → 陌生；冷启动或消息不足 → 陌生（若已有持久化关系跃迁则以持久化阶段保底）；已有反思或高阶关系事实 → 默契；
 * task-leaning 时把默契压回熟悉（刷代码 ≠ 交心）。
 */
export function resolveRelationshipStage(
  input: ResolveRelationshipStageInput,
): RelationshipStageResult {
  const now = input.now ?? Date.now()
  const minMsgs = input.minUserMessages ?? MIN_USER_MESSAGES
  const coldMs = input.coldStartMs ?? COLD_START_MS
  const signals: string[] = []

  if (input.sessionKind === 'summon') {
    signals.push('summon-guest')
    return {
      stage: 'stranger',
      signals,
      guidance: GUIDANCE.stranger + '（召唤短聊：勿推进对方生活世界，勿套用主会话默契。）',
      mix: input.mix,
    }
  }

  const started = Number(input.growthStartedAt) || 0
  const lastRun = Number(input.lastRunAt) || 0
  const msgs = Math.max(0, Number(input.recentUserMessages) || 0)
  const persistedPhase = typeof input.persistedPhase === 'string' ? input.persistedPhase.trim() : ''
  const persistedSignal = Number(input.persistedSignal) || 0
  const persistedStage: RelationshipStage | null =
    persistedPhase === 'rapport' || persistedPhase === 'bonding' || persistedPhase === 'milestone' || persistedSignal >= 20
      ? 'rapport'
      : persistedPhase === 'familiar' || persistedSignal >= 5
        ? 'familiar'
        : null

  const rank: Record<RelationshipStage, number> = { stranger: 0, familiar: 1, rapport: 2 }

  if (!started || now - started < coldMs) {
    signals.push('cold-start-window')
    if (persistedStage) {
      signals.push(`persisted:${persistedStage}`)
      let stage = persistedStage
      if (stage === 'rapport' && input.mix?.lean === 'task-leaning') {
        signals.push('cap-rapport-task-leaning')
        stage = 'familiar'
      }
      if (input.mix) signals.push(`mix:${input.mix.lean}`)
      return {
        stage,
        signals,
        guidance: GUIDANCE[stage],
        mix: input.mix,
      }
    }
    return {
      stage: 'stranger',
      signals,
      guidance: GUIDANCE.stranger,
      mix: input.mix,
    }
  }
  signals.push('past-cold-start')

  if (msgs < minMsgs) {
    signals.push('insufficient-messages')
    if (persistedStage) {
      signals.push(`persisted:${persistedStage}`)
      let stage = persistedStage
      if (stage === 'rapport' && input.mix?.lean === 'task-leaning') {
        signals.push('cap-rapport-task-leaning')
        stage = 'familiar'
      }
      if (input.mix) signals.push(`mix:${input.mix.lean}`)
      return {
        stage,
        signals,
        guidance: GUIDANCE[stage],
        mix: input.mix,
      }
    }
    return {
      stage: 'stranger',
      signals,
      guidance: GUIDANCE.stranger,
      mix: input.mix,
    }
  }
  signals.push(`msgs:${msgs}`)

  let stage: RelationshipStage = 'familiar'
  if (lastRun > 0) {
    signals.push('has-reflection')
    stage = 'rapport'
  } else {
    signals.push('no-reflection-yet')
  }

  if (persistedStage && rank[persistedStage] > rank[stage]) {
    signals.push(`persisted:${persistedStage}`)
    stage = persistedStage
  }

  // M28-G2：近窗偏干活时不把阶段说成默契（反思过 ≠ 交心过）
  if (stage === 'rapport' && input.mix?.lean === 'task-leaning') {
    signals.push('cap-rapport-task-leaning')
    stage = 'familiar'
  }
  if (input.mix) signals.push(`mix:${input.mix.lean}`)

  return {
    stage,
    signals,
    guidance: GUIDANCE[stage],
    mix: input.mix,
  }
}

/** 读存储后解析（主会话用；顺带采近窗正文算 mix 并与 companion_relationship_state 对齐） */
export async function resolveRelationshipStageForRole(
  roleId: string,
  opts?: { now?: number; sessionKind?: 'main' | 'summon' },
): Promise<RelationshipStageResult> {
  const now = opts?.now ?? Date.now()
  if (opts?.sessionKind === 'summon') {
    return resolveRelationshipStage({
      growthStartedAt: 0,
      lastRunAt: 0,
      recentUserMessages: 0,
      now,
      sessionKind: 'summon',
    })
  }
  const id = roleId.trim()
  const growthStartedAt = id ? await getGrowthStartedAt(id) : 0
  const state = id ? await getReflectionState(id) : { lastRunAt: 0 }
  const since = now - LOOKBACK_MS
  const recentUserMessages = id ? await countUserMessagesForRoleSince(id, since) : 0
  const persistedUserRel = id ? (await listRelationshipStates(id)).find(item => item.subjectId === 'user') : undefined
  let mix: FamiliarityMixResult | undefined
  if (id) {
    try {
      const texts = await listRecentUserMessagesForRole(id, since, 40)
      mix = resolveFamiliarityMix(texts)
    } catch {
      mix = undefined
    }
  }
  const resolved = resolveRelationshipStage({
    growthStartedAt,
    lastRunAt: state.lastRunAt,
    recentUserMessages,
    now,
    sessionKind: 'main',
    mix,
    persistedPhase: persistedUserRel?.phase,
    persistedSignal: persistedUserRel?.signal,
  })
  const rank: Record<RelationshipStage, number> = { stranger: 0, familiar: 1, rapport: 2 }
  const currentPersistedRank =
    persistedUserRel?.phase === 'rapport' || persistedUserRel?.phase === 'bonding' || persistedUserRel?.phase === 'milestone'
      ? 2
      : persistedUserRel?.phase === 'familiar'
        ? 1
        : 0
  if (id && rank[resolved.stage] > currentPersistedRank) {
    try {
      await recordRelationshipEvent({
        roleId: id,
        subjectId: 'user',
        phase: resolved.stage,
        delta: 0,
        note: `关系阶段演进至 ${resolved.stage}`,
        sourceEventId: `relationship-stage-sync:${id}:${resolved.stage}`,
      })
    } catch {
      // 读路径同步关系快照容错，不阻断主会话
    }
  }
  return resolved
}

export function formatRelationshipStageForPrompt(result: RelationshipStageResult): string {
  const lines = [
    `关系阶段：${result.stage}`,
    `行动指引：${result.guidance}`,
  ]
  if (result.mix) {
    lines.push(formatFamiliarityMixForPrompt(result.mix))
  }
  return lines.join('\n')
}

export const __test = { GUIDANCE }
