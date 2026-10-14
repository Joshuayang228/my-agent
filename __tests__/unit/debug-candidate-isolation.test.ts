import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugEvidenceCandidate } from '../../src/components/playground/DebugEvidenceCandidate'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES, DEBUG_RECORD_FIXTURES } from '../../src/components/playground/debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES, debugAssetGroup } from '../../src/components/playground/debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, getDebugEvidencePage, type DebugEvidencePageId } from '../../src/components/playground/debug-evidence-fixtures'
import { PRODUCT_EXPERIENCE_REGISTRY } from '../../src/shared/product-experience-registry'

describe('Debug 候选隔离边界', () => {
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
