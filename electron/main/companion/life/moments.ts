/**
 * Moments 投影（W3 / M24-G2 / M26-G1）
 *
 * 背景：朋友圈是 published 事件的 UI 截面，不是另一套生活真相。
 * 意图：事件 → companion_moments；可选 LLM 润色；派生卡司互动进 meta。
 * 约束：列表仅按 role 查询；互动不 tick 对方、不写独立真相。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { startSpan } from '../../utils/tracer'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileMomentReplyRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
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
import { resolveCastInteractions } from './moment-comment-service'
import { resolveMomentText } from './moment-polish'
import * as store from './store'
import { getSetting } from '../../storage/settings-store'

export { formatMomentText } from './moment-format'

export interface ProjectMomentOpts {
  /** tick 路径可为 true；Catch-up 细补默认 false */
  parentSpanId?: string
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
  /** 自动生活发布路径；自动配图偏好只约束该路径，用户明确发布不受影响。 */
  automatic?: boolean
  /** 自动分享按实际发布时间计数，生活事件仍保留原计划时间。 */
  publishedAt?: number
  /** 保留事件事实但跳过朋友圈投影。 */
  suppressMoment?: boolean
}

/** 将已 published 事件投影为 moment（幂等） */
export async function projectMomentFromEvent(
  event: CompanionEvent,
  opts?: ProjectMomentOpts,
): Promise<CompanionMoment | null> {
  if (event.status !== 'published') return null
  const relationship = event.payload.relationship && typeof event.payload.relationship === 'object' && !Array.isArray(event.payload.relationship)
    ? event.payload.relationship as Record<string, unknown>
    : undefined
  if (relationship) {
    await store.recordRelationshipEvent({
      roleId: event.roleId,
      subjectId: typeof relationship.subjectId === 'string' ? relationship.subjectId : 'user',
      phase: typeof relationship.phase === 'string' ? relationship.phase : undefined,
      note: typeof relationship.note === 'string' ? relationship.note : undefined,
      delta: typeof relationship.delta === 'number' ? relationship.delta : 1,
    })
  }
  const mood = typeof event.payload.mood === 'string' ? event.payload.mood.trim() : ''
  if (mood) {
    await store.recordEmotionEvent({
      roleId: event.roleId,
      eventId: event.id,
      label: mood,
      intensity: typeof event.payload.moodIntensity === 'number' ? event.payload.moodIntensity : 50,
      note: typeof event.payload.activity === 'string' ? event.payload.activity : '',
    })
  }
  if (opts?.suppressMoment) return null
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

  const interactionPolicy = opts?.automatic ? await getSetting('companionMomentInteractionPolicy') : 'regular'
  const hasSocialSignal = Boolean(event.payload.relationship)
    || Array.isArray(event.payload.participantIds) && event.payload.participantIds.length > 0
  // 公开名册仍决定选人；偶尔模式只在关系变化或同框事件下触发，失败保留空互动。
  const interactions = interactionPolicy === 'never' || (interactionPolicy === 'occasional' && !hasSocialSignal)
    ? []
    : await resolveCastInteractions(event, {
      universeId: opts?.universeId, preferLlm: opts?.preferLlm, llmConfig, postText: text,
    })

  const links: store.CompanionEventLinkInput[] = []
  if (assetId && outfitName) {
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'asset',
      targetId: assetId,
      relation: 'wears',
      metadata: { name: outfitName },
    })
  }
  if (bookAssetId && bookName) {
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'asset',
      targetId: bookAssetId,
      relation: 'references',
      metadata: { name: bookName },
    })
  }
  const imagePolicy = opts?.automatic ? await getSetting('companionMomentImagePolicy') : 'existing'
  const allowExistingImages = !opts?.automatic || imagePolicy === 'existing'
  const imageId = allowExistingImages && typeof event.payload.imageId === 'string' ? event.payload.imageId.trim() : ''
  const imageIds = allowExistingImages && Array.isArray(event.payload.imageIds)
    ? event.payload.imageIds.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id)).slice(0, 9) : []
  for (const [position, linkedImageId] of [...new Set([...(imageId ? [imageId] : []), ...imageIds])].slice(0, 9).entries()) {
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'image',
      targetId: linkedImageId,
      relation: 'depicts',
      metadata: { position },
    })
  }
  for (const interaction of interactions) {
    if (interaction.kind !== 'coframe') continue
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'cast',
      targetId: interaction.castId,
      relation: 'coframe',
      metadata: { name: interaction.castName },
    })
  }
  const participantIds = Array.isArray(event.payload.participantIds)
    ? event.payload.participantIds.filter((id): id is string => typeof id === 'string' && id.trim()).slice(0, 4)
    : []
  for (const participantId of [...new Set(participantIds)]) {
    let castName = participantId
    try { castName = loadRolePack(participantId, opts?.universeId ?? 'default').name } catch { /* 关系表已在工具入口校验；缺失 NPC 只保留 ID 证据 */ }
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'cast',
      targetId: participantId,
      relation: 'coframe',
      metadata: { name: castName, ...(typeof relationship?.phase === 'string' ? { relationshipPhase: relationship.phase } : {}), ...(typeof relationship?.note === 'string' ? { relationshipNote: relationship.note } : {}) },
    })
  }

  const moment = await store.insertMoment({
    roleId: event.roleId,
    eventId: event.id,
    publishedAt: opts?.publishedAt ?? event.scheduledAt,
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
      ...(participantIds.length ? { participantIds } : {}),
      ...(relationship ? { relationship } : {}),
    },
  })
  await store.replaceEventLinks(event.roleId, event.id, links)
  return moment
}

/**
 * 发布 [fromMs, toMs] 内 planned 事件并投影 moments。
 * 返回新 published 数量。
 */
const automaticPublishingRoles = new Set<string>()

/**
 * 背景：ticker 与换角追赶可能同时推进同一人物。
 * 意图：同人物自动推进在单进程中串行领取，预算读取与写入保持一个临界区。
 * 约束：所有退出路径释放领取，失败向原调用者传播，下次 tick 可继续读取未处理事件。
 */
export async function publishAndProjectRange(
  roleId: string,
  fromMs: number,
  toMs: number,
  opts?: ProjectMomentOpts,
): Promise<number> {
  if (!opts?.automatic) return projectRange(roleId, fromMs, toMs, opts)
  if (automaticPublishingRoles.has(roleId)) return 0
  automaticPublishingRoles.add(roleId)
  try {
    return await projectRange(roleId, fromMs, toMs, opts)
  } finally {
    automaticPublishingRoles.delete(roleId)
  }
}

async function projectRange(
  roleId: string,
  fromMs: number,
  toMs: number,
  opts?: ProjectMomentOpts,
): Promise<number> {
  const planned = await store.listEvents(roleId, { status: 'planned' })
  const candidates = planned.filter(event => event.scheduledAt >= fromMs && event.scheduledAt <= toMs)
  // 离线恢复只分享一个最近片段，生活事实仍逐条推进。每次 tick 按实际时刻重新校验预算。
  const selected = opts?.automatic ? [...candidates].reverse().find(event => event.type === 'moment' && event.scheduledAt >= toMs - 24 * 60 * 60_000) : undefined
  const allowShare = opts?.automatic ? Boolean(selected) && await canAutomaticallyPost(roleId, toMs, selected!) : true
  let n = 0
  for (const ev of planned) {
    if (ev.scheduledAt < fromMs || ev.scheduledAt > toMs) continue
    const span = startSpan('生活事件发布', 'system', 'interaction', opts?.parentSpanId, { roleId, sourceEventId: ev.id, operation: 'life_projection' })
    try {
      await store.markEventPublished(ev.id)
      const published: CompanionEvent = { ...ev, status: 'published' }
      // M25-G2：payload.grantAsset → 幂等入库（无则 noop）
      await maybeGrantFromEvent({
        roleId: ev.roleId,
        eventId: ev.id,
        eventPayload: ev.payload,
      })
      const moment = await projectMomentFromEvent(published, {
        ...opts,
        suppressMoment: opts?.automatic ? !allowShare || ev.id !== selected?.id : opts?.suppressMoment,
        publishedAt: opts?.automatic ? toMs : opts?.publishedAt,
      })
      if (moment) span.setAttribute('momentId', moment.id)
      span.end()
    } catch (error) { span.end('error'); throw error }
    n += 1
  }
  return n
}

/**
 * 背景：离线恢复会同时出现多条过期事件，按计划时间限流会在一个 tick 内刷屏。
 * 意图：以已保存动态的实际发帖时间执行每日预算和冷却，低频模式每天最多一条。
 * 约束：只约束自动分享，生活推进和用户明确发布独立运行。
 */
async function canAutomaticallyPost(roleId: string, now: number, candidate: CompanionEvent): Promise<boolean> {
  const cadence = await getSetting('companionMomentCadence')
  if (cadence === 'manual') return false
  const hour = new Date(now).getHours()
  const quietStart = Math.max(0, Math.min(23, Number.parseInt(await getSetting('companionMomentPostingQuietStart'), 10) || 0))
  const quietEnd = Math.max(0, Math.min(23, Number.parseInt(await getSetting('companionMomentPostingQuietEnd'), 10) || 0))
  if (quietStart !== quietEnd && (quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd)) return false

  const maxPerDay = Math.max(1, Math.min(10, Number.parseInt(await getSetting('companionMomentMaxPerDay'), 10) || 3))
  const cooldownMinutes = Math.max(0, Math.min(24 * 60, Number.parseInt(await getSetting('companionMomentCooldownMinutes'), 10) || 240))
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const recent = await listMomentsForRole(roleId, { limit: 500 })
  const todayCount = recent.filter(moment => moment.publishedAt >= start.getTime() && moment.publishedAt <= now).length
  const lastPublishedAt = recent.reduce((latest, moment) => Math.max(latest, moment.publishedAt), 0)
  if (todayCount >= (cadence === 'low' ? 1 : maxPerDay)) return false
  if (lastPublishedAt && now - lastPublishedAt < cooldownMinutes * 60_000) return false
  const latest = recent[0]
  const lastEvent = latest ? await store.getEventById(latest.eventId) : null
  // 相同活动与地点只保留最近一次分享，新的关系事实仍允许作为独立事件表达。
  return Boolean(candidate.payload.relationship) || !lastEvent
    || candidate.payload.activity !== lastEvent.payload.activity
    || candidate.payload.location !== lastEvent.payload.location
}

/** tick 推进到期生活事件，朋友圈由同一自动策略选择分享。 */
export async function publishAndProjectDue(roleId: string, now: number, parentSpanId?: string): Promise<number> {
  return publishAndProjectRange(roleId, 0, now, { preferLlm: true, parentSpanId, automatic: true })
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
  const inserted = await store.insertMomentUserInteraction({
    momentId: id,
    roleId,
    kind: 'comment',
    actorId: MOMENT_USER_ACTOR_ID,
    text: normalized.text,
  })
  // 回复是独立的主角作者记录；任何模型、配置或解析失败都不回滚用户评论。
  try {
    const config = await loadAuxLLMConfig()
    const pack = loadRolePack(roleId)
    if (hasLLMAuthentication(config)) {
      const raw = await chatComplete({
        config,
        request: compileMomentReplyRequest({
          protagonistName: pack.name,
          protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 800),
          postText: moment.text.slice(0, 1500),
          userComment: normalized.text.slice(0, 280),
        }),
        caller: 'moment-reply', temperature: 0.65, maxTokens: 220,
      })
      let reply: unknown
      try { reply = JSON.parse(raw) } catch { reply = null }
      const textValue = reply && typeof reply === 'object' && !Array.isArray(reply) && typeof (reply as Record<string, unknown>).reply === 'string'
        ? ((reply as Record<string, unknown>).reply as string).trim() : ''
      if (textValue.length >= 2 && textValue.length <= 120 && !/[\r\n<>]/.test(textValue)) {
        await store.insertMomentUserInteraction({
          momentId: id, roleId, kind: 'comment', actorId: roleId, actorType: 'protagonist', actorName: pack.name,
          parentInteractionId: inserted.id, text: textValue,
        })
      }
    }
  } catch {
    // 用户评论已经持久化；回复失败只留下可见的用户评论，不伪造成功状态。
  }
  const rows = await store.listMomentUserInteractions(roleId)
  return { ok: true, social: describeMomentSocial(id, rows) }
}
