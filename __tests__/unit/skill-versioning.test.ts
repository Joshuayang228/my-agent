/**
 * Skill 版本备份/回滚测试（M10 G1）
 *
 * 覆盖：
 * - 首次保存不产生备份
 * - 覆盖保存时旧内容备份到 .versions/
 * - 内容相同不重复备份
 * - 版本数超上限时删最旧
 * - listSkillVersions 按新→旧返回
 * - rollbackSkill 恢复历史版本，且当前内容也被备份
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// mock electron app.getPath → 指向临时目录
let tmpUserData: string

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpUserData,
  },
}))

// 被测模块在 mock 之后 import
import { saveSkill, listSkillVersions, rollbackSkill } from '../../electron/main/skills/loader'

const SKILL = 'test-skill'

function skillDir() {
  return join(tmpUserData, 'skills', SKILL)
}
function versionsDir() {
  return join(skillDir(), '.versions')
}
function currentContent() {
  return readFileSync(join(skillDir(), 'SKILL.md'), 'utf-8')
}

beforeEach(() => {
  tmpUserData = mkdtempSync(join(tmpdir(), 'skill-ver-'))
})

afterEach(() => {
  rmSync(tmpUserData, { recursive: true, force: true })
})

describe('Skill 版本备份 (G1)', () => {
  it('首次保存不产生备份', async () => {
    await saveSkill(SKILL, 'v1 content')
    expect(currentContent()).toBe('v1 content')
    // .versions 目录不该有版本文件
    const versions = await listSkillVersions(SKILL)
    expect(versions).toEqual([])
  })

  it('覆盖保存时旧内容备份到 .versions/', async () => {
    await saveSkill(SKILL, 'v1 content')
    await saveSkill(SKILL, 'v2 content')

    expect(currentContent()).toBe('v2 content')
    // 旧的 v1 被备份
    expect(existsSync(join(versionsDir(), 'v1.md'))).toBe(true)
    expect(readFileSync(join(versionsDir(), 'v1.md'), 'utf-8')).toBe('v1 content')
  })

  it('内容相同不重复备份', async () => {
    await saveSkill(SKILL, 'same')
    await saveSkill(SKILL, 'same')
    const versions = await listSkillVersions(SKILL)
    expect(versions).toEqual([])
  })

  it('版本数超上限（10）时删最旧', async () => {
    // 保存 12 次不同内容 → 触发 11 次备份，但只保留最近 10
    for (let i = 1; i <= 12; i++) {
      await saveSkill(SKILL, `content-${i}`)
    }
    const versions = await listSkillVersions(SKILL)
    expect(versions.length).toBe(10)
    // 最旧的 v1 应已被删（备份的是 content-1..content-11，共 11 个，删 1 个 → 剩 v2..v11）
    expect(existsSync(join(versionsDir(), 'v1.md'))).toBe(false)
  })

  it('listSkillVersions 按新→旧返回', async () => {
    await saveSkill(SKILL, 'a')
    await saveSkill(SKILL, 'b')
    await saveSkill(SKILL, 'c')
    // 备份了 a(v1)、b(v2)
    const versions = await listSkillVersions(SKILL)
    expect(versions).toEqual([2, 1])
  })
})

describe('Skill 回滚 (G1)', () => {
  it('rollbackSkill 恢复历史版本内容', async () => {
    await saveSkill(SKILL, 'original')
    await saveSkill(SKILL, 'modified')  // original 备份为 v1

    const ok = await rollbackSkill(SKILL, 1)
    expect(ok).toBe(true)
    expect(currentContent()).toBe('original')
  })

  it('回滚时当前内容也被备份（回滚可再回滚）', async () => {
    await saveSkill(SKILL, 'original')  // 首次，无备份
    await saveSkill(SKILL, 'modified')  // original → v1

    await rollbackSkill(SKILL, 1)  // modified → v2，当前变 original

    // 现在应能回滚到 v2（即 modified）
    const versions = await listSkillVersions(SKILL)
    expect(versions).toContain(2)
    expect(readFileSync(join(versionsDir(), 'v2.md'), 'utf-8')).toBe('modified')
  })

  it('回滚不存在的版本返回 false', async () => {
    await saveSkill(SKILL, 'only')
    const ok = await rollbackSkill(SKILL, 99)
    expect(ok).toBe(false)
  })
})
