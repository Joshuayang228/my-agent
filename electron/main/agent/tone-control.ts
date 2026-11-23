/**
 * 语气收放控制器（M27-G3）
 *
 * 背景：长工具链/报错时宜紧；安慰/闲聊时可软——不能纯靠模型自觉。
 * 意图：结合 reply-stance、executionMode、会话种别与报错信号，产出语气+aside 策略注入 Prompt。
 * 约束：启发式不调 LLM；不硬拦 Loop；与人设染色（aside_style）正交——只管收放，不管「是谁」。
 */

import type { ReplyStance } from './reply-stance'
import { shouldSuppressAside } from '../../../src/shared/aside'

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

/**
 * 识别用户显式提出严格输出格式/结构/字数/大小写/禁用词约束的请求。
 *
 * 背景：Google IFEval 与 skill-loading 实测显示，当用户要求精确格式（无前后解释、全小写、
 *       精确段落/列表/占位符或字数边界）时，人格化过渡语或 `~>` 旁白会导致严格校验失败。
 * 设计意图：仅在检测到显式格式/结构约束信号时收紧语气并抑制旁白，平时闲聊与情感陪伴零受影响。
 * 关键约束：保持纯启发式零 LLM 调用，且不得误触发普通情绪倾诉或常规问答。
 */
const RE_STRICT_FORMAT_CONSTRAINT =
  /只输出|仅输出|严格按|严格遵守|不要多余|不要解释|不要加|禁止出现|严禁出现|纯\s*JSON|无围栏|字数在|不少于\s*\d+|不超过\s*\d+|正好\s*\d+|全部大写|全部小写|\b(?:strictly|exact\s+format|only\s+output|output\s+only|return\s+only|no\s+other\s+text|no\s+explanation|without\s+any\s+(?:extra|additional|other)|all\s+lowercase|all\s+capital|entire\s+response\s+should\s+be\s+in|highlighted\s+sections?|bullet\s+points?|placeholders?|first\s+word\s+of|at\s+least\s+\d+\s+(?:words?|sentences?|paragraphs?|sections?|bullet)|no\s+more\s+than\s+\d+\s+(?:words?|sentences?|paragraphs?)|exactly\s+\d+\s+(?:words?|sentences?|paragraphs?|bullet|sections?))\b/i

const STRICT_FORMAT_GUIDANCE =
  '格式守约：本轮用户指定了明确的输出格式、字数、大小写或结构约束。必须逐条严格满足，严禁添加开场白、结束语、额外解释、多余 Markdown 包装或内心独白（~>）。'

const GUIDANCE: Record<ToneRegister, string> = {
  tight:
    '主答：紧、短、可执行（结论→步骤→验证）；少铺垫。',
  soft:
    '主答：可软一点接住情绪，但仍给一个轻量下一步；别写成小作文鸡汤。',
  neutral:
    '主答：按人设自然回应，直率清晰。',
}

export interface ResolveToneControlInput {
  stance: ReplyStance
  executionMode?: string
  sessionKind?: 'main' | 'summon'
  userText?: string
  /** 最近若干轮助手回复原文，用于内心独白硬冷却 */
  recentAssistantTurns?: string[]
}

/**
 * 解析本轮语气收放。
 * 优先级信号：报错高潮/confirm|plan/act → tight；comfort → soft；其余中性。
 * 冷却期内强制 discourage，让运行时直接省略内心独白格式段，避免反复提醒导致刷屏。
 */
export function resolveToneControl(input: ResolveToneControlInput): ToneControlResult {
  const signals: string[] = []
  const text = (input.userText || '').trim()
  const errorClimax = text.length > 0 && RE_ERROR_CLIMAX.test(text)
  const strictFormat = text.length > 0 && RE_STRICT_FORMAT_CONSTRAINT.test(text)
  if (errorClimax) signals.push('error-climax')
  if (strictFormat) signals.push('strict-format')
  if (input.executionMode === 'confirm-all') signals.push('confirm-all')
  if (input.executionMode === 'plan-first') signals.push('plan-first')
  if (input.sessionKind === 'summon') signals.push('summon')
  signals.push(`stance:${input.stance}`)

  let register: ToneRegister = 'neutral'
  let asidePolicy: AsidePolicy = 'optional'

  if (
    errorClimax ||
    strictFormat ||
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

  // 最近几轮已出现过内心独白 → 硬冷却，本轮不再注入内心独白格式说明
  if (asidePolicy !== 'discourage' && shouldSuppressAside(input.recentAssistantTurns)) {
    asidePolicy = 'discourage'
    signals.push('aside-cooldown')
  }

  const guidanceLines = [
    `语气档位：${register}`,
    `行动指引：${GUIDANCE[register]}`,
  ]
  if (strictFormat) {
    guidanceLines.push(STRICT_FORMAT_GUIDANCE)
  }
  const guidance = guidanceLines.join('\n')

  return { register, asidePolicy, signals, guidance }
}

/** 拼进 System Prompt；与 Reply stance 分节 */
export function formatToneControlForPrompt(result: ToneControlResult): string {
  return result.guidance
}

export const __test = {
  RE_ERROR_CLIMAX,
  RE_STRICT_FORMAT_CONSTRAINT,
  GUIDANCE,
}
