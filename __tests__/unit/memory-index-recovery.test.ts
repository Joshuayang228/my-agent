import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import 'vectra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ root: '', db: null as any, apiKey: 'test', baseUrl: 'http://localhost/v1', embedding: vi.fn(), persist: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => state.root }, safeStorage: {
  isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString(),
} }))
// 保留真实包导出并在收集阶段加载，避免每次重置业务模块时重复承担依赖初始化成本。
vi.mock('vectra', async importOriginal => await importOriginal())
vi.mock('../../electron/main/storage/database', async importOriginal => ({
  ...await importOriginal<typeof import('../../electron/main/storage/database')>(),
  getDatabase: async () => state.db, persist: state.persist,
}))
vi.mock('../../electron/main/memory/embeddings', async importOriginal => ({
  ...await importOriginal<typeof import('../../electron/main/memory/embeddings')>(), createEmbedding: state.embedding,
}))
vi.mock('../../electron/main/llm/aux-config', () => ({ loadMainLLMConfig: async () => ({ apiKey: state.apiKey, baseUrl: state.baseUrl, model: 'test' }) }))
vi.mock('../../electron/main/utils/asset-usage', () => ({ recordAssetUsage: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({ hashForLog: () => 'test', createLogger: () => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }))

const config = { apiKey: 'test', baseUrl: 'http://localhost/v1', model: 'test' }
let stop: (() => void) | undefined
beforeEach(async () => {
  vi.resetModules()
  state.apiKey = 'test'
  state.baseUrl = 'http://localhost/v1'
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-index-'))
  const SQL = await initSqlJs()
  state.db = new SQL.Database()
  state.db.run('CREATE TABLE memories (id TEXT PRIMARY KEY, category TEXT, content TEXT, createdAt INTEGER, updatedAt INTEGER, role_id TEXT)')
  state.persist.mockReset().mockImplementation(() => fs.writeFileSync(path.join(state.root, 'memory.db'), state.db.export()))
  state.embedding.mockReset().mockResolvedValue({ vector: [1, 0, 0], model: 'test', tokenCount: 1 })
})
afterEach(async () => {
  stop?.()
  stop = undefined
  const store = await import('../../electron/main/storage/memory-store')
  await store.drainMemoryBackgroundTasks()
  state.db.close()
  fs.rmSync(state.root, { recursive: true, force: true })
})

it('真实 Vectra 写入后按当前 API 检索命中', async () => {
  const vectors = await import('../../electron/main/memory/vector-store')
  await vectors.addToVectorStore({ id: 'mem-source', text: '清晨散步', category: 'fact', timestamp: 1 }, config)
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  const { LocalIndex } = await import('vectra')
  const legacy = new LocalIndex(path.join(state.root, 'vector-index'))
  // 原两参数调用把 topK 放到 query 位置；真实包返回空结果，不能用模拟索引掩盖。
  expect(await (legacy.queryItems as any)([1, 0, 0], 10)).toEqual([])
  expect(await vectors.searchVectorStore('散步', config)).toEqual([expect.objectContaining({ id: 'mem-source', text: '清晨散步' })])
})

it('本地 Embedding 端点没有 API Key 时仍会同步记忆镜像', async () => {
  state.apiKey = ''
  const store = await import('../../electron/main/storage/memory-store')
  await startSync()
  await store.addMemory('fact', '本地模型也可以保存记忆')
  await store.drainMemoryBackgroundTasks()
  expect(state.embedding).toHaveBeenCalledWith(
    '本地模型也可以保存记忆',
    expect.objectContaining({ apiKey: '', baseUrl: 'http://localhost/v1' }),
    undefined,
    expect.any(AbortSignal),
  )
  const vectors = await import('../../electron/main/memory/vector-store')
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
})

async function startSync() {
  const sync = (await import('../../electron/main/memory/index-sync')).startMemoryIndexSync()
  stop = sync.stop
  await sync.ready
  return sync
}

it('保存模型配置后立即重建，无需重启或再次修改记忆；停止后不再接收提交', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const settings = await import('../../electron/main/storage/settings-store')
  const memory = await store.addMemory('fact', '配置保存唤醒样本')
  const sync = await startSync()
  const vectors = await import('../../electron/main/memory/vector-store')
  state.baseUrl = 'http://second.local/v1'
  await settings.saveModelConfiguration({ connections: '[]', routes: '[]' })
  await vi.waitFor(() => expect(state.embedding.mock.calls.some(call => call[1].baseUrl === state.baseUrl)).toBe(true))
  await vi.waitFor(async () => expect(await vectors.searchVectorStore('样本', { ...config, baseUrl: state.baseUrl })).toEqual([expect.objectContaining({ id: memory.id })]))
  sync.stop()
  state.embedding.mockClear()
  await settings.saveModelConfiguration({ connections: '[]', routes: '[]' })
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(state.embedding).not.toHaveBeenCalled()
})

it('保存新配置取消旧端点的在途重建，迟到结果不发布', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const settings = await import('../../electron/main/storage/settings-store')
  await store.addMemory('fact', '取消旧配置请求样本')
  let oldSignal: AbortSignal | undefined
  let release!: (value: unknown) => void
  state.embedding.mockImplementationOnce((_text, _config, _model, signal: AbortSignal) => {
    oldSignal = signal
    return new Promise(resolve => { release = resolve })
  })
  const sync = (await import('../../electron/main/memory/index-sync')).startMemoryIndexSync()
  stop = sync.stop
  await vi.waitFor(() => expect(oldSignal).toBeDefined())
  try {
    state.baseUrl = 'http://second.local/v1'
    await settings.saveModelConfiguration({ connections: '[]', routes: '[]' })
    expect(oldSignal!.aborted).toBe(true)
  } finally { release({ vector: [1, 0, 0], model: 'test', tokenCount: 1 }) }
  await sync.ready
  const disk = JSON.parse(fs.readFileSync(path.join(state.root, 'vector-index/index.json'), 'utf8'))
  const { getEmbeddingSpaceKey } = await import('../../electron/main/memory/embeddings')
  expect(disk.items).toHaveLength(1)
  expect(disk.items[0].metadata.embeddingSpace).toBe(getEmbeddingSpaceKey({ ...config, baseUrl: state.baseUrl }))
})

it('切换端点不召回旧空间，核对后重建结构化记忆并保留旧对话', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const vectors = await import('../../electron/main/memory/vector-store')
  const memory = await store.addMemory('fact', '独立向量空间样本')
  const source = await store.listMemories()
  const reconcile = (target: typeof config) => vectors.reconcileMemoryIndex(source, target, () => true, new AbortController().signal)
  await reconcile(config)
  await vectors.addToVectorStore({ id: 'conversation-a', text: '旧端点对话', category: 'conversation', timestamp: 1 }, config)
  const next = { ...config, baseUrl: 'http://other.local/v1' }
  expect(await vectors.searchVectorStore('样本', next)).toEqual([])
  expect(await reconcile(next)).toBe(true)
  expect(await vectors.searchVectorStore('样本', next)).toEqual([expect.objectContaining({ id: memory.id })])
  expect(await vectors.searchVectorStore('样本', config)).toEqual([expect.objectContaining({ id: 'conversation-a' })])
  const calls = state.embedding.mock.calls.length
  await reconcile(next)
  expect(state.embedding).toHaveBeenCalledTimes(calls)
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 2 })
})

it('没有空间标识的旧向量不召回；结构化源可重建，未配置时不破坏已有镜像', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const memory = await store.addMemory('fact', '旧格式结构化源')
  const { LocalIndex } = await import('vectra')
  const legacy = new LocalIndex(path.join(state.root, 'vector-index'))
  await legacy.createIndex()
  await legacy.insertItem({ vector: [1, 0, 0], metadata: { id: memory.id, text: memory.content, category: memory.category, timestamp: memory.updatedAt } })
  const vectors = await import('../../electron/main/memory/vector-store')
  expect(await vectors.searchVectorStore('旧格式', config)).toEqual([])
  const source = await store.listMemories()
  await vectors.reconcileMemoryIndex(source, undefined, () => true, new AbortController().signal)
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  await vectors.reconcileMemoryIndex(source, config, () => true, new AbortController().signal)
  expect(await vectors.searchVectorStore('旧格式', config)).toEqual([expect.objectContaining({ id: memory.id })])
})

it('同端点返回不同维度时不比较不兼容向量', async () => {
  const vectors = await import('../../electron/main/memory/vector-store')
  await vectors.addToVectorStore({ id: 'conversation-dimension', text: '三维样本', category: 'conversation', timestamp: 1 }, config)
  state.embedding.mockResolvedValueOnce({ vector: [1, 0], model: 'test', tokenCount: 1 })
  expect(await vectors.searchVectorStore('二维查询', config)).toEqual([])
  state.embedding.mockResolvedValueOnce({ vector: [1, 0, 0], model: 'different-response-model', tokenCount: 1 })
  expect(await vectors.searchVectorStore('同维度不同模型', config)).toEqual([])
})

it('首次读取与写入并发时，迟到的磁盘旧快照不能覆盖新索引', async () => {
  const { LocalIndex, LocalFileStorage } = await import('vectra')
  await new LocalIndex(path.join(state.root, 'vector-index')).createIndex()
  const snapshot = fs.readFileSync(path.join(state.root, 'vector-index/index.json'))
  let releaseFirst!: () => void
  let releaseLate!: () => void
  let reportFirst!: () => void
  const firstStarted = new Promise<void>(resolve => { reportFirst = resolve })
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve })
  const lateGate = new Promise<void>(resolve => { releaseLate = resolve })
  let reads = 0
  const read = vi.spyOn(LocalFileStorage.prototype, 'readFile').mockImplementation(async () => {
    reads++
    if (reads === 1) { reportFirst(); await firstGate }
    else await lateGate
    return snapshot
  })
  try {
    const vectors = await import('../../electron/main/memory/vector-store')
    const writing = vectors.addToVectorStore({ id: 'mem-cold', text: '并发读取样本', category: 'fact', timestamp: 1 }, config)
    await firstStarted
    const reading = vectors.getVectorStoreStats()
    await new Promise<void>(resolve => setImmediate(resolve))
    releaseFirst()
    await writing
    releaseLate()
    await reading
    expect(reads).toBe(1)
    expect(JSON.parse(fs.readFileSync(path.join(state.root, 'vector-index/index.json'), 'utf8')).items).toHaveLength(1)
    expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  } finally { releaseFirst(); releaseLate(); read.mockRestore() }
})

it('提交后未发内存任务，重新打开真实 SQLite 仍补齐且不重复请求', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const first = store.writeMemoryToDatabase(state.db, 'feedback', '请直接给结论', { roleId: 'lin' })
  state.persist()
  state.db.close()
  const SQL = await initSqlJs()
  state.db = new SQL.Database(fs.readFileSync(path.join(state.root, 'memory.db')))
  const sync = await startSync()
  const vectors = await import('../../electron/main/memory/vector-store')
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  expect(await vectors.searchVectorStore('回答方式', config)).toEqual([expect.objectContaining({ id: first.entry.id, category: 'feedback' })])
  const disk = JSON.parse(fs.readFileSync(path.join(state.root, 'vector-index/index.json'), 'utf8'))
  expect(disk.items[0].metadata.roleId).toBe('lin')
  const calls = state.embedding.mock.calls.length
  await sync.request()
  expect(state.embedding).toHaveBeenCalledTimes(calls)
})

it('向量失败不丢源，重新启动恢复服务可补齐', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const memory = await store.addMemory('voice', '我偏好简短回答')
  state.embedding.mockRejectedValueOnce(new Error('offline'))
  await startSync()
  const vectors = await import('../../electron/main/memory/vector-store')
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 0 })
  expect(await store.getMemory(memory.id)).toMatchObject({ content: memory.content })
  stop?.()
  await startSync()
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
})

it('临时失败自动退避重试，停止服务会取消在途请求', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  await store.addMemory('fact', '自动重试样本')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    state.embedding.mockRejectedValueOnce(new Error('offline'))
    const sync = await startSync()
    expect(state.embedding).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    vi.useRealTimers()
    const vectors = await import('../../electron/main/memory/vector-store')
    await vi.waitFor(async () => expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 }))
    let signal: AbortSignal | undefined
    state.embedding.mockImplementationOnce((_text, _config, _model, currentSignal: AbortSignal) => {
      signal = currentSignal
      return new Promise((_resolve, reject) => currentSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    })
    await store.addMemory('voice', '另一个待取消样本')
    await vi.waitFor(() => expect(signal).toBeDefined())
    sync.stop()
    await store.drainMemoryBackgroundTasks()
    expect(signal!.aborted).toBe(true)
    expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  } finally { vi.useRealTimers() }
})

it('清理旧分类、重复和已删除镜像，保留对话向量与角色归属', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const vectors = await import('../../electron/main/memory/vector-store')
  const memory = await store.addMemory('workflow', '修改代码之后需要运行测试')
  const old = { id: memory.id, text: '旧内容', category: 'fact' as const, timestamp: 1 }
  await vectors.addToVectorStore(old, config)
  await vectors.addToVectorStore(old, config)
  await vectors.addToVectorStore({ ...old, id: 'mem-deleted' }, config)
  await vectors.addToVectorStore({ ...old, id: 'conversation-1', category: 'conversation' }, config)
  await startSync()
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 2 })
  expect(await vectors.searchVectorStore('测试', config, { category: 'workflow' })).toEqual([expect.objectContaining({ id: memory.id, text: memory.content })])
  await store.deleteMemory(memory.id)
  await store.drainMemoryBackgroundTasks()
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 1 })
  expect(await vectors.searchVectorStore('测试', config)).toEqual([expect.objectContaining({ id: 'conversation-1' })])
})

it('向量生成期间改写和删除，迟到结果不复活旧记忆', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  await startSync()
  let release!: (value: unknown) => void
  state.embedding.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const memory = await store.addMemory('voice', '请用简明文字回答')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  await store.updateMemory(memory.id, '现在请解释完整推导过程')
  await store.deleteMemory(memory.id)
  release({ vector: [1, 0, 0], model: 'test', tokenCount: 1 })
  await store.drainMemoryBackgroundTasks()
  const vectors = await import('../../electron/main/memory/vector-store')
  expect(await vectors.getVectorStoreStats()).toMatchObject({ count: 0 })
  expect(await store.listMemories()).toEqual([])
})

it('新增、修改、删除写盘失败均恢复内存事实源且不发布索引变更', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const notify = vi.fn(async () => {})
  stop = store.setMemoryIndexSync(notify)
  state.persist.mockImplementationOnce(() => { throw new Error('disk full') })
  await expect(store.addMemory('fact', '失败的新增不得被扫描')).rejects.toThrow('disk full')
  expect(await store.listMemories()).toEqual([])
  const memory = await store.addMemory('preference', '我喜欢早晨散步')
  await store.drainMemoryBackgroundTasks()
  notify.mockClear()
  state.persist.mockImplementationOnce(() => { throw new Error('disk full') })
  await expect(store.updateMemory(memory.id, '失败的修改')).rejects.toThrow('disk full')
  expect(await store.getMemory(memory.id)).toEqual(memory)
  state.persist.mockImplementationOnce(() => { throw new Error('disk full') })
  await expect(store.deleteMemory(memory.id)).rejects.toThrow('disk full')
  expect(await store.getMemory(memory.id)).toEqual(memory)
  expect(notify).not.toHaveBeenCalled()
})

it('向量快照替换失败保留原文件，后续重试不被残留 Vectra 事务阻塞', async () => {
  const store = await import('../../electron/main/storage/memory-store')
  const memory = await store.addMemory('voice', '原有偏好')
  const sync = await startSync()
  const file = path.join(state.root, 'vector-index/index.json')
  const before = fs.readFileSync(file)
  const rename = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('locked') })
  try {
    await store.updateMemory(memory.id, '已经修改的偏好')
    await store.drainMemoryBackgroundTasks()
    expect(fs.readFileSync(file)).toEqual(before)
  } finally { rename.mockRestore() }
  await sync.request()
  const items = JSON.parse(fs.readFileSync(file, 'utf8')).items
  expect(items).toHaveLength(1)
  expect(items[0].metadata).toMatchObject({ text: '已经修改的偏好', category: 'voice' })
})
