/**
 * Thinking 启发式与能力缓存解析
 */
import { describe, expect, it } from 'vitest'
import { __test } from '../../electron/main/llm/thinking'

const { prefersThinkingDisabledByHeuristic, capabilityCacheKey, parseCache } = __test

describe('thinking helpers', () => {
  it('DeepSeek / Moonshot 启发式建议关 thinking', () => {
    expect(prefersThinkingDisabledByHeuristic('https://api.deepseek.com/v1', 'deepseek-v4-flash')).toBe(true)
    expect(prefersThinkingDisabledByHeuristic('https://api.moonshot.cn/v1', 'kimi-k2.5')).toBe(true)
    expect(prefersThinkingDisabledByHeuristic('https://api.openai.com/v1', 'gpt-4o')).toBe(false)
  })

  it('cache key 归一化 baseUrl', () => {
    expect(capabilityCacheKey('https://api.deepseek.com/v1/', 'DeepSeek-V4-Flash')).toBe(
      'https://api.deepseek.com/v1|deepseek-v4-flash',
    )
  })

  it('parseCache 忽略坏 JSON / 非法条目', () => {
    expect(parseCache('')).toEqual({})
    expect(parseCache('not-json')).toEqual({})
    expect(parseCache(JSON.stringify({
      a: { thinkingDisable: 'supported', probedAt: 1 },
      b: { thinkingDisable: 'nope' },
    }))).toEqual({
      a: { thinkingDisable: 'supported', probedAt: 1 },
    })
  })
})
