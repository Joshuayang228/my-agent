/**
 * 日内计划槽位自适应重排核心服务（W2 / M23 因果状态机演进）
 *
 * 背景：日剧本如果静态生成后不随生理突变调整，容易出现“上午大病虚脱、下午剧烈探险”的离散割裂感；
 * 当角色体征严重透支（精力枯竭）、出现严重小情绪（vulnerability）或重大决断时，需自适应调整当日剩余未发生的槽位。
 *
 * 设计意图：
 * 1. 仅自适应调整当日 scheduledAt > now 的 status = 'planned' 槽位，不改变历史已发生事实；
 * 2. 结合诱因（精力透支/脆弱自白/决断），将原有槽位调整为修养生息、同伴照料、温情安心的活动；
 * 3. 槽位落盘时注入 causedBy 因果标签，为后续朋友圈与主会话提供前后自洽的叙事连续性；
 * 4. 配备高质量规则兜底，断网或无模型时依然保持人设自洽与因果成立。
 *
 * 关键约束：
 * - 纯主进程服务，按 roleId 严格隔离；
 * - 调整完成后广播 companion:slots-replanned 与 companion:timeline-updated；
 * - 避免同一天同一诱因频繁重复重排（具备幂等/防抖保护）。
 */

import type { CompanionLifeResonanceKind, ReplanResult } from '../../../../src/shared/types'
import { createLogger } from '../../utils/logger'
import { getDatabase } from '../../storage/database'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileReplanSlotsRequest } from '../../prompts/registered-request'
import { loadRoleLifePresets } from '../identity/life-presets'
import { loadRolePack } from '../identity/loader'
import { toLocalDateString } from './dates'
import { ensureWorldState } from './world-state'
import { isActiveRole } from '../../storage/settings-store'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { updateEventPayload } from '../core/persistence/life-repository'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'
import { listEvents } from '../core/persistence/life-repository'

const log = createLogger('LifeReplan')

export interface ReplanOptions {
  trigger: 'vitals_exhaustion' | 'vulnerability' | 'co_decision' | 'chat_resonance' | 'manual'
  reason: string
  now?: number
  preferLlm?: boolean
}

interface AdaptedSlot {
  hour: number
  minute: number
  activity: string
  mood: string
  location?: string
}

/** 规则兜底：优先从当前角色 Role Pack 的 life-presets 读取重排模板，未配置时使用平台中性兜底 */
function getFallbackAdaptedSlots(
  roleId: string,
  trigger: string,
  slots: Array<{ hour: number; minute: number; originalActivity: string }>,
): AdaptedSlot[] {
  const presets = loadRoleLifePresets(roleId)
  const exhaustionPool = presets.replan?.exhaustion
  const vulnerabilityPool = presets.replan?.vulnerability
  const defaultLocation = presets.replan?.defaultLocation || presets.defaultLocation || '休息区'

  if (trigger === 'vitals_exhaustion') {
    const generic = [
      { activity: '在安静处闭目深呼吸静养片刻', mood: '疲惫恢复中', location: '休息区' },
      { activity: '喝下一大杯温水整理呼吸', mood: '温饱安心', location: '茶水间' },
      { activity: '安静整理桌面放慢节奏', mood: '平静放松', location: '窗边' },
    ]
    return slots.map((s, idx) => {
      const picked = exhaustionPool?.[Math.min(idx, (exhaustionPool.length || 1) - 1)] ?? generic[Math.min(idx, generic.length - 1)]
      return {
        hour: s.hour,
        minute: s.minute,
        activity: picked.activity,
        mood: picked.mood,
        location: picked.location,
      }
    })
  }

  if (trigger === 'vulnerability') {
    const generic = [
      { activity: '独自站在窗边看远处的夜色', mood: '沉静释怀', location: '阳台' },
      { activity: '翻看过去的笔记与备忘', mood: '若有所思', location: '书桌前' },
      { activity: '听一段轻缓温暖的纯音乐', mood: '温暖安心', location: '沙发上' },
    ]
    return slots.map((s, idx) => {
      const picked = vulnerabilityPool?.[Math.min(idx, (vulnerabilityPool.length || 1) - 1)] ?? generic[Math.min(idx, generic.length - 1)]
      return {
        hour: s.hour,
        minute: s.minute,
        activity: picked.activity,
        mood: picked.mood,
        location: picked.location,
      }
    })
  }

  // co_decision 或 manual
  return slots.map((s, idx) => ({
    hour: s.hour,
    minute: s.minute,
    activity: idx === 0 ? '按照商量好的方向调整准备' : '整理随身物品与接下来的安排',
    mood: '专注认真',
    location: defaultLocation,
  }))
}

/**
 * 重新编排当日剩余未发布的 planned 槽位
 */
export async function replanRemainingSlots(
  roleId: string,
  options: ReplanOptions,
): Promise<ReplanResult> {
  const now = options.now ?? Date.now()
  const today = toLocalDateString(now)

  // 1. 读取角色当日所有待发布的 planned 槽位
  const allPlanned = await listEvents(roleId, { status: 'planned', order: 'asc', limit: 20 })
  const upcomingPlanned = allPlanned.filter((e) => {
    const isFuture = e.scheduledAt > now
    const eventDate = typeof e.payload.date === 'string' ? e.payload.date : toLocalDateString(e.scheduledAt)
    return isFuture && eventDate === today
  })

  if (upcomingPlanned.length === 0) {
    log.info('No upcoming planned events to replan today', { roleId, today, now })
    return {
      ok: true,
      roleId,
      replannedCount: 0,
      trigger: options.trigger,
      reason: options.reason,
      adjustedSlots: [],
    }
  }

  const slotsToReplan = upcomingPlanned.map((e) => {
    const d = new Date(e.scheduledAt)
    return {
      hour: d.getHours(),
      minute: d.getMinutes(),
      originalActivity: String(e.payload.activity || '日常活动'),
    }
  })

  // 2. 尝试调用小模型进行角色化重编排
  let adaptedList: AdaptedSlot[] = []
  const preferLlm = options.preferLlm ?? true

  if (preferLlm) {
    try {
      const llmConfig = await loadAuxLLMConfig()
      if (hasLLMAuthentication(llmConfig)) {
        const pack = await loadRolePack(roleId)
        const request = compileReplanSlotsRequest({
          protagonistName: pack?.name || roleId,
          protagonistBrief: pack?.summary || pack?.description || '热血坚毅的航海同伴',
          trigger: options.trigger,
          reason: options.reason,
          slotsToReplan,
        })
        const rawText = await chatComplete({ config: llmConfig, request, caller: 'replan-slots' })
        const parsed = JSON.parse(rawText.trim().replace(/^```json/i, '').replace(/```$/i, ''))
        if (Array.isArray(parsed) && parsed.length > 0) {
          adaptedList = parsed.map((item, idx) => ({
            hour: typeof item.hour === 'number' ? item.hour : slotsToReplan[idx]?.hour ?? 12,
            minute: typeof item.minute === 'number' ? item.minute : slotsToReplan[idx]?.minute ?? 0,
            activity: String(item.activity || '').trim() || slotsToReplan[idx]?.originalActivity || '休息',
            mood: String(item.mood || '平静').trim(),
            location: typeof item.location === 'string' ? item.location.trim() : undefined,
          }))
        }
      }
    } catch (err) {
      log.warn('Replan slots via LLM failed, using fallback', { roleId, error: String(err) })
    }
  }

  // 3. 兜底保障
  if (adaptedList.length === 0) {
    adaptedList = getFallbackAdaptedSlots(roleId, options.trigger, slotsToReplan)
  }

  // 4. 落盘更新每个待执行事件
  if (!(await isActiveRole(roleId))) {
    return { ok: false, roleId, replannedCount: 0, trigger: options.trigger, reason: '伙伴已切换', adjustedSlots: [] }
  }
  const adjustedSlots = await withCompanionUnitOfWork(async () => {
    const next: ReplanResult['adjustedSlots'] = []
    for (let i = 0; i < upcomingPlanned.length; i++) {
      const ev = upcomingPlanned[i]
      const adapted = adaptedList[i] || adaptedList[adaptedList.length - 1]
      const updatedPayload: Record<string, unknown> = {
        ...ev.payload,
        activity: adapted.activity,
        mood: adapted.mood,
        ...(adapted.location ? { location: adapted.location } : {}),
        causedBy: {
          trigger: options.trigger,
          reason: options.reason,
          previousActivity: typeof ev.payload.activity === 'string' ? ev.payload.activity : undefined,
          at: now,
        },
      }
      await updateEventPayload(ev.id, updatedPayload)
      next.push({
        eventId: ev.id,
        hour: adapted.hour,
        minute: adapted.minute,
        activity: adapted.activity,
        mood: adapted.mood,
        location: adapted.location,
      })
    }
    const result: ReplanResult = {
      ok: true,
      roleId,
      replannedCount: next.length,
      trigger: options.trigger,
      reason: options.reason,
      adjustedSlots: next,
    }
    const sourceId = `replan:${roleId}:${now}`
    await recordCompanionEventAndNotify({
      roleId,
      type: 'life_slots_replanned',
      sourceType: 'life_replan',
      sourceId,
      idempotencyKey: sourceId,
      occurredAt: now,
      payload: result as unknown as Record<string, unknown>,
      notification: [
        { kind: 'slots-replanned', dedupeKey: sourceId, payload: result as unknown as Record<string, unknown> },
        { kind: 'timeline-updated', dedupeKey: `${sourceId}:timeline`, payload: { roleId, now } },
      ],
      dispatch: false,
    })
    return next
  })

  log.info('Remaining slots replanned successfully', {
    roleId,
    replannedCount: adjustedSlots.length,
    trigger: options.trigger,
    reason: options.reason,
  })

  const result: ReplanResult = {
    ok: true,
    roleId,
    replannedCount: adjustedSlots.length,
    trigger: options.trigger,
    reason: options.reason,
    adjustedSlots,
  }

  await dispatchCompanionWindowOutbox()

  return result
}

/**
 * 检查角色体征是否耗尽，若透支且今日未重排过休养槽位，则自动执行自愈重编排
 */
export async function checkAndReplanIfExhausted(
  roleId: string,
  now = Date.now(),
): Promise<ReplanResult | null> {
  const world = await ensureWorldState(roleId)
  if (!world) return null

  const isExhausted = world.energy <= 25 || world.mood <= 20
  if (!isExhausted) return null

  // 查重：若今日未来槽位已有 causedBy.trigger === 'vitals_exhaustion'，不重复调整
  const today = toLocalDateString(now)
  const planned = await listEvents(roleId, { status: 'planned', order: 'asc', limit: 10 })
  const alreadyReplanned = planned.some((e) => {
    const causedBy = e.payload.causedBy as Record<string, unknown> | undefined
    return causedBy?.trigger === 'vitals_exhaustion' && (e.payload.date === today || toLocalDateString(e.scheduledAt) === today)
  })

  if (alreadyReplanned) {
    return null
  }

  const reason = world.energy <= 25 ? `体力透支（当前精力仅 ${world.energy}）急需休养` : `心情极度低落（当前心情 ${world.mood}）需安静调整`
  return replanRemainingSlots(roleId, {
    trigger: 'vitals_exhaustion',
    reason,
    now,
  })
}

const SAME_DAY_RESONANCE_KINDS = new Set<CompanionLifeResonanceKind>([
  'cuisine_wish',
  'culture_wish',
  'day_activity_wish',
])

function formatResonanceSlotActivity(kind: CompanionLifeResonanceKind, targetName: string): string {
  const clean = targetName.trim()
  if (kind === 'cuisine_wish') return `趁兴尝一尝刚聊到的「${clean}」`
  if (kind === 'culture_wish') return `抽空体验一下刚聊到的《${clean}》`
  return `按刚聊到的兴致去试试「${clean}」`
}

/**
 * 将主会话刚沉淀的生活心愿（美食 / 文化 / 日常活动）即时编入今日下一个未改动的 planned 槽位。
 *
 * 背景：此前 chat-resonance 沉淀的心愿只能在次日日剧本生成时被吸收，用户当天和伙伴约好
 * “待会儿吃烤肉/看某部作品”后，当天时间线毫无反应，缺少“说到做到”的即时活人感。
 * 设计意图：只轻度微调今日首个尚未被体征/脆弱/其他共鸣改写过的未来 planned 槽位，不覆盖整天行程；
 * 成功后在同一工作单元内将该心愿标记为 absorbed_in_script，避免次日重复吸收；若今日已无合适槽位，
 * 则保留 active 状态留给明日日剧本承接。
 * 关键约束：仅针对当前活跃角色；travel_wish 属跨日航程不走当日单槽微调；绝不改写历史或已因体征透支重排的休养槽位。
 */
export async function adaptNextUpcomingSlotForResonance(
  roleId: string,
  resonance: {
    id: string
    kind: CompanionLifeResonanceKind
    title: string
    targetName: string
    reason?: string
  },
  opts?: { now?: number },
): Promise<{ adapted: boolean; eventId?: string; activity?: string }> {
  if (!SAME_DAY_RESONANCE_KINDS.has(resonance.kind)) {
    return { adapted: false }
  }
  if (!resonance.targetName.trim()) {
    return { adapted: false }
  }
  if (!(await isActiveRole(roleId))) {
    return { adapted: false }
  }

  const now = opts?.now ?? Date.now()
  const today = toLocalDateString(now)
  const allPlanned = await listEvents(roleId, { status: 'planned', order: 'asc', limit: 20 })
  const targetEvent = allPlanned.find((ev) => {
    if (ev.scheduledAt <= now) return false
    const eventDate = typeof ev.payload.date === 'string' ? ev.payload.date : toLocalDateString(ev.scheduledAt)
    if (eventDate !== today) return false
    // 尊重已有高优先级因果重排（体征透支、脆弱安抚、或已编入其他聊天心愿）
    if (ev.payload.causedBy) return false
    return true
  })

  if (!targetEvent) {
    return { adapted: false }
  }

  const nextActivity = formatResonanceSlotActivity(resonance.kind, resonance.targetName)
  const scheduledDate = new Date(targetEvent.scheduledAt)
  const reasonText = resonance.reason?.trim() || resonance.title || `聊天约定：${resonance.targetName}`

  await withCompanionUnitOfWork(async () => {
    const updatedPayload: Record<string, unknown> = {
      ...targetEvent.payload,
      activity: nextActivity,
      mood: '兴致勃勃',
      causedBy: {
        trigger: 'chat_resonance',
        resonanceId: resonance.id,
        targetName: resonance.targetName,
        reason: reasonText,
        previousActivity: typeof targetEvent.payload.activity === 'string' ? targetEvent.payload.activity : undefined,
        at: now,
      },
    }
    await updateEventPayload(targetEvent.id, updatedPayload)

    const db = await getDatabase()
    db.run(
      "UPDATE companion_life_resonances SET status = 'absorbed_in_script', absorbed_at = ? WHERE id = ? AND status = 'active'",
      [now, resonance.id],
    )

    const result: ReplanResult = {
      ok: true,
      roleId,
      replannedCount: 1,
      trigger: 'chat_resonance',
      reason: reasonText,
      adjustedSlots: [{
        eventId: targetEvent.id,
        hour: scheduledDate.getHours(),
        minute: scheduledDate.getMinutes(),
        activity: nextActivity,
        mood: '兴致勃勃',
        location: typeof targetEvent.payload.location === 'string' ? targetEvent.payload.location : undefined,
      }],
    }
    const sourceId = `replan:resonance:${roleId}:${resonance.id}`
    await recordCompanionEventAndNotify({
      roleId,
      type: 'life_slots_replanned',
      sourceType: 'chat_resonance',
      sourceId,
      idempotencyKey: sourceId,
      occurredAt: now,
      payload: result as unknown as Record<string, unknown>,
      notification: [
        { kind: 'slots-replanned', dedupeKey: sourceId, payload: result as unknown as Record<string, unknown> },
        { kind: 'timeline-updated', dedupeKey: `${sourceId}:timeline`, payload: { roleId, now } },
      ],
      dispatch: false,
    })
  })

  await dispatchCompanionWindowOutbox()
  log.info('Adapted next upcoming slot for same-day chat resonance', {
    roleId,
    resonanceId: resonance.id,
    eventId: targetEvent.id,
    activity: nextActivity,
  })
  return { adapted: true, eventId: targetEvent.id, activity: nextActivity }
}
