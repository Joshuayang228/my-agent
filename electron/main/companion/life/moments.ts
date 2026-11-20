/**
 * Moments 投影（W3 / M24-G2 / M26-G1）
 *
 * 背景：朋友圈是 published 事件的 UI 截面，不是另一套生活真相。
 * 意图：事件 → companion_moments；可选 LLM 润色；派生卡司互动进 meta。
 * 约束：列表仅按 role 查询；互动不 tick 对方、不写独立真相。
 */

import type { LLMConfig, AddMomentCommentOptions } from '../../../../src/shared/types'
import { startSpan } from '../../utils/tracer'
import { createLogger } from '../../utils/logger'
import { runWithoutExecutionSignal } from '../../utils/execution-cancellation'
import { z } from 'zod'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileMomentReplyRequest } from '../../prompts/registered-request'
import { loadRolePack, resolveRoleUniverseId } from '../identity/loader'
import type { CompanionEvent, CompanionMoment } from '../types'
import {
  MOMENT_USER_ACTOR_ID,
  MOMENT_USER_ACTOR_NAME,
  describeMomentSocial,
  normalizeMomentCommentText,
  type MomentSocialView,
  type MomentUserInteraction,
} from '../../../../src/shared/moment-user-interactions'
import { ensureStarterMoments, getAsset, maybeGrantFromEvent } from './assets'
import { formatMomentText } from './moment-format'
import { buildRosterLines } from '../cast/roster'
import { resolveCastInteractions } from './moment-comment-service'
import { resolveMomentText } from './moment-polish'
import { evaluateLifeActionGating } from './life-gating'
import { collectLifeContextSnapshot, formatLifeContextForMomentPolish } from './life-context-snapshot'
import { getCompanionRuntimeReadModel } from '../core/read-models/runtime-read-model'
import { commandExecutionScope } from '../core/commands/execution-scope'
import { executeCompanionCommand } from '../core/commands/gateway'
import * as store from '../core/persistence/life-repository'

const log = createLogger('CompanionMoments')
import { getSetting } from '../../storage/settings-store'
import { generateAutomaticMomentMedia } from './automatic-moment-media'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { appendCompanionDomainEvent, getCompanionDomainEventById } from '../core/events/domain-events'
import { assertCompanionOutboxClaim, dispatchCompanionOutbox, enqueueCompanionOutbox, getNextScopedOutboxAttempt } from '../core/outbox/outbox'
import { COMPANION_FOLLOWUP } from '../core/outbox/followup-kinds'
import { recordCompanionProjection } from '../core/projections/receipts'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { markEventPublished, recordEmotionEvent, insertMoment, recordRelationshipEvent, recordEventExecution, replaceEventLinks } from '../core/persistence/life-repository'
import { getEventById, getMomentByEventId, getMomentById, listEvents, listMoments } from '../core/persistence/life-repository'

export { formatMomentText } from './moment-format'
export type { AddMomentCommentOptions } from '../../../../src/shared/types'

export interface ProjectMomentOpts {
  /** tick 路径可为 true；Catch-up 细补默认 false */
  parentSpanId?: string
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
  /** 自动生活发布路径；自动配图偏好只约束该路径，用户明确发布不受影响。 */
  automatic?: boolean
  /** 追赶完成依赖本次确实检查过待发布事件，不能按普通时钟的空操作处理并发。 */
  requireExclusive?: boolean
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
  const mood = typeof event.payload.mood === 'string' ? event.payload.mood.trim() : ''
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

  let lifeContext: string | undefined
  if (opts?.preferLlm) {
    try {
      const snapshot = await collectLifeContextSnapshot(event.roleId, opts?.publishedAt ?? Date.now())
      lifeContext = formatLifeContextForMomentPolish(snapshot)
    } catch {
      lifeContext = undefined
    }
  }
  const { text, source } = await resolveMomentText(event, {
    preferLlm: opts?.preferLlm,
    llmConfig,
    outfitName,
    bookName,
    universeId: opts?.universeId,
    lifeContext,
  })

  const interactionPolicy = opts?.automatic ? await getSetting('companionMomentInteractionPolicy') : 'regular'
  const hasSocialSignal = Boolean(event.payload.relationship)
    || Array.isArray(event.payload.participantIds) && event.payload.participantIds.length > 0
  // 公开名册仍决定选人；偶尔模式只在关系变化或同框事件下触发，失败保留空互动。
  const interactions = interactionPolicy === 'never' || (interactionPolicy === 'occasional' && !hasSocialSignal)
    ? []
    : await resolveCastInteractions(event, {
      universeId: opts?.universeId,
    preferLlm: opts?.preferLlm, llmConfig, postText: text,
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
    ? event.payload.participantIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).slice(0, 4)
    : []
  for (const participantId of [...new Set(participantIds)]) {
    let castName = participantId
    try { castName = loadRolePack(participantId, opts?.universeId ?? resolveRoleUniverseId(event.roleId)).name } catch { /* 关系表已在工具入口校验；缺失 NPC 只保留 ID 证据 */ }
    links.push({
      eventId: event.id,
      roleId: event.roleId,
      targetType: 'cast',
      targetId: participantId,
      relation: 'coframe',
      metadata: { name: castName, ...(typeof relationship?.phase === 'string' ? { relationshipPhase: relationship.phase } : {}), ...(typeof relationship?.note === 'string' ? { relationshipNote: relationship.note } : {}) },
    })
  }

  const projected = await withCompanionUnitOfWork(async () => {
    const domainEvent = await appendCompanionDomainEvent({
      roleId: event.roleId,
      universeId: opts?.universeId ?? resolveRoleUniverseId(event.roleId),
      type: event.type === 'moment' ? 'moment_published' : 'life_event_published',
      sourceType: 'companion_event',
      sourceId: event.id,
      causationId: event.id,
      correlationId: event.id,
      idempotencyKey: `life-event-published:${event.id}`,
      occurredAt: opts?.publishedAt ?? event.scheduledAt,
      payload: event.payload,
      schemaVersion: 1,
    })
    if (relationship) {
      await recordRelationshipEvent({
        roleId: event.roleId,
        subjectId: typeof relationship.subjectId === 'string' ? relationship.subjectId : 'user',
        phase: typeof relationship.phase === 'string' ? relationship.phase : undefined,
        note: typeof relationship.note === 'string' ? relationship.note : undefined,
        delta: typeof relationship.delta === 'number' ? relationship.delta : 1,
        sourceEventId: event.id,
      })
    }
    if (mood) {
      await recordEmotionEvent({
        roleId: event.roleId,
        eventId: event.id,
        label: mood,
        intensity: typeof event.payload.moodIntensity === 'number' ? event.payload.moodIntensity : 50,
        note: typeof event.payload.activity === 'string' ? event.payload.activity : '',
      })
    }
    if (opts?.suppressMoment) return { domainEvent, moment: null }
    let moment = await insertMoment({
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
    if (!moment) {
      moment = await getMomentByEventId(event.roleId, event.id)
      if (!moment) throw new Error('朋友圈投影未生成动态记录。')
    }
    await replaceEventLinks(event.roleId, event.id, links)
    await recordCompanionProjection({ projectionName: 'moment-read-model', eventId: domainEvent.id })
    return { domainEvent, moment }
  })
  const moment = projected.moment
  if (!moment) return null
  if (opts?.automatic && (await getSetting('companionMomentImagePolicy')) === 'generated') {
    await generateAutomaticMomentMedia(event.roleId, event, moment)
  }
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
  if (automaticPublishingRoles.has(roleId)) {
    if (opts.requireExclusive) throw new Error('正在推进该人物的生活事件，请稍后恢复补叙。')
    return 0
  }
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
  const planned = await listEvents(roleId, { status: 'planned' })
  const candidates = planned.filter(event => event.scheduledAt >= fromMs && event.scheduledAt <= toMs)
  // 离线恢复只分享一个最近片段，生活事实仍逐条推进。每次 tick 按实际时刻重新校验预算。
  const selected = opts?.automatic ? [...candidates].reverse().find(event => event.type === 'moment' && event.scheduledAt >= toMs - 24 * 60 * 60_000) : undefined
  const decision = opts?.automatic
    ? Boolean(selected) ? await canAutomaticallyPost(roleId, toMs, selected!) : { allow: false, reason: 'no-moment-candidate' }
    : { allow: true, reason: 'manual' }
  let n = 0
  for (const ev of planned) {
    if (ev.scheduledAt < fromMs || ev.scheduledAt > toMs) continue
    const span = startSpan('生活事件发布', 'system', 'interaction', opts?.parentSpanId, { roleId, sourceEventId: ev.id, operation: 'life_projection' })
    try {
      const published: CompanionEvent = { ...ev, status: 'published' }
      // M25-G2：payload.grantAsset → 幂等入库（无则 noop）
      await withCompanionUnitOfWork(() => maybeGrantFromEvent({
        roleId: ev.roleId,
        eventId: ev.id,
        eventPayload: ev.payload,
      }))
      const moment = await projectMomentFromEvent(published, {
        ...opts,
        suppressMoment: opts?.automatic ? !decision.allow || ev.id !== selected?.id : opts?.suppressMoment,
        publishedAt: opts?.automatic ? toMs : opts?.publishedAt,
      })
      // 事件状态必须在投影完成后提交。投影失败时保留 planned，下一次 tick 才能重试。
      // 若上一次尝试已经写入 Moment 但在后续步骤失败，按 event_id 恢复已有投影，避免重复写入。
      const persistedMoment = moment ?? await getMomentByEventId(ev.roleId, ev.id)
      await withCompanionUnitOfWork(async () => {
        await markEventPublished(ev.id)
        await recordEventExecution({
          roleId,
          eventId: ev.id,
          attemptedAt: toMs,
          action: persistedMoment ? 'published' : 'skipped',
          reason: opts?.automatic && selected && ev.id !== selected.id ? 'not-selected' : decision.reason,
          momentId: persistedMoment?.id ?? null,
        })
      })
      if (persistedMoment) span.setAttribute('momentId', persistedMoment.id)
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
async function canAutomaticallyPost(roleId: string, now: number, candidate: CompanionEvent): Promise<{ allow: boolean; reason: string }> {
  const cadence = await getSetting('companionMomentCadence')
  if (cadence === 'manual') return { allow: false, reason: 'manual-mode' }
  const hour = new Date(now).getHours()
  const quietStart = Math.max(0, Math.min(23, Number.parseInt(await getSetting('companionMomentPostingQuietStart'), 10) || 0))
  const quietEnd = Math.max(0, Math.min(23, Number.parseInt(await getSetting('companionMomentPostingQuietEnd'), 10) || 0))
  if (quietStart !== quietEnd && (quietStart < quietEnd ? hour >= quietStart && hour < quietEnd : hour >= quietStart || hour < quietEnd)) return { allow: false, reason: 'posting-quiet-hours' }

  const maxPerDay = Math.max(1, Math.min(10, Number.parseInt(await getSetting('companionMomentMaxPerDay'), 10) || 3))
  const cooldownMinutes = Math.max(0, Math.min(24 * 60, Number.parseInt(await getSetting('companionMomentCooldownMinutes'), 10) || 240))
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const recent = await listMoments(roleId, { limit: 500 })
  const todayCount = recent.filter(moment => moment.publishedAt >= start.getTime() && moment.publishedAt <= now).length
  const lastPublishedAt = recent.reduce((latest, moment) => Math.max(latest, moment.publishedAt), 0)
  if (todayCount >= (cadence === 'low' ? 1 : maxPerDay)) return { allow: false, reason: 'daily-limit' }
  if (lastPublishedAt && now - lastPublishedAt < cooldownMinutes * 60_000) return { allow: false, reason: 'cooldown' }
  const latest = recent[0]
  const lastEvent = latest ? await getEventById(latest.eventId) : null
  // 相同活动与地点只保留最近一次分享，新的关系事实仍允许作为独立事件表达。
  const distinct = Boolean(candidate.payload.relationship) || !lastEvent
    || candidate.payload.activity !== lastEvent.payload.activity
    || candidate.payload.location !== lastEvent.payload.location
  const runtime = await getCompanionRuntimeReadModel(roleId)
  const gating = evaluateLifeActionGating({
    kind: 'auto_moment',
    vitals: runtime,
    hasRelationshipMilestone: Boolean(candidate.payload.relationship),
  })
  if (!gating.allow) return { allow: false, reason: gating.reason }
  return distinct ? { allow: true, reason: 'policy-selected' } : { allow: false, reason: 'duplicate-context' }
}

/** tick 推进到期生活事件，朋友圈由同一自动策略选择分享。 */
export async function publishAndProjectDue(roleId: string, now: number, parentSpanId?: string): Promise<number> {
  return publishAndProjectRange(roleId, 0, now, { preferLlm: true, parentSpanId, automatic: true })
}

export async function listMomentsForRole(
  roleId: string,
  opts?: { limit?: number; offset?: number },
): Promise<CompanionMoment[]> {
  await ensureStarterMoments(roleId)
  return listMoments(roleId, opts)
}


type MomentSocialMutationResult =
  | { ok: true; social: MomentSocialView }
  | { ok: false; error: string; code: 'NOT_FOUND' | 'ROLE_MISMATCH' | 'INVALID' }

type MomentCommentMutationResult =
  | { ok: true; social: MomentSocialView; interactionId: string }
  | Extract<MomentSocialMutationResult, { ok: false }>

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
  const moment = await getMomentById(id)
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
interface AutonomousReplyDecision {
  shouldReply: boolean
  responderId: string
  responderName: string
  actorType: 'protagonist' | 'cast'
  reply: string
  delaySeconds: number
  reason?: string
}

function parseAutonomousReply(raw: string, defaultRoleId: string, defaultName: string): AutonomousReplyDecision | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const rec = value as Record<string, unknown>
    // 兼容历史返回 {"reply":"..."} 的结构
    if (typeof rec.reply === 'string' && rec.shouldReply === undefined) {
      const text = rec.reply.trim()
      if (text.length >= 2 && text.length <= 120 && !/[\r\n<>]/.test(text)) {
        return {
          shouldReply: true,
          responderId: defaultRoleId,
          responderName: defaultName,
          actorType: 'protagonist',
          reply: text,
          delaySeconds: 0,
        }
      }
      return null
    }

    if (rec.shouldReply === false) {
      return {
        shouldReply: false,
        responderId: '',
        responderName: '',
        actorType: 'protagonist',
        reply: '',
        delaySeconds: 0,
        reason: typeof rec.reason === 'string' ? rec.reason : undefined,
      }
    }

    const reply = typeof rec.reply === 'string' ? rec.reply.trim() : ''
    if (reply.length < 2 || reply.length > 120 || !reply || /[\r\n<>]/.test(reply)) return null
    const responderId = typeof rec.responderId === 'string' && rec.responderId.trim() ? rec.responderId.trim() : defaultRoleId
    const responderName = typeof rec.responderName === 'string' && rec.responderName.trim() ? rec.responderName.trim() : defaultName
    const actorType = rec.actorType === 'cast' ? 'cast' : 'protagonist'
    const delaySeconds = typeof rec.delaySeconds === 'number' && Number.isFinite(rec.delaySeconds)
      ? Math.max(0, Math.min(120, Math.round(rec.delaySeconds)))
      : 0

    return {
      shouldReply: true,
      responderId,
      responderName,
      actorType,
      reply,
      delaySeconds,
      reason: typeof rec.reason === 'string' ? rec.reason : undefined,
    }
  } catch {
    return null
  }
}

const momentReplySchema = z.object({
  roleId: z.string(),
  momentId: z.string(),
  parentInteractionId: z.string(),
  responderId: z.string(),
  responderName: z.string(),
  actorType: z.enum(['protagonist', 'cast']),
  reply: z.string(),
  occurredAt: z.number(),
})

type MomentReply = z.infer<typeof momentReplySchema>

async function persistMomentReplyAndNotify(input: MomentReply, accept?: () => Promise<boolean>): Promise<void> {
  const replyPayload = {
    momentId: input.momentId,
    roleId: input.roleId,
    reply: { actorName: input.responderName, text: input.reply },
  }
  await withCompanionUnitOfWork(async () => {
    if (accept && !(await accept())) return
    await store.insertMomentUserInteraction({
      momentId: input.momentId,
      roleId: input.roleId,
      kind: 'comment',
      actorId: input.responderId,
      actorType: input.actorType,
      actorName: input.responderName,
      parentInteractionId: input.parentInteractionId,
      replyToActorName: MOMENT_USER_ACTOR_NAME,
      text: input.reply,
    })
    await recordCompanionEventAndNotify({
      roleId: input.roleId,
      type: 'moment_comment_replied',
      sourceType: 'moment_comment',
      sourceId: input.parentInteractionId,
      idempotencyKey: `moment-comment-reply:${input.parentInteractionId}`,
      occurredAt: input.occurredAt,
      payload: replyPayload,
      notification: {
        kind: 'moment-updated',
        dedupeKey: `moment-comment-reply:${input.parentInteractionId}`,
        payload: replyPayload,
      },
      dispatch: false,
    })
  })
  await dispatchCompanionWindowOutbox()
}

let replyWake: { at: number; timer: ReturnType<typeof setTimeout> } | undefined

/**
 * 延迟回复的内容和到期时间由 Outbox 持有，计时器只唤醒下一次领取。
 * 原评论工具可能已经退出或超时，恢复必须以当前人物和世界观重新建立执行范围。
 */
function wakeDelayedMomentReplies(at: number): void {
  if (replyWake && replyWake.at <= at) return
  if (replyWake) clearTimeout(replyWake.timer)
  const timer = commandExecutionScope.exit(() => runWithoutExecutionSignal(() => setTimeout(() => {
    replyWake = undefined
    void recoverDelayedMomentReplies().catch(error => {
      log.warn('Delayed moment reply recovery deferred', { errorType: error instanceof Error ? error.name : 'unknown' })
    })
  }, Math.max(10, at - Date.now()))))
  timer.unref()
  replyWake = { at, timer }
}

async function scheduleDelayedMomentReply(reply: MomentReply, universeId: string, availableAt: number): Promise<void> {
  await withCompanionUnitOfWork(async () => {
    const event = await appendCompanionDomainEvent({
      roleId: reply.roleId,
      universeId,
      type: 'moment_comment_reply_scheduled',
      sourceType: 'moment_comment',
      sourceId: reply.parentInteractionId,
      causationId: reply.parentInteractionId,
      correlationId: reply.parentInteractionId,
      idempotencyKey: `moment-comment-reply-scheduled:${reply.parentInteractionId}`,
      occurredAt: reply.occurredAt,
      payload: { momentId: reply.momentId },
      schemaVersion: 1,
    })
    await enqueueCompanionOutbox({
      roleId: reply.roleId,
      eventId: event.id,
      kind: COMPANION_FOLLOWUP.momentDelayedReply,
      dedupeKey: `${COMPANION_FOLLOWUP.momentDelayedReply}:${event.id}`,
      payload: reply,
      availableAt,
    })
  })
  wakeDelayedMomentReplies(availableAt)
}

export async function recoverDelayedMomentReplies(): Promise<void> {
  const roleId = await getSetting('activeRoleId')
  const universeId = await getSetting('universeId')
  const kind = COMPANION_FOLLOWUP.momentDelayedReply
  await dispatchCompanionOutbox({
    roleId,
    universeId,
    kinds: [kind],
    deliver: async message => {
      const event = message.eventId ? await getCompanionDomainEventById(message.eventId) : null
      const reply = momentReplySchema.parse(message.payload)
      if (event?.type !== 'moment_comment_reply_scheduled' || event.roleId !== roleId || reply.roleId !== roleId || event.universeId !== universeId ||
        event.sourceId !== reply.parentInteractionId || event.payload.momentId !== reply.momentId) {
        throw new Error('延迟回复缺少原评论。')
      }
      await executeCompanionCommand({
        roleId,
        actionType: 'reply-to-moment-comment',
        idempotencyKey: event.id,
        correlationId: event.correlationId,
        handler: () => persistMomentReplyAndNotify({ ...reply, occurredAt: Date.now() }, async () => {
          if (await getSetting('universeId') !== universeId) throw new Error('朋友圈原世界观已切换。')
          await assertCompanionOutboxClaim(message)
          const parent = await store.getMomentUserInteraction(roleId, reply.parentInteractionId)
          if (parent?.kind !== 'comment' || parent.momentId !== reply.momentId || parent.actorType !== 'user') return false
          return recordCompanionProjection({ projectionName: kind, eventId: event.id })
        }),
      })
    },
  })
  const next = await getNextScopedOutboxAttempt({ kind, roleId, universeId })
  if (next !== null) wakeDelayedMomentReplies(next)
}

export async function addMomentCommentForRole(
  roleId: string,
  momentId: string,
  text: unknown,
  opts?: AddMomentCommentOptions,
): Promise<MomentCommentMutationResult> {
  const id = typeof momentId === 'string' ? momentId.trim() : ''
  if (!id) return { ok: false, code: 'INVALID', error: '动态不存在' }
  const normalized = normalizeMomentCommentText(text)
  if (!normalized.ok) return { ok: false, code: 'INVALID', error: normalized.error }
  const moment = await getMomentById(id)
  if (!moment) return { ok: false, code: 'NOT_FOUND', error: '动态不存在' }
  if (moment.roleId !== roleId) return { ok: false, code: 'ROLE_MISMATCH', error: '只能互动当前主角的动态' }
  const command = commandExecutionScope.getStore()
  const inserted = await withCompanionUnitOfWork(() => store.insertMomentUserInteraction({
    momentId: id,
    roleId,
    kind: 'comment',
    actorId: MOMENT_USER_ACTOR_ID,
    actorType: 'user',
    actorName: MOMENT_USER_ACTOR_NAME,
    parentInteractionId: opts?.parentInteractionId ?? null,
    replyToActorName: opts?.replyToActorName ?? null,
    text: normalized.text,
  }))

  // 自主回复：由模型/在场 NPC 自主决策是否回复、谁来回复以及延迟时长
  try {
    const config = await loadAuxLLMConfig()
    const pack = loadRolePack(roleId)
    if (hasLLMAuthentication(config)) {
      const universeId = opts?.universeId ?? resolveRoleUniverseId(roleId)
      const roster = buildRosterLines(roleId, universeId)
      const castContext = roster.map((r) => `${r.otherName}（ID: ${r.otherId}，关系: ${r.relationType}，简介: ${r.text}）`).join('\n')

      const priorRows = await store.listMomentUserInteractions(roleId)
      const thisMomentRows = priorRows.filter((r) => r.momentId === id && r.kind === 'comment')
      const recentComments = thisMomentRows.map((r) => {
        const actor = r.actorName || (r.actorType === 'protagonist' ? pack.name : MOMENT_USER_ACTOR_NAME)
        const target = r.replyToActorName ? ` 回复 @${r.replyToActorName}` : ''
        return `${actor}${target}：${r.text}`
      }).slice(-8).join('\n')

      const raw = await chatComplete({
        config,
        request: compileMomentReplyRequest({
          protagonistName: pack.name,
          protagonistBrief: `${pack.description}\n${pack.voice ?? ''}`.slice(0, 800),
          postText: moment.text.slice(0, 1500),
          userComment: normalized.text.slice(0, 280),
          replyToActorName: opts?.replyToActorName ?? null,
          castContext,
          recentComments,
        }),
        caller: 'moment-reply',
        signal: command?.signal,
        temperature: 0.65,
        maxTokens: 280,
      })

      command?.signal?.throwIfAborted()
      const decision = parseAutonomousReply(raw, roleId, pack.name)
      if (decision && decision.shouldReply) {
        const reply: MomentReply = {
          roleId,
          momentId: id,
          parentInteractionId: inserted.id,
          responderId: decision.responderId,
          responderName: decision.responderName,
          actorType: decision.actorType,
          reply: decision.reply,
          occurredAt: Date.now(),
        }
        if (opts?.immediate || decision.delaySeconds <= 0) {
          await persistMomentReplyAndNotify(reply)
        } else {
          await scheduleDelayedMomentReply(reply, universeId, reply.occurredAt + decision.delaySeconds * 1000)
        }
      }
    }
  } catch (error) {
    // 用户评论已经持久化；回复失败只留下可见的用户评论，不伪造成功状态。
    log.warn('Moment comment saved without an autonomous reply', { roleId, errorType: error instanceof Error ? error.name : 'unknown' })
  }
  const rows = await store.listMomentUserInteractions(roleId)
  return { ok: true, social: describeMomentSocial(id, rows), interactionId: inserted.id }
}
