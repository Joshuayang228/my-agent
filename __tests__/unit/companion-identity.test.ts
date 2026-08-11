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
    expect(pack.profile).toBeUndefined()
    expect(pack.worldDefaults).toBeUndefined()
    const xia = loadRolePack('xia')
    expect(xia.name).toBe('小夏')
    expect(xia.canBeProtagonist).toBe(true)
  })

  it('候选小航读取结构化档案与默认世界，但不进入当前主角列表', () => {
    const pack = loadRolePack('hang')
    expect(pack.name).toBe('小航')
    expect(pack.profile?.schemaVersion).toBe(1)
    expect(pack.profile?.expression.directness).toBe(7)
    expect(pack.profile?.lifeAnchors).toHaveLength(0)
    expect(pack.profile?.appearance.distinguishingFeatures).toHaveLength(0)
    expect(pack.profile?.favorites.foods).toHaveLength(0)
    expect(pack.profile?.selfAwareness).toContain('人物故事未确认')
    expect(pack.worldDefaults?.schemaVersion).toBe(1)
    expect(pack.worldDefaults?.city.fictional).toBe(true)
    expect(pack.worldDefaults?.home.shortName).toBe('未设定')
    expect(pack.worldDefaults?.favoritePlaces).toHaveLength(0)
    expect(pack.worldDefaults?.possessions).toHaveLength(0)
    expect(pack.worldDefaults?.standingFacts).toHaveLength(1)
    expect(isKnownProtagonist('hang')).toBe(false)
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
