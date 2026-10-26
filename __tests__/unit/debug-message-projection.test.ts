import { describe, expect, it } from 'vitest'
import { normalizeDebugMessages } from '../../src/components/debug/debug-format'
import { messageScope } from '../../src/components/debug/saved-context'

describe('LLM 消息保存长度投影', () => {
  it('正文占位保留原长度和零值，不数占位字符或还原正文', () => {
    for (const length of [0, 4096]) {
      const source = [{ role: 'system', content: '（正文未持久化）', contentLength: length }], before = JSON.stringify(source)
      const result = normalizeDebugMessages(source)[0]
      expect(result.contentLength).toBe(length)
      expect(result.content).toBe('（正文未持久化）')
      expect(messageScope({ content: result.content, contentLength: result.contentLength })).toBe(`正文未持久化 · 保存长度 ${length} 字符`)
      expect(JSON.stringify(source)).toBe(before)
    }
  })
  it('缺失、负数、非整数、非有限或不安全长度保持未知', () => {
    for (const length of [undefined, -1, 1.5, '4096', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const result = normalizeDebugMessages([{ role: 'user', content: '（正文未持久化）', contentLength: length }])[0]
      expect(result.contentLength).toBeUndefined()
      expect(messageScope({ content: result.content, contentLength: result.contentLength })).toBe('正文未持久化 · 长度未记录')
    }
  })
})
