import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { homeObjectsForSpace, WorldHomeGallery, type HomeObjectPreview } from '../../src/components/world/WorldHomeGallery'

describe('家居候选展示边界', () => {
  const meaningful: HomeObjectPreview = { id: 'story-sofa', name: '窗边沙发', spaceId: 'living', displayInHome: true, displayReason: '共同回忆', displayEvidence: ['fixture:event'] }
  it('只消费有依据的显式选择，不按名称或类别列出所有物件', () => {
    const objects = [meaningful, { ...meaningful, id: 'ordinary-sofa', displayInHome: false },
      { ...meaningful, id: 'missing-reason', displayReason: ' ' },
      { ...meaningful, id: 'missing-evidence', displayEvidence: [] },
      { ...meaningful, id: 'undecided', displayInHome: undefined }]
    expect(homeObjectsForSpace(objects, 'living')).toEqual([meaningful])
    expect(objects).toHaveLength(5)
    expect(homeObjectsForSpace(objects, 'bedroom')).toEqual([])
  })
  it('未归置只收显式选择，隐藏记录不产生入口', () => {
    const object = { ...meaningful, spaceId: null }
    expect(homeObjectsForSpace([object], 'unassigned')).toEqual([object])
    const html = renderToStaticMarkup(createElement(WorldHomeGallery, { spaces: [], objects: [{ ...object, displayInHome: false }], overviewImage: '/sample.png' }))
    expect(html).not.toContain('未归置')
  })
  it('总览只有鸟瞰图片，不混入物件或维护表单', () => {
    const html = renderToStaticMarkup(createElement(WorldHomeGallery, { spaces: [{ id: 'living', name: '客厅' }], objects: [meaningful], overviewImage: '/sample.png' }))
    expect(html).toContain('住所鸟瞰图')
    expect(html).not.toContain('home-object-card')
    expect(html).not.toContain('窗边沙发')
    expect(html).not.toContain('<input')
  })
  it('空家居与读取失败有独立反馈', () => {
    expect(renderToStaticMarkup(createElement(WorldHomeGallery, { spaces: [], objects: [] }))).toContain('还没有记录居住空间')
    expect(renderToStaticMarkup(createElement(WorldHomeGallery, { spaces: [], objects: [], readError: '请重试' }))).toContain('家居记录未能读取')
  })
})
