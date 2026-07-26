import { ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import type { AppSettings } from '../storage/settings-store'
import { loadRules } from '../sandbox/permission-engine'

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:get', async () => settings.getAllSettings())

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    await settings.setSetting(key as keyof AppSettings, value)
    // 自定义权限规则热更新 → 立即刷入责任链第一层
    if (key === 'permissionRules') {
      loadRules(value || '[]')
    }
  })
}
