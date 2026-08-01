/**
 * Companion Orchestrator
 *
 * 背景：设置页与 runtime 需要统一读写 activeRoleId；切换必须门控进行中会话。
 * 意图：getActiveRoleId / requestSwitch / 解析当前 RolePack（含 MUTABLE 覆盖）。
 * 约束：有流式 chat 时拒绝切换（SESSION_ACTIVE）；切换时 pause 旧角色 / resume 新角色。
 *       Catch-up 细补在 W3；本模块只排队标记 catchupQueued。
 *       本模块不 import agent/（通过 streaming-gate 探针）。
 */

import * as settings from '../storage/settings-store'
import * as identity from './identity/loader'
import { getMutable } from './growth/mutable-store'
import { pauseRole, resumeRole } from './life/engine'
import { getRoleState } from './life/store'
import { isStreamingActive } from './streaming-gate'
import type { RolePack, RoleSummary, SwitchResult } from './types'

export async function getActiveRoleId(): Promise<string> {
  const universeId = await settings.getSetting('universeId')
  const active = await settings.getSetting('activeRoleId')
  if (active && identity.isKnownProtagonist(active, universeId)) return active
  const fallback = identity.getDefaultProtagonistId(universeId)
  if (active !== fallback) {
    await settings.setSetting('activeRoleId', fallback)
  }
  return fallback
}

export async function getActiveRole(): Promise<RoleSummary & { universeId: string }> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  const pack = identity.loadRolePack(roleId, universeId)
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
  return identity.loadRolePack(roleId, universeId)
}

/** Assemble 输入：Pack + 当前 MUTABLE 正文（覆盖或默认） */
export async function loadRoleAssembleInput(
  roleId: string,
  universeId?: string,
): Promise<{ pack: RolePack; mutableBody: string }> {
  const uid = universeId ?? (await settings.getSetting('universeId'))
  const pack = identity.loadRolePack(roleId, uid)
  const mutableBody = await getMutable(roleId, uid)
  return { pack, mutableBody }
}

export async function loadActiveAssembleInput(): Promise<{ pack: RolePack; mutableBody: string }> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return loadRoleAssembleInput(roleId, universeId)
}

export function listActiveUniverseProtagonists(universeId?: string): RoleSummary[] {
  return identity.listProtagonists(universeId ?? 'default')
}

/**
 * 完整切换活跃主角。
 * 流式进行中 → SESSION_ACTIVE；未知角色 / 已是当前 → 对应错误码。
 * 成功：pause 旧角色 → 写 activeRoleId → resume 新角色；若新角色曾暂停则 catchupQueued。
 */
export async function requestSwitch(roleId: string): Promise<SwitchResult> {
  const universeId = await settings.getSetting('universeId')
  if (!identity.isKnownProtagonist(roleId, universeId)) {
    return { ok: false, code: 'UNKNOWN_ROLE' }
  }
  const current = await getActiveRoleId()
  if (current === roleId) {
    return { ok: false, code: 'ALREADY_ACTIVE' }
  }
  if (isStreamingActive()) {
    return { ok: false, code: 'SESSION_ACTIVE' }
  }

  const now = Date.now()
  await pauseRole(current, now)

  const targetPrev = await getRoleState(roleId)
  const catchupQueued = targetPrev?.pausedAt != null

  await settings.setSetting('activeRoleId', roleId)
  await resumeRole(roleId)

  return { ok: true, catchupQueued }
}
