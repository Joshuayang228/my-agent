import { describe, it, expect } from 'vitest'
import { memoryTextSimilarity, normalizeMemoryText } from '../../electron/main/storage/memory-store'

describe('M08 G6 memory semantic dedup', () => {
  it('normalize 去掉空白与标点', () => {
    expect(normalizeMemoryText('Hello, World!')).toBe('helloworld')
  })

  it('完全相同文本相似度为 1', () => {
    expect(memoryTextSimilarity('喜欢咖啡', '喜欢咖啡')).toBe(1)
  })

  it('近重复文本相似度 ≥ 0.85', () => {
    const s = memoryTextSimilarity(
      '用户喜欢在早上喝美式咖啡',
      '用户喜欢在早上喝美式咖啡。',
    )
    expect(s).toBeGreaterThanOrEqual(0.85)
  })

  it('无关文本相似度较低', () => {
    const s = memoryTextSimilarity('喜欢咖啡', '明天去爬山')
    expect(s).toBeLessThan(0.85)
  })
})
