/**
 * Companion IPC — 取代旧 persona:* 通道
 *
 * 四处同步：本文件 / preload / vite-env / 调用方（SettingsPanel 等）
 */

import { ipcMain } from 'electron'
import {
  getActiveRole,
  getActiveRoleId,
  listActiveUniverseProtagonists,
  requestSwitch,
} from '../companion/orchestrator'
import {
  getMutable,
  listMutableVersions,
  rollbackMutable,
  setMutable,
} from '../companion/growth/mutable-store'
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
}
