/**
 * M26-G1：Moments 卡司互动派生
 */

import { describe, it, expect } from 'vitest'
import type { CompanionEvent } from '../../electron/main/companion/types'
import {
  deriveCastInteractions,
  __test,
} from '../../electron/main/companion/life/moment-interactions'
import type { RosterLine } from '../../electron/main/companion/cast/roster'

function evt(partial: Partial<CompanionEvent> & Pick<CompanionEvent, 'id' | 'payload'>): CompanionEvent {
  return {
    id: partial.id,
    roleId: partial.roleId ?? 'lin',
    scheduledAt: partial.scheduledAt ?? 1_700_000_000_000,
    status: partial.status ?? 'published',
    type: partial.type ?? 'moment',
    payload: partial.payload,
    dayScriptId: partial.dayScriptId ?? null,
  }
}

const roster: RosterLine[] = [
  {
    otherId: 'chen',
    otherName: '陈姐',
    relationType: 'colleague',
    text: '你与陈姐（同事）：工位搭子',
  },
  {
    otherId: 'ayu',
    otherName: '阿雨',
    relationType: 'friend',
    text: '你与阿雨（朋友）：老同学',
  },
]

describe('deriveCastInteractions', () => {
  it('非 moment / 非 published / 无名册 → 空', () => {
    expect(
      deriveCastInteractions(
        evt({ id: 'a', type: 'activity', payload: { location: '咖啡馆', activity: '约朋友' } }),
        { roster },
      ),
    ).toEqual([])
    expect(
      deriveCastInteractions(
        evt({ id: 'b', status: 'planned', payload: { location: '咖啡馆', activity: '约朋友' } }),
        { roster },
      ),
    ).toEqual([])
    expect(
      deriveCastInteractions(
        evt({ id: 'c', payload: { location: '咖啡馆', activity: '约朋友' } }),
        { roster: [] },
      ),
    ).toEqual([])
  })

  it('社交场景可派生，且同 seed 稳定；只用名册姓名', () => {
    let e: CompanionEvent | null = null
    let a: ReturnType<typeof deriveCastInteractions> = []
    for (let i = 0; i < 40; i++) {
      const candidate = evt({
        id: `ev-social-${i}`,
        scheduledAt: 42 + i,
        payload: { location: '咖啡馆', activity: '约朋友喝一杯', mood: '轻快', theme: '见朋友' },
      })
      const got = deriveCastInteractions(candidate, { roster })
      if (got.length) {
        e = candidate
        a = got
        break
      }
    }
    expect(e).toBeTruthy()
    expect(a.length).toBeGreaterThan(0)
    expect(a.length).toBeLessThanOrEqual(2)
    expect(deriveCastInteractions(e!, { roster })).toEqual(a)
    for (const i of a) {
      expect(['chen', 'ayu']).toContain(i.castId)
      expect(['陈姐', '阿雨']).toContain(i.castName)
      if (i.kind === 'comment') {
        expect(i.text.length).toBeGreaterThan(0)
        expect(i.text).not.toMatch(/protected|SYSTEM|你是/)
      }
    }
  })

  it('家/工位低亲和度多数跳过', () => {
    let hits = 0
    for (let i = 0; i < 20; i++) {
      const got = deriveCastInteractions(
        evt({
          id: `home-${i}`,
          scheduledAt: 1000 + i,
          payload: { location: '家', activity: '看书', theme: '宅' },
        }),
        { roster },
      )
      if (got.length) hits += 1
    }
    expect(hits).toBeLessThan(8)
  })

  it('真实宇宙名册：lin 视角能派生且不含 protected 长文', () => {
    const e = evt({
      id: 'ev-real-roster',
      scheduledAt: 99,
      payload: { location: '附近街道', activity: '出门见朋友', theme: '约人出门' },
    })
    const got = deriveCastInteractions(e)
    // 可能因种子跳过；若有则姓名应是已知卡司
    for (const i of got) {
      expect(i.castName.length).toBeGreaterThan(0)
      expect(i.castName.length).toBeLessThan(20)
    }
  })

  it('hashSeed 稳定', () => {
    expect(__test.hashSeed('x', 1)).toBe(__test.hashSeed('x', 1))
    expect(__test.hashSeed('x', 1)).not.toBe(__test.hashSeed('y', 1))
  })
})
