import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldAssetActions, emptyWorldAssetDraft, fieldsFor } from '../../src/components/world/WorldAssetEditor'
import { WorldCultureContent, type LivingAsset } from '../../src/components/world/WorldLivingContent'

const render = (assets: LivingAsset[]) => renderToStaticMarkup(createElement(WorldCultureContent, { assets }))

describe('WorldCultureContent', () => {
  it('书籍候选区分作者、状态与独立最新笔记，按时间和稳定标识排序', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      presentation: 'culture-gallery', showPreviewImages: true,
      assets: [{ id: 'book', kind: 'culture', name: '书籍', payload: { type: 'reading', author: '作者', readingStatus: 'reading', summary: '摘要不铺开' } }],
      previewReadingNotes: [
        { id: 'z', assetId: 'book', text: '旧笔记', occurredAt: 1 },
        { id: 'b', assetId: 'book', text: '同时间第二条', createdAt: 2 },
        { id: 'a', assetId: 'book', text: '最新笔记', occurredAt: 2 },
        { id: 'other', assetId: 'other', text: '其他书笔记', occurredAt: 3 },
      ],
    }))
    expect(html).toContain('data-foundation="badge"')
    expect(html).toContain('正在读')
    expect(html).toContain('reading-note-excerpt')
    expect(html).toContain('最新笔记')
    for (const value of ['旧笔记', '同时间第二条', '其他书笔记', '摘要不铺开']) expect(html).not.toContain(value)
  })

  it('四分类候选只展示书籍，不混入其他类别、归档和维护插槽', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      presentation: 'culture-gallery', showPreviewImages: true,
      assets: [
        { id: 'one', kind: 'culture', name: '同名书', payload: { type: 'reading', detail: '详情不得铺开' } },
        { id: 'two', kind: 'bookshelf', name: '同名书', payload: {} },
        { id: 'film', kind: 'culture', name: '电影不得出现', payload: { type: 'film' } },
        { id: 'archived', kind: 'culture', name: '归档不得出现', payload: { type: 'reading', visibility: 'archived' } },
      ], renderEditor: () => createElement('div', null, '编辑不得出现'),
    }))
    for (const label of ['书籍', '影视', '音乐', '摄影']) expect(html).toContain(label)
    expect(html.match(/<article /g)).toHaveLength(2)
    for (const value of ['电影不得出现', '归档不得出现', '详情不得铺开', '编辑不得出现', '>全部<']) expect(html).not.toContain(value)
  })

  it('候选必须显式启用图片样张隔离，正式默认保留维护和完整记录', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      presentation: 'culture-gallery', assets: [{ id: 'one', kind: 'culture', name: '正式记录', payload: { type: 'music', detail: '真实正文' } }],
      renderEditor: () => createElement('div', null, '正式维护'),
    }))
    expect(html).not.toContain('culture-gallery')
    expect(html).toContain('真实正文')
    expect(html).toContain('正式维护')
  })
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

  it('renderEditor 插槽出现在对应文化卡片内', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      assets: [{ id: 'reading', kind: 'culture', name: '插槽作品', payload: { type: 'reading' } }],
      renderEditor: (asset) => createElement('div', { 'data-editor': asset.id }, asset.name),
    }))
    expect(html).toContain('data-editor="reading"')
    expect(html).toContain('插槽作品')
  })
})

describe('WorldAssetEditor', () => {
  it('操作槽固定占位，文化字段包含长文笔记', () => {
    const html = renderToStaticMarkup(createElement(WorldAssetActions, {
      name: '灰蓝薄外套',
      onEdit: () => {},
      onDelete: () => {},
    }))
    expect(html).toContain('h-8')
    expect(html).toContain('w-[68px]')
    expect(fieldsFor('culture').some((field) => field.key === 'note' && field.maxLength === 4000)).toBe(true)
    expect(emptyWorldAssetDraft('footprint').payload.visitStatus).toBe('favorite')
  })
})
