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
  requestSwitch,
  summonCastBrief,
} from '../companion/orchestrator'
import {
  getMutable,
  listMutableVersions,
  rollbackMutable,
  setMutable,
} from '../companion/growth/mutable-store'
import { ensureStarterWardrobe, listAssets } from '../companion/life/assets'
import { listMomentsForRole } from '../companion/life/moments'
import { getRoleState } from '../companion/life/store'
import * as settings from '../storage/settings-store'

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
      const { version } = await setMutable(roleId.trim(), body, summary || '')
      return { ok: true as const, version }
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
      return { ok: false as const, error: String(err) }
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
    return {
      roleId,
      pausedAt: state?.pausedAt ?? null,
      catchupSummary: state?.catchupSummary ?? '',
      lastTickAt: state?.lastTickAt ?? 0,
    }
  })

  /** 衣柜等资产：仅活跃主角；空库时播种 starter */
  ipcMain.handle(
    'companion:get-assets',
    async (_e, opts?: { kind?: string }) => {
      const roleId = await getActiveRoleId()
      await ensureStarterWardrobe(roleId)
      const kind = typeof opts?.kind === 'string' ? opts.kind : undefined
      const items = await listAssets(roleId, kind ? { kind } : undefined)
      return { roleId, items }
    },
  )

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
      return { ok: false as const, error: String(err) }
    }
  })
}
