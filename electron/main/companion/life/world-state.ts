/**
 * 角色世界状态薄片（M23-G2）
 *
 * 背景：原先只有 catchup_summary + 事件里的 location；缺稳定「居所/时区/短期情境」。
 * 意图：结构化存 world_json；Assemble 只吃一行薄切片；不整库灌 Prompt。
 * 约束：不改稳定人物定义；辅任务正文来自纯 Prompt 生产定义。
 */

import type { CompanionWorldState } from '../types'
import {
  defaultWorldState,
  formatWorldSliceForPrompt,
} from './world-codec'
import * as store from './store'
import { applyVitalsDelta, deriveVitalsDelta, releaseSocialNeedAfterChat } from './world-vitals'
import {
  getCompanionRuntimeState,
  replaceCompanionRuntimeState,
} from '../core/state/runtime-state'

function runtimeToWorldState(state: Awaited<ReturnType<typeof getCompanionRuntimeState>>): CompanionWorldState {
  return {
    schemaVersion: 1,
    home: state.home,
    timezone: state.timezone,
    situation: state.situation,
    mood: state.mood,
    energy: state.energy,
    socialNeed: state.socialNeed,
    currentLocation: state.currentLocation,
    locationDetail: state.locationDetail,
    currentActivity: state.currentActivity,
    statusTags: state.statusTags,
    updatedAt: state.updatedAt,
  }
}

function worldToRuntimeState(
  world: CompanionWorldState,
  runtime: Awaited<ReturnType<typeof getCompanionRuntimeState>>,
) {
  return {
    roleId: runtime.roleId,
    universeId: runtime.universeId,
    mood: world.mood,
    energy: world.energy,
    socialNeed: world.socialNeed,
    hunger: runtime.hunger,
    sleepiness: runtime.sleepiness,
    home: world.home,
    timezone: world.timezone,
    currentActivity: world.currentActivity,
    currentLocation: world.currentLocation,
    locationDetail: world.locationDetail,
    statusTags: world.statusTags,
    situation: world.situation,
    pausedAt: runtime.pausedAt,
    catchupSummary: runtime.catchupSummary,
    version: runtime.version + 1,
    updatedAt: world.updatedAt,
    lastEventId: runtime.lastEventId,
  }
}

export {
  defaultWorldState,
  formatWorldSliceForPrompt,
  parseWorldJson,
  serializeWorldState,
} from './world-codec'

/** 读取当前 schema 世界；旧版 world_json 已由 codec 直接重置为出厂世界。 */
export async function ensureWorldState(roleId: string): Promise<CompanionWorldState> {
  const state = await getCompanionRuntimeState(roleId)
  return runtimeToWorldState(state)
}

/** 单次刷新最多结算的新事件数；离线补叙一次涌入大量事件时只结算最近若干条，避免数值被一次性推到极端。 */
const MAX_VITALS_EVENTS_PER_REFRESH = 8

/**
 * tick 后根据最近 published 事件刷新短期情境（短句）与生命体征。
 * 无事件则保留原 situation。
 *
 * 背景：mood / energy / socialNeed 需要随生活事件真实波动，否则前端顶栏与 Prompt 里的状态永远是出厂值。
 * 设计意图：以 world.updatedAt 作为结算水位线——只有 scheduledAt 晚于它的已发布事件才产生增量，
 * 因此 5 分钟心跳重复调用不会重复结算，也不需要给世界状态新增字段。
 * 关键约束：任何写入都把 updatedAt 推到 now（会移动水位线）；聊天释放 socialNeed 不得改 updatedAt，
 * 否则会让尚未结算的事件被水位线吞掉。
 */
export async function refreshSituationFromLife(
  roleId: string,
  now: number,
): Promise<CompanionWorldState> {
  const world = await ensureWorldState(roleId)
  const events = await store.listEvents(roleId, { status: 'published' })
  const due = events
    .filter((e) => e.scheduledAt <= now)
    .sort((a, b) => b.scheduledAt - a.scheduledAt)
  const latest = due[0]
  if (!latest) return world

  let vitals = { mood: world.mood, energy: world.energy, socialNeed: world.socialNeed }
  const unsettled = due
    .filter((e) => e.scheduledAt > world.updatedAt)
    .slice(0, MAX_VITALS_EVENTS_PER_REFRESH)
    .reverse()
  for (const event of unsettled) {
    vitals = applyVitalsDelta(vitals, deriveVitalsDelta(String(event.payload.activity ?? '')))
  }
  const vitalsChanged = vitals.mood !== world.mood
    || vitals.energy !== world.energy
    || vitals.socialNeed !== world.socialNeed

  const activity = String(latest.payload.activity ?? '').trim()
  const location = String(latest.payload.location ?? '').trim()
  const situation = [activity, location].filter(Boolean).join('@').slice(0, 80)
  if (!situation && !vitalsChanged) return world

  const nextSituation = situation || world.situation
  const currentLocation = location || world.currentLocation
  const locationDetail = location && location !== world.currentLocation ? '' : world.locationDetail
  const currentActivity = activity || world.currentActivity
  if (
    !vitalsChanged
    && nextSituation === world.situation
    && currentLocation === world.currentLocation
    && locationDetail === world.locationDetail
    && currentActivity === world.currentActivity
  ) {
    return world
  }

  const next: CompanionWorldState = {
    ...world,
    ...vitals,
    situation: nextSituation,
    currentLocation,
    locationDetail,
    currentActivity,
    updatedAt: now,
  }
  const runtime = await getCompanionRuntimeState(roleId)
  await replaceCompanionRuntimeState(worldToRuntimeState(next, runtime))
  return next
}

/**
 * 对话结束后释放社交需求。
 * 背景：socialNeed 随生活事件累积（见 world-vitals），用户来聊过之后应当回落，否则角色永远「想找人说话」。
 * 关键约束：保留 updatedAt 不变，避免移动 refreshSituationFromLife 的事件结算水位线。
 */
export async function settleVitalsAfterChat(roleId: string): Promise<CompanionWorldState> {
  const world = await ensureWorldState(roleId)
  const released = releaseSocialNeedAfterChat(world)
  const next: CompanionWorldState = { ...world, ...released }
  const runtime = await getCompanionRuntimeState(roleId)
  await replaceCompanionRuntimeState(worldToRuntimeState(next, runtime))
  return next
}
