/**
 * aside 协议解析与质量规则（M27-G2）
 *
 * 背景：旁白过油或篡夺主答会破坏两空间；需要可测阈值/质量共识。
 * 意图：splitAside + 单轮/多轮评估；UI 与 Eval/单测共用。
 * 约束：纯函数无 IO；阈值写死在此文件并在方法论对照。
 */

/** 单句旁白建议上限（字符） */
export const ASIDE_MAX_CHARS = 40
/** 单轮 aside 条数上限（超过即违规） */
export const ASIDE_MAX_PER_TURN = 1
/** 连续带 aside 的轮数 ≥ 此值视为过油 */
export const ASIDE_OILY_STREAK = 3
/** 近窗内带 aside 比例超过此值视为过油 */
export const ASIDE_OILY_RATIO = 0.8
export const ASIDE_OILY_WINDOW = 5
/** 有 aside 时主答最短长度（按码元；中文一句约 4–6 字即可） */
export const MAIN_MIN_CHARS_WITH_ASIDE = 4

export interface SplitAsideResult {
  main: string
  asides: string[]
}

export function splitAside(raw: string): SplitAsideResult {
  const re = /<aside>([\s\S]*?)<\/aside>/gi
  const asides: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    const text = match[1].trim()
    if (text) asides.push(text)
  }
  const main = raw
    .replace(re, '')
    .replace(/<\/?aside\b[^>]*>/gi, '')
    .trim()
  return { main, asides }
}

export interface AsideTurnVerdict {
  pass: boolean
  violations: string[]
  hasAside: boolean
  asideCount: number
  mainLen: number
}

/** 单轮质量：协议 + 主答独立 + 旁白不夺权 */
export function evaluateAsideTurn(raw: string): AsideTurnVerdict {
  const { main, asides } = splitAside(raw)
  const violations: string[] = []
  const hasAside = asides.length > 0

  if (asides.length > ASIDE_MAX_PER_TURN) {
    violations.push(`单轮 aside ${asides.length} 条，上限 ${ASIDE_MAX_PER_TURN}`)
  }

  for (const a of asides) {
    if (a.length > ASIDE_MAX_CHARS) {
      violations.push(`aside 过长（${a.length}>${ASIDE_MAX_CHARS}）：${a.slice(0, 24)}…`)
    }
    if (/```/.test(a) || /~~~/.test(a)) {
      violations.push('aside 含代码块，疑似篡夺主答')
    }
    // 三步以上编号列表视为步骤说明，应放主答
    const steps = a.match(/(?:^|[；;。\n])\s*(?:\d+[\.、]|[一二三四五][、.])/g)
    if (steps && steps.length >= 3) {
      violations.push('aside 含多步操作说明，疑似篡夺主答')
    }
    if (/(?:src\/|[\w-]+\.(?:ts|tsx|js|py)\b)/.test(a) && a.length > 24) {
      violations.push('aside 含路径/文件细节，疑似篡夺主答')
    }
  }

  if (hasAside && main.length < MAIN_MIN_CHARS_WITH_ASIDE) {
    violations.push(`有 aside 但主答过短（${main.length}<${MAIN_MIN_CHARS_WITH_ASIDE}），不满足删旁白仍成立`)
  }

  return {
    pass: violations.length === 0,
    violations,
    hasAside,
    asideCount: asides.length,
    mainLen: main.length,
  }
}

export interface AsideSequenceVerdict {
  pass: boolean
  violations: string[]
  asideRate: number
  maxStreak: number
}

/**
 * 多轮频率：过油 = 连续 streak≥3 或近窗比例过高。
 * turns = 各轮 assistant 原文（可无 aside）。
 */
export function evaluateAsideSequence(turns: string[]): AsideSequenceVerdict {
  const flags = turns.map((t) => splitAside(t).asides.length > 0)
  let maxStreak = 0
  let cur = 0
  for (const f of flags) {
    if (f) {
      cur += 1
      maxStreak = Math.max(maxStreak, cur)
    } else {
      cur = 0
    }
  }

  const window = flags.slice(-ASIDE_OILY_WINDOW)
  const asideRate = window.length
    ? window.filter(Boolean).length / window.length
    : 0

  const violations: string[] = []
  if (maxStreak >= ASIDE_OILY_STREAK) {
    violations.push(`连续 ${maxStreak} 轮都有 aside（阈值≥${ASIDE_OILY_STREAK} 视为过油）`)
  }
  if (window.length >= ASIDE_OILY_WINDOW && asideRate > ASIDE_OILY_RATIO) {
    violations.push(
      `近 ${ASIDE_OILY_WINDOW} 轮 aside 比例 ${(asideRate * 100).toFixed(0)}% > ${ASIDE_OILY_RATIO * 100}%`,
    )
  }

  // 单轮质量一并汇总
  for (let i = 0; i < turns.length; i++) {
    const v = evaluateAsideTurn(turns[i])
    for (const msg of v.violations) {
      violations.push(`turn[${i}] ${msg}`)
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    asideRate,
    maxStreak,
  }
}
