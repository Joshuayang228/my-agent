/**
 * 角色生命体征（mood / energy / socialNeed）演化规则
 *
 * 背景：世界状态里的三项数值原先只在出厂时写入，之后永远不变；Chat 顶栏永远「心情明朗，精力充足」，
 * 角色跑了一天也不会累，两天没人聊天也不会想找人说话，活人感停在文字描述上。
 * 设计意图：由已发布的生活事件（activity 文本）推导小幅增减，复用既有的事件推进，不新增 LLM 调用、
 * 也不改日剧本的 LLM 输出契约；每次先向常态值回归再叠加增量，避免数值单向塌到 0 或顶满 100。
 * 关键约束：纯函数、结果一律限制在 [0,100]；socialNeed 的「时间累积」由事件推进承担（每个事件 +3 左右，
 * 约一天半到顶），聊天结束时再由 releaseSocialNeedAfterChat 释放，因此不依赖额外的「上次聊天时间」存储。
 * 改规则表时必须同步单测；关键词顺序即优先级（先匹配先生效）。
 */

import type { CompanionWorldState } from '../types'

export interface VitalsDelta {
  mood: number
  energy: number
  socialNeed: number
}

type Vitals = Pick<CompanionWorldState, 'mood' | 'energy' | 'socialNeed'>

/** 向常态值回归的幅度；常态值之外的偏移会在几个事件内被拉回，避免数值单向漂移。 */
const BASELINE = { mood: 65, energy: 70 } as const
const REVERSION = { mood: 0.08, energy: 0.1 } as const
const ENERGY_FLOOR = 8

const ACTIVITY_RULES: Array<{ pattern: RegExp; delta: VitalsDelta }> = [
  { pattern: /睡|午睡|打盹|小憩|休息|躺/, delta: { mood: 2, energy: 22, socialNeed: 2 } },
  { pattern: /吃|饭|餐|烤肉|零食|宴/, delta: { mood: 5, energy: 8, socialNeed: -4 } },
  { pattern: /聊|朋友|伙伴|合唱|唱歌|表演|玩闹|打闹/, delta: { mood: 5, energy: -2, socialNeed: -8 } },
  { pattern: /训|探险|冒险|战斗|决斗|钓|跑|游泳|攀|比赛/, delta: { mood: 4, energy: -10, socialNeed: 2 } },
  { pattern: /守夜|值班|瞭望|修|干活|工作/, delta: { mood: 0, energy: -6, socialNeed: 3 } },
  { pattern: /读|书|看|笔记|画|整理|写/, delta: { mood: 1, energy: -3, socialNeed: 3 } },
]
const DEFAULT_DELTA: VitalsDelta = { mood: 0, energy: -3, socialNeed: 3 }

function clamp(value: number, min = 0): number {
  return Math.max(min, Math.min(100, Math.round(value)))
}

export function deriveVitalsDelta(activity: string): VitalsDelta {
  const text = activity.trim()
  const rule = ACTIVITY_RULES.find(item => item.pattern.test(text))
  return rule ? rule.delta : DEFAULT_DELTA
}

/** 先回归常态再叠加事件增量；socialNeed 不回归，由时间（事件）与聊天直接决定。 */
export function applyVitalsDelta(vitals: Vitals, delta: VitalsDelta): Vitals {
  const mood = vitals.mood + (BASELINE.mood - vitals.mood) * REVERSION.mood + delta.mood
  const energy = vitals.energy + (BASELINE.energy - vitals.energy) * REVERSION.energy + delta.energy
  return {
    mood: clamp(mood),
    energy: clamp(energy, ENERGY_FLOOR),
    socialNeed: clamp(vitals.socialNeed + delta.socialNeed),
  }
}

/** 用户和角色聊过一轮后：想说话的欲望被满足，心情略升；有下限，避免被聊到「完全不想说话」。 */
export function releaseSocialNeedAfterChat(vitals: Vitals): Vitals {
  return {
    mood: clamp(vitals.mood + 2),
    energy: vitals.energy,
    socialNeed: clamp(vitals.socialNeed - 15, 10),
  }
}
