import { describe, expect, it } from 'vitest'

const { getStarterAssetDefinitions } = await import('../../electron/main/companion/life/assets')
const { loadRoleWorldDefaults } = await import('../../electron/main/companion/identity/loader')

describe('伙伴生活面来源边界', () => {
  it('每个生活面的初始内容只能来自确认过的 Role Pack 世界或保持空态', () => {
    const roleIds = ['ayu', 'chen', 'hang', 'lin', 'xia', 'zhou']

    for (const roleId of roleIds) {
      const world = loadRoleWorldDefaults(roleId)
      const starters = getStarterAssetDefinitions(roleId)

      if (!world) {
        expect(starters, `${roleId} 没有 world.default.json 时必须为空态`).toEqual([])
        continue
      }

      for (const starter of starters) {
        expect(['home', 'footprint']).toContain(starter.kind)
        expect(starter.payload.seededFrom).toBe('world.default')
      }
      expect(starters.some((starter) => ['wardrobe', 'bookshelf', 'culture'].includes(starter.kind))).toBe(false)
    }
  })
})
