import { describe, expect, it } from 'vitest'
import { hasUnsafeRegexShape } from '../../electron/main/tools/builtins/code-search'

describe('code-search 正则安全边界', () => {
  it('拒绝最常见的灾难性回溯形状和反向引用', () => {
    expect(hasUnsafeRegexShape('(a+)+$')).toBe(true)
    expect(hasUnsafeRegexShape('.*foo.*bar')).toBe(true)
    expect(hasUnsafeRegexShape('([a-z]+)\\1')).toBe(true)
  })

  it('保留普通标识符和简单正则搜索', () => {
    expect(hasUnsafeRegexShape('buildSystemPrompt')).toBe(false)
    expect(hasUnsafeRegexShape('export function \\w+')).toBe(false)
  })
})
