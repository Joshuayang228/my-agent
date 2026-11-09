import { describe, expect, it } from 'vitest'
import {
  getRoleVisualDataUrl,
  getRoleVisuals,
  listProtagonists,
  loadRolePack,
} from '../../electron/main/companion/identity/loader'

describe('companion role visuals & atmosphere', () => {
  it('路飞出厂角色包具备专属头像与横幅，并成功转换为 base64 dataUrl', () => {
    const pack = loadRolePack('luffy')
    expect(pack.avatarVisualPath).toBe('visual/avatar-v1.png')
    expect(pack.bannerVisualPath).toBe('visual/banner-v1.png')
    expect(pack.themeColor).toBe('#E65100')

    const visuals = getRoleVisuals('luffy')
    expect(visuals.roleId).toBe('luffy')
    expect(visuals.roleName).toBe('路飞')
    expect(visuals.themeColor).toBe('#E65100')
    expect(visuals.avatarDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(visuals.avatarDataUrl!.length).toBeGreaterThan(1000)
    expect(visuals.bannerDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(visuals.bannerDataUrl!.length).toBeGreaterThan(1000)
  })

  it('草帽团其他角色（索隆、娜美、山治、乌索普）均具备专属头像与人设主题色', () => {
    const cast = ['zoro', 'nami', 'sanji', 'usopp']
    for (const roleId of cast) {
      const pack = loadRolePack(roleId)
      expect(pack.avatarVisualPath).toBe('visual/avatar-v1.png')
      expect(pack.themeColor).toBeTruthy()

      const visuals = getRoleVisuals(roleId)
      expect(visuals.avatarDataUrl).toMatch(/^data:image\/png;base64,/)
      expect(visuals.themeColor).toBe(pack.themeColor)
    }
  })

  it('读取不存在或非法的视觉路径时静默降级为 null，不抛出异常', () => {
    const invalidUrl = getRoleVisualDataUrl('luffy', 'visual/not-exist-xyz.png')
    expect(invalidUrl).toBeNull()

    const traversalUrl = getRoleVisualDataUrl('luffy', '../../secrets.png')
    expect(traversalUrl).toBeNull()
  })

  it('连续多次调用命中内存缓存', () => {
    const first = getRoleVisualDataUrl('luffy', 'visual/avatar-v1.png')
    const second = getRoleVisualDataUrl('luffy', 'visual/avatar-v1.png')
    expect(first).toBe(second)
  })

  it('listProtagonists 列表项包含已预热的 avatarDataUrl 与 bannerDataUrl', () => {
    const protagonists = listProtagonists()
    expect(protagonists.length).toBeGreaterThan(0)
    const luffy = protagonists.find((p) => p.id === 'luffy')
    expect(luffy).toBeDefined()
    expect(luffy?.avatarDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(luffy?.bannerDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(luffy?.themeColor).toBe('#E65100')
  })
})
