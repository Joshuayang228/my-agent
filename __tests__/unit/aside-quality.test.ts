/**
 * M27-G2：aside 频率/质量规则
 */

import { describe, it, expect } from 'vitest'
import {
  splitAside,
  evaluateAsideTurn,
  evaluateAsideSequence,
  ASIDE_OILY_STREAK,
} from '../../src/shared/aside'

describe('aside quality (M27-G2)', () => {
  it('splitAside 拆主答与旁白', () => {
    const { main, asides } = splitAside('修好了。<aside>这报错眼熟</aside>')
    expect(main).toBe('修好了。')
    expect(asides).toEqual(['这报错眼熟'])
  })

  it('合格短旁白通过', () => {
    const v = evaluateAsideTurn('先改校验逻辑，再跑测试。\n<aside>呼，终于顺了</aside>')
    expect(v.pass).toBe(true)
    expect(v.hasAside).toBe(true)
  })

  it('有 aside 但主答过短失败', () => {
    const v = evaluateAsideTurn('<aside>全靠旁白告诉你改 foo.ts</aside>')
    expect(v.pass).toBe(false)
    expect(v.violations.some((x) => x.includes('主答过短'))).toBe(true)
  })

  it('aside 含代码块视为夺权', () => {
    const v = evaluateAsideTurn('嗯。<aside>```ts\nconst x=1\n```</aside>')
    expect(v.pass).toBe(false)
    expect(v.violations.some((x) => x.includes('代码块'))).toBe(true)
  })

  it('连续多轮 aside 过油', () => {
    const oily = [
      'ok <aside>a</aside>',
      'ok <aside>b</aside>',
      'ok <aside>c</aside>',
    ]
    const v = evaluateAsideSequence(oily)
    expect(v.maxStreak).toBeGreaterThanOrEqual(ASIDE_OILY_STREAK)
    expect(v.pass).toBe(false)
    expect(v.violations.some((x) => x.includes('过油'))).toBe(true)
  })

  it('稀疏 aside 序列通过', () => {
    const good = [
      '步骤：1) 读日志 2) 定位 3) 修复并验证结果。',
      '继续排查根因，先复现。<aside>这味道不对</aside>',
      '已修好，建议跑一遍回归。',
      '补充：边界用例也过了。',
      '收工。',
    ]
    const v = evaluateAsideSequence(good)
    expect(v.pass).toBe(true)
    expect(v.maxStreak).toBeLessThan(ASIDE_OILY_STREAK)
  })
})
