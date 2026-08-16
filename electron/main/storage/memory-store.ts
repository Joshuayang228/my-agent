import { getDatabase, persist } from './database'
import { randomUUID } from 'node:crypto'
import { createLogger } from '../utils/logger'
import { addToVectorStore, removeFromVectorStore } from '../memory/vector-store'
import type { MemoryCategory, MemoryEntry } from '../../../src/shared/types'
import { recordAssetUsage } from '../utils/asset-usage'
import { MEMORY_STRATEGY_ASSET_KEYS } from '../memory/asset-keys'
import { detectSensitiveKinds } from '../../../src/shared/sensitive-memory'

const log = createLogger('MemoryStore')

export const MEMORY_SEMANTIC_DEDUP_THRESHOLD = 0.85
export const FEEDBACK_MEMORY_LIMIT = 12
export const MAX_MEMORY_CONTENT_LENGTH = 20_000

/** 长期记忆存储层的最终安全边界：任何入口都不能落盘凭据原文。 */
export function assertMemoryContentAllowed(content: unknown): asserts content is string {
  if (typeof content !== 'string' || content.length < 2 || content.length > MAX_MEMORY_CONTENT_LENGTH) {
    throw new Error('记忆内容为空或超过长度限制')
  }
  if (detectSensitiveKinds(content).includes('credentials')) {
    throw new Error('密码、API Key、Token、私钥等凭据原文不会写入长期记忆')
  }
}

// MemoryCategory / MemoryEntry 统一由 src/shared/types.ts 定义，此处 re-export 供本层调用方使用
export type { MemoryCategory, MemoryEntry }

export interface AddMemoryOpts {
  /** feedback 等应按主角分桶；其它类别可省略（全局） */
  roleId?: string
}

async function getLLMConfigForSync() {
  const { loadMainLLMConfig } = await import('../llm/aux-config')
  return loadMainLLMConfig()
}

async function ensureTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id        TEXT PRIMARY KEY,
      category  TEXT NOT NULL,
      content   TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      role_id   TEXT NOT NULL DEFAULT ''
    )
  `)
  // 旧库由 schema v9 加列；新库 CREATE 已含列。幂等补齐。
  try {
    db.run(`ALTER TABLE memories ADD COLUMN role_id TEXT NOT NULL DEFAULT ''`)
  } catch {
    /* already exists */
  }
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_memories_category_role
      ON memories(category, role_id)
  `)
}

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  const roleId = typeof row.role_id === 'string' ? row.role_id : ''
  return {
    id: row.id as string,
    category: row.category as MemoryEntry['category'],
    content: row.content as string,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number,
    ...(roleId ? { roleId } : {}),
  }
}

/** 规范化文本供模糊去重（小写、去标点空白） */
export function normalizeMemoryText(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}]+/gu, '')
}

/** Jaccard 相似度（字符 bigram）；≥ threshold 视为语义近重复（G6） */
export function memoryTextSimilarity(a: string, b: string): number {
  const na = normalizeMemoryText(a)
  const nb = normalizeMemoryText(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const grams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    if (s.length === 1) set.add(s)
    return set
  }
  const A = grams(na)
  const B = grams(nb)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

export async function addMemory(
  category: MemoryCategory,
  content: string,
  opts?: AddMemoryOpts,
): Promise<MemoryEntry> {
  assertMemoryContentAllowed(content)
  await ensureTable()
  // feedback 必须带 role 才参与同桶去重；其它类别保持全局去重
  const roleId =
    category === 'feedback' && opts?.roleId?.trim() ? opts.roleId.trim() : ''
  const existing = await listMemories(category)
  const pool = category === 'feedback' && roleId
    ? existing.filter((m) => (m.roleId || '') === roleId || !(m.roleId))
    : existing
  const dup = pool.find(m => memoryTextSimilarity(m.content, content) >= MEMORY_SEMANTIC_DEDUP_THRESHOLD)
  if (dup) {
    log.info('Memory semantic dedup: skip insert', { existingId: dup.id, category, roleId })
    void recordAssetUsage({
      assetKey: MEMORY_STRATEGY_ASSET_KEYS.semanticDeduplication,
      relation: 'used', usageKind: 'memory-operation', status: 'success',
      metadata: { category, comparedCount: pool.length, duplicateCount: 1 },
    })
    if (category === 'feedback') {
      void recordAssetUsage({
        assetKey: MEMORY_STRATEGY_ASSET_KEYS.feedbackBucket,
        relation: 'used', usageKind: 'memory-operation', status: 'success',
        metadata: { bucketed: Boolean(roleId), acceptedCount: 0 },
      })
    }
    return dup
  }

  const db = await getDatabase()
  const now = Date.now()
  const id = `mem-${randomUUID()}`

  db.run(
    'INSERT INTO memories (id, category, content, createdAt, updatedAt, role_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, category, content, now, now, roleId],
  )
  persist()
  log.info('Memory added', { id, category, roleId: roleId || undefined })
  void recordAssetUsage({
    assetKey: MEMORY_STRATEGY_ASSET_KEYS.semanticDeduplication,
    relation: 'used', usageKind: 'memory-operation', status: 'success',
    metadata: { category, comparedCount: pool.length, duplicateCount: 0 },
  })
  if (category === 'feedback') {
    void recordAssetUsage({
      assetKey: MEMORY_STRATEGY_ASSET_KEYS.feedbackBucket,
      relation: 'used', usageKind: 'memory-operation', status: 'success',
      metadata: { bucketed: Boolean(roleId), acceptedCount: 1 },
    })
  }

  getLLMConfigForSync().then(config => {
    if (!config.apiKey) return
    addToVectorStore({ id, text: content, category, sessionId: '', timestamp: now }, config)
      .catch(() => {})
  })

  return { id, category, content, createdAt: now, updatedAt: now, ...(roleId ? { roleId } : {}) }
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
    results.push(rowToEntry(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  return results
}

/**
 * 反思用 feedback：只取该 role 桶内条目。
 * 旧数据 role_id 为空：不注入任何角色的反思（避免串味）；新写入必须带 roleId。
 */
export async function listFeedbackForRole(
  roleId: string,
  limit = FEEDBACK_MEMORY_LIMIT,
): Promise<MemoryEntry[]> {
  const id = roleId.trim()
  if (!id) return []
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    `SELECT * FROM memories
     WHERE category = 'feedback' AND role_id = ?
     ORDER BY updatedAt DESC
     LIMIT ?`,
  )
  stmt.bind([id, limit])
  const results: MemoryEntry[] = []
  while (stmt.step()) {
    results.push(rowToEntry(stmt.getAsObject() as Record<string, unknown>))
  }
  stmt.free()
  void recordAssetUsage({
    assetKey: MEMORY_STRATEGY_ASSET_KEYS.feedbackBucket,
    relation: 'used', usageKind: 'memory-operation', status: 'success',
    metadata: { bucketed: true, resultCount: results.length, limit },
  })
  return results
}

/** 按 id 取一条；不存在返回 null（M29-G2 纠错分流） */
export async function getMemory(id: string): Promise<MemoryEntry | null> {
  const key = (id || '').trim()
  if (!key) return null
  await ensureTable()
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM memories WHERE id = ? LIMIT 1')
  stmt.bind([key])
  let entry: MemoryEntry | null = null
  if (stmt.step()) {
    entry = rowToEntry(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return entry
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
  assertMemoryContentAllowed(content)
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
 * @param roleId 若提供：feedback 只注入该主角桶，避免协作默契串味
 */
export async function buildUserProfile(roleId?: string): Promise<{
  identity: string
  workflow: string
  voice: string
} | null> {
  const memories = await listMemories()
  if (memories.length === 0) return null

  const byCategory: Record<string, string[]> = {}
  for (const m of memories) {
    if (detectSensitiveKinds(m.content).includes('credentials')) continue
    if (m.category === 'feedback' && roleId) {
      if ((m.roleId || '') !== roleId) continue
    }
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
