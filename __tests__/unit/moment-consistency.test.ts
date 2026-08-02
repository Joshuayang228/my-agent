/**
 * M24-G1：近 Moment 薄锚点 + 软一致性
 */

import { describe, it, expect } from 'vitest'
import type { CompanionMoment } from '../../electron/main/companion/types'
import {
  formatRecentMomentsForPrompt,
  checkReplyAgainstRecentMoments,
} from '../../electron/main/companion/life/moment-consistency'
import { buildSystemPrompt } from '../../electron/main/agent/prompt-builder'

function moment(partial: Partial<CompanionMoment> & { text: string }): CompanionMoment {
  return {
    id: partial.id || 'm1',
    roleId: partial.roleId || 'lin',
    eventId: partial.eventId || 'e1',
    publishedAt: partial.publishedAt ?? Date.UTC(2026, 7, 2, 12, 0),
    text: partial.text,
    meta: partial.meta ?? { location: '家' },
  }
}

describe('formatRecentMomentsForPrompt', () => {
  it('无动态返回空', () => {
    expect(formatRecentMomentsForPrompt([])).toBe('')
  })

  it('最多 3 条并含勿打脸提示', () => {
    const text = formatRecentMomentsForPrompt([
      moment({ text: '午饭散步（放松） · 附近街道', meta: { location: '附近街道' } }),
      moment({ id: 'm2', eventId: 'e2', text: '开工 · 工位', meta: { location: '工位' }, publishedAt: 1 }),
      moment({ id: 'm3', eventId: 'e3', text: '早餐 · 家', meta: { location: '家' }, publishedAt: 2 }),
      moment({ id: 'm4', eventId: 'e4', text: '更早 · 家', meta: { location: '家' }, publishedAt: 3 }),
    ], 3)
    expect(text).toContain('最近朋友圈')
    expect(text).toContain('午饭散步')
    expect(text).toContain('勿编造未发生动态')
    expect(text).toContain('避免与上列地点')
    // 第 4 条不出现
    expect(text).not.toContain('更早')
  })
})

describe('checkReplyAgainstRecentMoments', () => {
  const recent = [
    moment({ text: '宅家充电 · 家', meta: { location: '家' } }),
  ]

  it('无冲突 ok', () => {
    expect(checkReplyAgainstRecentMoments('我在家歇着，等会再出门。', recent).ok).toBe(true)
  })

  it('自称在其它地点 → warning', () => {
    const r = checkReplyAgainstRecentMoments('我现在在工位赶稿呢。', recent)
    expect(r.ok).toBe(false)
    expect(r.warnings[0]?.code).toBe('location-clash')
  })

  it('未自称在场则不误伤', () => {
    const r = checkReplyAgainstRecentMoments('工位那套流程你可以参考一下。', recent)
    expect(r.ok).toBe(true)
  })
})

describe('Assemble Recent moments', () => {
  it('buildSystemPrompt 含 Recent moments 节', () => {
    const slice = formatRecentMomentsForPrompt([
      moment({ text: '咖啡馆小憩 · 咖啡馆', meta: { location: '咖啡馆' } }),
    ])
    const prompt = buildSystemPrompt({
      persona: {
        id: 'lin',
        name: '林晚',
        description: 'x',
        protected: 'p',
        mutable: 'm',
      },
      toolNames: ['file_read'],
      recentMomentsSlice: slice,
    })
    expect(prompt).toContain('## Recent moments')
    expect(prompt).toContain('咖啡馆')
  })
})
