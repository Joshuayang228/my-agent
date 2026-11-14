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

import type { ReplanResult } from '../../../../src/shared/types'
import { createLogger } from '../../utils/logger'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileReplanSlotsRequest } from '../../prompts/registered-request'
import { loadRolePack } from '../identity/loader'
import { toLocalDateString } from './dates'
import { ensureWorldState } from './world-state'
import * as store from './store'
import { isActiveRole } from '../../storage/settings-store'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import { withCompanionUnitOfWork } from '../core/transaction/unit-of-work'
import { dispatchCompanionWindowOutbox } from '../adapters/window-outbox-dispatcher'

const log = createLogger('LifeReplan')

export interface ReplanOptions {
  trigger: 'vitals_exhaustion' | 'vulnerability' | 'co_decision' | 'manual'
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

/** 规则兜底：依据诱因与时间槽提供自然可信的修养/调理活动 */
function getFallbackAdaptedSlots(
  roleId: string,
  trigger: string,
  slots: Array<{ hour: number; minute: number; originalActivity: string }>,
): AdaptedSlot[] {
  const isLuffy = roleId === 'luffy' || roleId.includes('luffy')

  if (trigger === 'vitals_exhaustion') {
    return slots.map((s, idx) => {
      if (idx === 0) {
        return {
          hour: s.hour,
          minute: s.minute,
          activity: isLuffy ? '在船舱阴凉处裹着毯子大睡特睡' : '在工位旁闭目深呼吸静养片刻',
          mood: '疲惫恢复中',
          location: isLuffy ? '医务室/船舱' : '休息区',
        }
      }
      if (idx === 1) {
        return {
          hour: s.hour,
          minute: s.minute,
          activity: isLuffy ? '大口喝下山治特调的热骨头浓汤' : '喝下一大杯温水整理呼吸',
          mood: '温饱安心',
          location: isLuffy ? '厨房角落' : '茶水间',
        }
      }
      return {
        hour: s.hour,
        minute: s.minute,
        activity: isLuffy ? '坐在甲板台阶上发呆吹微风' : '安静整理桌面放慢节奏',
        mood: '平静放松',
        location: isLuffy ? '甲板阴凉处' : '窗边',
      }
    })
  }

  if (trigger === 'vulnerability') {
    return slots.map((s, idx) => {
      if (idx === 0) {
        return {
          hour: s.hour,
          minute: s.minute,
          activity: isLuffy ? '一个人坐在羊头船首静静看海浪' : '独自站在阳台看远处的夜色',
          mood: '沉静释怀',
          location: isLuffy ? '梅利号船首' : '阳台',
        }
      }
      if (idx === 1) {
        return {
          hour: s.hour,
          minute: s.minute,
          activity: isLuffy ? '低头默默抚平草帽上的细小磨痕' : '翻看过去的笔记与备忘',
          mood: '若有所思',
          location: isLuffy ? '甲板角落' : '书桌前',
        }
      }
      return {
        hour: s.hour,
        minute: s.minute,
        activity: isLuffy ? '听着同伴们在厨房喧闹的声音感到心安' : '听一段轻缓温暖的纯音乐',
        mood: '温暖安心',
        location: isLuffy ? '船舱外廊' : '沙发上',
      }
    })
  }

  // co_decision 或 manual
  return slots.map((s, idx) => ({
    hour: s.hour,
    minute: s.minute,
    activity: idx === 0 ? '按照商量好的方向调整准备' : '整理随身探险装备',
    mood: '专注认真',
    location: isLuffy ? '甲板' : '工位',
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
  const allPlanned = await store.listEvents(roleId, { status: 'planned', order: 'asc', limit: 20 })
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
      await store.updateEventPayload(ev.id, updatedPayload)
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
  const planned = await store.listEvents(roleId, { status: 'planned', order: 'asc', limit: 10 })
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
