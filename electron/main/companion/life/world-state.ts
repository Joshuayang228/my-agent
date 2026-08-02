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
  mergeWorldDefaults,
} from './world-codec'
import * as store from './store'

export {
  defaultWorldState,
  formatWorldSliceForPrompt,
  mergeWorldDefaults,
  parseWorldJson,
  serializeWorldState,
} from './world-codec'

/** 读取并确保有默认居所/时区 */
export async function ensureWorldState(roleId: string): Promise<CompanionWorldState> {
  const state = await store.getRoleState(roleId)
  const merged = mergeWorldDefaults(roleId, state?.world ?? defaultWorldState(roleId))
  const before = state?.world
  const changed =
    !before ||
    before.home !== merged.home ||
    before.timezone !== merged.timezone
  if (changed) {
    const next = { ...merged, updatedAt: Date.now() }
    await store.setWorldState(roleId, next)
    return next
  }
  return merged
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
  if (!situation || situation === world.situation) return world

  const next: CompanionWorldState = {
    ...world,
    situation,
    updatedAt: now,
  }
  await store.setWorldState(roleId, next)
  return next
}
