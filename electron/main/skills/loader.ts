import { app } from 'electron'
import { readdir, readFile, stat, mkdir, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml'
import { createLogger } from '../utils/logger'
import type { SkillDefinition, SkillFrontmatter, SkillValidationIssue, SkillValidationResult, SkillVersionInfo } from '../../../src/shared/types'

const log = createLogger('SkillLoader')

/** 每个 Skill 最多保留的历史版本数（对齐 Alice Ch.10 的「保留最近 10 版」） */
const MAX_SKILL_VERSIONS = 10
export const MAX_SKILL_CONTENT_LENGTH = 1_000_000
const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export function validateSkillName(name: string): SkillValidationIssue[] {
  const value = name.trim()
  if (!value) {
    return [{ severity: 'error', code: 'name.required', field: 'name', message: 'Skill 名称不能为空。' }]
  }
  if (!SKILL_NAME_PATTERN.test(value)) {
    return [{ severity: 'error', code: 'name.invalid', field: 'name', message: 'Skill 名称只能使用字母、数字、点、下划线和短横线，长度不超过 64 个字符。' }]
  }
  return []
}

function safeSkillName(name: string): string | null {
  const value = name.trim()
  return validateSkillName(value).some((issue) => issue.severity === 'error') ? null : value
}

/**
 * 只解析标准 YAML Frontmatter，不允许 `---javascript` 等可执行引擎。
 *
 * 背景：gray-matter 会根据开头语言标签选择 JavaScript 引擎，并直接 `eval` 用户可控正文；
 * Skill 文件和编辑 IPC 都属于不可信输入，这会把资产解析升级成 Electron 主进程 RCE。
 * 设计意图：只实现本项目需要的 `---` + YAML + `---` 契约，并用 js-yaml 的 JSON_SCHEMA
 * 限制为普通 JSON-like 数据。关键约束：开头如果以 `---` 起始却不是独立分隔行，直接拒绝；
 * Frontmatter 必须解析成对象，不能是数组或标量。
 */
export function parseSkillFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  if (!content.startsWith('---')) return { data: {}, content }
  const opening = /^---[ \t]*\r?\n/.exec(content)
  if (!opening) throw new Error('只允许使用标准 YAML Frontmatter，不支持语言引擎标签')

  const rest = content.slice(opening[0].length)
  const closing = /^---[ \t]*\r?$/m.exec(rest)
  if (!closing) throw new Error('Frontmatter 缺少结束分隔符')

  const raw = rest.slice(0, closing.index)
  let body = rest.slice(closing.index + closing[0].length)
  if (body.startsWith('\r\n')) body = body.slice(2)
  else if (body.startsWith('\n')) body = body.slice(1)

  const parsed = loadYaml(raw, { schema: JSON_SCHEMA })
  if (parsed == null) return { data: {}, content: body }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter 必须是 YAML 对象')
  }
  return { data: parsed as Record<string, unknown>, content: body }
}

/**
 * 校验 Skill 文件，不写盘、不加载工具，只返回可展示的结构问题。
 *
 * 背景：Skill 是会影响工具调用的生产资产，解析成功不代表配置可用。
 * 设计意图：把结构校验集中在 loader，IPC 保存和隔离试跑共同复用，避免 UI 自己解析一套规则。
 * 关键约束：工具引用只在调用方提供工具名集合时检查；没有集合时不猜测、不阻断保存。
 */
export function validateSkillContent(content: string, availableToolNames: ReadonlySet<string> = new Set()): SkillValidationResult {
  const issues: SkillValidationIssue[] = []
  if (typeof content !== 'string' || content.length > MAX_SKILL_CONTENT_LENGTH) {
    return { valid: false, issues: [{ severity: 'error', code: 'content.too_large', message: 'Skill 正文过长，不能超过 1MB。' }] }
  }
  if (!content.trim()) {
    return { valid: false, issues: [{ severity: 'error', code: 'content.required', message: 'Skill 正文不能为空。' }] }
  }

  let data: Record<string, unknown>
  let body = ''
  try {
    const parsed = parseSkillFrontmatter(content)
    data = parsed.data as Record<string, unknown>
    body = parsed.content
  } catch (error) {
    return {
      valid: false,
      issues: [{ severity: 'error', code: 'frontmatter.invalid', message: `Frontmatter 解析失败：${error instanceof Error ? error.message : String(error)}` }],
    }
  }

  const name = typeof data.name === 'string' ? data.name.trim() : ''
  issues.push(...validateSkillName(name))
  const description = typeof data.description === 'string' ? data.description.trim() : ''
  if (!description) issues.push({ severity: 'error', code: 'description.required', field: 'description', message: '请填写 Skill 描述。' })

  if (data.when_to_use !== undefined && typeof data.when_to_use !== 'string') {
    issues.push({ severity: 'error', code: 'when_to_use.invalid', field: 'when_to_use', message: '触发条件必须是文本。' })
  } else if (!String(data.when_to_use ?? '').trim()) {
    issues.push({ severity: 'warning', code: 'when_to_use.missing', field: 'when_to_use', message: '未填写触发条件，模型可能无法稳定判断何时激活。' })
  }

  const allowedTools = data.allowed_tools
  if (allowedTools !== undefined && (!Array.isArray(allowedTools) || allowedTools.some((item) => typeof item !== 'string' || !item.trim()))) {
    issues.push({ severity: 'error', code: 'allowed_tools.invalid', field: 'allowed_tools', message: 'allowed_tools 必须是非空字符串数组。' })
  } else if (Array.isArray(allowedTools) && availableToolNames.size > 0) {
    for (const toolName of allowedTools.filter((item): item is string => typeof item === 'string')) {
      if (!availableToolNames.has(toolName)) {
        issues.push({ severity: 'error', code: 'allowed_tools.unknown', field: 'allowed_tools', message: `引用了不存在的工具：${toolName}` })
      }
    }
  }

  if (data.disable_model_invocation !== undefined && typeof data.disable_model_invocation !== 'boolean') {
    issues.push({ severity: 'error', code: 'disable_model_invocation.invalid', field: 'disable_model_invocation', message: 'disable_model_invocation 必须是 true 或 false。' })
  }
  if (data.version !== undefined && (typeof data.version !== 'string' || !data.version.trim())) {
    issues.push({ severity: 'error', code: 'version.invalid', field: 'version', message: 'version 必须是非空文本。' })
  }
  if (!body.trim()) issues.push({ severity: 'error', code: 'body.required', message: 'Skill 正文部分不能为空。' })

  const meta: SkillFrontmatter = {
    name,
    description,
    ...(typeof data.when_to_use === 'string' && data.when_to_use.trim() ? { when_to_use: data.when_to_use } : {}),
    ...(Array.isArray(allowedTools) && allowedTools.every((item): item is string => typeof item === 'string') ? { allowed_tools: allowedTools } : {}),
    ...(typeof data.disable_model_invocation === 'boolean' ? { disable_model_invocation: data.disable_model_invocation } : {}),
    ...(typeof data.version === 'string' && data.version.trim() ? { version: data.version } : {}),
  }
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues, name: name || undefined, meta }
}

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
    const { data, content: body } = parseSkillFrontmatter(content)
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
  const nameIssues = validateSkillName(name)
  if (nameIssues.some((issue) => issue.severity === 'error')) {
    throw new Error(nameIssues.map((issue) => issue.message).join('；'))
  }
  const dir = join(getSkillsDir(), name.trim())
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

/** 列出某个 Skill 的历史版本序号（保留旧调用方契约，新→旧）。 */
export async function listSkillVersions(name: string): Promise<number[]> {
  const infos = await listSkillVersionInfo(name)
  return infos.map((item) => item.version)
}

/** 返回版本历史的时间元数据，当前文件由 UI 单独标记，历史快照均为 current=false。 */
export async function listSkillVersionInfo(name: string): Promise<SkillVersionInfo[]> {
  const safeName = safeSkillName(name)
  if (!safeName) return []
  const versionsDir = join(getSkillsDir(), safeName, '.versions')
  try {
    const files = (await readdir(versionsDir)).filter(f => /^v\d+\.md$/.test(f))
    const items = await Promise.all(files.map(async (file) => {
      const filePath = join(versionsDir, file)
      const fileStat = await stat(filePath)
      return { version: parseInt(file.slice(1, -3), 10), createdAt: fileStat.mtimeMs, current: false }
    }))
    return items.sort((a, b) => b.version - a.version)
  } catch {
    return []
  }
}

export async function getSkillVersionContent(name: string, version: number): Promise<string | null> {
  const safeName = safeSkillName(name)
  if (!safeName || !Number.isInteger(version) || version < 1) return null
  try {
    return await readFile(join(getSkillsDir(), safeName, '.versions', `v${version}.md`), 'utf-8')
  } catch {
    return null
  }
}

/**
 * G1 回滚：把指定历史版本恢复为当前 SKILL.md。
 * 恢复前会把「当前内容」也备份一版，所以回滚本身也可被回滚。
 */
export async function rollbackSkill(name: string, version: number): Promise<boolean> {
  const safeName = safeSkillName(name)
  if (!safeName || !Number.isInteger(version) || version < 1) return false
  const dir = join(getSkillsDir(), safeName)
  const versionFile = join(dir, '.versions', `v${version}.md`)
  try {
    const versionContent = await readFile(versionFile, 'utf-8')
    await saveSkill(safeName, versionContent)  // 复用 saveSkill → 当前内容自动备份
    log.info('Skill rolled back', { name: safeName, version })
    return true
  } catch (err) {
    log.warn('Skill rollback failed', { name, version, error: String(err) })
    return false
  }
}

export async function deleteSkill(name: string): Promise<void> {
  const safeName = safeSkillName(name)
  if (!safeName) throw new Error('Skill 名称不合法。')
  const dir = getSkillsDir()
  const dirPath = join(dir, safeName)
  const skillFile = join(dirPath, 'SKILL.md')

  try {
    await unlink(skillFile)
    const remaining = await readdir(dirPath)
    if (remaining.length === 0) {
      const { rmdir } = await import('fs/promises')
      await rmdir(dirPath)
    }
  } catch {
    const filePath = join(dir, `${safeName}.md`)
    await unlink(filePath)
  }
  log.info('Skill deleted', { name })
}

export async function getSkillContent(name: string): Promise<string | null> {
  const safeName = safeSkillName(name)
  if (!safeName) return null
  const dir = getSkillsDir()

  const dirFile = join(dir, safeName, 'SKILL.md')
  try { return await readFile(dirFile, 'utf-8') } catch { /* try flat file */ }

  const flatFile = join(dir, `${safeName}.md`)
  try { return await readFile(flatFile, 'utf-8') } catch { return null }
}
