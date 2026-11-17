import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SkillDefinition, ToolContext } from '../../src/shared/types'

const fixture = vi.hoisted(() => ({ directory: '', skills: [] as SkillDefinition[], handlers: new Map<string, (...args: any[]) => Promise<any>>() }))
vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory },
  safeStorage: { isEncryptionAvailable: () => false },
  ipcMain: { handle: (name: string, handler: (...args: any[]) => Promise<any>) => fixture.handlers.set(name, handler) },
}))
vi.mock('../../electron/main/skills/loader', async (original) => ({
  ...await original<typeof import('../../electron/main/skills/loader')>(),
  loadAllSkills: async () => fixture.skills.map((skill) => ({ ...skill })),
}))

import * as database from '../../electron/main/storage/database'
import { loadDisabledSkills, saveDisabledSkills } from '../../electron/main/storage/skill-state-store'
import { buildSkillSummaryForPrompt, clearActiveSkill, getActiveSkill, initSkillSystem, isSkillEnabled, setSkillEnabled } from '../../electron/main/skills/registry'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { registerSkillsIPC } from '../../electron/main/ipc/skills'

let tools: ToolRegistry
beforeEach(async () => {
  fixture.directory = mkdtempSync(join(tmpdir(), 'my-agent-skill-state-'))
  fixture.skills = [{ meta: { name: 'test-helper', description: '测试工作方法', author: 'Test' }, body: '读取并总结', source: 'builtin', filePath: join(fixture.directory, 'SKILL.md') }, { meta: { name: 'manual-only', description: '仅手动', disable_model_invocation: true }, body: '手动执行', source: 'user', filePath: '' }]
  tools = new ToolRegistry()
  await initSkillSystem(tools)
  registerSkillsIPC(tools)
})
afterEach(() => {
  vi.restoreAllMocks()
  database._resetDatabaseForTests()
  rmSync(fixture.directory, { recursive: true, force: true })
})

describe('Skill 启停真实持久化与 IPC', () => {
  it('禁用移除工具、Prompt 与活跃状态，并拒绝缓存工具调用', async () => {
    const previous = tools.get('skill_invoke_test_helper')!
    const context: ToolContext = { workdir: fixture.directory, sessionId: 'session-a', skillState: {} }
    await previous.execute({}, context)
    expect(getActiveSkill(context.skillState)?.meta.name).toBe('test-helper')
    await setSkillEnabled(tools, 'test-helper', false)
    expect(tools.has(previous.name)).toBe(false)
    expect(getActiveSkill(context.skillState)).toBeNull()
    expect(buildSkillSummaryForPrompt()).not.toContain('test-helper')
    await expect(previous.execute({})).rejects.toThrow('已停用')
    expect(await loadDisabledSkills()).toEqual(new Set(['test-helper']))
    database.closeDatabase()
    await initSkillSystem(tools)
    expect(isSkillEnabled('test-helper')).toBe(false)
    expect(tools.has(previous.name)).toBe(false)
    await setSkillEnabled(tools, 'test-helper', true)
    await setSkillEnabled(tools, 'test-helper', true)
    expect(tools.has(previous.name)).toBe(true)
    expect(buildSkillSummaryForPrompt()).toContain('test-helper')
    await expect(previous.execute({})).rejects.toThrow('已停用、更新或移除')
  })

  it('并行会话独立激活和清理，重载使旧定义失效', async () => {
    fixture.skills.push({ ...fixture.skills[0], meta: { name: 'second-helper', description: '另一套方法' } })
    await initSkillSystem(tools)
    const first: ToolContext = { workdir: fixture.directory, sessionId: 'first', skillState: {} }
    const second: ToolContext = { workdir: fixture.directory, sessionId: 'second', skillState: {} }
    await Promise.all([
      tools.get('skill_invoke_test_helper')!.execute({}, first),
      tools.get('skill_invoke_second_helper')!.execute({}, second),
    ])
    expect(getActiveSkill(first.skillState)?.meta.name).toBe('test-helper')
    expect(getActiveSkill(second.skillState)?.meta.name).toBe('second-helper')
    clearActiveSkill(first.skillState)
    expect(getActiveSkill(first.skillState)).toBeNull()
    expect(getActiveSkill(second.skillState)?.meta.name).toBe('second-helper')
    await initSkillSystem(tools)
    expect(getActiveSkill(second.skillState)).toBeNull()
    await expect(tools.get('skill_invoke_test_helper')!.execute({})).rejects.toThrow('会话')
  })

  it('Registry 复制工具上下文时仍将激活结果留在本次执行容器', async () => {
    const context: ToolContext = { workdir: fixture.directory, sessionId: 'registry' }
    const results = await tools.executeAll([{ id: 'activate', name: 'skill_invoke_test_helper', arguments: '{}' }], context)
    expect(results[0].isError).not.toBe(true)
    expect(getActiveSkill(context.skillState)?.meta.name).toBe('test-helper')
  })

  it('磁盘写入失败不改变内存、数据库或工具状态，可重试', async () => {
    vi.spyOn(database, 'persist').mockImplementationOnce(() => { throw new Error('disk failed') })
    await expect(setSkillEnabled(tools, 'test-helper', false)).rejects.toThrow('disk failed')
    expect(isSkillEnabled('test-helper')).toBe(true)
    expect(tools.has('skill_invoke_test_helper')).toBe(true)
    expect(await loadDisabledSkills()).toEqual(new Set())
    await setSkillEnabled(tools, 'test-helper', false)
    expect(isSkillEnabled('test-helper')).toBe(false)
  })

  it('并发启停按调用顺序保存，手动调用标记与启停独立', async () => {
    await Promise.all([setSkillEnabled(tools, 'test-helper', false), setSkillEnabled(tools, 'manual-only', false), setSkillEnabled(tools, 'test-helper', true)])
    expect(await loadDisabledSkills()).toEqual(new Set(['manual-only']))
    await setSkillEnabled(tools, 'manual-only', true)
    expect(tools.has('skill_invoke_manual_only')).toBe(false)
    expect(buildSkillSummaryForPrompt()).toContain('(仅手动调用)')
  })

  it('坏状态不被解释为全部启用，加载失败保留原运行态', async () => {
    await saveDisabledSkills(new Set(['test-helper']))
    const db = await database.getDatabase()
    db.run('UPDATE settings SET value = ? WHERE key = ?', ['{"bad":true}', 'skillDisabledNames'])
    await expect(initSkillSystem(tools)).rejects.toThrow('状态无效')
    expect(tools.has('skill_invoke_test_helper')).toBe(true)
  })

  it('IPC 拒绝伪造名称和布尔值；内置正文真实可读且不可改删', async () => {
    const call = (name: string, ...args: unknown[]) => fixture.handlers.get(name)!(null, ...args)
    expect(await call('skills:set-enabled', 'test-helper', 'false')).toMatchObject({ success: false })
    expect(await call('skills:set-enabled', '../outside', false)).toMatchObject({ success: false })
    expect(await call('skills:set-enabled', 'test-helper', false)).toEqual({ success: true, enabled: false })
    expect((await call('skills:list'))[0]).toMatchObject({ name: 'test-helper', author: 'Test', enabled: false })
    expect((await call('skills:list'))[0]).not.toHaveProperty('filePath')
    writeFileSync(fixture.skills[0].filePath, '---\nname: test-helper\n---\n真实内置正文')
    expect(await call('skills:get', 'test-helper')).toContain('真实内置正文')
    expect(await call('skills:get', '../outside')).toBeNull()
    expect(await call('skills:delete', 'test-helper')).toEqual({ success: false })
    expect(await call('skills:save', 'test-helper', 'replacement')).toMatchObject({ success: false })
  })

  it('工具名称冲突在写盘和替换前拒绝，不发布半套状态', async () => {
    fixture.skills.push({ ...fixture.skills[0], meta: { ...fixture.skills[0].meta, name: 'test_helper' } })
    await expect(initSkillSystem(tools)).rejects.toThrow('名称冲突')
    expect(tools.has('skill_invoke_test_helper')).toBe(true)
    fixture.skills.pop()
    await setSkillEnabled(tools, 'test-helper', false)
    tools.register({ name: 'skill_invoke_test_helper', description: '冲突工具', parameters: {}, execute: async () => 'other' })
    await expect(setSkillEnabled(tools, 'test-helper', true)).rejects.toThrow('名称冲突')
    expect(await loadDisabledSkills()).toEqual(new Set(['test-helper']))
    expect(isSkillEnabled('test-helper')).toBe(false)
  })
})
