/**
 * 生活资产薄切片（衣柜穿着、文化角在读/在看/在听、进行中旅程）
 */
import { describe, expect, it } from 'vitest'
import {
  formatLifeAssetsSliceForPrompt,
  ASSET_KIND_WARDROBE,
  ASSET_KIND_CULTURE,
  ASSET_KIND_FOOTPRINT,
} from '../../electron/main/companion/life/assets'
import type { CompanionAsset } from '../../electron/main/companion/types'

describe('formatLifeAssetsSliceForPrompt', () => {
  it('无穿搭/文化/旅程时返回空串，不注入多余文字', () => {
    expect(formatLifeAssetsSliceForPrompt([])).toBe('')
  })

  it('提取当前穿搭的衣物名称', () => {
    const assets: CompanionAsset[] = [
      {
        id: 'top1',
        roleId: 'luffy',
        kind: ASSET_KIND_WARDROBE,
        name: '红色背心',
        payload: { recordType: 'garment', category: 'top' },
        acquiredAt: 1,
        sourceEventId: null,
      },
      {
        id: 'bottom1',
        roleId: 'luffy',
        kind: ASSET_KIND_WARDROBE,
        name: '蓝色短裤',
        payload: { recordType: 'garment', category: 'bottom' },
        acquiredAt: 2,
        sourceEventId: null,
      },
      {
        id: 'wear1',
        roleId: 'luffy',
        kind: ASSET_KIND_WARDROBE,
        name: '当前穿搭',
        payload: {
          recordType: 'wear-state',
          slots: { top: 'top1', bottom: 'bottom1' },
          outfitVersion: 1,
        },
        acquiredAt: 3,
        sourceEventId: null,
      },
    ]

    const slice = formatLifeAssetsSliceForPrompt(assets)
    expect(slice).toContain('- 当前穿着：红色背心、蓝色短裤')
    expect(slice).toContain('此刻的生活事实')
  })

  it('提取文化角进行中的阅读、音乐与摄影', () => {
    const assets: CompanionAsset[] = [
      {
        id: 'c1',
        roleId: 'luffy',
        kind: ASSET_KIND_CULTURE,
        name: '奇异生物图鉴',
        payload: {
          type: 'reading',
          readingStatus: 'reading',
          currentPage: 48,
          totalPages: 120,
          note: '看海兽那页折了角',
        },
        acquiredAt: 1,
        sourceEventId: null,
      },
      {
        id: 'c2',
        roleId: 'luffy',
        kind: ASSET_KIND_CULTURE,
        name: '宾克斯的美酒',
        payload: {
          type: 'music',
          listeningStatus: 'revisiting',
          note: '大合唱最来劲',
        },
        acquiredAt: 2,
        sourceEventId: null,
      },
      {
        id: 'c3',
        roleId: 'luffy',
        kind: ASSET_KIND_CULTURE,
        name: '已经看完了的空岛影像',
        payload: {
          type: 'film',
          watchStatus: 'finished', // 不是 watching，不应出现在「此刻」切片中
        },
        acquiredAt: 3,
        sourceEventId: null,
      },
    ]

    const slice = formatLifeAssetsSliceForPrompt(assets)
    expect(slice).toContain('在读《奇异生物图鉴》（第 48/120 页） · 看海兽那页折了角')
    expect(slice).toContain('在听《宾克斯的美酒》 · 大合唱最来劲')
    expect(slice).not.toContain('已经看完了的空岛影像')
  })

  it('提取进行中的旅行足迹与最新站点', () => {
    const assets: CompanionAsset[] = [
      {
        id: 't1',
        roleId: 'luffy',
        kind: ASSET_KIND_FOOTPRINT,
        name: '东海启航航线',
        payload: {
          recordType: 'trip',
          status: 'completed', // 已完成，不应作为当前进行中旅程
          stops: [{ id: 's1', name: '风车村', story: '出发' }],
        },
        acquiredAt: 1,
        sourceEventId: null,
      },
      {
        id: 't2',
        roleId: 'luffy',
        kind: ASSET_KIND_FOOTPRINT,
        name: '空岛云海探险',
        payload: {
          recordType: 'trip',
          status: 'active',
          stops: [
            { id: 's1', name: '白白海天使海滩', story: '初登空岛' },
            { id: 's2', name: '阿帕亚多黄金钟', story: '敲响黄金钟' },
          ],
        },
        acquiredAt: 2,
        sourceEventId: null,
      },
    ]

    const slice = formatLifeAssetsSliceForPrompt(assets)
    expect(slice).toContain('- 进行中的旅程：空岛云海探险（最近到过：阿帕亚多黄金钟）')
    expect(slice).not.toContain('东海启航航线')
  })
})
