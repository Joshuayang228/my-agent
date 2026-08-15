/**
 * Companion IPC — 取代旧 persona:* 通道
 *
 * 四处同步：本文件 / preload / vite-env / 调用方（SettingsPanel 等）
 */

import { ipcMain } from 'electron'
import {
  getActiveRole,
  getActiveRoleId,
  getActiveRoster,
  listActiveUniverseProtagonists,
  getCastAvailability,
  requestSwitch,
  startSummonSession,
  summonCastBrief,
} from '../companion/orchestrator'
import {
  getMutable,
  listMutableVersions,
  rollbackMutable,
  setMutable,
} from '../companion/growth/mutable-store'
import {
  getReflectionStatus,
  runReflectionNow,
} from '../companion/growth/reflection-service'
import { describeCastPresence } from '../companion/cast/availability'
import {
  deleteAsset,
  ensureStarterAssets,
  listAssets,
  updateAsset,
} from '../companion/life/assets'
import { listMomentsForRole } from '../companion/life/moments'
import { getRoleState } from '../companion/life/store'
import * as settings from '../storage/settings-store'
import { loadAuxLLMConfig } from '../llm/aux-config'
import { createLogger } from '../utils/logger'

const log = createLogger('CompanionIPC')

export function registerCompanionIPC(): void {
  ipcMain.handle('companion:list-protagonists', async () => {
    const universeId = await settings.getSetting('universeId')
    return listActiveUniverseProtagonists(universeId)
  })

  ipcMain.handle('companion:get-active', async () => getActiveRole())

  ipcMain.handle('companion:request-switch', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false, code: 'UNKNOWN_ROLE' as const }
    }
    return requestSwitch(roleId.trim())
  })

  ipcMain.handle('companion:get-mutable', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    const universeId = await settings.getSetting('universeId')
    const body = await getMutable(id, universeId)
    return { roleId: id, body }
  })

  ipcMain.handle(
    'companion:set-mutable',
    async (_e, roleId: string, body: string, summary?: string) => {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        return { ok: false as const, error: 'INVALID_ROLE' }
      }
      if (typeof body !== 'string') {
        return { ok: false as const, error: 'INVALID_BODY' }
      }
      const result = await setMutable(roleId.trim(), body, summary || '')
      if (!result.ok) {
        return { ok: false as const, error: result.error, code: result.code }
      }
      return { ok: true as const, version: result.version }
    },
  )

  ipcMain.handle('companion:list-mutable-versions', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) return []
    return listMutableVersions(roleId.trim())
  })

  ipcMain.handle('companion:rollback-mutable', async (_e, roleId: string, toVersion: number) => {
    if (typeof roleId !== 'string' || !roleId.trim() || !Number.isFinite(toVersion)) {
      return { ok: false as const, error: 'INVALID_ARGS' }
    }
    try {
      const { version } = await rollbackMutable(roleId.trim(), toVersion)
      return { ok: true as const, version }
    } catch (err) {
      log.warn('Mutable rollback failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false as const, error: '回滚失败，请稍后重试' }
    }
  })

  /** 朋友圈：仅返回当前活跃主角 */
  ipcMain.handle(
    'companion:get-moments',
    async (_e, opts?: { limit?: number; offset?: number }) => {
      const roleId = await getActiveRoleId()
      const limit = typeof opts?.limit === 'number' ? opts.limit : 50
      const offset = typeof opts?.offset === 'number' ? opts.offset : 0
      const items = await listMomentsForRole(roleId, { limit, offset })
      return { roleId, items }
    },
  )

  ipcMain.handle('companion:catchup-status', async () => {
    const roleId = await getActiveRoleId()
    const state = await getRoleState(roleId)
    const universeId = await settings.getSetting('universeId')
    const presence = (await describeCastPresence(roleId, { universeId })) || ''
    return {
      roleId,
      pausedAt: state?.pausedAt ?? null,
      catchupSummary: state?.catchupSummary ?? '',
      lastTickAt: state?.lastTickAt ?? 0,
      /** 此刻活动/地点一句话（供 Chat 状态条） */
      presence,
    }
  })

  /** 物什（衣柜/书架）：仅活跃主角；空 kind 时播种 starter */
  ipcMain.handle(
    'companion:get-assets',
    async (_e, opts?: { kind?: string }) => {
      const roleId = await getActiveRoleId()
      await ensureStarterAssets(roleId)
      const kind = typeof opts?.kind === 'string' ? opts.kind : undefined
      const items = await listAssets(roleId, kind ? { kind } : undefined)
      return { roleId, items }
    },
  )

  /** M25-G1：更新活跃主角资产 */
  ipcMain.handle(
    'companion:update-asset',
    async (
      _e,
      assetId: string,
      patch?: { name?: string; payload?: Record<string, unknown> },
    ) => {
      if (typeof assetId !== 'string' || !assetId.trim()) {
        return { ok: false as const, error: 'INVALID_ID' }
      }
      if (!patch || typeof patch !== 'object') {
        return { ok: false as const, error: 'INVALID_PATCH' }
      }
      const roleId = await getActiveRoleId()
      const result = await updateAsset(assetId.trim(), patch, { expectedRoleId: roleId })
      if (!result.ok) return { ok: false as const, error: result.error, code: result.code }
      return { ok: true as const, asset: result.asset }
    },
  )

  /** M25-G1：删除活跃主角资产 */
  ipcMain.handle('companion:delete-asset', async (_e, assetId: string) => {
    if (typeof assetId !== 'string' || !assetId.trim()) {
      return { ok: false as const, error: 'INVALID_ID' }
    }
    const roleId = await getActiveRoleId()
    const result = await deleteAsset(assetId.trim(), { expectedRoleId: roleId })
    if (!result.ok) return { ok: false as const, error: result.error, code: result.code }
    return { ok: true as const }
  })

  /** 名册：以活跃主角为视角的关系短句 + 卡司浅层 */
  ipcMain.handle('companion:get-roster', async () => getActiveRoster())

  /** 召唤摘要：不含 protected，不启用对方生活世界 */
  ipcMain.handle('companion:summon-brief', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false as const, error: 'INVALID_ROLE' }
    }
    try {
      const brief = await summonCastBrief(roleId.trim())
      return { ok: true as const, brief }
    } catch (err) {
      log.warn('Summon brief failed', { errorType: err instanceof Error ? err.name : 'unknown' })
      return { ok: false as const, error: '召唤摘要生成失败，请稍后重试' }
    }
  })

  /** 召唤前忙闲（Alice checkFriendAvailability 对照） */
  ipcMain.handle('companion:check-cast-availability', async (_e, roleId: string) => {
    if (typeof roleId !== 'string' || !roleId.trim()) {
      return { ok: false as const, error: 'INVALID_ROLE' }
    }
    return getCastAvailability(roleId.trim())
  })

  /** 召唤子会话：装载对方完整 Pack，不改 active、不启对方生活 */
  ipcMain.handle(
    'companion:start-summon',
    async (_e, roleId: string, force?: boolean) => {
      if (typeof roleId !== 'string' || !roleId.trim()) {
        return { ok: false as const, error: 'INVALID_ROLE' }
      }
      return startSummonSession(roleId.trim(), { force: !!force })
    },
  )

  /** 成长反思状态（门闸 + 最近 runs） */
  ipcMain.handle('companion:reflection-status', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    return getReflectionStatus(id)
  })

  /** 立即反思；force 跳过 72h/24h/消息数门闸 */
  ipcMain.handle(
    'companion:run-reflection',
    async (_e, roleId?: string, force?: boolean) => {
      const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
      const llm = await loadAuxLLMConfig()
      if (!llm.apiKey) {
        return { skipped: true, changed: false, summary: 'NO_API_KEY', reason: 'NO_API_KEY' }
      }
      return runReflectionNow(id, llm, { force: !!force })
    },
  )

  /** M30-G1：已记录的关系里程碑种类（无成就点数） */
  ipcMain.handle('companion:list-milestones', async (_e, roleId?: string) => {
    const id = (typeof roleId === 'string' && roleId.trim()) || (await getActiveRoleId())
    const { listMilestoneKinds } = await import('../companion/growth/milestones')
    return { roleId: id, kinds: await listMilestoneKinds(id) }
  })
}
