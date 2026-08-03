/**
 * Moments 卡司互动派生（M26-G1）
 *
 * 背景：朋友圈默认只见 active；圈子感需要「别人出现」但不另开真相。
 * 意图：对已 published 事件，用名册浅层 + 确定性种子派生评论/同框，写入 meta。
 * 约束：不 tick/不反思对方；只用 name（及模板句），绝不读他人 protected；
 *       互动是投影附属，不是独立事件行。
 */

import { buildRosterLines, type RosterLine } from '../cast/roster'
import type { CompanionEvent } from '../types'

export type MomentInteraction =
  | { kind: 'coframe'; castId: string; castName: string }
  | { kind: 'comment'; castId: string; castName: string; text: string }

const SOCIAL_LOC = /咖啡|街道|公园|户外|路上|合租/
const SOCIAL_ACT = /约|朋友|见面|午饭|出门|逛街|聚/

const COMMENT_BY_TYPE: Record<string, string[]> = {
  colleague: ['工位见～', '辛苦啦', '下次一起午饭？'],
  friend: ['哈哈哈', '下次叫上我', '看起来很开心嘛'],
  family: ['注意休息', '想你了', '记得吃饭'],
  mentor: ['不错', '有进步', '慢慢来'],
  rival: ['还行吧', '下次见真章', '哼'],
  acquaintance: ['路过点个赞', '巧了', '下次再见'],
}

const COMMENT_DEFAULT = ['赞一个', '看起来不错', '收到～']

function hashSeed(eventId: string, scheduledAt: number): number {
  let h = scheduledAt >>> 0
  for (let i = 0; i < eventId.length; i++) {
    h = (Math.imul(h, 31) + eventId.charCodeAt(i)) >>> 0
  }
  return h
}

function socialAffinity(event: CompanionEvent): number {
  const p = event.payload
  const loc = String(p.location ?? '')
  const act = String(p.activity ?? '')
  const theme = String(p.theme ?? '')
  let score = 0
  if (event.type === 'moment') score += 1
  if (SOCIAL_LOC.test(loc)) score += 2
  if (SOCIAL_ACT.test(act) || SOCIAL_ACT.test(theme)) score += 2
  return score
}

function pickCommentText(relationType: string, seed: number): string {
  const pool = COMMENT_BY_TYPE[relationType] ?? COMMENT_DEFAULT
  return pool[seed % pool.length]
}

export interface DeriveCastInteractionsOpts {
  universeId?: string
  /** 单测注入，避免依赖宇宙文件 */
  roster?: RosterLine[]
}

/**
 * 从事件 + 名册派生 0～2 条互动（确定性）。
 * 应用场景：projectMomentFromEvent 写入 meta.interactions。
 */
export function deriveCastInteractions(
  event: CompanionEvent,
  opts?: DeriveCastInteractionsOpts,
): MomentInteraction[] {
  if (event.status !== 'published') return []
  if (event.type !== 'moment') return []

  const roster = opts?.roster ?? buildRosterLines(event.roleId, opts?.universeId ?? 'default')
  if (!roster.length) return []

  const seed = hashSeed(event.id, event.scheduledAt)
  const affinity = socialAffinity(event)
  // 非社交场景大多跳过；社交场景更常出现
  if (affinity < 2 && seed % 5 !== 0) return []
  if (affinity >= 2 && seed % 4 === 0) return [] // 偶尔也不出现，避免条条都有人

  const out: MomentInteraction[] = []
  const a = roster[seed % roster.length]
  const b = roster[(seed + 1) % roster.length]
  const mode = seed % 3

  if (mode === 0 || mode === 2) {
    out.push({ kind: 'coframe', castId: a.otherId, castName: a.otherName })
  }
  if (mode === 1 || mode === 2) {
    const commenter = mode === 2 ? b : a
    out.push({
      kind: 'comment',
      castId: commenter.otherId,
      castName: commenter.otherName,
      text: pickCommentText(commenter.relationType, seed >> 3),
    })
  }

  return out.slice(0, 2)
}

export const __test = {
  hashSeed,
  socialAffinity,
  pickCommentText,
}
