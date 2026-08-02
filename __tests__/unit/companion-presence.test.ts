import { describe, it, expect } from 'vitest'
import { buildColdStartCopy } from '../../src/shared/companion-presence'

describe('companion presence', () => {
  it('冷启动文案绑定主角名', () => {
    const copy = buildColdStartCopy({
      name: '小林',
      description: '沉稳体贴的数字伙伴',
    })
    expect(copy.title).toBe('嗨，我是小林')
    expect(copy.subtitle).toContain('沉稳体贴')
    expect(copy.hint).toContain('不能换人')
  })
})
