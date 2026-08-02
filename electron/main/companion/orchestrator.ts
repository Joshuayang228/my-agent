/**
 * Companion Orchestrator
 *
 * 背景：设置页与 runtime 需要统一读写 activeRoleId；切换必须门控进行中会话。
 * 意图：getActiveRoleId / requestSwitch / assertSessionRole / Assemble 输入。
 * 约束：有流式 chat 时拒绝切换（SESSION_ACTIVE）；切换时 pause 旧角色；
 *       新角色曾暂停则同步 runCatchup（W3）；本模块不 import agent/。
 */

import { BrowserWindow } from 'electron'
import * as settings from '../storage/settings-store'
import * as identity from './identity/loader'
import {
  buildRosterLines,
  formatRosterForPrompt,
  listRelatedCast,
  loadCastBrief,
  type CastBrief,
  type RosterLine,
} from './cast/roster'
import { getMutable } from './growth/mutable-store'
import { runCatchup } from './life/catchup'
import { pauseRole, resumeRole } from './life/engine'
import { getRoleState } from './life/store'
import { isStreamingActive } from './streaming-gate'
import type { RolePack, RoleSummary, SwitchResult } from './types'

export type { CastBrief, RosterLine }

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

/** Assemble 输入：Pack + MUTABLE + catchup + 名册浅注入 */
export async function loadRoleAssembleInput(
  roleId: string,
  universeId?: string,
): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  rosterLines?: string
}> {
  const uid = universeId ?? (await settings.getSetting('universeId'))
  const pack = identity.loadRolePack(roleId, uid)
  const mutableBody = await getMutable(roleId, uid)
  const state = await getRoleState(roleId)
  const catchupSummary = state?.catchupSummary?.trim() || undefined
  const roster = formatRosterForPrompt(buildRosterLines(roleId, uid))
  return {
    pack,
    mutableBody,
    catchupSummary,
    rosterLines: roster || undefined,
  }
}

export async function loadActiveAssembleInput(): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  rosterLines?: string
}> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return loadRoleAssembleInput(roleId, universeId)
}

/** 当前活跃主角相关的名册短句 */
export async function getActiveRoster(): Promise<{
  roleId: string
  lines: RosterLine[]
  cast: CastBrief[]
}> {
  const universeId = await settings.getSetting('universeId')
  const roleId = await getActiveRoleId()
  return {
    roleId,
    lines: buildRosterLines(roleId, universeId),
    cast: listRelatedCast(roleId, universeId),
  }
}

/**
 * 召唤摘要：装载非 active 角色浅层信息，不启用其生活世界、不返回 protected。
 */
export async function summonCastBrief(roleId: string): Promise<CastBrief> {
  const universeId = await settings.getSetting('universeId')
  return loadCastBrief(roleId, universeId)
}

export function listActiveUniverseProtagonists(universeId?: string): RoleSummary[] {
  return identity.listProtagonists(universeId ?? 'default')
}

/**
 * 聊天前校验：会话绑定的 role_id 不可被 activeRoleId 悄悄替换。
 * 返回应使用的 assembleRoleId；mismatch 时 UI 应提示「当前会话仍是旧主角」。
 */
export async function assertSessionRole(sessionRoleId: string | undefined | null): Promise<{
  assembleRoleId: string
  activeRoleId: string
  mismatch: boolean
}> {
  const activeRoleId = await getActiveRoleId()
  const bound = (sessionRoleId || '').trim()
  if (!bound) {
    return { assembleRoleId: activeRoleId, activeRoleId, mismatch: false }
  }
  return {
    assembleRoleId: bound,
    activeRoleId,
    mismatch: bound !== activeRoleId,
  }
}

function broadcastRoleChanged(payload: {
  roleId: string
  catchupQueued: boolean
  previousRoleId: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('companion:role-changed', payload)
  }
}

/**
 * 完整切换活跃主角。
 * 成功：pause 旧角色 → 写 activeRoleId → 若新角色曾暂停则 runCatchup，否则 resume。
 * 并向渲染进程广播 Surfaces rebind。
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
  const pausedAt = targetPrev?.pausedAt ?? null

  await settings.setSetting('activeRoleId', roleId)

  let catchupQueued = false
  if (pausedAt != null) {
    await runCatchup(roleId, pausedAt, now)
    catchupQueued = true
  } else {
    await resumeRole(roleId)
  }

  broadcastRoleChanged({ roleId, catchupQueued, previousRoleId: current })
  return { ok: true, catchupQueued }
}
