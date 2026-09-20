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
  fs.writeFileSync(path.join(fixture.directory, 'Local State'), JSON.stringify({ os_crypt: { encrypted_key: Buffer.from('DPAPI-test-only').toString('base64') } }))
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
  it.runIf(process.platform === 'win32')('系统状态损坏时双键、单键与同步准备均拒绝且保留原配置', async () => {
    await save(oldConnections, oldRoutes)
    const before = fs.readFileSync(path.join(fixture.directory, 'my-agent.db'))
    fs.writeFileSync(path.join(fixture.directory, 'Local State'), '{')
    const notify = vi.fn()
    const stop = settings.subscribeModelConfigurationCommitted(notify)
    try {
      await expect(save(newConnections, newRoutes)).rejects.toThrow('系统安全存储')
      await expect(settings.setSetting('modelConnections', newConnections)).rejects.toThrow('系统安全存储')
      expect(() => settings.prepareSettingWrite('mcpServers', '[]')).toThrow('系统安全存储')
      expect(await read()).toEqual([oldConnections, oldRoutes])
      expect(fs.readFileSync(path.join(fixture.directory, 'my-agent.db'))).toEqual(before)
      expect(notify).not.toHaveBeenCalled()
    } finally { stop() }
  })

  it('只在模型设置成功落盘后通知，失败及无关设置不通知，取消订阅生效', async () => {
    const notify = vi.fn()
    const unsubscribe = settings.subscribeModelConfigurationCommitted(notify)
    try {
      const realPersist = database.persist
      vi.spyOn(database, 'persist').mockImplementationOnce(() => { expect(notify).not.toHaveBeenCalled(); realPersist() })
      await save(oldConnections, oldRoutes)
      expect(notify).toHaveBeenCalledTimes(1)
      notify.mockClear()
      vi.spyOn(database, 'persist').mockImplementationOnce(() => { throw new Error('fixture-failed') })
      await expect(save(newConnections, newRoutes)).rejects.toThrow()
      await settings.setSetting('companionResponseNote', '无关设置')
      expect(notify).not.toHaveBeenCalled()
      await settings.setSetting('modelRoutes', newRoutes)
      expect(notify).toHaveBeenCalledTimes(1)
      notify.mockClear()
      vi.spyOn(database, 'persist').mockImplementationOnce(() => { throw new Error('fixture-failed') })
      await expect(settings.setSetting('modelRoutes', oldRoutes)).rejects.toThrow()
      expect(notify).not.toHaveBeenCalled()
      unsubscribe()
      await save(newConnections, newRoutes)
      expect(notify).not.toHaveBeenCalled()
    } finally { unsubscribe() }
  })

  it('后台监听失败不把已提交保存变成失败，也不阻塞其他监听', async () => {
    const stopThrowing = settings.subscribeModelConfigurationCommitted(() => { throw new Error('observer') })
    const stopRejecting = settings.subscribeModelConfigurationCommitted(async () => { throw new Error('observer') })
    const notify = vi.fn()
    const stop = settings.subscribeModelConfigurationCommitted(notify)
    try {
      await expect(save(oldConnections, oldRoutes)).resolves.toBeUndefined()
      expect(await read()).toEqual([oldConnections, oldRoutes])
      expect(notify).toHaveBeenCalledTimes(1)
    } finally { stopThrowing(); stopRejecting(); stop() }
  })

  it.each(['modelConnections', 'modelRoutes'] as const)('单键 %s 写盘失败也恢复内存和磁盘原值', async key => {
    await save(oldConnections, oldRoutes)
    const before = fs.readFileSync(path.join(fixture.directory, 'my-agent.db'))
    vi.spyOn(database, 'persist').mockImplementationOnce(() => { throw new Error('fixture-disk-failed') })
    await expect(settings.setSetting(key, key === 'modelConnections' ? newConnections : newRoutes)).rejects.toThrow()
    expect(await read()).toEqual([oldConnections, oldRoutes])
    expect(fs.readFileSync(path.join(fixture.directory, 'my-agent.db'))).toEqual(before)
  })

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
