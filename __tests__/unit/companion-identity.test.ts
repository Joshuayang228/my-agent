import { describe, it, expect } from 'vitest'
import {
  getDefaultProtagonistId,
  isKnownProtagonist,
  listProtagonists,
  loadRolePack,
  loadUniverseManifest,
} from '../../electron/main/companion/identity/loader'

describe('companion identity loader', () => {
  it('加载 default 宇宙 manifest', () => {
    const m = loadUniverseManifest('default')
    expect(m.id).toBe('default')
    expect(m.plannedProtagonistSlots).toBe(3)
    expect(m.defaultProtagonistId).toBe('lin')
    expect(m.protagonistIds).toContain('lin')
  })

  it('listProtagonists 返回已挂满的 3 个主角槽', () => {
    const list = listProtagonists('default')
    expect(list.map((r) => r.id)).toEqual(['lin', 'zhou', 'xia'])
    expect(list[0].name).toBe('小林')
    expect(list[1].name).toBe('小周')
    expect(list[2].name).toBe('小夏')
    expect(isKnownProtagonist('xia')).toBe(true)
  })

  it('loadRolePack 读出 protected / mutable（含第三槽 xia）', () => {
    const pack = loadRolePack('lin')
    expect(pack.protected.length).toBeGreaterThan(20)
    expect(pack.mutableDefault.length).toBeGreaterThan(10)
    expect(pack.canBeProtagonist).toBe(true)
    const xia = loadRolePack('xia')
    expect(xia.name).toBe('小夏')
    expect(xia.canBeProtagonist).toBe(true)
  })

  it('未知角色校验', () => {
    expect(isKnownProtagonist('lin')).toBe(true)
    expect(isKnownProtagonist('warm-partner')).toBe(false)
    expect(getDefaultProtagonistId()).toBe('lin')
  })

  it('缺失 pack 抛错', () => {
    expect(() => loadRolePack('does-not-exist')).toThrow(/not found/)
  })
})
