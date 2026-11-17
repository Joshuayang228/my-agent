import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => fixture.directory } }))
const { getDatabase, withDatabaseTransaction, persist, _resetDatabaseForTests } = await import('../../electron/main/storage/database')
const SQL = await initSqlJs()

beforeEach(async () => {
  fixture.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-transaction-'))
  const db = await getDatabase()
  db.run('CREATE TABLE transaction_probe (id TEXT PRIMARY KEY)')
  persist()
})
afterEach(() => {
  vi.restoreAllMocks()
  _resetDatabaseForTests()
  fs.rmSync(fixture.directory, { recursive: true, force: true })
})

it.each(['export', 'write', 'rename'] as const)('事务提交后 %s 失败隔离内存状态，后续保存不夹带失败事实，重启恢复磁盘快照', async failure => {
  const retained = await getDatabase()
  const unavailable = () => { throw new Error('disk-unavailable') }
  if (failure === 'export') vi.spyOn(retained, 'export').mockImplementationOnce(unavailable)
  if (failure === 'write') vi.spyOn(fs, 'writeFileSync').mockImplementationOnce(unavailable)
  if (failure === 'rename') vi.spyOn(fs, 'renameSync').mockImplementationOnce(unavailable)
  await expect(withDatabaseTransaction(async db => {
    db.run('INSERT INTO transaction_probe VALUES (?)', ['failed-commit'])
  })).rejects.toThrow('数据库保存失败')
  await expect(getDatabase()).rejects.toThrow('重启')
  expect(() => retained.exec('SELECT * FROM transaction_probe')).toThrow()
  expect(() => persist()).toThrow('重启')
  _resetDatabaseForTests()
  const reopened = await getDatabase()
  expect(reopened.exec('SELECT id FROM transaction_probe')[0]?.values ?? []).toEqual([])
  reopened.run('INSERT INTO transaction_probe VALUES (?)', ['successful-retry'])
  persist()
  const disk = new SQL.Database(fs.readFileSync(path.join(fixture.directory, 'my-agent.db')))
  expect(disk.exec('SELECT id FROM transaction_probe')[0]?.values).toEqual([['successful-retry']])
  disk.close()
})

it('事务成功返回前已写盘，独立数据库重开可见提交事实', async () => {
  await withDatabaseTransaction(async db => {
    db.run('INSERT INTO transaction_probe VALUES (?)', ['committed'])
    persist()
  })
  const reopened = new SQL.Database(fs.readFileSync(path.join(fixture.directory, 'my-agent.db')))
  try {
    expect(reopened.exec('SELECT id FROM transaction_probe')[0]?.values).toEqual([['committed']])
  } finally { reopened.close() }
})

it('独立并发事务不加入另一个事务并随它回滚', async () => {
  let release!: () => void
  let entered!: () => void
  const started = new Promise<void>(resolve => { entered = resolve })
  const gate = new Promise<void>(resolve => { release = resolve })
  const first = withDatabaseTransaction(async db => {
    db.run('INSERT INTO transaction_probe VALUES (?)', ['rollback'])
    entered()
    await gate
    throw new Error('rollback-first')
  })
  const rejected = expect(first).rejects.toThrow('rollback-first')
  await started
  const second = withDatabaseTransaction(async db => {
    db.run('INSERT INTO transaction_probe VALUES (?)', ['survivor'])
  })
  release()
  await rejected
  await second
  expect((await getDatabase()).exec('SELECT id FROM transaction_probe')[0]?.values).toEqual([['survivor']])
})

it('人物状态并发增量与生命周期更新均保留', async () => {
  const { resetCompanionCoreSchemaForTesting, getCompanionRuntimeState, applyCompanionRuntimeDelta, updateCompanionRuntimeLifecycle } = await import('../../electron/main/companion/core/state/runtime-state')
  resetCompanionCoreSchemaForTesting()
  const before = await getCompanionRuntimeState('luffy')
  await Promise.all([
    applyCompanionRuntimeDelta({ roleId: 'luffy', delta: { energy: -10 } }),
    applyCompanionRuntimeDelta({ roleId: 'luffy', delta: { energy: -5 } }),
    updateCompanionRuntimeLifecycle({ roleId: 'luffy', lastTickAt: 123 }),
  ])
  const after = await getCompanionRuntimeState('luffy')
  expect(after.energy).toBe(before.energy - 15)
  expect(after.version).toBe(2)
  expect(after.lastTickAt).toBe(123)
})
