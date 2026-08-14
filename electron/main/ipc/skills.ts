import { ipcMain } from 'electron'
import { getLoadedSkills, reloadSkills } from '../skills/registry'
import { getSkillContent, getSkillVersionContent, listSkillVersionInfo, rollbackSkill, saveSkill, validateSkillContent, deleteSkill } from '../skills/loader'
import { ToolRegistry } from '../tools/registry'
import type { SkillValidationResult } from '../../../src/shared/types'

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

  const validate = (content: string): SkillValidationResult =>
    validateSkillContent(content, new Set(toolRegistry.getAll().map((tool) => tool.name)))

  ipcMain.handle('skills:validate', async (_event, content: string) => validate(content))

  ipcMain.handle('skills:save', async (_event, name: string, content: string) => {
    const validation = validate(content)
    if (!validation.valid) return { success: false, issues: validation.issues }
    const targetName = validation.name || name
    if (targetName !== name.trim()) {
      return {
        success: false,
        issues: [{ severity: 'error', code: 'name.mismatch', field: 'name', message: `文件中的 Skill 名称「${targetName}」与保存目标「${name}」不一致。` }],
      }
    }
    try {
      const filePath = await saveSkill(targetName, content)
      await reloadSkills(toolRegistry)
      return { success: true, filePath, issues: validation.issues }
    } catch (error) {
      return {
        success: false,
        issues: [{ severity: 'error', code: 'save.failed', message: error instanceof Error ? error.message : 'Skill 保存失败。' }],
      }
    }
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

  // G1 版本管理：列出历史版本 + 查看正文 + 回滚
  ipcMain.handle('skills:versions', async (_event, name: string) => {
    return listSkillVersionInfo(name)
  })

  ipcMain.handle('skills:version-content', async (_event, name: string, version: number) => {
    return getSkillVersionContent(name, version)
  })

  ipcMain.handle('skills:playground-run', async (_event, input: { content: string; userPrompt: string }) => {
    const validation = validate(input?.content ?? '')
    if (!validation.valid) return { ok: false, error: validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join('；') }
    const { runPlayground } = await import('../agent/playground')
    return runPlayground({ systemPrompt: input.content, userPrompt: input.userPrompt })
  })

  ipcMain.handle('skills:rollback', async (_event, name: string, version: number) => {
    const success = await rollbackSkill(name, version)
    if (success) await reloadSkills(toolRegistry)
    return { success }
  })
}
