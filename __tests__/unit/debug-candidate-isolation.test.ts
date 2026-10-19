import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugEvidenceCandidate, type EvidencePreviewState } from '../../src/components/playground/DebugEvidenceCandidate'
import { DebugScheduleCandidate, type SchedulePreviewState } from '../../src/components/playground/DebugScheduleCandidate'
import { DebugNowCandidate, type NowPreviewState } from '../../src/components/playground/DebugNowCandidate'
import { DebugCharacterCandidate, type CharacterPreviewState } from '../../src/components/playground/DebugCharacterCandidate'
import { DebugLocationCandidate, type LocationPreviewState } from '../../src/components/playground/DebugLocationCandidate'
import { DebugPromptCandidate, type PromptPreviewState } from '../../src/components/playground/DebugPromptCandidate'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES, DEBUG_RECORD_FIXTURES } from '../../src/components/playground/debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES, debugAssetGroup } from '../../src/components/playground/debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, getDebugEvidencePage, type DebugEvidencePageId } from '../../src/components/playground/debug-evidence-fixtures'
import { PRODUCT_EXPERIENCE_REGISTRY } from '../../src/shared/product-experience-registry'

describe('Debug 候选隔离边界', () => {
  it('位置快照不补造未读 / 缺失地点，解析回退与移动历史分开', () => {
    const before = JSON.stringify(DEBUG_EVIDENCE_PAGES.location)
    const render = (previewState: LocationPreviewState, initialSelectedId?: string, empty = false) => renderToStaticMarkup(createElement(DebugLocationCandidate, { previewState, snapshotState: 'fallback', initialSelectedId, empty, onRetry: () => {}, onAsset: () => {}, onPage: () => {} }))
    for (const state of ['unread', 'loading', 'unavailable', 'error', 'missing'] as const) {
      expect(render(state)).not.toContain('data-record-id=')
      expect(render(state)).not.toContain('0 条')
      expect(render(state)).not.toContain('未补造默认地点')
    }
    expect(render('ready', undefined, true)).toContain('未补造默认地点')
    expect(render('ready', 'demo-not-found')).toContain('未选择替代记录')
    expect(render('unset')).toContain('世界更新时间未记录')
    expect(render('unset')).not.toContain('1970')
    expect(render('fallback')).toContain('不代表实际位置已知')
    const refresh = render('refresh-error', 'demo-location-current')
    expect(refresh).toContain('保留上次位置快照')
    expect(refresh).toContain('不代表实际位置已知')
    expect(refresh).toContain('旧结构地点')
    expect(refresh).toContain('更新时间不是到达时间')
    expect(render('long', 'demo-location-current')).toContain('长位置细节样张')
    expect(JSON.stringify(DEBUG_EVIDENCE_PAGES.location)).toBe(before)
    expect(DEBUG_EVIDENCE_PAGES.location.items[0].location?.currentLocation).toBe(DEBUG_EVIDENCE_PAGES.now.items[0].now?.location)
    expect(DEBUG_EVIDENCE_PAGES.location.items[0].links).toBeUndefined()
    expect(DEBUG_EVIDENCE_PAGES.location.items[0].relatedPages?.map(link => link.page)).toEqual(['now', 'residence', 'footprints'])
  })
  it('人物定义缺口、读取失败与历史证据分开，长文和未知字段不丢失', () => {
    const before = JSON.stringify(DEBUG_EVIDENCE_PAGES.character)
    const render = (previewState: CharacterPreviewState, initialSelectedId?: string, empty = false) => renderToStaticMarkup(createElement(DebugCharacterCandidate, { previewState, snapshotState: 'partial', initialSelectedId, empty, onRetry: () => {}, onAsset: () => {}, onPage: () => {} }))
    for (const state of ['unread', 'loading', 'unavailable', 'error', 'missing'] as const) {
      expect(render(state)).not.toContain('data-record-id=')
      expect(render(state)).not.toContain('0 条')
      expect(render(state)).not.toContain('未补造人物设定')
    }
    expect(render('ready', undefined, true)).toContain('未补造人物设定')
    expect(render('ready', 'demo-not-found')).toContain('未选择替代人物')
    expect(render('ready', 'demo-character-yu')).toContain('详细人物资料未提供')
    expect(render('empty-profile')).toContain('已读取空资料结构')
    expect(render('partial')).toContain('未提供')
    expect(render('refresh-error', 'demo-character-lin')).toContain('保留上次资料')
    expect(render('refresh-error', 'demo-character-lin')).not.toContain('生活记录者 · 样张设定')
    const long = render('long', 'demo-character-lin')
    expect(long).toContain('完整简介')
    expect(long).toContain('额外资料字段也完整保留')
    expect(long).toContain('不是当前心情或模型参数')
    expect(long).not.toContain('查看实际阅读记录')
    expect(JSON.stringify(DEBUG_EVIDENCE_PAGES.character)).toBe(before)
    expect(DEBUG_EVIDENCE_PAGES.character.items[0].links).toBeUndefined()
    expect(DEBUG_EVIDENCE_PAGES.character.items[0].relatedPages?.map(value => value.page)).toEqual(['growth', 'items'])
  })
  it('此刻不补造未读或缺失快照，数值与暂停遵守生产语义', () => {
    const render = (previewState: NowPreviewState, empty = false, initialSelectedId?: string) => renderToStaticMarkup(createElement(DebugNowCandidate, { previewState, snapshotState: 'paused', empty, initialSelectedId, onRetry: () => {}, onPage: () => {} }))
    for (const state of ['unread', 'loading', 'unavailable', 'error', 'missing'] as const) {
      const html = render(state)
      expect(html).not.toContain('debug-now-summary')
      expect(html).not.toContain('65 · 样张值')
      expect(html).not.toContain('正常运行')
    }
    expect(render('ready', true)).toContain('未补造默认世界')
    expect(render('ready', false, 'demo-missing')).toContain('未选择替代快照')
    expect(render('paused')).toContain('生活推进已暂停')
    expect(render('refresh-error')).toContain('生活推进已暂停')
    expect(render('fallback')).toContain('不代表已存世界')
    expect(render('unset')).toContain('更新时间未记录')
    expect(render('unset')).not.toContain('1970')
    const expanded = render('ready', false, 'demo-now-lin')
    expect(expanded).toContain('65 · 样张值')
    expect(expanded).not.toContain('0.65')
    expect(DEBUG_EVIDENCE_PAGES.now.items[0].now?.activity).toBe('整理旅行照片')
    expect(DEBUG_EVIDENCE_PAGES.now.items[0].links).toBeUndefined()
    expect(DEBUG_EVIDENCE_PAGES.now.items[0].relatedPages?.map(link => link.page)).toEqual(['location', 'schedule'])
  })
  it('行为日志候选对齐现有事件源，不将 Trace 和反思伪装成主列表', () => {
    const events = getDebugEvidencePage('recent', DEBUG_RECORD_FIXTURES).items
    const activity = getDebugEvidencePage('activity', DEBUG_RECORD_FIXTURES).items
    expect(activity.map(entry => entry.id)).toEqual(events.map(entry => entry.id))
    for (const entry of activity) {
      expect(entry.links).toContainEqual({ page: 'recent', id: entry.id, label: '查看来源生活事件' })
      expect(entry.callId).toBeUndefined()
    }
    const render = (previewState: EvidencePreviewState) => renderToStaticMarkup(createElement(DebugEvidenceCandidate, { id: 'activity', previewState, records: DEBUG_RECORD_FIXTURES, empty: false, onAsset: () => {}, onRecord: () => {}, onEvidence: () => {} }))
    const ready = render('ready')
    expect(ready).toContain('完整行动日志尚未建立')
    expect(ready).toContain('河边散步')
    expect(ready).not.toContain('demo-action-reflection')
    expect(ready).not.toContain('demo-action-tool')
    const failed = render('error')
    expect(failed).toContain('行为证据读取失败')
    expect(failed).not.toContain('data-record-id=')
    expect(failed).not.toContain('行为证据范围计数')
  })
  it('最近事项只统计已读范围，未读取和未知时间不补造事实', () => {
    const render = (previewState: EvidencePreviewState, initialSelectedId?: string) => renderToStaticMarkup(createElement(DebugEvidenceCandidate, { id: 'recent', previewState, initialSelectedId, records: DEBUG_RECORD_FIXTURES, empty: false, onAsset: () => {}, onRecord: () => {}, onEvidence: () => {} }))
    for (const state of ['unread', 'loading', 'unavailable', 'error'] as const) {
      const html = render(state)
      expect(html).not.toContain('事项范围计数')
      expect(html).not.toContain('此范围没有记录')
      expect(html).not.toContain('data-record-id=')
    }
    const ready = render('ready')
    expect(ready).toContain('3 条已读取')
    expect(ready).toContain('总数未知')
    expect(ready.indexOf('河边散步')).toBeLessThan(ready.indexOf('阅读旅行笔记'))
    expect(ready).not.toContain('翻到上次旅途')
    expect(render('unknown-time')).toContain('时间未记录')
    const history = render('ready', 'demo-event-book')
    expect(history).toContain('value="2026-10-12"')
    expect(history).toContain('aria-label="领域证据详情"')
    expect(history).toContain('此事项未保存正文')
    expect(render('missing')).not.toContain('data-record-id=')
  })
  it('日程未读取不生成零条结论，历史引用按人物和日期定位', () => {
    const render = (previewState: SchedulePreviewState, initialSelectedId?: string) => renderToStaticMarkup(createElement(DebugScheduleCandidate, { previewState, initialSelectedId, empty: false, onRetry: () => {}, onEvidence: () => {} }))
    for (const state of ['unread', 'loading', 'unavailable', 'error'] as const) {
      const html = render(state)
      expect(html).not.toContain('计划时段计数')
      expect(html).not.toContain('此范围没有记录')
      expect(html).not.toContain('data-record-id=')
    }
    const history = render('ready', 'demo-slot-yesterday')
    expect(history).toContain('value="2026-10-12"')
    expect(history).toContain('aria-label="领域证据详情"')
    expect(history).toContain('10:00 · 整理书架')
    expect(history).not.toContain('14:00 · 阅读旅行笔记')
    expect(render('ready', 'demo-slot-yu')).toContain('value="yu" selected=""')
    expect(render('ready', 'demo-missing')).not.toContain('aria-label="领域证据详情"')
    expect(render('invalid')).toContain('没有可读取的计划时段')
  })
  it('提示词首次未读取与局部失败不冒充成功空结果', () => {
    const render = (previewState: PromptPreviewState) => renderToStaticMarkup(createElement(DebugPromptCandidate, { previewState, empty: false, selectedKey: 'demo.prompt.main', onSelect: () => {}, records: DEBUG_RECORD_FIXTURES, onRecord: () => {} }))
    for (const state of ['unread', 'unavailable', 'loading', 'error'] as const) {
      const html = render(state)
      expect(html).not.toContain('此范围没有资产')
      expect(html).not.toContain('debug-prompt-directory')
      expect(html).not.toContain('相关调用 · 0')
      expect(html).toContain('disabled=""')
    }
    const usage = render('usage-error')
    expect(usage).toContain('和用户共同整理')
    expect(usage).toContain('相关调用 · 未读取')
    expect(usage).not.toContain('此范围内没有关联调用')
    expect(render('missing')).toContain('引用的资产未在目录中找到')
  })
  it('领域默认只读当前人物，首屏不混入另一人物画像及来源分类', () => {
    const html = renderToStaticMarkup(createElement(DebugEvidenceCandidate, {
      id: 'profile', records: DEBUG_RECORD_FIXTURES, empty: false,
      onAsset: () => {}, onRecord: () => {}, onEvidence: () => {},
    }))
    expect(html).toContain('data-record-id="demo-profile-lin"')
    expect(html).not.toContain('data-record-id="demo-profile-yu"')
    expect(html).toContain('先看结论，再看依据')
    expect(html).not.toContain('identity + fact')
    expect(html).not.toContain('buildUserProfile(lin)')
  })
  it('显式关联昨日记录时按目标日期定位，未知目标不伪造详情', () => {
    const render = (initialSelectedId: string) => renderToStaticMarkup(createElement(DebugEvidenceCandidate, {
      id: 'schedule', records: DEBUG_RECORD_FIXTURES, empty: false, initialSelectedId,
      onAsset: () => {}, onRecord: () => {}, onEvidence: () => {},
    }))
    const yesterday = render('demo-slot-yesterday')
    expect(yesterday).toContain('value="2026-10-12"')
    expect(yesterday).toContain('aria-label="领域证据详情"')
    expect(yesterday).toContain('10:00 · 整理书架')
    expect(yesterday).not.toContain('14:00 · 阅读旅行笔记')
    const unknown = render('demo-missing-target')
    expect(unknown).toContain('value="2026-10-13"')
    expect(unknown).not.toContain('aria-label="领域证据详情"')
  })

  it('样张身份不冒充生产资产，关联不悬空', () => {
    const keys = new Set(DEBUG_ASSET_FIXTURES.map(asset => asset.key))
    expect(keys.size).toBe(DEBUG_ASSET_FIXTURES.length)
    for (const asset of DEBUG_ASSET_FIXTURES) {
      expect(asset.key).toMatch(/^demo\./)
      expect(asset.fingerprint).toMatch(/^demo:/)
      expect(asset).not.toHaveProperty('text')
      expect(asset.preview).toMatch(/^【隔离/)
    }
    for (const record of DEBUG_RECORD_FIXTURES) {
      expect(record.id).toMatch(/^demo-/)
      expect(record.sessionId).toMatch(/^demo-/)
      for (const key of record.assetKeys) expect(keys.has(key)).toBe(true)
      expect(record).not.toHaveProperty('messages')
    }
  })

  it('所有分区有领域数据；资产、请求和跨页关联不悬空', () => {
    expect(new Set(DEBUG_PERSPECTIVES.map(view => view.id)).size).toBe(DEBUG_PERSPECTIVES.length)
    expect(new Set(DEBUG_PERSPECTIVES.map(view => view.group))).toEqual(new Set(DEBUG_GROUPS))
    const specialized = ['assets', 'runs', 'quality', 'persona', 'system']
    expect(DEBUG_PERSPECTIVES.filter(view => !specialized.includes(view.id)).map(view => view.id).sort()).toEqual(Object.keys(DEBUG_EVIDENCE_PAGES).sort())
    const assetKeys = new Set(DEBUG_ASSET_FIXTURES.map(asset => asset.key))
    const callIds = new Set(DEBUG_RECORD_FIXTURES.map(record => record.id))
    for (const id of Object.keys(DEBUG_EVIDENCE_PAGES) as DebugEvidencePageId[]) {
      const page = getDebugEvidencePage(id, DEBUG_RECORD_FIXTURES)
      expect(page.boundary.length).toBeGreaterThan(10)
      expect(page.items.length).toBeGreaterThan(0)
      expect(new Set(page.items.map(entry => entry.id)).size).toBe(page.items.length)
      for (const entry of page.items) {
        expect(entry.id).toMatch(/^demo-/)
        for (const key of entry.assets ?? []) expect(assetKeys.has(key)).toBe(true)
        if (entry.callId) expect(callIds.has(entry.callId)).toBe(true)
        for (const link of entry.links ?? []) expect(getDebugEvidencePage(link.page, DEBUG_RECORD_FIXTURES).items.some(value => value.id === link.id)).toBe(true)
      }
    }
  })

  it('本项目六生活面各有明确入口，住所、物件、旅行与文化记录不混型', () => {
    const labels = new Set(DEBUG_PERSPECTIVES.map(view => view.label))
    for (const label of ['朋友圈', '衣柜', '文化角', '家居', '通讯录', '足迹']) expect(labels.has(label)).toBe(true)
    const home = DEBUG_EVIDENCE_PAGES.residence.items
    expect(home.some(entry => entry.fields.some(([key, value]) => key === '记录类型' && value === 'space'))).toBe(true)
    expect(home.some(entry => entry.fields.some(([key, value]) => key === '家居展示' && value === 'displayInHome = false'))).toBe(true)
    expect(DEBUG_EVIDENCE_PAGES.items.items.some(entry => entry.id === 'demo-item-camera')).toBe(false)
    expect(home.some(entry => entry.id === 'demo-item-camera')).toBe(true)
    const planned = DEBUG_EVIDENCE_PAGES.footprints.items.find(entry => entry.id === 'demo-trip-planned')!
    expect(planned.fields).toContainEqual(['正式足迹展示', '不纳入实际旅行'])
    expect(DEBUG_EVIDENCE_PAGES.footprints.items.find(entry => entry.id === 'demo-footprint-place')?.fields).toContainEqual(['访问日期', '未记录'])
  })

  it('运行中快照的调用链和实时事件不沿用最终失败；无 Span 不生成节点', () => {
    const pending = DEBUG_RECORD_FIXTURES.map((record, index) => index ? record : { ...record, status: 'pending' as const, stages: record.stages.slice(0, 1) })
    const traces = getDebugEvidencePage('traces', pending)
    expect(traces.items.find(entry => entry.id === 'demo-span-03')?.status).toBe('运行中')
    expect(traces.items.find(entry => entry.id === 'demo-span-03')?.body).not.toContain('服务返回失败')
    expect(traces.items.some(entry => entry.callId === 'demo-call-01')).toBe(false)
    expect(getDebugEvidencePage('traces', []).items).toEqual([])
    expect(getDebugEvidencePage('events', pending).items.find(entry => entry.id === 'demo-runtime-error')?.status).toBe('运行中')
  })

  it('人物用途来自显式关联，平台共用与未登记不冒充注入', () => {
    const main = DEBUG_ASSET_FIXTURES.find(asset => asset.key === 'demo.prompt.main')!
    const identity = DEBUG_ASSET_FIXTURES.find(asset => asset.key === 'demo.prompt.identity')!
    expect(debugAssetGroup(main, 'all')).toBe('平台 / 行为')
    expect(debugAssetGroup(main, 'lin')).toBe('行为')
    expect(debugAssetGroup(main, 'yu')).toBe('平台共用')
    expect(debugAssetGroup(identity, 'lin')).toBe('身份')
    expect(debugAssetGroup({ ...identity, uses: undefined }, 'lin')).toBe('未登记关联')
    for (const asset of DEBUG_ASSET_FIXTURES) {
      for (const role of Object.keys(asset.uses ?? {})) expect(['lin', 'yu']).toContain(role)
    }
  })

  it('阅读摘要复用原字段；家居父子、旅行状态与停留有明确结构', () => {
    for (const page of Object.values(DEBUG_EVIDENCE_PAGES)) for (const entry of page.items) {
      for (const field of entry.readingFields ?? []) expect(entry.fields).toContainEqual(field)
    }
    const home = DEBUG_EVIDENCE_PAGES.residence.items
    for (const entry of home) if (entry.home?.parentId) {
      expect(home.some(parent => parent.id === entry.home!.parentId && parent.role === entry.role)).toBe(true)
    }
    const trips = DEBUG_EVIDENCE_PAGES.footprints.items
    expect(trips.find(entry => entry.id === 'demo-trip-completed')?.travel?.stops?.[0]).toMatchObject({ id: 'demo-stop-river', date: '2026-10-10' })
    expect(trips.find(entry => entry.id === 'demo-trip-planned')?.travel?.kind).toBe('planned')
    expect(trips.find(entry => entry.id === 'demo-footprint-place')?.travel?.kind).toBe('place')
  })

  it('候选与样张不访问生产桥接、模型或持久化', () => {
    for (const path of PRODUCT_EXPERIENCE_REGISTRY['experience.debug'].sourcePaths.filter(path => !path.endsWith('.css'))) {
      const code = readFileSync(path, 'utf8')
      expect(code).not.toMatch(/window\.electronAPI|localStorage|fetch\s*\(|streamChat\s*\(|chatComplete\s*\(/)
      expect(code).not.toMatch(/from\s+['"][^'"]*(?:electron\/main|\/prompts\/|\/llm\/)/)
    }
  })
})
