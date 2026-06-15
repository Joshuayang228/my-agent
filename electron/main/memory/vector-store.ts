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
  } catch (err) {
    log.warn('Failed to add vector memory', { id: entry.id, error: String(err) })
  }
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
