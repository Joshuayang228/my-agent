import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldAssetActions, emptyWorldAssetDraft, fieldsFor, draftFromAsset, payloadFromDraft } from '../../src/components/world/WorldAssetEditor'
import { WorldCultureContent, WorldHomeContent, homeRecordsForRole, travelRecordsForRole, type LivingAsset } from '../../src/components/world/WorldLivingContent'
import { homeObjectsForSpace } from '../../src/components/world/WorldHomeGallery'

const render = (assets: LivingAsset[]) => renderToStaticMarkup(createElement(WorldCultureContent, { assets }))

describe('正式旅行投影与维护', () => {
  it('只显示本角色有效且已出发的旅行，不把旧地点转换成旅行', () => {
    const trip = (id: string, payload: Record<string, unknown>, roleId = 'lin'): LivingAsset => ({ id, roleId, kind: 'footprint', name: id, payload: { recordType: 'trip', destination: '苏州', status: 'active', start: '2026-09-26', ...payload } })
    expect(travelRecordsForRole([
      trip('valid', { stops: [{ id: 'stop', name: '小巷', story: '雨后散步' }] }),
      trip('foreign', {}, 'yao'), trip('planned', { status: 'planned' }),
      trip('cancelled', { status: 'cancelled' }), trip('invalid', { start: '2026-02-30' }),
      trip('place', { recordType: 'place' }), trip('unfinished', { status: 'completed' }),
    ], 'lin').map(item => item.id)).toEqual(['valid'])
  })
  it('旅行草稿保留停留 ID 和多条正文，进行中不保存旧结束日期', () => {
    const draft = draftFromAsset({ kind: 'footprint', name: '旅行', payload: { status: 'completed', start: '2026-09-26', end: '2026-09-27', destination: '苏州', story: '旅行故事', stops: [{ id: 'one', name: '老城', story: '第一段' }, { id: 'two', date: '2026-09-27', name: '园林', story: '第二段' }] } }, 'travel-gallery')
    expect(payloadFromDraft(draft)).toMatchObject({ recordType: 'trip', stops: [{ id: 'one', name: '老城', story: '第一段' }, { id: 'two', date: '2026-09-27', name: '园林', story: '第二段' }] })
    draft.payload.status = 'active'
    expect(payloadFromDraft(draft).end).toBeNull()
  })
})

describe('正式家居资产投影', () => {
  it('家居维护草稿保留空间类型、结构化依据与布尔展示值，支持解除归属', () => {
    const room = draftFromAsset({ kind: 'home', name: '卧室', payload: { recordType: 'space', residenceId: 'house', description: '房间描述' } }, 'home-gallery')
    expect(payloadFromDraft(room)).toEqual({ recordType: 'space', residenceId: 'house', description: '房间描述' })
    const object = draftFromAsset({ kind: 'furniture', name: '杯子', payload: { spaceId: 'room', description: '说明', originNote: '礼物', displayInHome: true, displayReason: '常用', displayEvidence: ['故事', '习惯'] } }, 'home-gallery')
    expect(payloadFromDraft(object)).toMatchObject({ spaceId: 'room', displayInHome: true, displayEvidence: ['故事', '习惯'], originNote: '礼物' })
    object.payload.spaceId = ''
    object.payload.displayInHome = 'false'
    expect(payloadFromDraft(object)).toMatchObject({ spaceId: null, displayInHome: false })
  })
  const owned = (id: string, kind: string, payload: Record<string, unknown>, roleId = 'role'): LivingAsset => ({ id, kind, name: id, payload, roleId })
  it('只读取所属角色、同住所空间和有依据物件；失效空间引用归入未归置', () => {
    const view = homeRecordsForRole([
      owned('house', 'home', { recordType: 'residence' }),
      owned('room', 'home', { recordType: 'space', residenceId: 'house' }),
      owned('other-house-room', 'home', { recordType: 'space', residenceId: 'other-house' }),
      owned('foreign', 'home', { recordType: 'space' }, 'another'),
      owned('meaningful', 'furniture', { spaceId: 'room', displayInHome: true, displayReason: '常在这里读书', displayEvidence: ['习惯记录'] }),
      owned('missing-room', 'furniture', { spaceId: 'deleted', displayInHome: true, displayReason: '家人的礼物', displayEvidence: ['来历'] }),
      owned('ordinary', 'furniture', { spaceId: 'room', displayInHome: true }),
      owned('book', 'bookshelf', { displayInHome: true, displayReason: '故事', displayEvidence: ['故事'] }),
    ], 'role')
    expect(view.spaces.map(item => item.id)).toEqual(['room'])
    expect(homeObjectsForSpace(view.objects, 'room').map(item => item.id)).toEqual(['meaningful'])
    expect(homeObjectsForSpace(view.objects, 'unassigned').map(item => item.id)).toEqual(['missing-room'])
    expect(homeRecordsForRole(view.owned, undefined).owned).toEqual([])
  })
  it('正式家居不读取样张地址，不把当前活动放进总览，保留真实住所维护', () => {
    const html = renderToStaticMarkup(createElement(WorldHomeContent, {
      presentation: 'home-gallery', roleId: 'role', presence: '当前活动不展示',
      assets: [owned('house', 'home', { playgroundImageSrc: 'https://fixture.invalid/image.png' })],
      renderEditor: asset => createElement('span', null, `维护-${asset.id}`),
    }))
    expect(html).toContain('home-gallery')
    expect(html).toContain('维护-house')
    expect(html).toContain('暂无配图')
    expect(html).not.toContain('fixture.invalid')
    expect(html).not.toContain('当前活动不展示')
  })
})

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

  it('未显式采用画廊的调用方保留维护和完整记录', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      assets: [{ id: 'one', kind: 'culture', name: '正式记录', payload: { type: 'music', detail: '真实正文' } }],
      renderEditor: () => createElement('div', null, '正式维护'),
    }))
    expect(html).not.toContain('culture-gallery')
    expect(html).toContain('真实正文')
    expect(html).toContain('正式维护')
  })
  it('正式入口显式采用画廊，读取持久化笔记但不读取样张图片或样张笔记', () => {
    const html = renderToStaticMarkup(createElement(WorldCultureContent, {
      presentation: 'culture-gallery', assets: [{ id: 'book', kind: 'culture', name: '真实书籍', payload: { type: 'reading', readingNotes: [{ id: 'real-note', text: '保存的读书笔记' }], playgroundImageSrc: 'https://sample.invalid/cover.png' } }],
      previewReadingNotes: [{ id: 'fixture', assetId: 'book', text: '隔离笔记不得读入' }],
    }))
    expect(html).toContain('culture-gallery')
    expect(html).toContain('保存的读书笔记')
    expect(html).not.toContain('sample.invalid')
    expect(html).not.toContain('隔离笔记不得读入')
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
  it('正式衣柜维护分类与完整套装槽位，不把槽位字段当作短标签保存', () => {
    const draft = draftFromAsset({ id: 'outfit', kind: 'wardrobe', name: '套装', payload: { recordType: 'outfit', slots: { top: 't', bottom: 'b', outerwear: 'o', shoes: 's' } } }, 'wardrobe-gallery')
    expect(draft.payload['slot:top']).toBe('t')
    draft.payload['slot:outerwear'] = ''
    expect(payloadFromDraft(draft)).toEqual({ recordType: 'outfit', slots: { top: 't', bottom: 'b', shoes: 's' } })
    expect(fieldsFor('wardrobe', 'wardrobe-gallery', 'garment').map(field => field.key)).toContain('category')
  })
  it('正式文化草稿维护多条稳定笔记和数字进度，旧笔记只迁移一次', () => {
    const draft = draftFromAsset({ id: 'book', kind: 'bookshelf', name: '书籍', payload: { note: '旧笔记', currentPage: 12, totalPages: 100, readingStatus: 'reading' } }, 'culture-gallery')
    expect(draft.readingNotes).toEqual([{ id: 'book:note', text: '旧笔记' }])
    draft.readingNotes!.push({ id: 'second', text: '新笔记', page: 13, chapter: '第二章', createdAt: 10 })
    expect(payloadFromDraft(draft)).toMatchObject({ currentPage: 12, totalPages: 100, readingStatus: 'reading', readingNotes: draft.readingNotes })
    draft.readingNotes = []
    draft.payload.currentPage = ''
    expect(payloadFromDraft(draft)).toMatchObject({ currentPage: null, readingNotes: [] })
  })
  it('正式文化维护按类别提供字段，观后感和听感共用展示原文字段', () => {
    const draft = draftFromAsset({ kind: 'culture', name: '旧电影', payload: { type: 'film', author: '旧导演', summary: '旧观后感' } }, 'culture-gallery')
    expect(draft.payload).toMatchObject({ director: '旧导演', detail: '旧观后感' })
    draft.payload.director = '新导演'
    draft.payload.detail = ''
    expect(payloadFromDraft(draft)).toMatchObject({ director: '新导演', detail: '', author: null, summary: null })
    expect(fieldsFor('culture', 'culture-gallery', undefined, 'film').map(field => field.key)).toEqual(['name', 'type', 'director', 'mediaKind', 'watchStatus', 'detail'])
    expect(fieldsFor('culture', 'culture-gallery', undefined, 'music').map(field => field.key)).toEqual(['name', 'type', 'artist', 'musicKind', 'listeningStatus', 'detail'])
    expect(fieldsFor('culture', 'culture-gallery', undefined, 'photography').map(field => field.key)).toContain('locationName')
  })
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
