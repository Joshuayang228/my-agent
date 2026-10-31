import { app } from 'electron'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type CharacterDraftStatus = 'draft' | 'review'
export type CharacterDraftSection =
  | 'identity'
  | 'world'
  | 'relationships'
  | 'appearance'
  | 'behaviors'
  | 'materials'
  | 'dramaturgy'
  | 'decisionRules'
  | 'continuity'
  | 'firstContact'
  | 'evidence'

export interface CharacterDraft {
  id: string
  universeId: string
  title: string
  roleId: string
  roleName: string
  status: CharacterDraftStatus
  sections: Partial<Record<CharacterDraftSection, string>>
  createdAt: number
  updatedAt: number
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/i
const MAX_TEXT = 50_000
const SECTIONS = new Set<CharacterDraftSection>([
  'identity', 'world', 'relationships', 'appearance', 'behaviors', 'materials',
  'dramaturgy', 'decisionRules', 'continuity', 'firstContact', 'evidence',
])

function draftsRoot(): string {
  try { return join(app.getPath('userData'), 'character-drafts') } catch { return join(process.cwd(), '.agent-data', 'character-drafts') }
}

function universesRoot(): string {
  try { return join(app.getPath('userData'), 'universes') } catch { return join(process.cwd(), '.agent-data', 'universes') }
}

function assertId(value: string, label: string): string {
  const normalized = value.trim()
  if (!ID_PATTERN.test(normalized)) throw new Error(`${label} 格式无效。`)
  return normalized
}

function assertText(value: string, label: string, max = MAX_TEXT): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > max) throw new Error(`${label}不能为空且不能超过 ${max} 字。`)
  return normalized
}

function draftPath(id: string): string { return join(draftsRoot(), `${id}.json`) }

async function writeDraft(draft: CharacterDraft): Promise<void> {
  const root = draftsRoot()
  await mkdir(root, { recursive: true })
  const temporary = `${draftPath(draft.id)}.tmp-${process.pid}-${Date.now()}`
  await writeFile(temporary, JSON.stringify(draft, null, 2), 'utf8')
  await rename(temporary, draftPath(draft.id))
}

export async function readCharacterDraft(id: string): Promise<CharacterDraft | null> {
  const normalized = assertId(id, '草稿标识')
  try {
    const value = JSON.parse(await readFile(draftPath(normalized), 'utf8')) as CharacterDraft
    if (value.id !== normalized || !value.sections || typeof value.sections !== 'object') return null
    return value
  } catch { return null }
}

export async function listCharacterDrafts(): Promise<CharacterDraft[]> {
  try {
    const entries = await readdir(draftsRoot(), { withFileTypes: true })
    const drafts = await Promise.all(entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).map(entry => readCharacterDraft(entry.name.slice(0, -5))))
    return drafts.filter((draft): draft is CharacterDraft => Boolean(draft)).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch { return [] }
}

/**
 * 将已提交审阅的最小人物草稿发布为用户世界观。
 *
 * 背景：用户生成的人物必须进入与内置 Universe 相同的 loader 形状，才能复用 Prompt、名册和 Debug 目录。
 * 设计意图：发布时生成带世界观前缀的内部 role id，规避当前运行库按 role_id 分桶造成的跨世界碰撞；模型不能直接调用此函数。
 * 关键约束：只接受 review 草稿，拒绝覆盖既有世界；只写 manifest / relations / 必需 Role Pack，缺失的详细档案保持未设定而不是编造。
 */
export async function publishCharacterDraft(id: string): Promise<{ universeId: string; roleId: string; title: string }> {
  const draft = await readCharacterDraft(id)
  if (!draft) throw new Error('找不到人物草稿。')
  if (draft.status !== 'review') throw new Error('人物草稿必须先提交审阅。')
  const universeId = assertId(draft.universeId, '世界观标识')
  const roleId = assertId(`${universeId}-${draft.roleId}`.slice(0, 64), '发布人物标识')
  const root = join(universesRoot(), universeId)
  if (await readFile(join(root, 'manifest.json'), 'utf8').then(() => true).catch(() => false)) throw new Error('世界观已存在，不能覆盖。')
  const temporaryRoot = join(universesRoot(), `.tmp-${universeId}-${process.pid}-${Date.now()}`)
  const roleRoot = join(temporaryRoot, 'roles', roleId)
  await mkdir(roleRoot, { recursive: true })
  const identity = draft.sections.identity || `${draft.roleName} 的稳定身份和表达仍待补充。`
  const world = draft.sections.world || '人物世界尚未设定，不能补造居所、经历或当前位置。'
  const firstContact = draft.sections.firstContact || '首次冷启尚未设定；发布后不会自动补造名言或经历。'
  const continuity = draft.sections.continuity || '既有经历、当前状态和用户共同经历尚未分开设定。'
  try {
    await mkdir(join(roleRoot, 'scenes'), { recursive: true })
    await writeFile(join(temporaryRoot, 'manifest.json'), JSON.stringify({ id: universeId, title: draft.title, version: 1, protagonistIds: [roleId], castIds: [], plannedProtagonistSlots: 1, defaultProtagonistId: roleId, ownership: 'user' }, null, 2), 'utf8')
    await writeFile(join(temporaryRoot, 'relations.json'), JSON.stringify({ edges: [] }, null, 2), 'utf8')
    await writeFile(join(roleRoot, 'manifest.json'), JSON.stringify({ id: roleId, name: draft.roleName, description: identity.slice(0, 240), canBeProtagonist: true, asideStyle: '沿用已确认的人物表达，缺少资料时明确说明。', ownership: 'user', sourceDraftId: draft.id }, null, 2), 'utf8')
    await writeFile(join(roleRoot, 'protected.md'), `你是${draft.roleName}。\n\n${identity}\n\n世界观资料：\n${world}`, 'utf8')
    await writeFile(join(roleRoot, 'mutable.default.md'), '当前可变行为状态尚未设定，只根据用户确认逐步形成。', 'utf8')
    await writeFile(join(roleRoot, 'summary.txt'), identity.slice(0, 1000), 'utf8')
    await writeFile(join(roleRoot, 'scenes', 'first-contact.md'), firstContact, 'utf8')
    await mkdir(join(roleRoot, 'timeline'), { recursive: true })
    await writeFile(join(roleRoot, 'timeline', 'continuity.md'), continuity, 'utf8')
    await rename(temporaryRoot, root)
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
  return { universeId, roleId, title: draft.title }
}

/**
 * 保存人物体系草稿，不直接写入生产 Role Pack。
 *
 * 背景：用户共创需要跨轮积累材料，但模型不能获得任意生产文件写入权。
 * 设计意图：把草稿落在独立 userData 目录，采用临时文件替换，允许后续人工审阅和发布流程复用。
 * 关键约束：只接受有限分区和有界文本；状态只能从 draft 推进到 review，不能由模型直接发布或切换世界观。
 */
export async function saveCharacterDraft(input: {
  action: 'create' | 'update' | 'submit_for_review'
  draftId?: string
  universeId?: string
  title?: string
  roleId?: string
  roleName?: string
  section?: CharacterDraftSection
  content?: string
}): Promise<CharacterDraft> {
  const now = Date.now()
  const existing = input.draftId ? await readCharacterDraft(input.draftId) : null
  if (input.action !== 'create' && !existing) throw new Error('找不到人物草稿。')
  const draft: CharacterDraft = existing ?? {
    id: assertId(`${input.universeId ?? 'character'}-${Date.now().toString(36)}`, '草稿标识'),
    universeId: assertId(input.universeId ?? '', '世界观标识'),
    title: assertText(input.title ?? '', '草稿标题', 120),
    roleId: assertId(input.roleId ?? '', '人物标识'),
    roleName: assertText(input.roleName ?? '', '人物名称', 120),
    status: 'draft',
    sections: {},
    createdAt: now,
    updatedAt: now,
  }
  if (input.action !== 'create') {
    if (input.universeId) draft.universeId = assertId(input.universeId, '世界观标识')
    if (input.title) draft.title = assertText(input.title, '草稿标题', 120)
    if (input.roleId) draft.roleId = assertId(input.roleId, '人物标识')
    if (input.roleName) draft.roleName = assertText(input.roleName, '人物名称', 120)
  }
  if (input.section) {
    if (!SECTIONS.has(input.section)) throw new Error('人物草稿分区无效。')
    draft.sections[input.section] = assertText(input.content ?? '', '分区内容')
  }
  if (input.action === 'submit_for_review') draft.status = 'review'
  draft.updatedAt = now
  await writeDraft(draft)
  return draft
}
