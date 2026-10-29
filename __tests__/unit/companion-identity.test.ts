import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  getDefaultProtagonistId,
  getUniversesRoot,
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
    expect(m.defaultProtagonistId).toBe('luffy')
    expect(m.protagonistIds).toEqual(['luffy'])
  })

  it('listProtagonists 返回已挂满的 3 个主角槽', () => {
    const list = listProtagonists('default')
    expect(list.map((r) => r.id)).toEqual(['luffy'])
    expect(list[0].name).toBe('路飞')
    expect(isKnownProtagonist('luffy')).toBe(true)
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
    expect(pack.protected).toContain('不能只确认路径就承诺执行')
    expect(pack.voice).toContain('不要只让用户给自己的卡点分类')
    expect(pack.voice).toContain('备份、回收站或其他恢复方式')
    expect(pack.mutableDefault).toContain('中性的可逆动作')
    expect(pack.worldDefaults?.schemaVersion).toBe(1)
    expect(pack.worldDefaults?.city.fictional).toBe(true)
    expect(pack.worldDefaults?.home.shortName).toBe('未设定')
    expect(pack.worldDefaults?.favoritePlaces).toHaveLength(0)
    expect(pack.worldDefaults?.possessions).toHaveLength(0)
    expect(pack.worldDefaults?.standingFacts).toHaveLength(1)
    expect(isKnownProtagonist('hang')).toBe(false)
  })

  it('路飞默认世界把千里阳光号和草帽作为可追踪出厂事实', () => {
    const world = loadRolePack('luffy').worldDefaults
    expect(world?.home.shortName).toBe('千里阳光号')
    expect(world?.initialLocation).toBe('千里阳光号')
    expect(world?.possessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'straw-hat', name: '草帽', kind: 'symbolic-item' }),
    ]))
  })

  it('路飞稳定身份不把平台术语写成自我介绍', () => {
    const pack = loadRolePack('luffy')
    expect(pack.protected.split('\n')[0]).toBe('你是路飞，一个自由、直率、重视伙伴的冒险伙伴。')
    expect(pack.protected).not.toContain('数字')
    expect(pack.profile?.selfAwareness).not.toContain('数字')
  })

  it('路飞档案关联基础衣物视觉参考，图片属于 Role Pack 资产', () => {
    const profile = loadRolePack('luffy').profile
    expect(profile?.appearance.visualReferencePath).toBe('visual/wardrobe-initial-v1.png')
    expect(fs.existsSync(path.join(getUniversesRoot(), 'default', 'roles', 'luffy', profile!.appearance.visualReferencePath!))).toBe(true)
    expect(profile?.appearance.visualReferencePaths).toEqual(['visual/wardrobe-initial-v1.png', 'visual/thousand-sunny-crew-scene-v1.png'])
    expect(profile?.appearance.visualReferencePaths?.every(reference => fs.existsSync(path.join(getUniversesRoot(), 'default', 'roles', 'luffy', reference)))).toBe(true)
  })

  it('未知角色校验', () => {
    expect(isKnownProtagonist('luffy')).toBe(true)
    expect(isKnownProtagonist('warm-partner')).toBe(false)
    expect(getDefaultProtagonistId()).toBe('luffy')
  })

  it('缺失 pack 抛错', () => {
    expect(() => loadRolePack('does-not-exist')).toThrow(/not found/)
  })
})
