import { describe, it, expect } from 'vitest'
import {
  buildColdStartCopy,
  buildReacquaintCopy,
  buildTimeOfDayGreeting,
  buildTimeOfDaySubtitle,
} from '../../src/shared/companion-presence'

describe('companion presence', () => {
  it('按时段返回亲切活人感双行问候与引导', () => {
    expect(buildTimeOfDayGreeting(7)).toBe('早上好啊')
    expect(buildTimeOfDaySubtitle(7)).toBe('新的一天，想先从哪件事开始？')
    expect(buildTimeOfDayGreeting(10)).toBe('上午好啊')
    expect(buildTimeOfDaySubtitle(10)).toBe('今天想一起做点什么？')
    expect(buildTimeOfDayGreeting(12)).toBe('中午好啊')
    expect(buildTimeOfDaySubtitle(12)).toBe('吃过饭了吗？下午打算忙点啥？')
    expect(buildTimeOfDayGreeting(15)).toBe('下午好啊')
    expect(buildTimeOfDaySubtitle(15)).toBe('歇口气，有什么想聊的随时说。')
    expect(buildTimeOfDayGreeting(20)).toBe('晚上好啊')
    expect(buildTimeOfDaySubtitle(20)).toBe('忙了一天，今晚想聊点啥？')
    expect(buildTimeOfDayGreeting(1)).toBe('夜深了')
    expect(buildTimeOfDaySubtitle(1)).toBe('还没歇着呀，陪你待一会儿。')
  })

  it('既有角色冷启动首次相遇保留人物首次宣言', () => {
    const copy = buildColdStartCopy({
      name: '路飞',
      description: '自由、直率的冒险伙伴',
      firstContact: { openingLine: '我是蒙奇·D·路飞！我要成为海贼王的男人！', quote: '我要成为海贼王的男人！' },
    })
    expect(copy.title).toContain('我要成为海贼王的男人')
    expect(copy.subtitle).toContain('路飞')
  })

  it('日常回头开聊改走温暖时段双行问候，不重复人物口号', () => {
    const copy = buildColdStartCopy({
      name: '路飞',
      description: '自由、直率的冒险伙伴',
      quote: '我是要成为海贼王的男人！',
      hour: 10,
    })
    expect(copy.title).toBe('上午好啊')
    expect(copy.subtitle).toBe('今天想一起做点什么？')
    expect(copy.subtitle).not.toContain('海贼王')
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
