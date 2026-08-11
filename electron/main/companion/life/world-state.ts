/**
 * 角色世界状态薄片（M23-G2）
 *
 * 背景：原先只有 catchup_summary + 事件里的 location；缺稳定「居所/时区/短期情境」。
 * 意图：结构化存 world_json；Assemble 只吃一行薄切片；不整库灌 Prompt。
 * 约束：不碰 prompt-builder 的 L1/L2；辅任务 Prompt 仍放各服务文件。
 */

import type { CompanionWorldState } from '../types'
import {
  defaultWorldState,
  formatWorldSliceForPrompt,
} from './world-codec'
import * as store from './store'

export {
  defaultWorldState,
  formatWorldSliceForPrompt,
  parseWorldJson,
  serializeWorldState,
} from './world-codec'

/** 读取当前 schema 世界；旧版 world_json 已由 codec 直接重置为出厂世界。 */
export async function ensureWorldState(roleId: string): Promise<CompanionWorldState> {
  const state = await store.getRoleState(roleId)
  const world = state?.world ?? defaultWorldState(roleId)
  if (!state || world.updatedAt === 0) {
    const next = { ...world, updatedAt: Date.now() }
    await store.setWorldState(roleId, next)
    return next
  }
  return world
}

/**
 * tick 后根据最近 published 事件刷新短期情境（短句）。
 * 无事件则保留原 situation。
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

  const activity = String(latest.payload.activity ?? '').trim()
  const location = String(latest.payload.location ?? '').trim()
  const situation = [activity, location].filter(Boolean).join('@').slice(0, 80)
  if (!situation) return world

  const currentLocation = location || world.currentLocation
  const locationDetail = location && location !== world.currentLocation ? '' : world.locationDetail
  const currentActivity = activity || world.currentActivity
  if (
    situation === world.situation
    && currentLocation === world.currentLocation
    && locationDetail === world.locationDetail
    && currentActivity === world.currentActivity
  ) {
    return world
  }

  const next: CompanionWorldState = {
    ...world,
    situation,
    currentLocation,
    locationDetail,
    currentActivity,
    updatedAt: now,
  }
  await store.setWorldState(roleId, next)
  return next
}
