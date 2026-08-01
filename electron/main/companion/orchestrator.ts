/**
 * Companion Orchestrator（W0 最小实现）
 *
 * 背景：设置页与 runtime 需要统一读写 activeRoleId；完整会话门控 / Catch-up 在 W1+。
 * 意图：提供 getActiveRoleId / requestSwitch / 解析当前 RolePack。
 * 约束：W0 的 requestSwitch 不做 SESSION_ACTIVE 检查（W1 补齐）；未知角色拒绝。
 */

import * as settings from '../storage/settings-store'
import {
  getDefaultProtagonistId,
  isKnownProtagonist,
  listProtagonists,
  loadRolePack,
} from './identity/loader'
import type { RolePack, RoleSummary, SwitchResult } from './types'

export async function getActiveRoleId(): Promise<string> {
  const universeId = await settings.getSetting('universeId')
  const active = await settings.getSetting('activeRoleId')
  if (active && isKnownProtagonist(active, universeId)) return active
  const fallback = getDefaultProtagonistId(universeId)
  if (active !== fallback) {
    await settings.setSetting('activeRoleId', fallback)
  }
  return fallback
}

export async function getActiveRole(): Promise<RoleSummary & { universeId: string }> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  const pack = loadRolePack(roleId, universeId)
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    universeId,
  }
}

export async function loadActiveRolePack(): Promise<RolePack> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return loadRolePack(roleId, universeId)
}

export function listActiveUniverseProtagonists(universeId?: string): RoleSummary[] {
  return listProtagonists(universeId ?? 'default')
}

/**
 * 切换活跃主角（W0：仅写 settings；W1 补会话门控与 Catch-up）。
 */
export async function requestSwitch(roleId: string): Promise<SwitchResult> {
  const universeId = await settings.getSetting('universeId')
  if (!isKnownProtagonist(roleId, universeId)) {
    return { ok: false, code: 'UNKNOWN_ROLE' }
  }
  const current = await getActiveRoleId()
  if (current === roleId) {
    return { ok: false, code: 'ALREADY_ACTIVE' }
  }
  await settings.setSetting('activeRoleId', roleId)
  // W0：尚无 LifeEngine，不排队 Catch-up
  return { ok: true, catchupQueued: false }
}
