/**
 * 向量记忆存储
 *
 * 基于 Vectra LocalIndex，将对话片段和记忆向量化后存入本地文件。
 * 支持语义检索：给定查询文本，返回最相关的记忆条目。
 *
 * 存储路径：userData/vector-index/
 */

import { LocalIndex } from 'vectra'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { createEmbedding } from './embeddings'
import { createLogger } from '../utils/logger'
import type { LLMConfig } from '../../../src/shared/types'

const log = createLogger('VectorStore')

let index: LocalIndex | null = null

/**
 * G3 记忆生命周期：conversation 类向量只增不减会无限膨胀。
 * 设上限，超出时按 timestamp 删最旧的（LRU）。
 * 只淘汰 conversation 类——结构化记忆（identity/preference/fact 等）是精心维护的
 * 高价值知识，由用户/画像提取管理，不自动淘汰。
 */
const MAX_CONVERSATION_VECTORS = 500

function getIndexPath(): string {
  const userDataPath = app?.getPath?.('userData') ?? path.join(process.cwd(), '.agent-data')
  const indexPath = path.join(userDataPath, 'vector-index')
  if (!fs.existsSync(indexPath)) {
    fs.mkdirSync(indexPath, { recursive: true })
  }
  return indexPath
}

async function getIndex(): Promise<LocalIndex> {
  if (index) return index

  const indexPath = getIndexPath()
  index = new LocalIndex(indexPath)

  if (!await index.isIndexCreated()) {
    await index.createIndex()
    log.info('Vector index created', { path: indexPath })
  }

  return index
}

export interface VectorMemoryEntry {
  id: string
  text: string
  category: 'conversation' | 'fact' | 'preference' | 'identity' | 'workflow' | 'voice'
  sessionId?: string
  timestamp: number
}

/**
 * 将一条记忆写入向量索引。
 */
export async function addToVectorStore(
  entry: VectorMemoryEntry,
  config: LLMConfig,
): Promise<void> {
  const idx = await getIndex()

  try {
    const { vector } = await createEmbedding(entry.text, config)

    await idx.insertItem({
      vector,
      metadata: {
        id: entry.id,
        text: entry.text,
        category: entry.category,
        sessionId: entry.sessionId ?? '',
        timestamp: entry.timestamp,
      },
    })

    log.info('Vector memory added', { id: entry.id, category: entry.category })

    // G3：conversation 类写入后检查容量，超上限淘汰最旧的
    if (entry.category === 'conversation') {
      await evictOldConversationVectors()
    }
  } catch (err) {
    log.warn('Failed to add vector memory', { id: entry.id, error: String(err) })
  }
}

/**
 * G3 淘汰：conversation 类向量超过 MAX_CONVERSATION_VECTORS 时，
 * 按 timestamp 升序删除最旧的，直到回到上限。只动 conversation 类。
 * 从选出待删条目到 items（纯逻辑）抽出为 selectEvictableItems 便于测试。
 */
async function evictOldConversationVectors(): Promise<void> {
  const idx = await getIndex()
  try {
    const items = await idx.listItems()
    const toEvict = selectEvictableItems(
      items.map(it => ({ itemId: it.id, metadata: it.metadata as Record<string, unknown> })),
      MAX_CONVERSATION_VECTORS,
    )
    for (const itemId of toEvict) {
      await idx.deleteItem(itemId)
    }
    if (toEvict.length > 0) {
      log.info('Evicted old conversation vectors', { count: toEvict.length })
    }
  } catch (err) {
    log.warn('Conversation vector eviction failed', { error: String(err) })
  }
}

/**
 * 纯函数：给定所有向量条目，选出需要淘汰的 conversation 条目 id。
 * 规则：只看 category==='conversation' 的条目，若超过 max，按 timestamp 升序
 * （最旧优先）选出多余的部分返回。非 conversation 条目永不淘汰。
 */
export function selectEvictableItems(
  items: Array<{ itemId: string; metadata: Record<string, unknown> }>,
  max: number,
): string[] {
  const conversations = items
    .filter(it => (it.metadata.category as string) === 'conversation')
    .map(it => ({ itemId: it.itemId, timestamp: (it.metadata.timestamp as number) ?? 0 }))
    .sort((a, b) => a.timestamp - b.timestamp)  // 最旧在前

  const overflow = conversations.length - max
  if (overflow <= 0) return []
  return conversations.slice(0, overflow).map(c => c.itemId)
}

/**
 * 批量添加记忆到向量索引。
 */
export async function addBatchToVectorStore(
  entries: VectorMemoryEntry[],
  config: LLMConfig,
): Promise<number> {
  let added = 0
  for (const entry of entries) {
    try {
      await addToVectorStore(entry, config)
      added++
    } catch {
      // continue on individual failures
    }
  }
  return added
}

export interface VectorSearchResult {
  id: string
  text: string
  category: string
  score: number
  sessionId?: string
  timestamp: number
}

/**
 * 语义检索：根据查询文本找到最相关的记忆。
 */
export async function searchVectorStore(
  query: string,
  config: LLMConfig,
  options: { topK?: number; minScore?: number; category?: string } = {},
): Promise<VectorSearchResult[]> {
  const { topK = 10, minScore = 0.5, category } = options
  const idx = await getIndex()

  if (!await idx.isIndexCreated()) return []

  try {
    const { vector } = await createEmbedding(query, config)

    const results = await idx.queryItems(vector, topK)

    return results
      .filter(r => r.score >= minScore)
      .filter(r => !category || (r.item.metadata as any).category === category)
      .map(r => {
        const meta = r.item.metadata as any
        return {
          id: meta.id ?? '',
          text: meta.text ?? '',
          category: meta.category ?? 'fact',
          score: r.score,
          sessionId: meta.sessionId || undefined,
          timestamp: meta.timestamp ?? 0,
        }
      })
  } catch (err) {
    log.warn('Vector search failed', { error: String(err) })
    return []
  }
}

/**
 * 将时间戳格式化为人类可读的「距今多久」。
 *
 * G2 防漂移：LLM 不擅长对原始 ISO 时间戳做陈旧性推理，但「30 天前」这样的
 * 相对表述能触发它对记忆时效性的判断。对照 CC memoryAge.ts 的设计动机。
 */
export function formatMemoryAge(timestamp: number, now: number = Date.now()): string {
  const days = Math.max(0, Math.floor((now - timestamp) / (24 * 60 * 60 * 1000)))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

/** 超过此天数的记忆，注入时追加"请以当前实际为准"的陈旧提示 */
export const MEMORY_STALE_THRESHOLD_DAYS = 7

/**
 * 把向量召回结果加工成注入 System Prompt 的文本。
 * 纯函数，便于测试。整合 G5 去重 + G2 老化告警：
 * - G5：排除 id 前缀 mem- 的 SQLite 记忆镜像（已由 buildUserProfile 全量注入，避免双重注入）
 * - G2：每条加相对时间感；存在超阈值记忆时追加陈旧提示
 * 返回 null 表示去重后无内容可注入。
 */
export function formatRecallForInjection(
  results: VectorSearchResult[],
  now: number = Date.now(),
): string | null {
  const deduped = results.filter(r => !r.id.startsWith('mem-'))
  if (deduped.length === 0) return null

  let hasStale = false
  const lines = deduped.map(r => {
    const age = formatMemoryAge(r.timestamp, now)
    const ageDays = Math.floor((now - r.timestamp) / (24 * 60 * 60 * 1000))
    if (ageDays > MEMORY_STALE_THRESHOLD_DAYS) hasStale = true
    return `- [${r.category}·${age}] ${r.text}`
  })

  let output = lines.join('\n')
  if (hasStale) {
    output += '\n\n（部分记忆记录较早，如与当前对话不符，请以用户当前表述为准。）'
  }
  return output
}

/**
 * 删除指定 ID 的向量记忆。
 */
export async function removeFromVectorStore(id: string): Promise<void> {
  const idx = await getIndex()
  try {
    const items = await idx.listItems()
    const target = items.find(item => (item.metadata as any).id === id)
    if (target) {
      await idx.deleteItem(target.id)
      log.info('Vector memory removed', { id })
    }
  } catch (err) {
    log.warn('Failed to remove vector memory', { id, error: String(err) })
  }
}

/**
 * 获取索引统计信息。
 */
export async function getVectorStoreStats(): Promise<{ count: number; path: string }> {
  const idx = await getIndex()
  const items = await idx.listItems()
  return { count: items.length, path: getIndexPath() }
}
