import { ipcMain } from 'electron'
import * as settings from '../storage/settings-store'
import { BUILTIN_PERSONAS } from '../agent/prompt-builder'

export function registerPersonaIPC(): void {
  ipcMain.handle('persona:list', () =>
    BUILTIN_PERSONAS.map(p => ({ id: p.id, name: p.name, description: p.description })))

  ipcMain.handle('persona:get-current', async () => {
    const id = await settings.getSetting('personaId')
    return BUILTIN_PERSONAS.find(p => p.id === id) ?? BUILTIN_PERSONAS[0]
  })
}
