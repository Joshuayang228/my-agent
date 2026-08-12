/**
 * 用户专家度 → 能力解释粒度（M30-G3）
 *
 * 背景：对新手讲太多术语会懵，对熟手讲「什么是 git」会冒犯。
 * 意图：设置覆盖优先；否则用画像/近窗消息启发式；默认 unknown 偏中性。
 * 约束：不调 LLM；误判成本高 → 不确定不自称专家/小白；只调解释粒度不改权限。
 */

export type ExpertiseLevel = 'novice' | 'intermediate' | 'expert' | 'unknown'

export interface ExpertiseLevelResult {
  level: ExpertiseLevel
  signals: string[]
  guidance: string
  /** 是否来自用户设置显式覆盖 */
  fromOverride: boolean
}

const GUIDANCE: Record<ExpertiseLevel, string> = {
  novice:
    '解释粒度：偏入门。关键术语先一句白话；步骤拆短；仍给可执行下一步，勿灌水讲义。',
  intermediate:
    '解释粒度：中等。默认懂常见概念；只在岔路/风险处多一句；避免小学课堂口吻。',
  expert:
    '解释粒度：偏专家。少铺垫、多结论与差异点；别解释基础命令除非用户问；勿装作比用户懂其领域。',
  unknown:
    '解释粒度：未知。先按中等偏短；用户显露困惑再放慢，显露很熟则收紧废话。勿贴标签叫「小白/大佬」。',
}

const RE_NOVICE =
  /我是新手|刚学|小白|不太懂|能讲详细|通俗一点|什么是\s*\w+|怎么入门|第一次用/i

const RE_EXPERT =
  /资深|架构师|senior|principal|不用解释基础|别讲常识|直接给|我清楚|我知道怎么|PR\s*review|生产环境我来|我熟这套/i

const RE_INTERMEDIATE =
  /有点经验|用过一段时间|不是完全新手|大概懂|以前写过/i

const RE_PROFILE_NOVICE = /新手|初学|刚转行|自学中/i
const RE_PROFILE_EXPERT = /资深|架构|专家|tech\s*lead|十年|10\+?\s*年/i

function normalizeOverride(raw?: string): ExpertiseLevel | null {
  const v = (raw || '').trim().toLowerCase()
  if (v === 'novice' || v === 'intermediate' || v === 'expert' || v === 'unknown') {
    return v
  }
  if (v === 'auto' || v === '') return null
  return null
}

export interface ResolveExpertiseInput {
  /** settings.userExpertiseLevel；auto/空 = 启发式 */
  override?: string
  /** 画像拼接文本（identity/workflow 等） */
  profileText?: string
  /** 近几条用户消息 */
  recentUserTexts?: string[]
}

/**
 * 解析专家度。优先级：显式设置 > 近窗消息 > 画像 > unknown。
 */
export function resolveExpertiseLevel(input: ResolveExpertiseInput): ExpertiseLevelResult {
  const signals: string[] = []
  const ov = normalizeOverride(input.override)
  if (ov) {
    signals.push(`override:${ov}`)
    return {
      level: ov,
      signals,
      guidance: GUIDANCE[ov],
      fromOverride: true,
    }
  }

  const recent = (input.recentUserTexts || []).join('\n')
  if (recent) {
    if (RE_EXPERT.test(recent)) {
      signals.push('recent:expert')
      return pack('expert', signals)
    }
    if (RE_NOVICE.test(recent)) {
      signals.push('recent:novice')
      return pack('novice', signals)
    }
    if (RE_INTERMEDIATE.test(recent)) {
      signals.push('recent:intermediate')
      return pack('intermediate', signals)
    }
  }

  const profile = (input.profileText || '').trim()
  if (profile) {
    if (RE_PROFILE_EXPERT.test(profile)) {
      signals.push('profile:expert')
      return pack('expert', signals)
    }
    if (RE_PROFILE_NOVICE.test(profile)) {
      signals.push('profile:novice')
      return pack('novice', signals)
    }
  }

  signals.push('default-unknown')
  return pack('unknown', signals)
}

function pack(level: ExpertiseLevel, signals: string[]): ExpertiseLevelResult {
  return {
    level,
    signals,
    guidance: GUIDANCE[level],
    fromOverride: false,
  }
}

export function formatExpertiseLevelForPrompt(result: ExpertiseLevelResult): string {
  return [
    `用户专家度（解释粒度）：${result.level}`,
    `触发信号：${result.signals.join(', ') || '无'}`,
    `行动指引：${result.guidance}`,
  ].join('\n')
}

export const __test = {
  GUIDANCE,
  RE_NOVICE,
  RE_EXPERT,
  normalizeOverride,
}
