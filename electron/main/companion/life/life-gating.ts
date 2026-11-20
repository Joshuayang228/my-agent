/**
 * 生活引擎统一行为门控（生命体征节流 × 关系梯度敞开度）。
 *
 * 背景：此前朋友圈、足迹推进、脆弱心境与主动搭话各自维护独立冷却，未统一感知角色的
 * 精力/心情耗竭与跟用户的关系阶段，导致精疲力竭仍自动发圈/远行、初识阶段“交浅言深”。
 * 设计意图：将跨切面的产品级门控收敛为纯函数策略，统一回答某类生活行为在当前体征与
 * 关系阶段下是否应放行、暂缓或收窄，并输出结构化原因供 Debug 执行账本留痕。
 * 关键约束：纯函数、无数据库或模型副作用；不覆盖安全/隐私/用户手动设置边界；
 * 关系里程碑事件（hasRelationshipMilestone）允许穿透常规低体征节流。
 */

import type { RelationshipStage } from '../growth/relationship-stage'

export type GatedLifeActionKind =
  | 'auto_moment'
  | 'travel_progression'
  | 'vulnerability'
  | 'spontaneous_impulse'
  | 'private_journal_visibility'

export interface LifeVitalsSnapshot {
  mood?: number | null
  energy?: number | null
  socialNeed?: number | null
}

export interface LifeActionGatingInput {
  kind: GatedLifeActionKind
  relationshipStage?: RelationshipStage
  vitals?: LifeVitalsSnapshot | null
  hasRelationshipMilestone?: boolean
}

export interface LifeActionGatingDecision {
  allow: boolean
  reason:
    | 'ok'
    | 'low-energy'
    | 'low-mood-withdrawn'
    | 'relationship-too-early'
}

export const LIFE_GATING_THRESHOLDS = {
  exhaustedEnergyMax: 20,
  withdrawnMoodMax: 25,
  withdrawnSocialNeedBelow: 60,
} as const

function isExhausted(vitals: LifeVitalsSnapshot | null | undefined): boolean {
  if (!vitals || typeof vitals.energy !== 'number' || !Number.isFinite(vitals.energy)) return false
  return vitals.energy <= LIFE_GATING_THRESHOLDS.exhaustedEnergyMax
}

function isLowMoodWithdrawn(vitals: LifeVitalsSnapshot | null | undefined): boolean {
  if (!vitals) return false
  const mood = typeof vitals.mood === 'number' && Number.isFinite(vitals.mood) ? vitals.mood : null
  const socialNeed = typeof vitals.socialNeed === 'number' && Number.isFinite(vitals.socialNeed) ? vitals.socialNeed : null
  if (mood === null || socialNeed === null) return false
  return mood <= LIFE_GATING_THRESHOLDS.withdrawnMoodMax && socialNeed < LIFE_GATING_THRESHOLDS.withdrawnSocialNeedBelow
}

/**
 * 统一判定某项生活行为在当前体征与关系阶段下是否允许执行。
 */
export function evaluateLifeActionGating(input: LifeActionGatingInput): LifeActionGatingDecision {
  const stage: RelationshipStage = input.relationshipStage ?? 'stranger'

  switch (input.kind) {
    case 'auto_moment': {
      if (input.hasRelationshipMilestone) return { allow: true, reason: 'ok' }
      if (isExhausted(input.vitals)) return { allow: false, reason: 'low-energy' }
      if (isLowMoodWithdrawn(input.vitals)) return { allow: false, reason: 'low-mood-withdrawn' }
      return { allow: true, reason: 'ok' }
    }

    case 'travel_progression': {
      if (isExhausted(input.vitals)) return { allow: false, reason: 'low-energy' }
      return { allow: true, reason: 'ok' }
    }

    case 'vulnerability': {
      // 初识阶段不触发深夜脆弱倾诉，避免交浅言深；熟悉与默契阶段放行。
      if (stage === 'stranger') return { allow: false, reason: 'relationship-too-early' }
      return { allow: true, reason: 'ok' }
    }

    case 'spontaneous_impulse': {
      if (isExhausted(input.vitals)) return { allow: false, reason: 'low-energy' }
      return { allow: true, reason: 'ok' }
    }

    case 'private_journal_visibility': {
      if (stage === 'stranger') return { allow: false, reason: 'relationship-too-early' }
      return { allow: true, reason: 'ok' }
    }
  }
}
