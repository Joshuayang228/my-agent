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
import * as store from '../storage/session-store'
import * as identity from './identity/loader'
import {
  checkCastAvailability,
  describeCastPresence,
  type CastAvailability,
} from './cast/availability'
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
import { recordAndBroadcastMilestone } from './growth/milestones'
import { buildReacquaintCopy } from './presence'
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

/** Assemble 输入：Pack + MUTABLE + catchup + 世界薄片 + 近 Moment + 名册浅注入 */
export async function loadRoleAssembleInput(
  roleId: string,
  universeId?: string,
): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  /** M23-G2：居所/时区/近况一行 */
  worldSlice?: string
  /** M24-G1：近 1–3 条 Moment 薄锚点 */
  recentMomentsSlice?: string
  rosterLines?: string
}> {
  const uid = universeId ?? (await settings.getSetting('universeId'))
  const pack = identity.loadRolePack(roleId, uid)
  const mutableBody = await getMutable(roleId, uid)
  const state = await getRoleState(roleId)
  const catchupSummary = state?.catchupSummary?.trim() || undefined
  const roster = formatRosterForPrompt(buildRosterLines(roleId, uid))
  // 延迟 import，避免 orchestrator ↔ life 启动环
  const { ensureWorldState, formatWorldSliceForPrompt } = await import('./life/world-state')
  const { collectRecentMomentsSlice } = await import('./life/moment-consistency')
  const world = await ensureWorldState(roleId)
  const worldSlice = formatWorldSliceForPrompt(world) || undefined
  const { slice: recentMomentsSlice } = await collectRecentMomentsSlice(roleId)
  return {
    pack,
    mutableBody,
    catchupSummary,
    worldSlice,
    recentMomentsSlice: recentMomentsSlice || undefined,
    rosterLines: roster || undefined,
  }
}

export async function loadActiveAssembleInput(): Promise<{
  pack: RolePack
  mutableBody: string
  catchupSummary?: string
  worldSlice?: string
  recentMomentsSlice?: string
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

/** 召唤前忙闲查询（UI 可先预检） */
export async function getCastAvailability(
  roleId: string,
  opts?: { now?: number; random?: () => number },
): Promise<CastAvailability | { ok: false; error: string }> {
  const universeId = await settings.getSetting('universeId')
  const id = roleId.trim()
  if (!id) return { ok: false, error: 'INVALID_ROLE' }
  try {
    return await checkCastAvailability(id, { ...opts, universeId })
  } catch {
    return { ok: false, error: 'UNKNOWN_ROLE' }
  }
}

/**
 * 开启召唤子会话：绑定目标 Role Pack（含 protected），不改 activeRoleId，不 resume 对方生活。
 * 若目标就是当前活跃主角，退化为普通主线会话。
 * 默认走可用性检查（Alice checkFriendAvailability）；force=true 可强开。
 */
export async function startSummonSession(
  roleId: string,
  opts?: { force?: boolean; now?: number; random?: () => number },
): Promise<
  | {
      ok: true
      sessionId: string
      roleId: string
      name: string
      sessionKind: 'main' | 'summon'
      activeRoleId: string
      presence?: string
    }
  | {
      ok: false
      error: string
      reason?: string
      alternative?: string
      presence?: string
    }
> {
  const universeId = await settings.getSetting('universeId')
  const id = roleId.trim()
  if (!id) return { ok: false, error: 'INVALID_ROLE' }

  let pack
  try {
    pack = identity.loadRolePack(id, universeId)
  } catch {
    return { ok: false, error: 'UNKNOWN_ROLE' }
  }

  const activeRoleId = await getActiveRoleId()
  if (id === activeRoleId) {
    const session = await store.createSession(id, { sessionKind: 'main' })
    return {
      ok: true,
      sessionId: session.id,
      roleId: id,
      name: pack.name,
      sessionKind: 'main',
      activeRoleId,
    }
  }

  if (!opts?.force) {
    const avail = await checkCastAvailability(id, {
      universeId,
      now: opts?.now,
      random: opts?.random,
    })
    if (!avail.available) {
      return {
        ok: false,
        error: 'BUSY',
        reason: avail.reason,
        alternative: avail.alternative,
        presence: avail.presence,
      }
    }
  }

  const presence =
    (await describeCastPresence(id, { universeId, now: opts?.now })) || undefined

  const session = await store.createSession(id, {
    sessionKind: 'summon',
    title: `召唤 · ${pack.name}`,
  })
  return {
    ok: true,
    sessionId: session.id,
    roleId: id,
    name: pack.name,
    sessionKind: 'summon',
    activeRoleId,
    presence,
  }
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
  reacquaint: { title: string; body: string; toast: string }
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

  // M28-G3：再认识微文案（不碰成长时钟）
  let fromName = current
  let toName = roleId
  try {
    fromName = identity.loadRolePack(current, universeId).name
    toName = identity.loadRolePack(roleId, universeId).name
  } catch {
    /* 名缺失时用 id */
  }
  const reacquaint = buildReacquaintCopy({
    fromName,
    toName,
    catchupQueued,
  })

  broadcastRoleChanged({
    roleId,
    catchupQueued,
    previousRoleId: current,
    reacquaint,
  })

  // M30-G1：第一次切到该主角（反成就绑架，仅记一次）
  void recordAndBroadcastMilestone(roleId, 'first_role_switch', {
    roleDisplayName: toName,
  }).catch(() => {})

  return { ok: true, catchupQueued, reacquaint }
}
