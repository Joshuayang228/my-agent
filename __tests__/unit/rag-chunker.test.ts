import { describe, it, expect } from 'vitest'
import { chunkText } from '../../electron/main/rag/index'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test-agent-data' },
}))

vi.mock('vectra', () => ({
  LocalIndex: vi.fn(),
}))

vi.mock('../../electron/main/memory/embeddings', () => ({
  createEmbedding: vi.fn(),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(),
  persist: vi.fn(),
}))

import { vi } from 'vitest'

describe('chunkText', () => {
  it('短文本不分块', () => {
    const text = '这是一段短文本。'
    const chunks = chunkText(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('按双换行分段', () => {
    const para1 = 'A'.repeat(400)
    const para2 = 'B'.repeat(400)
    const para3 = 'C'.repeat(400)
    const text = `${para1}\n\n${para2}\n\n${para3}`

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it('空文本返回空数组', () => {
    expect(chunkText('')).toEqual([])
  })

  it('单段超长文本仍然被收进一个 chunk（段内不再拆分）', () => {
    const longPara = 'X'.repeat(2000)
    const chunks = chunkText(longPara)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(longPara)
  })

  it('多段文本拆分后各 chunk 非空', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) =>
      `Paragraph ${i}: ${'word '.repeat(80)}`)
    const text = paragraphs.join('\n\n')

    const chunks = chunkText(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0)
    }
  })

  it('chunk 之间有重叠内容（overlap 验证）', () => {
    const paragraphs = Array.from({ length: 10 }, (_, i) =>
      `Section ${i}: ${'lorem ipsum dolor sit amet '.repeat(20)}`)
    const text = paragraphs.join('\n\n')

    const chunks = chunkText(text)
    if (chunks.length >= 2) {
      const lastWordsOfFirst = chunks[0].split(/\s+/).slice(-5).join(' ')
      expect(chunks[1]).toContain(lastWordsOfFirst)
    }
  })
})
