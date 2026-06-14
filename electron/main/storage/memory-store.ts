import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'

const log = createLogger('MemoryStore')

export type MemoryCategory = 'identity' | 'preference' | 'fact' | 'workflow' | 'voice'

export interface MemoryEntry {
  id: string
  category: MemoryCategory
  content: string
  createdAt: number
  updatedAt: number
}

async function ensureTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id        TEXT PRIMARY KEY,
      category  TEXT NOT NULL,
      content   TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    )
  `)
}

export async function addMemory(category: MemoryCategory, content: string): Promise<MemoryEntry> {
  await ensureTable()
  const db = await getDatabase()
  const now = Date.now()
  const id = `mem-${now}-${Math.random().toString(36).slice(2, 8)}`

  db.run(
    'INSERT INTO memories (id, category, content, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [id, category, content, now, now],
  )
  persist()
  log.info('Memory added', { id, category })
  return { id, category, content, createdAt: now, updatedAt: now }
}

export async function listMemories(category?: MemoryCategory): Promise<MemoryEntry[]> {
  await ensureTable()
  const db = await getDatabase()

  const sql = category
    ? 'SELECT * FROM memories WHERE category = ? ORDER BY updatedAt DESC'
    : 'SELECT * FROM memories ORDER BY updatedAt DESC'

  const stmt = category ? db.prepare(sql) : db.prepare(sql)
  if (category) stmt.bind([category])

  const results: MemoryEntry[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>
    results.push({
      id: row.id as string,
      category: row.category as MemoryEntry['category'],
      content: row.content as string,
      createdAt: row.createdAt as number,
      updatedAt: row.updatedAt as number,
    })
  }
  stmt.free()
  return results
}

export async function deleteMemory(id: string): Promise<void> {
  await ensureTable()
  const db = await getDatabase()
  db.run('DELETE FROM memories WHERE id = ?', [id])
  persist()
  log.info('Memory deleted', { id })
}

export async function updateMemory(id: string, content: string): Promise<void> {
  await ensureTable()
  const db = await getDatabase()
  db.run('UPDATE memories SET content = ?, updatedAt = ? WHERE id = ?', [content, Date.now(), id])
  persist()
  log.info('Memory updated', { id })
}

/**
 * 构建记忆注入文本，供 Agent Loop 注入 System Prompt。
 */
export async function buildMemoryContext(): Promise<string> {
  const memories = await listMemories()
  if (memories.length === 0) return ''

  const sections: Record<string, string[]> = {
    identity: [],
    preference: [],
    fact: [],
    workflow: [],
    voice: [],
  }

  for (const m of memories) {
    sections[m.category]?.push(`- ${m.content}`)
  }

  const parts: string[] = []

  if (sections.identity.length > 0) {
    parts.push('### About the user\n' + sections.identity.join('\n'))
  }
  if (sections.workflow.length > 0) {
    parts.push('### How they work\n' + sections.workflow.join('\n'))
  }
  if (sections.voice.length > 0) {
    parts.push('### Communication style\n' + sections.voice.join('\n'))
  }
  if (sections.preference.length > 0) {
    parts.push('### Preferences\n' + sections.preference.join('\n'))
  }
  if (sections.fact.length > 0) {
    parts.push('### Known facts\n' + sections.fact.join('\n'))
  }

  return parts.join('\n\n')
}

/**
 * 构建三维用户画像，供 prompt-builder L3 层使用。
 */
export async function buildUserProfile(): Promise<{
  identity: string
  workflow: string
  voice: string
} | null> {
  const memories = await listMemories()
  if (memories.length === 0) return null

  const byCategory: Record<string, string[]> = {}
  for (const m of memories) {
    if (!byCategory[m.category]) byCategory[m.category] = []
    byCategory[m.category].push(`- ${m.content}`)
  }

  const identity = [...(byCategory.identity ?? []), ...(byCategory.fact ?? [])].join('\n')
  const workflow = (byCategory.workflow ?? []).join('\n')
  const voice = [...(byCategory.voice ?? []), ...(byCategory.preference ?? [])].join('\n')

  if (!identity && !workflow && !voice) return null
  return { identity, workflow, voice }
}
