import { getDatabase, persist } from './database'
import { createLogger } from '../utils/logger'
import { addToVectorStore, removeFromVectorStore } from '../memory/vector-store'
import * as settings from './settings-store'
import type { MemoryCategory, MemoryEntry } from '../../../src/shared/types'

const log = createLogger('MemoryStore')

// MemoryCategory / MemoryEntry 统一由 src/shared/types.ts 定义，此处 re-export 供本层调用方使用
export type { MemoryCategory, MemoryEntry }

async function getLLMConfigForSync() {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
  }
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

  getLLMConfigForSync().then(config => {
    if (!config.apiKey) return
    addToVectorStore({ id, text: content, category, sessionId: '', timestamp: now }, config)
      .catch(() => {})
  })

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

  removeFromVectorStore(id).catch(() => {})
}

export async function updateMemory(id: string, content: string): Promise<void> {
  await ensureTable()
  const db = await getDatabase()
  const now = Date.now()
  db.run('UPDATE memories SET content = ?, updatedAt = ? WHERE id = ?', [content, now, id])
  persist()
  log.info('Memory updated', { id })

  removeFromVectorStore(id).catch(() => {})
  getLLMConfigForSync().then(config => {
    if (!config.apiKey) return
    addToVectorStore({ id, text: content, category: 'fact', sessionId: '', timestamp: now }, config)
      .catch(() => {})
  })
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
  // feedback（用户对协作方式的纠正与确认）归入 workflow —— 本质是"该怎么跟用户配合"的知识
  const workflow = [...(byCategory.workflow ?? []), ...(byCategory.feedback ?? [])].join('\n')
  const voice = [...(byCategory.voice ?? []), ...(byCategory.preference ?? [])].join('\n')

  if (!identity && !workflow && !voice) return null
  return { identity, workflow, voice }
}
