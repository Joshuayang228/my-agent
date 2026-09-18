import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const fixture = vi.hoisted(() => ({ directory: '', encryption: true }))
vi.mock('electron', () => ({
  app: { getPath: () => fixture.directory },
  safeStorage: {
    isEncryptionAvailable: () => fixture.encryption,
    encryptString: (value: string) => Buffer.from(`fixture:${value}`),
    decryptString: (value: Buffer) => value.toString().slice('fixture:'.length),
  },
}))
import * as database from '../../electron/main/storage/database'
import * as settings from '../../electron/main/storage/settings-store'

const oldConnections = JSON.stringify([{ id: 'old', apiKey: 'fixture-secret' }])
const oldRoutes = JSON.stringify([{ connectionId: 'old' }])
const newConnections = JSON.stringify([{ id: 'new', apiKey: 'fixture-new' }])
const newRoutes = JSON.stringify([{ connectionId: 'new' }])
beforeEach(async () => {
  fixture.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-model-config-'))
  fixture.encryption = true
  await settings.ensureTable()
})
afterEach(() => {
  vi.restoreAllMocks()
  database._resetDatabaseForTests()
  fs.rmSync(fixture.directory, { recursive: true, force: true })
})
const read = async () => [await settings.getSetting('modelConnections'), await settings.getSetting('modelRoutes')]
const save = (connections: string, routes: string) => settings.saveModelConfiguration({ connections, routes })

describe('模型配置整组真实 SQLite 持久化', () => {
  it('两个字段一次落盘，密文存储且重新打开恢复同一组', async () => {
    const persist = vi.spyOn(database, 'persist')
    await save(oldConnections, oldRoutes)
    expect(persist).toHaveBeenCalledTimes(1)
    const db = await database.getDatabase()
    expect(String(db.exec("SELECT value FROM settings WHERE key='modelConnections'")[0].values[0][0])).not.toContain('fixture-secret')
    database.closeDatabase()
    expect(await read()).toEqual([oldConnections, oldRoutes])
  })
  it.each([false, true])('落盘失败恢复两键的原始存在状态，已有值=%s', async (existing) => {
    if (existing) await save(oldConnections, oldRoutes)
    const file = path.join(fixture.directory, 'my-agent.db')
    const before = fs.readFileSync(file)
    vi.spyOn(database, 'persist').mockImplementationOnce(() => { throw new Error('fixture-disk-failed') })
    await expect(save(newConnections, newRoutes)).rejects.toThrow('模型配置保存失败')
    expect(await read()).toEqual(existing ? [oldConnections, oldRoutes] : ['[]', '[]'])
    expect(fs.readFileSync(file)).toEqual(before)
    if (!existing) expect((await database.getDatabase()).exec("SELECT key FROM settings WHERE key IN ('modelConnections','modelRoutes')")).toEqual([])
    await save(newConnections, newRoutes)
    database.closeDatabase()
    expect(await read()).toEqual([newConnections, newRoutes])
  })
  it('第二条 SQL 失败恢复第一条，且不写盘', async () => {
    await save(oldConnections, oldRoutes)
    const db = await database.getDatabase()
    db.run("CREATE TRIGGER fail_route BEFORE UPDATE ON settings WHEN NEW.key='modelRoutes' AND NEW.value LIKE '%new%' BEGIN SELECT RAISE(ABORT,'fixture-route-failure'); END")
    const persist = vi.spyOn(database, 'persist')
    await expect(save(newConnections, newRoutes)).rejects.toThrow('模型配置保存失败')
    expect(await read()).toEqual([oldConnections, oldRoutes])
    expect(persist).not.toHaveBeenCalled()
  })
  it('真实 export 后文件替换失败，内存恢复旧组且重开仍为旧组', async () => {
    await save(oldConnections, oldRoutes)
    const file = path.join(fixture.directory, 'my-agent.db')
    const before = fs.readFileSync(file)
    vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('fixture-file-locked') })
    await expect(save(newConnections, newRoutes)).rejects.toThrow('原配置已保留')
    expect(await read()).toEqual([oldConnections, oldRoutes])
    expect(fs.readFileSync(file)).toEqual(before)
    database.closeDatabase()
    expect(await read()).toEqual([oldConnections, oldRoutes])
  })
  it('加密不可用或载荷超限时不得开始写入', async () => {
    await save(oldConnections, oldRoutes)
    const db = await database.getDatabase()
    const before = db.exec('SELECT key,value FROM settings ORDER BY key')
    fixture.encryption = false
    await expect(save(newConnections, newRoutes)).rejects.toThrow()
    expect(db.exec('SELECT key,value FROM settings ORDER BY key')).toEqual(before)
    fixture.encryption = true
    await expect(save('x'.repeat(settings.MAX_SETTING_VALUE_LENGTH + 1), newRoutes)).rejects.toThrow()
    expect(await read()).toEqual([oldConnections, oldRoutes])
  })
})
