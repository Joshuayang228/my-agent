/**
 * Moments 投影（W3 / M24-G2 / M26-G1）
 *
 * 背景：朋友圈是 published 事件的 UI 截面，不是另一套生活真相。
 * 意图：事件 → companion_moments；可选 LLM 润色；派生卡司互动进 meta。
 * 约束：列表仅按 role 查询；互动不 tick 对方、不写独立真相。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import type { CompanionEvent, CompanionMoment } from '../types'
import {
  MOMENT_USER_ACTOR_ID,
  describeMomentSocial,
  normalizeMomentCommentText,
  type MomentSocialView,
  type MomentUserInteraction,
} from '../../../../src/shared/moment-user-interactions'
import { getAsset, maybeGrantFromEvent } from './assets'
import { formatMomentText } from './moment-format'
import { deriveCastInteractions } from './moment-interactions'
import { resolveMomentText } from './moment-polish'
import * as store from './store'

export { formatMomentText } from './moment-format'

export interface ProjectMomentOpts {
  /** tick 路径可为 true；Catch-up 细补默认 false */
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
}

/** 将已 published 事件投影为 moment（幂等） */
export async function projectMomentFromEvent(
  event: CompanionEvent,
  opts?: ProjectMomentOpts,
): Promise<CompanionMoment | null> {
  if (event.status !== 'published') return null
  let outfitName: string | undefined
  let bookName: string | undefined
  const assetId = typeof event.payload.assetId === 'string' ? event.payload.assetId : null
  const bookAssetId =
    typeof event.payload.bookAssetId === 'string' ? event.payload.bookAssetId : null
  if (assetId) {
    const asset = await getAsset(assetId)
    if (asset) outfitName = asset.name
  }
  if (bookAssetId) {
    const book = await getAsset(bookAssetId)
    if (book) bookName = book.name
  }

  let llmConfig = opts?.llmConfig
  if (opts?.preferLlm && !llmConfig) {
    try {
      llmConfig = await loadAuxLLMConfig()
    } catch {
      llmConfig = undefined
    }
  }

  const { text, source } = await resolveMomentText(event, {
    preferLlm: opts?.preferLlm,
    llmConfig,
    outfitName,
    bookName,
    universeId: opts?.universeId,
  })

  // M26-G1：名册浅派生评论/同框（确定性；无边则空）
  const interactions = deriveCastInteractions(event, {
    universeId: opts?.universeId,
  })

  return store.insertMoment({
    roleId: event.roleId,
    eventId: event.id,
    publishedAt: event.scheduledAt,
    text,
    meta: {
      type: event.type,
      mood: event.payload.mood,
      location: event.payload.location,
      theme: event.payload.theme,
      assetId: assetId ?? undefined,
      outfit: outfitName,
      bookAssetId: bookAssetId ?? undefined,
      book: bookName,
      textSource: source,
      ...(interactions.length ? { interactions } : {}),
    },
  })
}

/**
 * 发布 [fromMs, toMs] 内 planned 事件并投影 moments。
 * 返回新 published 数量。
 */
export async function publishAndProjectRange(
  roleId: string,
  fromMs: number,
  toMs: number,
  opts?: ProjectMomentOpts,
): Promise<number> {
  const planned = await store.listEvents(roleId, { status: 'planned' })
  let n = 0
  for (const ev of planned) {
    if (ev.scheduledAt < fromMs || ev.scheduledAt > toMs) continue
    await store.markEventPublished(ev.id)
    const published: CompanionEvent = { ...ev, status: 'published' }
    // M25-G2：payload.grantAsset → 幂等入库（无则 noop）
    await maybeGrantFromEvent({
      roleId: ev.roleId,
      eventId: ev.id,
      eventPayload: ev.payload,
    })
    await projectMomentFromEvent(published, opts)
    n += 1
  }
  return n
}

/** tick 用：发布所有 scheduled_at <= now 的 planned 并投影（prefer LLM 润色） */
export async function publishAndProjectDue(roleId: string, now: number): Promise<number> {
  return publishAndProjectRange(roleId, 0, now, { preferLlm: true })
}

export async function listMomentsForRole(
  roleId: string,
  opts?: { limit?: number; offset?: number },
): Promise<CompanionMoment[]> {
  return store.listMoments(roleId, opts)
}


type MomentSocialMutationResult =
  | { ok: true; social: MomentSocialView }
  | { ok: false; error: string; code: 'NOT_FOUND' | 'ROLE_MISMATCH' | 'INVALID' }

export async function listMomentUserInteractionsForRole(
  roleId: string,
): Promise<MomentUserInteraction[]> {
  return store.listMomentUserInteractions(roleId)
}

/**
 * 切换当前用户对一条动态的赞。
 *
 * 背景：Playground 赞只改本地 Set；正式页需要角色隔离的真实落库，但不能改动态正文或卡司投影。
 * 设计意图：用户赞单独成行，同一 actor 对同一动态最多一条；取消赞只删用户行。
 * 关键约束：动态必须属于传入 roleId；不写 meta.interactions；不改 moment.text。
 */
export async function toggleMomentLikeForRole(
  roleId: string,
  momentId: string,
): Promise<MomentSocialMutationResult> {
  const id = typeof momentId === 'string' ? momentId.trim() : ''
  if (!id) return { ok: false, code: 'INVALID', error: '动态不存在' }
  const moment = await store.getMomentById(id)
  if (!moment) return { ok: false, code: 'NOT_FOUND', error: '动态不存在' }
  if (moment.roleId !== roleId) return { ok: false, code: 'ROLE_MISMATCH', error: '只能互动当前主角的动态' }
  const existing = await store.findMomentUserLike(id, MOMENT_USER_ACTOR_ID)
  if (existing) {
    await store.deleteMomentUserInteraction(existing.id, roleId)
  } else {
    await store.insertMomentUserInteraction({
      momentId: id,
      roleId,
      kind: 'like',
      actorId: MOMENT_USER_ACTOR_ID,
      text: null,
    })
  }
  const rows = await store.listMomentUserInteractions(roleId)
  return { ok: true, social: describeMomentSocial(id, rows) }
}

/**
 * 给一条动态追加用户评论。
 *
 * 背景：卡司评论已经投影进 meta.interactions，用户评论不能覆盖那份生活事实。
 * 设计意图：评论先规范化再落库；空值和超长在写入前拒绝，避免半截文本。
 * 关键约束：评论按创建时间追加；展示时卡司评论仍排在用户评论前面。
 */
export async function addMomentCommentForRole(
  roleId: string,
  momentId: string,
  text: unknown,
): Promise<MomentSocialMutationResult> {
  const id = typeof momentId === 'string' ? momentId.trim() : ''
  if (!id) return { ok: false, code: 'INVALID', error: '动态不存在' }
  const normalized = normalizeMomentCommentText(text)
  if (!normalized.ok) return { ok: false, code: 'INVALID', error: normalized.error }
  const moment = await store.getMomentById(id)
  if (!moment) return { ok: false, code: 'NOT_FOUND', error: '动态不存在' }
  if (moment.roleId !== roleId) return { ok: false, code: 'ROLE_MISMATCH', error: '只能互动当前主角的动态' }
  await store.insertMomentUserInteraction({
    momentId: id,
    roleId,
    kind: 'comment',
    actorId: MOMENT_USER_ACTOR_ID,
    text: normalized.text,
  })
  const rows = await store.listMomentUserInteractions(roleId)
  return { ok: true, social: describeMomentSocial(id, rows) }
}
