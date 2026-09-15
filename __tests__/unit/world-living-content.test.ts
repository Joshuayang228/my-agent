import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldCultureContent, type LivingAsset } from '../../src/components/world/WorldLivingContent'

const render = (assets: LivingAsset[]) => renderToStaticMarkup(createElement(WorldCultureContent, { assets }))

describe('WorldCultureContent', () => {
  it('四类中文标签、书架及笔记共享展示，不按名称丢掉不同记录', () => {
    const html = render([
      ...['reading', 'music', 'film', 'photography'].map((type) => ({ id: type, kind: 'culture', name: `作品-${type}`, payload: { type, detail: '真实摘要', note: `笔记-${type}` } })),
      { id: 'book', kind: 'bookshelf', name: '作品-reading', payload: { author: '作者', note: '独立书架笔记' } },
      { id: 'clothes', kind: 'wardrobe', name: '外套不得出现', payload: {} },
    ])
    for (const label of ['读书', '音乐', '电影', '摄影', '作者', '独立书架笔记', '笔记-reading', '笔记-music', '真实摘要']) expect(html).toContain(label)
    expect(html.match(/<article /g)).toHaveLength(5)
    expect(html.match(/<blockquote /g)).toHaveLength(2)
    expect(html).not.toContain('外套不得出现')
    expect(html).not.toContain('3 条笔记')
  })

  it('未知类型保持内容，错误字段与原型名称不会成为控件或崩溃', () => {
    const html = render([
      { id: 'unknown', kind: 'culture', name: '<script>不执行</script>', payload: { type: '__proto__', detail: { invalid: true }, note: '保留记录' } },
      { id: 'empty', kind: 'culture', name: '没有笔记的书', payload: { type: 'reading', note: '   ' } },
    ])
    expect(html).toContain('文化记录')
    expect(html).toContain('保留记录')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('[object Object]')
    expect(html).not.toContain('<blockquote')
  })

  it('真实空态不生成作品或样张笔记', () => {
    const html = render([])
    expect(html).toContain('还没有记录文化生活。')
    expect(html).not.toContain('<article')
    expect(html).not.toContain('瓦尔登湖')
  })
})
