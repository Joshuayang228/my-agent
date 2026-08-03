/**
 * 压缩保护「关系最小集」白名单（M30-G2）
 *
 * 背景：Collapse/AutoCompact 易把称呼偏好、共同约定、情感锚点当废纸摘要掉。
 * 意图：显式白名单 + 从待压缩消息启发式抽取，强制并入摘要块。
 * 约束：不调 LLM；不改 snip 条数策略；条目截断防膨胀；与持久记忆互补非替代。
 */

import type { ChatMessage } from '../../../src/shared/types'

/** 产品白名单：压缩时不可当废纸的关系类信息（对照 M30§三） */
export const RELATIONSHIP_MINSET_WHITELIST = [
  '称呼与沟通偏好',
  '进行中的共同约定',
  '未完成的情感锚点（用户要求先别提/别问的事）',
] as const

export type RelationshipMinSetKind =
  | 'address_pref'
  | 'joint_commitment'
  | 'emotion_anchor'

export interface RelationshipMinSetItem {
  kind: RelationshipMinSetKind
  text: string
}

const KIND_LABEL: Record<RelationshipMinSetKind, string> = {
  address_pref: '称呼/沟通偏好',
  joint_commitment: '共同约定',
  emotion_anchor: '情感锚点',
}

const RE_ADDRESS =
  /叫我|称呼我|别叫我|请叫|喊我|说话(短|简洁)|别太(热情|油)|沟通(风格|方式)|回复(短|长)一点|用中文|用英文/i

const RE_COMMIT =
  /这周|约定|答应(你|我)|我们一起|务必|一定要|记得帮我|别忘了|截止|deadline|待办|我们说好|约好/i

const RE_ANCHOR =
  /先别提|不要提|别再说|别问|暂时别|不想聊|保密|别告诉别人|别外传|别提那(件|个)事/i

const ITEM_MAX = 120
const EXTRACT_MAX = 8

function classifyLine(text: string): RelationshipMinSetKind | null {
  if (RE_ANCHOR.test(text)) return 'emotion_anchor'
  if (RE_COMMIT.test(text)) return 'joint_commitment'
  if (RE_ADDRESS.test(text)) return 'address_pref'
  return null
}

/**
 * 从待压缩消息中抽取关系最小集候选项。
 * 优先用户话；助手复述约定也可（有据回调）。
 */
export function extractRelationshipMinSet(
  messages: ChatMessage[],
  limit = EXTRACT_MAX,
): RelationshipMinSetItem[] {
  const out: RelationshipMinSetItem[] = []
  const seen = new Set<string>()

  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue
    const raw = (m.content || '').trim()
    if (!raw || raw.length < 4) continue
    // 按句粗切，避免整段长文只命中一次 kind
    const chunks = raw.split(/[。！？\n]/).map((s) => s.trim()).filter((s) => s.length >= 4)
    for (const chunk of chunks.length ? chunks : [raw]) {
      const kind = classifyLine(chunk)
      if (!kind) continue
      const text = chunk.replace(/\s+/g, ' ').slice(0, ITEM_MAX)
      const key = `${kind}:${text}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ kind, text })
      if (out.length >= limit) return out
    }
  }
  return out
}

/** 写入压缩 instruction 的白名单说明（给摘要 LLM） */
export function formatMinSetWhitelistForCompactPrompt(): string {
  const bullets = RELATIONSHIP_MINSET_WHITELIST.map((w) => `- ${w}`).join('\n')
  return `## 关系最小集（必须保留）
以下类别若在对话中出现，必须写入本节，禁止省略或改写成「无」：
${bullets}
若原文没有则写「无」。不要编造未出现的关系事实。`
}

export function formatMinSetBlock(items: RelationshipMinSetItem[]): string {
  if (!items.length) {
    return '## 关系最小集\n无'
  }
  const lines = items.map((i) => `- [${KIND_LABEL[i.kind]}] ${i.text}`)
  return ['## 关系最小集', ...lines].join('\n')
}

/**
 * 把抽取结果并入摘要：已有「关系最小集」节则补缺；否则追加整节。
 */
export function mergeMinSetIntoSummary(
  summary: string,
  items: RelationshipMinSetItem[],
): string {
  const block = formatMinSetBlock(items)
  if (!items.length) {
    // 仍写入显式节，避免下游以为「可以不管关系」
    if (/##\s*关系最小集/.test(summary)) return summary
    return `${summary.trimEnd()}\n\n${block}`
  }

  if (/##\s*关系最小集/.test(summary)) {
    // 已有节：在文末再挂「补充抽取」以免覆盖模型已写内容
    const extras = items
      .map((i) => `- [${KIND_LABEL[i.kind]}] ${i.text}`)
      .join('\n')
    return `${summary.trimEnd()}\n\n（压缩管线补充抽取）\n${extras}`
  }

  return `${summary.trimEnd()}\n\n${block}`
}

export const __test = {
  RE_ADDRESS,
  RE_COMMIT,
  RE_ANCHOR,
  KIND_LABEL,
  classifyLine,
}
