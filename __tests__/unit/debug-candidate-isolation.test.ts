import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES, DEBUG_RECORD_FIXTURES } from '../../src/components/playground/debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES } from '../../src/components/playground/debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, getDebugEvidencePage, type DebugEvidencePageId } from '../../src/components/playground/debug-evidence-fixtures'
import { PRODUCT_EXPERIENCE_REGISTRY } from '../../src/shared/product-experience-registry'

describe('Debug 候选隔离边界', () => {
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

  it('候选与样张不访问生产桥接、模型或持久化', () => {
    for (const path of PRODUCT_EXPERIENCE_REGISTRY['experience.debug'].sourcePaths.filter(path => !path.endsWith('.css'))) {
      const code = readFileSync(path, 'utf8')
      expect(code).not.toMatch(/window\.electronAPI|localStorage|fetch\s*\(|streamChat\s*\(|chatComplete\s*\(/)
      expect(code).not.toMatch(/from\s+['"][^'"]*(?:electron\/main|\/prompts\/|\/llm\/)/)
    }
  })
})
