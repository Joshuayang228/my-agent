import { app } from 'electron'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type CharacterDraftStatus = 'draft' | 'review'
export type CharacterDraftSection = 'identity' | 'world' | 'relationships' | 'appearance' | 'behaviors' | 'materials'

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
const SECTIONS = new Set<CharacterDraftSection>(['identity', 'world', 'relationships', 'appearance', 'behaviors', 'materials'])

function draftsRoot(): string {
  try { return join(app.getPath('userData'), 'character-drafts') } catch { return join(process.cwd(), '.agent-data', 'character-drafts') }
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
