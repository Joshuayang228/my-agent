/**
 * 语气收放控制器（M27-G3）
 *
 * 背景：长工具链/报错时宜紧；安慰/闲聊时可软——不能纯靠模型自觉。
 * 意图：结合 reply-stance、executionMode、会话种别与报错信号，产出语气+aside 策略注入 Prompt。
 * 约束：启发式不调 LLM；不硬拦 Loop；与人设染色（aside_style）正交——只管收放，不管「是谁」。
 */

import type { ReplyStance } from './reply-stance'

export type ToneRegister = 'tight' | 'soft' | 'neutral'
export type AsidePolicy = 'discourage' | 'optional' | 'encourage-once'

export interface ToneControlResult {
  register: ToneRegister
  asidePolicy: AsidePolicy
  signals: string[]
  guidance: string
}

const RE_ERROR_CLIMAX =
  /报错|堆栈|stack\s*trace|exception|失败了|又崩|panic|TypeError|Cannot find|EACCES|FATAL/i

const GUIDANCE: Record<ToneRegister, string> = {
  tight:
    '主答：紧、短、可执行（结论→步骤→验证）；少铺垫。aside：本轮尽量不要，除非一句能减压且不占事实。',
  soft:
    '主答：可软一点接住情绪，但仍给一个轻量下一步；别写成小作文鸡汤。aside：最多一句，点到为止。',
  neutral:
    '主答：按人设自然回应。aside：可选一句，勿连续多轮都有。',
}

const ASIDE_LINE: Record<AsidePolicy, string> = {
  discourage: 'Aside policy: discourage（本轮优先无旁白）',
  optional: 'Aside policy: optional（自然才写）',
  'encourage-once': 'Aside policy: encourage-once（可一句心疼/吐槽，勿夺主答）',
}

export interface ResolveToneControlInput {
  stance: ReplyStance
  executionMode?: string
  sessionKind?: 'main' | 'summon'
  userText?: string
}

/**
 * 解析本轮语气收放。
 * 优先级信号：报错高潮/confirm|plan/act → tight；comfort → soft；其余中性。
 */
export function resolveToneControl(input: ResolveToneControlInput): ToneControlResult {
  const signals: string[] = []
  const text = (input.userText || '').trim()
  const errorClimax = text.length > 0 && RE_ERROR_CLIMAX.test(text)
  if (errorClimax) signals.push('error-climax')
  if (input.executionMode === 'confirm-all') signals.push('confirm-all')
  if (input.executionMode === 'plan-first') signals.push('plan-first')
  if (input.sessionKind === 'summon') signals.push('summon')
  signals.push(`stance:${input.stance}`)

  let register: ToneRegister = 'neutral'
  let asidePolicy: AsidePolicy = 'optional'

  if (
    errorClimax ||
    input.executionMode === 'confirm-all' ||
    input.executionMode === 'plan-first' ||
    input.stance === 'act' ||
    input.stance === 'pushback'
  ) {
    register = 'tight'
    asidePolicy = 'discourage'
  } else if (input.stance === 'comfort') {
    register = 'soft'
    asidePolicy = 'encourage-once'
  } else if (input.stance === 'ask' && input.executionMode === 'plan-first') {
    register = 'tight'
    asidePolicy = 'discourage'
  }

  // 召唤：人设全开，但旁白仍克制（已有「不推进生活」声明）
  if (input.sessionKind === 'summon' && register === 'neutral') {
    asidePolicy = 'optional'
    signals.push('summon-soft-bound')
  }

  const guidance = [
    `Tone register: ${register}`,
    ASIDE_LINE[asidePolicy],
    `Guidance: ${GUIDANCE[register]}`,
  ].join('\n')

  return { register, asidePolicy, signals, guidance }
}

/** 拼进 System Prompt；与 Reply stance 分节 */
export function formatToneControlForPrompt(result: ToneControlResult): string {
  return result.guidance
}

export const __test = {
  RE_ERROR_CLIMAX,
  GUIDANCE,
}
