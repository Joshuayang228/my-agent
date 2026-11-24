import { describe, it, expect } from 'vitest'
import {
  buildColdStartCopy,
  buildReacquaintCopy,
  buildTimeOfDayGreeting,
} from '../../src/shared/companion-presence'

describe('companion presence', () => {
  it('按时段返回亲切活人感问候', () => {
    expect(buildTimeOfDayGreeting(7)).toBe('早上好啊')
    expect(buildTimeOfDayGreeting(10)).toBe('上午好啊')
    expect(buildTimeOfDayGreeting(12)).toBe('中午好啊')
    expect(buildTimeOfDayGreeting(15)).toBe('下午好啊')
    expect(buildTimeOfDayGreeting(20)).toBe('晚上好啊')
    expect(buildTimeOfDayGreeting(1)).toBe('夜深了，还没歇着呀')
  })

  it('无 quote 角色回退简介并采用时段问候标题', () => {
    const copy = buildColdStartCopy({
      name: '小林',
      description: '沉稳体贴的数字伙伴',
      hour: 10,
    })
    expect(copy.title).toBe('上午好啊')
    expect(copy.subtitle).toContain('沉稳体贴')
    expect(copy).not.toHaveProperty('hint')
  })

  it('既有角色冷启动优先使用人物首次宣言', () => {
    const copy = buildColdStartCopy({
      name: '路飞',
      description: '自由、直率的冒险伙伴',
      firstContact: { openingLine: '我是蒙奇·D·路飞！我要成为海贼王的男人！', quote: '我要成为海贼王的男人！' },
    })
    expect(copy.title).toContain('我要成为海贼王的男人')
    expect(copy.subtitle).toContain('路飞')
  })

  it('常规空态首屏采用时段问候标题并优先展示角色第一人称台词 quote', () => {
    const copy = buildColdStartCopy({
      name: '路飞',
      description: '自由、直率的冒险伙伴',
      quote: '我是要成为海贼王的男人！',
      hour: 10,
    })
    expect(copy.title).toBe('上午好啊')
    expect(copy.subtitle).toBe('我是要成为海贼王的男人！')
  })

  it('换角再认识文案：换视角非重开，且点名双方', () => {
    const copy = buildReacquaintCopy({
      fromName: '小林',
      toName: '小周',
      catchupQueued: true,
    })
    expect(copy.title).toContain('小周')
    expect(copy.body).toContain('小林')
    expect(copy.body).toMatch(/不是重开|成长时钟/)
    expect(copy.toast).toContain('成长未重置')
    expect(copy.title).not.toBe('嗨，我是小周')
  })

  it('无 catchup 时仍强调非教程重开', () => {
    const copy = buildReacquaintCopy({ fromName: '小林', toName: '小夏' })
    expect(copy.toast).toContain('不是重开')
    expect(copy.body).toContain('成长与记忆')
  })
})
