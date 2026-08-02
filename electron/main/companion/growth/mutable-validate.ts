/**
 * MUTABLE 结构性防退化校验（M22-G3）
 *
 * 背景：反思/人手写入若只靠 Prompt，仍可能把事实流水账或 PROTECTED 克隆写进默契区。
 * 意图：纯规则、可单测、无 LLM；挡住明显退化，不追求完美语义审稿。
 * 约束：失败应拒绝写入并给出短 reason；回滚路径可跳过。
 */

/** 与 reflection-service 对齐的软上限 */
export const MUTABLE_MAX_CHARS = 800
export const MUTABLE_MIN_CHARS = 8

/** 本地 bigram Jaccard；不依赖 memory-store，避免测试 mock 断链 */
function textSimilarity(a: string, b: string): number {
  const na = a.replace(/\s+/g, '').toLowerCase()
  const nb = b.replace(/\s+/g, '').toLowerCase()
  if (!na || !nb) return 0
  if (na === nb) return 1
  const grams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    if (s.length === 1) set.add(s)
    return set
  }
  const A = grams(na)
  const B = grams(nb)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

export type MutableRejectCode =
  | 'empty'
  | 'too-short'
  | 'too-long'
  | 'protected-clone'
  | 'protected-quote'
  | 'sudden-bloat'
  | 'fact-dump'
  | 'anchor-drift'

export interface MutableValidateInput {
  candidate: string
  current: string
  protectedText: string
  mutableDefault: string
}

export type MutableValidateResult =
  | { ok: true }
  | { ok: false; code: MutableRejectCode; reason: string }

function longestSharedSubstring(a: string, b: string, maxScan = 400): number {
  const s = a.slice(0, maxScan)
  const t = b.slice(0, maxScan)
  if (!s || !t) return 0
  let best = 0
  for (let i = 0; i < s.length; i++) {
    for (let j = 0; j < t.length; j++) {
      let k = 0
      while (i + k < s.length && j + k < t.length && s[i + k] === t[j + k]) k++
      if (k > best) best = k
      if (best >= 48) return best
    }
  }
  return best
}

/** 像「事实流水账 / 日记」而非行为默认值 */
function looksLikeFactDump(text: string): boolean {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  let hits = 0
  const patterns = [
    /用户叫|用户的名字|真名叫/,
    /\d{4}[-/年]\d{1,2}/, // 日期
    /昨天|今天早上|上周三|明天要/,
    /https?:\/\//i,
    /住在|电话是|邮箱是|身份证/,
    /我昨天|我刚才|刚刚发生/,
  ]
  for (const line of lines) {
    for (const p of patterns) {
      if (p.test(line)) {
        hits += 1
        break
      }
    }
  }
  // 多条命中，或短文里一条强事实句占比过高
  if (hits >= 2) return true
  if (hits >= 1 && lines.length <= 2 && text.length < 120) return true
  return false
}

/**
 * 校验候选 MUTABLE 是否可写入。
 */
export function validateMutableCandidate(input: MutableValidateInput): MutableValidateResult {
  const candidate = input.candidate.trim()
  const current = input.current.trim()
  const protectedText = input.protectedText.trim()
  const mutableDefault = input.mutableDefault.trim()

  if (!candidate) {
    return { ok: false, code: 'empty', reason: 'MUTABLE 不能为空' }
  }
  if (candidate.length < MUTABLE_MIN_CHARS) {
    return { ok: false, code: 'too-short', reason: `MUTABLE 过短（<${MUTABLE_MIN_CHARS}）` }
  }
  if (candidate.length > MUTABLE_MAX_CHARS) {
    return {
      ok: false,
      code: 'too-long',
      reason: `MUTABLE 超过 ${MUTABLE_MAX_CHARS} 字`,
    }
  }

  if (protectedText) {
    const shared = longestSharedSubstring(candidate, protectedText)
    if (shared >= 40) {
      return {
        ok: false,
        code: 'protected-quote',
        reason: '疑似整段抄入 PROTECTED 原文',
      }
    }
    const simProt = textSimilarity(candidate, protectedText.slice(0, 600))
    if (simProt >= 0.55) {
      return {
        ok: false,
        code: 'protected-clone',
        reason: '与 PROTECTED 过于相似，疑似人格克隆',
      }
    }
  }

  if (current && candidate.length > Math.max(Math.floor(current.length * 2.5), current.length + 350)) {
    return {
      ok: false,
      code: 'sudden-bloat',
      reason: '相对当前版本突然暴涨，疑似灌水',
    }
  }

  if (looksLikeFactDump(candidate)) {
    return {
      ok: false,
      code: 'fact-dump',
      reason: '疑似事实/日记流水账，应写入记忆而非 MUTABLE',
    }
  }

  // 相对「当前 ∪ 出厂默认」双锚点都极不像，且正文不短 → 漂移过大
  const anchor = [current, mutableDefault].filter(Boolean).join('\n')
  if (anchor && candidate.length >= 80) {
    const simAnchor = textSimilarity(candidate, anchor.slice(0, 800))
    if (simAnchor < 0.06) {
      return {
        ok: false,
        code: 'anchor-drift',
        reason: '相对出厂/当前默契漂移过大',
      }
    }
  }

  return { ok: true }
}
