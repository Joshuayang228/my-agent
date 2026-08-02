/**
 * 对话 ↔ 最近 Moment 薄一致性（M24-G1）
 *
 * 背景：圈与对话同源是地板；硬裁判拦回复是天花板，易误伤。
 * 意图：① Assemble 注入近 1–3 条 Moment 锚点；② 纯规则软校验，供测/调试，不阻断 Loop。
 * 约束：不整库灌圈；不写 prompt-builder 长文案；召唤会话不注入对方圈。
 */

import type { CompanionMoment } from '../types'
import { listMomentsForRole } from './moments'

export const RECENT_MOMENTS_PROMPT_LIMIT = 3

const LOCATION_HINTS = [
  '家', '工位', '路上', '咖啡馆', '附近街道', '公园', '合租', '公寓',
]

function formatLocalStamp(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

function locationFromMoment(m: CompanionMoment): string {
  const metaLoc = m.meta?.location
  if (typeof metaLoc === 'string' && metaLoc.trim()) return metaLoc.trim()
  // text 形如「午饭散步（放松） · 附近街道 · 穿着x」
  const parts = m.text.split('·').map((s) => s.trim())
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    if (!p || p.startsWith('穿着')) continue
    if (LOCATION_HINTS.some((h) => p.includes(h)) || p.length <= 12) return p
  }
  return ''
}

/**
 * 压成 Assemble 用薄切片（无动态时返回空串）。
 */
export function formatRecentMomentsForPrompt(
  moments: CompanionMoment[],
  limit = RECENT_MOMENTS_PROMPT_LIMIT,
): string {
  const lines: string[] = []
  for (const m of moments.slice(0, limit)) {
    const text = m.text.trim().slice(0, 100)
    if (!text) continue
    lines.push(`- ${formatLocalStamp(m.publishedAt)} ${text}`)
  }
  if (lines.length === 0) return ''
  return [
    '最近朋友圈（同源事件投影，勿编造未发生动态）：',
    ...lines,
    '提及近况时避免与上列地点/心情明显打架；用户纠正时以用户为准。',
  ].join('\n')
}

export interface MomentConsistencyWarning {
  code: 'location-clash'
  detail: string
}

export interface MomentConsistencyResult {
  ok: boolean
  warnings: MomentConsistencyWarning[]
}

/**
 * 软校验：回复是否与最近 Moment 地点明显冲突。
 * 不追求 NLP；只挡「刚发在家，嘴上却在工位」这类硬打脸。
 */
export function checkReplyAgainstRecentMoments(
  reply: string,
  moments: CompanionMoment[],
): MomentConsistencyResult {
  const warnings: MomentConsistencyWarning[] = []
  const text = reply.trim()
  if (!text || moments.length === 0) return { ok: true, warnings }

  const latest = moments[0]
  const anchorLoc = locationFromMoment(latest)
  if (!anchorLoc) return { ok: true, warnings }

  // 回复里点名了其它已知地点，且未提及锚点地点
  const mentionedOther = LOCATION_HINTS.filter(
    (h) => h !== anchorLoc && !anchorLoc.includes(h) && text.includes(h),
  )
  const mentionsAnchor = text.includes(anchorLoc)
    || LOCATION_HINTS.some((h) => anchorLoc.includes(h) && text.includes(h))

  if (mentionedOther.length > 0 && !mentionsAnchor) {
    // 仅当回复像在陈述「自己在某处」时告警（粗启发式）
    const selfPlace = /我(在|刚到|还在|正待在)|这会儿在|现在在/.test(text)
    if (selfPlace) {
      warnings.push({
        code: 'location-clash',
        detail: `最近动态地点「${anchorLoc}」，回复却自称在「${mentionedOther[0]}」`,
      })
    }
  }

  return { ok: warnings.length === 0, warnings }
}

/** 拉取并格式化当前角色近 Moment（供 Assemble） */
export async function collectRecentMomentsSlice(
  roleId: string,
  opts?: { limit?: number },
): Promise<{
  slice: string
  moments: CompanionMoment[]
}> {
  const limit = opts?.limit ?? RECENT_MOMENTS_PROMPT_LIMIT
  const moments = await listMomentsForRole(roleId, { limit })
  return {
    slice: formatRecentMomentsForPrompt(moments, limit),
    moments,
  }
}
