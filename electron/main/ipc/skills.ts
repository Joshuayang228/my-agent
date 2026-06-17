import { ipcMain } from 'electron'
import { getLoadedSkills, reloadSkills } from '../skills/registry'
import { saveSkill, deleteSkill, getSkillContent } from '../skills/loader'
import { ToolRegistry } from '../tools/registry'

export function registerSkillsIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('skills:list', async () => {
    return getLoadedSkills().map(s => ({
      name: s.meta.name,
      description: s.meta.description,
      when_to_use: s.meta.when_to_use || '',
      allowed_tools: s.meta.allowed_tools || [],
      disable_model_invocation: s.meta.disable_model_invocation || false,
      version: s.meta.version || '',
      source: s.source,
      filePath: s.filePath,
    }))
  })

  ipcMain.handle('skills:get', async (_event, name: string) => {
    return getSkillContent(name)
  })

  ipcMain.handle('skills:save', async (_event, name: string, content: string) => {
    const filePath = await saveSkill(name, content)
    await reloadSkills(toolRegistry)
    return { success: true, filePath }
  })

  ipcMain.handle('skills:delete', async (_event, name: string) => {
    await deleteSkill(name)
    await reloadSkills(toolRegistry)
    return { success: true }
  })

  ipcMain.handle('skills:reload', async () => {
    await reloadSkills(toolRegistry)
    return { success: true, count: getLoadedSkills().length }
  })
}
