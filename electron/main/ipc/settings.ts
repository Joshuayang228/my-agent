import { ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import type { AppSettings } from '../storage/settings-store'

export function registerSettingsIPC(): void {
  ipcMain.handle('settings:get', async () => settings.getAllSettings())

  ipcMain.handle('settings:set', async (_event, key: string, value: string) =>
    settings.setSetting(key as keyof AppSettings, value))
}
