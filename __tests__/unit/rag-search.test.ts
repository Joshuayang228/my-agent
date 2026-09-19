import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import 'vectra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ root: '', db: null as any, embedding: vi.fn(), config: { apiKey: '', baseUrl: 'http://localhost/v1', model: 'chat' } }))
vi.mock('electron', () => ({ app: { getPath: () => state.root } }))
vi.mock('vectra', async importOriginal => await importOriginal())
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => state.db, persist: vi.fn() }))
vi.mock('../../electron/main/memory/embeddings', () => ({ createEmbedding: state.embedding }))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig: async () => state.config }))
vi.mock('../../electron/main/utils/logger', () => ({ hashForLog: () => 'test', createLogger: () => ({ info: vi.fn(), warn: vi.fn() }) }))

beforeEach(async () => {
  vi.resetModules()
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-search-'))
  state.config = { apiKey: '', baseUrl: 'http://localhost/v1', model: 'chat' }
  const SQL = await initSqlJs()
  state.db = new SQL.Database()
  state.db.run('CREATE TABLE rag_documents (id TEXT PRIMARY KEY, name TEXT, file_path TEXT, chunk_count INTEGER, created_at INTEGER)')
  state.embedding.mockReset().mockResolvedValue({ vector: [1, 0, 0], model: 'embedding', tokenCount: 1 })
})
afterEach(() => {
  state.db.close()
  fs.rmSync(state.root, { recursive: true, force: true })
})

it('真实导入后查询命中，遵守 topK，重开索引后仍可通过无 Key 工具检索', async () => {
  const rag = await import('../../electron/main/rag/index')
  for (const name of ['first.txt', 'second.txt']) {
    const file = path.join(state.root, name)
    fs.writeFileSync(file, '项目资料：清晨散步计划。')
    expect(await rag.ingestDocument(file, state.config)).toMatchObject({ chunkCount: 1 })
  }
  expect(await rag.listDocuments()).toHaveLength(2)
  expect(await rag.searchDocuments('散步', state.config, 1)).toEqual([
    expect.objectContaining({ text: '项目资料：清晨散步计划。', chunkIndex: 0, score: 1 }),
  ])
  expect(await rag.searchDocuments('散步', state.config, 2)).toHaveLength(2)
  vi.resetModules()
  const { ragSearchTool } = await import('../../electron/main/tools/builtins/rag-search')
  const result = await ragSearchTool.execute({ query: '散步', topK: '1' })
  expect(result).toContain('[用户文档内容]')
  expect(result).toContain('清晨散步计划')
  expect(result).not.toContain('[2]')
})

it.each(['baseUrl', 'model'] as const)('工具拒绝空 %s，即使存在残留 Key', async key => {
  state.config.apiKey = 'test'
  state.config[key] = ' '
  const { ragSearchTool } = await import('../../electron/main/tools/builtins/rag-search')
  expect(await ragSearchTool.execute({ query: '散步' })).toContain('请先配置可用的模型连接')
  expect(state.embedding).not.toHaveBeenCalled()
})

it('无 Key 工具允许有效本地连接，空库和服务失败仍保持既有无结果行为', async () => {
  const { ragSearchTool } = await import('../../electron/main/tools/builtins/rag-search')
  expect(await ragSearchTool.execute({ query: '散步' })).toContain('未找到相关文档片段')
  expect(state.embedding).toHaveBeenCalledWith('散步', state.config)
  state.embedding.mockRejectedValueOnce(new Error('offline'))
  expect(await ragSearchTool.execute({ query: '散步' })).toContain('未找到相关文档片段')
})
