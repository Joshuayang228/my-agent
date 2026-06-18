import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { LocalIndex } from 'vectra'
import { app } from 'electron'
import { createEmbedding } from '../memory/embeddings'
import { createLogger } from '../utils/logger'
import { getDatabase, persist } from '../storage/database'
import type { LLMConfig } from '../../../src/shared/types'

const log = createLogger('RAG')

let ragIndex: LocalIndex | null = null

function getRagIndexPath(): string {
  const userDataPath = app?.getPath?.('userData') ?? path.join(process.cwd(), '.agent-data')
  const indexPath = path.join(userDataPath, 'rag-index')
  if (!fs.existsSync(indexPath)) fs.mkdirSync(indexPath, { recursive: true })
  return indexPath
}

async function getIndex(): Promise<LocalIndex> {
  if (ragIndex) return ragIndex
  ragIndex = new LocalIndex(getRagIndexPath())
  if (!await ragIndex.isIndexCreated()) await ragIndex.createIndex()
  return ragIndex
}

export interface RagDocument {
  id: string
  name: string
  filePath: string
  chunkCount: number
  createdAt: number
}

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 100

export function chunkText(text: string): string[] {
  const chunks: string[] = []
  const paragraphs = text.split(/\n{2,}/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.trim())
      const words = current.split(/\s+/)
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5))
      current = overlapWords.join(' ') + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

export async function ingestDocument(filePath: string, config: LLMConfig): Promise<RagDocument> {
  const absPath = path.resolve(filePath)
  if (!fs.existsSync(absPath)) throw new Error(`File not found: ${absPath}`)

  const content = fs.readFileSync(absPath, 'utf-8')
  const name = path.basename(absPath)
  const docId = randomUUID()
  const chunks = chunkText(content)

  log.info(`Ingesting document: ${name}`, { chunks: chunks.length, size: content.length })

  const idx = await getIndex()
  let ingested = 0

  for (let i = 0; i < chunks.length; i++) {
    try {
      const { vector } = await createEmbedding(chunks[i], config)
      await idx.insertItem({
        vector,
        metadata: {
          docId,
          docName: name,
          chunkIndex: i,
          text: chunks[i],
          filePath: absPath,
        },
      })
      ingested++
    } catch (err) {
      log.warn(`Failed to embed chunk ${i}/${chunks.length}`, { error: String(err) })
    }
  }

  const db = await getDatabase()
  db.run(
    'INSERT INTO rag_documents (id, name, file_path, chunk_count, created_at) VALUES (?, ?, ?, ?, ?)',
    [docId, name, absPath, ingested, Date.now()],
  )
  persist()

  log.info(`Document ingested: ${name}`, { docId, chunks: ingested })
  return { id: docId, name, filePath: absPath, chunkCount: ingested, createdAt: Date.now() }
}

export async function searchDocuments(query: string, config: LLMConfig, topK = 5): Promise<Array<{ text: string; docName: string; score: number; chunkIndex: number }>> {
  const idx = await getIndex()
  if (!await idx.isIndexCreated()) return []

  try {
    const { vector } = await createEmbedding(query, config)
    const results = await idx.queryItems(vector, topK)

    return results
      .filter(r => r.score >= 0.4)
      .map(r => {
        const meta = r.item.metadata as Record<string, unknown>
        return {
          text: meta.text as string,
          docName: meta.docName as string,
          score: r.score,
          chunkIndex: meta.chunkIndex as number,
        }
      })
  } catch (err) {
    log.warn('RAG search failed', { error: String(err) })
    return []
  }
}

export async function listDocuments(): Promise<RagDocument[]> {
  const db = await getDatabase()
  const stmt = db.prepare('SELECT * FROM rag_documents ORDER BY created_at DESC')
  const docs: RagDocument[] = []
  while (stmt.step()) {
    const r = stmt.getAsObject() as Record<string, unknown>
    docs.push({
      id: r.id as string,
      name: r.name as string,
      filePath: r.file_path as string,
      chunkCount: r.chunk_count as number,
      createdAt: r.created_at as number,
    })
  }
  stmt.free()
  return docs
}

export async function deleteDocument(docId: string): Promise<void> {
  const idx = await getIndex()
  try {
    const items = await idx.listItems()
    for (const item of items) {
      if ((item.metadata as Record<string, unknown>).docId === docId) {
        await idx.deleteItem(item.id)
      }
    }
  } catch (err) {
    log.warn('Failed to remove RAG vectors', { docId, error: String(err) })
  }

  const db = await getDatabase()
  db.run('DELETE FROM rag_documents WHERE id = ?', [docId])
  persist()
  log.info('RAG document deleted', { docId })
}
