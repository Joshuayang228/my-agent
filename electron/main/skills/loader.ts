import { app } from 'electron'
import { readdir, readFile, stat, mkdir, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import matter from 'gray-matter'
import { createLogger } from '../utils/logger'
import type { SkillDefinition, SkillFrontmatter } from '../../../src/shared/types'

const log = createLogger('SkillLoader')

/** 每个 Skill 最多保留的历史版本数（对齐 Alice Ch.10 的「保留最近 10 版」） */
const MAX_SKILL_VERSIONS = 10

function getSkillsDir(): string {
  return join(app.getPath('userData'), 'skills')
}

function getBuiltinSkillsDir(): string {
  return join(__dirname, '..', '..', 'skills-builtin')
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true })
  } catch { /* already exists */ }
}

function parseSkillFile(content: string, filePath: string, source: 'builtin' | 'user'): SkillDefinition | null {
  try {
    const { data, content: body } = matter(content)
    const meta = data as Partial<SkillFrontmatter>

    if (!meta.name || !meta.description) {
      log.warn('Skill missing name or description', { filePath })
      return null
    }

    return {
      meta: {
        name: meta.name,
        description: meta.description,
        when_to_use: meta.when_to_use,
        allowed_tools: meta.allowed_tools,
        disable_model_invocation: meta.disable_model_invocation ?? false,
        version: meta.version,
      },
      body: body.trim(),
      filePath,
      source,
    }
  } catch (err) {
    log.error('Failed to parse skill', { filePath, error: String(err) })
    return null
  }
}

async function scanDirectory(dir: string, source: 'builtin' | 'user'): Promise<SkillDefinition[]> {
  const skills: SkillDefinition[] = []

  try {
    const entries = await readdir(dir)
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const s = await stat(fullPath)

      if (s.isDirectory()) {
        const skillFile = join(fullPath, 'SKILL.md')
        try {
          const content = await readFile(skillFile, 'utf-8')
          const skill = parseSkillFile(content, skillFile, source)
          if (skill) skills.push(skill)
        } catch { /* no SKILL.md in this dir */ }
      } else if (entry.endsWith('.md') && entry !== 'README.md') {
        const content = await readFile(fullPath, 'utf-8')
        const skill = parseSkillFile(content, fullPath, source)
        if (skill) skills.push(skill)
      }
    }
  } catch { /* directory doesn't exist */ }

  return skills
}

export async function loadAllSkills(): Promise<SkillDefinition[]> {
  const userDir = getSkillsDir()
  await ensureDir(userDir)

  const builtinDir = getBuiltinSkillsDir()

  const [builtinSkills, userSkills] = await Promise.all([
    scanDirectory(builtinDir, 'builtin'),
    scanDirectory(userDir, 'user'),
  ])

  const skillMap = new Map<string, SkillDefinition>()
  for (const s of builtinSkills) skillMap.set(s.meta.name, s)
  for (const s of userSkills) skillMap.set(s.meta.name, s)

  const all = Array.from(skillMap.values())
  log.info('Skills loaded', { builtin: builtinSkills.length, user: userSkills.length, total: all.length })
  return all
}

/**
 * G1 版本备份：覆盖 SKILL.md 前，把旧内容存进 .versions/ 目录。
 * 文件名用递增序号（v{N}.md），保留最近 MAX_SKILL_VERSIONS 个，超出删最旧。
 * 这是自进化（G2 自动改进）的安全前提——改坏了能回滚。
 */
async function backupSkillVersion(skillDir: string, oldContent: string): Promise<void> {
  const versionsDir = join(skillDir, '.versions')
  await ensureDir(versionsDir)

  // 现有版本文件（v{N}.md），按序号排序
  let existing: string[] = []
  try {
    existing = (await readdir(versionsDir)).filter(f => /^v\d+\.md$/.test(f))
  } catch { /* no versions yet */ }

  const seqOf = (f: string) => parseInt(f.slice(1, -3), 10)
  existing.sort((a, b) => seqOf(a) - seqOf(b))

  // 新版本号 = 当前最大序号 + 1（不复用已删号，保证时间顺序单调）
  const nextSeq = existing.length > 0 ? seqOf(existing[existing.length - 1]) + 1 : 1
  await writeFile(join(versionsDir, `v${nextSeq}.md`), oldContent, 'utf-8')

  // 超出上限：删最旧的（含刚写入的一共 existing.length + 1 个）
  const afterWrite = [...existing, `v${nextSeq}.md`]
  const overflow = afterWrite.length - MAX_SKILL_VERSIONS
  for (let i = 0; i < overflow; i++) {
    await unlink(join(versionsDir, afterWrite[i])).catch(() => { /* already gone */ })
  }

  log.info('Skill version backed up', { skillDir, version: nextSeq, kept: Math.min(afterWrite.length, MAX_SKILL_VERSIONS) })
}

export async function saveSkill(name: string, content: string): Promise<string> {
  const dir = join(getSkillsDir(), name)
  await ensureDir(dir)
  const filePath = join(dir, 'SKILL.md')

  // G1：若已存在旧版本，先备份再覆盖（改坏可回滚）
  try {
    const oldContent = await readFile(filePath, 'utf-8')
    if (oldContent !== content) {
      await backupSkillVersion(dir, oldContent)
    }
  } catch { /* 首次创建，无旧版本可备份 */ }

  await writeFile(filePath, content, 'utf-8')
  log.info('Skill saved', { name, filePath })
  return filePath
}

/** 列出某个 Skill 的历史版本序号（新→旧） */
export async function listSkillVersions(name: string): Promise<number[]> {
  const versionsDir = join(getSkillsDir(), name, '.versions')
  try {
    const files = (await readdir(versionsDir)).filter(f => /^v\d+\.md$/.test(f))
    return files.map(f => parseInt(f.slice(1, -3), 10)).sort((a, b) => b - a)
  } catch {
    return []
  }
}

/**
 * G1 回滚：把指定历史版本恢复为当前 SKILL.md。
 * 恢复前会把「当前内容」也备份一版，所以回滚本身也可被回滚。
 */
export async function rollbackSkill(name: string, version: number): Promise<boolean> {
  const dir = join(getSkillsDir(), name)
  const versionFile = join(dir, '.versions', `v${version}.md`)
  try {
    const versionContent = await readFile(versionFile, 'utf-8')
    await saveSkill(name, versionContent)  // 复用 saveSkill → 当前内容自动备份
    log.info('Skill rolled back', { name, version })
    return true
  } catch (err) {
    log.warn('Skill rollback failed', { name, version, error: String(err) })
    return false
  }
}

export async function deleteSkill(name: string): Promise<void> {
  const dir = getSkillsDir()
  const dirPath = join(dir, name)
  const skillFile = join(dirPath, 'SKILL.md')

  try {
    await unlink(skillFile)
    const remaining = await readdir(dirPath)
    if (remaining.length === 0) {
      const { rmdir } = await import('fs/promises')
      await rmdir(dirPath)
    }
  } catch {
    const filePath = join(dir, `${name}.md`)
    await unlink(filePath)
  }
  log.info('Skill deleted', { name })
}

export async function getSkillContent(name: string): Promise<string | null> {
  const dir = getSkillsDir()

  const dirFile = join(dir, name, 'SKILL.md')
  try { return await readFile(dirFile, 'utf-8') } catch { /* try flat file */ }

  const flatFile = join(dir, `${name}.md`)
  try { return await readFile(flatFile, 'utf-8') } catch { return null }
}
