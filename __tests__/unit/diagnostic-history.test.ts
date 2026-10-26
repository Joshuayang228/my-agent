import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import type { DiagnosticHistoryRecord } from '../../src/shared/debug-history'
import { DIAGNOSTIC_HISTORY_LIMITS as LIMITS } from '../../src/shared/debug-history'
import { createDiagnosticHistorySchema } from '../../electron/main/storage/diagnostic-history-schema'
import { DiagnosticHistoryStore } from '../../electron/main/storage/diagnostic-history-store'
import { DIAGNOSTIC_PROCESS_RUN_ID, setDiagnosticHistorySink } from '../../electron/main/utils/diagnostic-history'
import { startSpan, startLinkedAsyncSpan, clearSpans } from '../../electron/main/utils/tracer'
import { getTraceSampleRate, setTraceSampleRate } from '../../electron/main/utils/session-sampler'
import { startDiagnosticHistory, stopDiagnosticHistory, queryDiagnosticHistory } from '../../electron/main/debug/diagnostic-history-service'

const NOW = 1_800_000_000_000
let db: Database
let store: DiagnosticHistoryStore
let clock: number
const persist = vi.fn()
const stores: DiagnosticHistoryStore[] = []

function record(spanId: string, patch: Partial<DiagnosticHistoryRecord> = {}): DiagnosticHistoryRecord {
  return { id: `run-a:span:${spanId}`, processRunId: 'run-a', kind: 'span', occurredAt: NOW - 1000, updatedAt: NOW - 1000, status: 'running', phase: 'started', spanType: 'tool', caller: 'tool', spanId, sessionId: 'session-a', roleId: 'role-a', omittedFields: 0, ...patch }
}
function open(run = 'run-a') {
  const next = new DiagnosticHistoryStore(db, run, persist, () => clock)
  stores.push(next)
  return next
}
beforeEach(async () => {
  vi.useFakeTimers()
  clock = NOW
  persist.mockReset()
  db = new (await initSqlJs()).Database()
  createDiagnosticHistorySchema(db)
  store = open()
})
afterEach(() => {
  setDiagnosticHistorySink()
  stopDiagnosticHistory()
  for (const item of stores.splice(0)) item.close()
  db.close()
  clearSpans()
  vi.useRealTimers()
})

describe('诊断历史：真实 SQL 与生命周期', () => {
  it('正式启动前查询不可用且不建表，启动后接口可读真实历史', () => {
    expect(queryDiagnosticHistory().state).toBe('unavailable')
    expect(() => queryDiagnosticHistory({ limit: 999 })).toThrow()
    const before = db.export()
    queryDiagnosticHistory()
    expect(db.export()).toEqual(before)
    startDiagnosticHistory(db, persist)
    expect(queryDiagnosticHistory().state).toBe('ready')
  })

  it('未 flush 的首个终态不会被重复结束覆盖，超限存储行不解析', () => {
    store.record(record('twice', { status: 'ok', phase: 'ended', updatedAt: NOW }))
    store.record(record('twice', { status: 'error', phase: 'ended', updatedAt: NOW + 1 }))
    store.flush()
    expect(store.query().records[0].status).toBe('ok')
    db.run('UPDATE diagnostic_history SET record_json=?', [JSON.stringify({ text: 'x'.repeat(5000) })])
    expect(store.query().records).toEqual([])
    expect(store.query().coverage.invalidStored).toBe(1)
  })

  it('同一真实 Span 可补上最初未知身份，但已有身份和终态不被覆盖', () => {
    store.record(record('late-role', { roleId: undefined }))
    store.flush()
    store.record(record('late-role', { updatedAt: NOW }))
    store.flush()
    expect(store.query({ roleId: 'role-a' }).records[0].spanId).toBe('late-role')
    store.record(record('late-role', { updatedAt: NOW, status: 'error', phase: 'ended' }))
    store.flush()
    store.record(record('late-role', { updatedAt: NOW + 1, status: 'ok', phase: 'ended' }))
    store.flush()
    expect(store.query().records[0].status).toBe('error')
  })
  it('排队前查询不写盘，批量刷新后同 ID 读取，终态不被迟到 running 覆盖', () => {
    store.record(record('span-a'))
    const before = db.export()
    expect(store.query().records).toEqual([])
    expect(db.export()).toEqual(before)
    expect(store.query().coverage.pending).toBe(1)
    expect(persist).not.toHaveBeenCalled()
    store.flush()
    store.record(record('span-a', { status: 'error', phase: 'ended', updatedAt: NOW, durationMs: 1000 }))
    store.flush()
    store.record(record('span-a', { updatedAt: NOW + 1 }))
    store.flush()
    expect(store.query({ spanId: 'span-a' }).records).toMatchObject([{ status: 'error', durationMs: 1000 }])
  })

  it('同时间跨页不重不漏，游标不能跨角色或日期复用，缺 ID 不替代', () => {
    for (const id of ['a', 'b', 'c']) store.record(record(id))
    store.record(record('other', { roleId: 'role-b' }))
    store.flush()
    const first = store.query({ roleId: 'role-a', limit: 2 })
    expect(first.records.map(row => row.spanId)).toEqual(['c', 'b'])
    const second = store.query({ roleId: 'role-a', limit: 2, cursor: first.nextCursor })
    expect(second.records.map(row => row.spanId)).toEqual(['a'])
    expect(second.hasMore).toBe(false)
    expect(() => store.query({ roleId: 'role-b', cursor: first.nextCursor })).toThrow()
    expect(() => store.query({ roleId: 'role-a', from: NOW - 5000, cursor: first.nextCursor })).toThrow()
    expect(store.query({ recordId: 'missing', roleId: 'role-a' }).records).toEqual([])
    expect(store.query({ spanId: 'other', roleId: 'role-a' }).records).toEqual([])
    expect(store.query({ sessionId: 'different' }).records).toEqual([])
  })

  it('导出并重开数据库后仍保留历史，将旧 running 明确标为中断且不补耗时', async () => {
    store.record(record('unfinished'))
    store.record(record('finished', { status: 'ok', phase: 'ended', updatedAt: NOW, durationMs: 1000 }))
    store.close()
    stores.splice(stores.indexOf(store), 1)
    const snapshot = db.export()
    db.close()
    db = new (await initSqlJs()).Database(snapshot)
    const restarted = open('run-b')
    restarted.recover()
    const unfinished = restarted.query({ spanId: 'unfinished' }).records[0]
    expect(unfinished.status).toBe('interrupted')
    expect(unfinished.durationMs).toBeUndefined()
    expect(unfinished.updatedAt).toBe(NOW - 1000)
    expect(restarted.query({ spanId: 'finished' }).records[0].status).toBe('ok')
    expect(restarted.query().coverage.recordingSince).toBe(NOW)
  })

  it('SQL 注入、任意字段、非法时间、无界页和异范围游标被拒绝', () => {
    for (const query of [{ roleId: "' OR 1=1--" }, { limit: 101 }, { from: 10, to: 1 }, { cursor: 'bad-json' }, { sql: 'DELETE' }, { recordId: 'one', cursor: 'two' }]) {
      expect(() => store.query(query)).toThrow()
    }
    expect(store.query().records).toEqual([])
  })

  it('拒绝正文扩展、凭据身份、错误进程、超长元数据和跨作用域更新', () => {
    store.record({ ...record('text'), content: '用户正文' })
    store.record(record('secret', { sessionId: 'sk-sensitive-credential' }))
    store.record(record('process', { processRunId: 'wrong-run' }))
    store.record(record('large', { links: Array.from({ length: 16 }, (_, i) => `${i}${'a'.repeat(239)}`) }))
    store.record(record('stable'))
    store.record(record('stable', { roleId: 'role-b' }))
    store.flush()
    expect(store.query().coverage.dropped).toBe(5)
    expect(store.query().records.map(row => row.spanId)).toEqual(['stable'])
    expect(store.query({ roleId: 'role-b' }).records).toEqual([])
    store.record(record('stable', { roleId: 'role-b', updatedAt: NOW }))
    store.flush()
    expect(store.query({ roleId: 'role-a' }).records[0].roleId).toBe('role-a')
  })

  it('坏 JSON 与列 / JSON 角色不一致被隔离，不泄露到其他范围', () => {
    store.record(record('valid'))
    store.flush()
    db.run('UPDATE diagnostic_history SET record_json = ? WHERE id = ?', [JSON.stringify(record('valid', { roleId: 'role-b' })), record('valid').id])
    const result = store.query({ roleId: 'role-a' })
    expect(result.records).toEqual([])
    expect(result.coverage.invalidStored).toBe(1)
    db.run('UPDATE diagnostic_history SET record_json = ?', ['{broken'])
    expect(store.query().coverage.invalidStored).toBe(1)
  })

  it('队列有界、写盘失败可见且后续 flush 能重试，关闭清理定时器', () => {
    for (let i = 0; i < LIMITS.maxQueued + 4; i++) store.record(record(`item-${i}`))
    expect(store.query().coverage).toMatchObject({ pending: LIMITS.maxQueued, dropped: 4 })
    persist.mockImplementationOnce(() => { throw new Error('disk full') })
    expect(store.flush()).toBe(false)
    expect(store.query().coverage).toMatchObject({ pending: 0, diskPending: true, writeFailures: 1 })
    expect(store.flush()).toBe(true)
    expect(store.query().coverage.diskPending).toBe(false)
    store.close()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('SQL 事务失败不会回滚调用方事务，失败批次有明确丢失计数', () => {
    db.run('BEGIN TRANSACTION')
    db.run("INSERT INTO diagnostic_history_meta VALUES ('external-owner',1)")
    store.record(record('busy'))
    expect(store.flush()).toBe(false)
    db.run('COMMIT')
    expect(db.exec("SELECT value FROM diagnostic_history_meta WHERE key='external-owner'")[0].values).toEqual([[1]])
    expect(store.query().coverage).toMatchObject({ pending: 0, dropped: 1, writeFailures: 1 })
  })

  it('超过保留天数不再查询，正式写入清理旧记录', () => {
    store.record(record('old'))
    store.flush()
    clock += LIMITS.retentionMs + 1
    expect(store.query().records).toEqual([])
    store.flush()
    expect(db.exec('SELECT COUNT(*) FROM diagnostic_history')[0].values).toEqual([[0]])
    expect(store.query().coverage.pruned).toBe(1)
  })

  it('达到总量上限时按时间 / ID 确定性裁剪，不依赖页面大小', () => {
    const stmt = db.prepare('INSERT INTO diagnostic_history VALUES (?,?,?,?,?,?,?,?,?,?)')
    db.run('BEGIN TRANSACTION')
    try {
      for (let i = 0; i < LIMITS.maxRecords + 3; i++) {
        const row = record(`item-${String(i).padStart(5, '0')}`)
        stmt.run([row.id, row.processRunId, row.kind, row.occurredAt, row.updatedAt, row.status, row.roleId!, row.sessionId!, row.spanId, JSON.stringify(row)])
      }
    } finally { stmt.free(); db.run('COMMIT') }
    store.flush()
    expect(db.exec('SELECT COUNT(*) FROM diagnostic_history')[0].values).toEqual([[LIMITS.maxRecords]])
    expect(store.query({ spanId: 'item-00000' }).records).toEqual([])
    expect(store.query({ spanId: 'item-20002' }).records).toHaveLength(1)
    expect(store.query().coverage.pruned).toBe(3)
  })
})

describe('生产追踪到历史存储', () => {
  it('沿真实 Span ID 保存生命周期及 links，不保存名字、错误、参数和凭据', () => {
    const live = open(DIAGNOSTIC_PROCESS_RUN_ID)
    setDiagnosticHistorySink(row => live.record(row))
    vi.setSystemTime(NOW)
    const root = startSpan('包含用户正文的名字', 'main', 'interaction', undefined, { sessionId: 'actual-session', roleId: 'actual-role', prompt: '不应保存', apiKey: 'sk-secret' })
    const tool = startSpan('读取私有路径', 'tool', 'tool_execution', root.id, { args: { secret: 'secret' } })
    tool.end('error', '不应保存的错误正文')
    const background = startLinkedAsyncSpan('后台正文', 'memory', { linkToSpanId: root.id })
    background.end()
    root.end()
    live.flush()
    const result = live.query({ kind: 'span', sessionId: 'actual-session' })
    expect(result.records.find(row => row.spanId === tool.id)).toMatchObject({ parentId: root.id, status: 'error', roleId: 'actual-role' })
    expect(live.query({ kind: 'span', spanId: background.id }).records[0].links).toEqual([root.id])
    const saved = JSON.stringify(live.query({ limit: 100 }))
    for (const text of ['不应保存', '用户正文', '读取私有路径', 'sk-secret', 'apiKey', 'args']) expect(saved).not.toContain(text)
    expect(live.query({ kind: 'event', spanId: root.id }).records.map(row => row.phase).sort()).toEqual(['ended', 'started'])
  })

  it('未采样会话不偷偷写历史，sink 故障不使任务失败', () => {
    const rate = getTraceSampleRate()
    try {
      const sink = vi.fn(() => { throw new Error('sink unavailable') })
      setDiagnosticHistorySink(sink)
      setTraceSampleRate(0)
      const dropped = startSpan('not sampled', 'main', 'interaction', undefined, { sessionId: 'sample-me' })
      dropped.end()
      expect(sink).not.toHaveBeenCalled()
      setTraceSampleRate(1)
      expect(() => startSpan('sampled', 'main', 'interaction').end()).not.toThrow()
      expect(sink).toHaveBeenCalled()
    } finally { setTraceSampleRate(rate) }
  })
})
