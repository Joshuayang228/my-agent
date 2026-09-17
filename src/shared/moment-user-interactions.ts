/**
 * 朋友圈用户互动展示
 *
 * 背景：Playground 赞 / 评论只是本地 React 状态；正式页需要真实落库，但不能改动态正文或卡司投影。
 * 设计意图：用户赞和评论是独立用户态，不写入 meta.interactions，也不改 moment.text。
 * 关键约束：卡司评论始终在前、用户评论在后；同一动态最多一条用户赞；评论去空白后为空或超长必须拒绝。
 */

import type {
  MomentSocialView,
  MomentUserCommentView,
  MomentUserInteractionKind,
  MomentUserLikeView,
} from './types'

export type {
  MomentSocialView,
  MomentUserCommentView,
  MomentUserInteractionKind,
  MomentUserLikeView,
}

export const MOMENT_USER_ACTOR_ID = 'user'
export const MOMENT_USER_ACTOR_NAME = '我'
export const MOMENT_COMMENT_MAX_LENGTH = 280

export interface MomentUserInteraction {
  id: string
  momentId: string
  roleId: string
  kind: MomentUserInteractionKind
  actorId: string
  text: string | null
  createdAt: number
}

export interface MomentCastInteractionView {
  kind: 'coframe' | 'comment'
  castId?: string
  castName: string
  text?: string
}

export interface MomentMergedCommentView {
  key: string
  actorName: string
  text: string
  source: 'cast' | 'user'
}

export function normalizeMomentCommentText(
  value: unknown,
): { ok: true; text: string } | { ok: false; error: string; code: 'INVALID' } {
  if (typeof value !== 'string') {
    return { ok: false, error: '评论不能为空', code: 'INVALID' }
  }
  const text = value.replace(/\r\n/g, '\n').trim()
  if (!text) {
    return { ok: false, error: '评论不能为空', code: 'INVALID' }
  }
  if (text.length > MOMENT_COMMENT_MAX_LENGTH) {
    return { ok: false, error: `评论不能超过 ${MOMENT_COMMENT_MAX_LENGTH} 字`, code: 'INVALID' }
  }
  return { ok: true, text }
}

export function parseCastInteractions(
  meta: Record<string, unknown> | null | undefined,
): MomentCastInteractionView[] {
  const raw = meta?.interactions
  if (!Array.isArray(raw)) return []
  const out: MomentCastInteractionView[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const castName = typeof record.castName === 'string' ? record.castName : ''
    const kind = record.kind === 'coframe' || record.kind === 'comment' ? record.kind : null
    if (!castName || !kind) continue
    out.push({
      kind,
      castId: typeof record.castId === 'string' ? record.castId : undefined,
      castName,
      text: typeof record.text === 'string' ? record.text : undefined,
    })
  }
  return out
}

export function groupMomentUserInteractions(rows: readonly MomentUserInteraction[]): {
  likesByMomentId: Map<string, MomentUserLikeView>
  commentsByMomentId: Map<string, MomentUserCommentView[]>
} {
  const likesByMomentId = new Map<string, MomentUserLikeView>()
  const commentsByMomentId = new Map<string, MomentUserCommentView[]>()
  for (const row of rows) {
    if (row.kind === 'like') {
      likesByMomentId.set(row.momentId, { id: row.id, createdAt: row.createdAt })
      continue
    }
    if (row.kind !== 'comment' || !row.text) continue
    const list = commentsByMomentId.get(row.momentId) ?? []
    list.push({
      id: row.id,
      actorName: MOMENT_USER_ACTOR_NAME,
      text: row.text,
      createdAt: row.createdAt,
    })
    commentsByMomentId.set(row.momentId, list)
  }
  return { likesByMomentId, commentsByMomentId }
}

export function describeMomentSocial(
  momentId: string,
  rows: readonly MomentUserInteraction[],
): MomentSocialView {
  const { likesByMomentId, commentsByMomentId } = groupMomentUserInteractions(rows)
  const like = likesByMomentId.get(momentId)
  const comments = commentsByMomentId.get(momentId) ?? []
  return {
    liked: Boolean(like),
    likeCount: like ? 1 : 0,
    like,
    comments,
    commentCount: comments.length,
  }
}

export function mergeMomentComments(
  cast: readonly MomentCastInteractionView[],
  user: readonly MomentUserCommentView[],
): MomentMergedCommentView[] {
  const fromCast = cast
    .filter((item) => item.kind === 'comment')
    .map((item, index) => ({
      key: 'cast-' + (item.castId ?? item.castName) + '-' + String(index),
      actorName: item.castName,
      text: item.text || '赞',
      source: 'cast' as const,
    }))
  const fromUser = user.map((item) => ({
      key: 'user-' + item.id,
      actorName: item.actorName,
      text: item.text,
      source: 'user' as const,
    }))
  return [...fromCast, ...fromUser]
}

export function emptyMomentSocial(): MomentSocialView {
  return { liked: false, likeCount: 0, comments: [], commentCount: 0 }
}
