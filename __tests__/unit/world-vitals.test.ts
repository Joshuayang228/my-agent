/**
 * 角色生命体征（mood / energy / socialNeed）演化单测
 */
import { describe, expect, it } from 'vitest'
import {
  deriveVitalsDelta,
  applyVitalsDelta,
  releaseSocialNeedAfterChat,
} from '../../electron/main/companion/life/world-vitals'

describe('deriveVitalsDelta', () => {
  it('睡眠或打盹大幅恢复精力', () => {
    const delta = deriveVitalsDelta('在甲板太阳椅上午睡')
    expect(delta.energy).toBeGreaterThanOrEqual(20)
    expect(delta.mood).toBeGreaterThanOrEqual(0)
  })

  it('吃烤肉或宴会大幅提升心情与精力，满足社交需求', () => {
    const delta = deriveVitalsDelta('草帽一伙举办大烤肉宴会')
    expect(delta.mood).toBe(5)
    expect(delta.energy).toBe(8)
    expect(delta.socialNeed).toBe(-4)
  })

  it('训练、冒险或探险消耗精力但提升心情', () => {
    const delta = deriveVitalsDelta('和索隆在草坪甲板上特训')
    expect(delta.energy).toBeLessThan(0)
    expect(delta.mood).toBeGreaterThan(0)
  })

  it('守夜或值班消耗精力', () => {
    const delta = deriveVitalsDelta('在千阳号狮子船头瞭望守夜')
    expect(delta.energy).toBe(-6)
  })

  it('默认普通日常活动微幅消耗精力并随时间累加社交需求', () => {
    const delta = deriveVitalsDelta('在甲板走走看看')
    expect(delta.energy).toBe(-3)
    expect(delta.socialNeed).toBe(3)
  })
})

describe('applyVitalsDelta', () => {
  it('向基线回归并叠加增量，且保证数值在 [0, 100] 范围内', () => {
    // 初始高精力 90，经历了剧烈战斗冒险活动
    const current = { mood: 65, energy: 90, socialNeed: 30 }
    const next = applyVitalsDelta(current, { mood: 5, energy: -20, socialNeed: 5 })
    expect(next.mood).toBe(70)
    expect(next.energy).toBeLessThan(90)
    expect(next.socialNeed).toBe(35)
  })

  it('精力保持下限避免跌入不可动弹状态', () => {
    const current = { mood: 30, energy: 10, socialNeed: 50 }
    const next = applyVitalsDelta(current, { mood: -10, energy: -20, socialNeed: 10 })
    expect(next.energy).toBeGreaterThanOrEqual(8)
  })
})

describe('releaseSocialNeedAfterChat', () => {
  it('对话后释放社交渴望并稍微提振心情', () => {
    const current = { mood: 60, energy: 70, socialNeed: 75 }
    const next = releaseSocialNeedAfterChat(current)
    expect(next.socialNeed).toBe(60)
    expect(next.mood).toBe(62)
    expect(next.energy).toBe(70)
  })

  it('社交需求释放有下限，避免清零到完全冷漠', () => {
    const current = { mood: 80, energy: 80, socialNeed: 12 }
    const next = releaseSocialNeedAfterChat(current)
    expect(next.socialNeed).toBe(10)
  })
})
