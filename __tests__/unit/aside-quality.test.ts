/**
 * M27-G2：aside 频率/质量规则
 */

import { describe, it, expect } from 'vitest'
import {
  splitAside,
  parseAsideSegments,
  shouldSuppressAside,
  evaluateAsideTurn,
  evaluateAsideSequence,
  ASIDE_OILY_STREAK,
} from '../../src/shared/aside'

describe('aside quality (M27-G2)', () => {
  it('splitAside 拆主答与旁白（兼容 <aside> 与 ~> 独立行）', () => {
    const legacy = splitAside('修好了。<aside>这报错眼熟</aside>')
    expect(legacy.main).toBe('修好了。')
    expect(legacy.asides).toEqual(['这报错眼熟'])

    const ququ = splitAside('~>又要写正则了\n\n好的，帮你写一个匹配邮箱的正则。\n\n~>希望这次一次过')
    expect(ququ.main).toBe('好的，帮你写一个匹配邮箱的正则。')
    expect(ququ.asides).toEqual(['又要写正则了', '希望这次一次过'])
  })

  it('parseAsideSegments 保持原位顺序且不误切代码块', () => {
    const md = [
      '~>开头蛐蛐',
      '正文第一段',
      '```md',
      '~>代码块里的波浪线不能被切走',
      '<aside>代码块里的标签不能被切走</aside>',
      '```',
      '~>结尾蛐蛐',
    ].join('\n')
    const segs = parseAsideSegments(md)
    expect(segs.map((s) => s.type)).toEqual(['aside', 'markdown', 'aside'])
    expect(segs[0].text).toBe('开头蛐蛐')
    expect(segs[1].text).toContain('~>代码块里的波浪线不能被切走')
    expect(segs[1].text).toContain('<aside>代码块里的标签不能被切走</aside>')
    expect(segs[2].text).toBe('结尾蛐蛐')
  })

  it('shouldSuppressAside 在冷却窗口内返回 true', () => {
    expect(shouldSuppressAside([])).toBe(false)
    expect(shouldSuppressAside(['普通回复一', '普通回复二'])).toBe(false)
    expect(shouldSuppressAside(['普通回复', '搞定了\n~>三点了还在改代码'])).toBe(true)
    expect(shouldSuppressAside(['搞定了\n~>旧旁白', '普通回复一', '普通回复二'], 2)).toBe(false)
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
