import { ipcMain } from 'electron'
import { getLoadedSkills, isSkillEnabled, reloadSkills, setSkillEnabled, withSkillMutation } from '../skills/registry'
import { getSkillContent, getSkillVersionContent, listSkillVersionInfo, rollbackSkill, saveSkill, validateSkillContent, deleteSkill, MAX_SKILL_CONTENT_LENGTH } from '../skills/loader'
import { ToolRegistry } from '../tools/registry'
import type { SkillEnabledResult, SkillInfo, SkillValidationResult } from '../../../src/shared/types'

export function registerSkillsIPC(toolRegistry: ToolRegistry): void {
  ipcMain.handle('skills:list', async () => withSkillMutation(async () => {
    return getLoadedSkills().map((s): SkillInfo => ({
      name: s.meta.name,
      description: s.meta.description,
      author: s.meta.author,
      when_to_use: s.meta.when_to_use || '',
      allowed_tools: s.meta.allowed_tools || [],
      disable_model_invocation: s.meta.disable_model_invocation || false,
      version: s.meta.version || '',
      source: s.source,
      enabled: isSkillEnabled(s.meta.name),
    }))
  }))

  ipcMain.handle('skills:get', async (_event, name: string) => {
    if (typeof name !== 'string' || name.length > 64) return null
    const skill = getLoadedSkills().find((item) => item.meta.name === name)
    if (!skill) return null
    if (skill.source === 'user') return getSkillContent(name)
    const { readFile } = await import('node:fs/promises')
    try { return await readFile(skill.filePath, 'utf-8') } catch { return null }
  })

  ipcMain.handle('skills:set-enabled', async (_event, name: unknown, enabled: unknown): Promise<SkillEnabledResult> => {
    if (typeof name !== 'string' || name.length > 64 || typeof enabled !== 'boolean') return { success: false, error: 'Skill 启停参数无效。' }
    try {
      await setSkillEnabled(toolRegistry, name, enabled)
      return { success: true, enabled }
    } catch {
      return { success: false, error: '未能更新 Skill 状态，请重试。' }
    }
  })

  const validate = (content: string): SkillValidationResult =>
    validateSkillContent(content, new Set(toolRegistry.getAll().map((tool) => tool.name)))

  ipcMain.handle('skills:validate', async (_event, content: string) => validate(content))

  ipcMain.handle('skills:save', async (_event, name: string, content: string) => withSkillMutation(async () => {
    const existing = getLoadedSkills().find((skill) => skill.meta.name === name)
    if (typeof name !== 'string' || name.length > 64 || existing?.source === 'builtin') {
      return { success: false, issues: [{ severity: 'error', code: 'save.readonly', message: '此 Skill 不可编辑。' }] }
    }
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
    } catch {
      return {
        success: false,
        issues: [{ severity: 'error', code: 'save.failed', message: 'Skill 保存失败，请重试。' }],
      }
    }
  }))

  ipcMain.handle('skills:delete', async (_event, name: string) => withSkillMutation(async () => {
    if (typeof name !== 'string' || !getLoadedSkills().some((skill) => skill.meta.name === name && skill.source === 'user')) return { success: false }
    try {
      await deleteSkill(name)
      await reloadSkills(toolRegistry)
      return { success: true }
    } catch {
      return { success: false }
    }
  }))

  ipcMain.handle('skills:reload', async () => withSkillMutation(async () => {
    try {
      await reloadSkills(toolRegistry)
      return { success: true, count: getLoadedSkills().length }
    } catch {
      throw new Error('无法重新加载 Skills，请重试。')
    }
  }))

  // G1 版本管理：列出历史版本 + 查看正文 + 回滚
  ipcMain.handle('skills:versions', async (_event, name: string) => {
    return listSkillVersionInfo(name)
  })

  ipcMain.handle('skills:version-content', async (_event, name: string, version: number) => {
    return getSkillVersionContent(name, version)
  })

  ipcMain.handle('skills:playground-run', async (_event, input: { content: string; userPrompt: string }) => {
    if (!input || typeof input !== 'object' || typeof input.content !== 'string' || typeof input.userPrompt !== 'string') {
      return { ok: false, error: 'Playground 参数无效' }
    }
    if (input.userPrompt.length > MAX_SKILL_CONTENT_LENGTH) {
      return { ok: false, error: '用户提示词过长' }
    }
    const validation = validate(input.content)
    if (!validation.valid) return { ok: false, error: validation.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message).join('；') }
    const { runPlayground } = await import('../agent/playground')
    return runPlayground({ systemPrompt: input.content, userPrompt: input.userPrompt })
  })

  ipcMain.handle('skills:rollback', async (_event, name: string, version: number) => withSkillMutation(async () => {
    const success = await rollbackSkill(name, version)
    if (success) await reloadSkills(toolRegistry)
    return { success }
  }))
}
