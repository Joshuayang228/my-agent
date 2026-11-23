import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateRequestTokens,
  pruneHistoricalToolResults,
  stripImagesForCompression,
} from '../../electron/main/agent/context-manager'
import type { ChatMessage, ToolDefinition } from '../../src/shared/types'

function msg(partial: Partial<ChatMessage> & { content: string }): ChatMessage {
  return {
    id: partial.id ?? 'm1',
    role: partial.role ?? 'user',
    content: partial.content,
    timestamp: Date.now(),
    images: partial.images,
    toolCalls: partial.toolCalls,
  }
}

describe('estimateTokens G13', () => {
  it('中文比同等长度 ASCII 估得更高', () => {
    const ascii = estimateTokens([msg({ content: 'a'.repeat(100) })])
    const cjk = estimateTokens([msg({ content: '中'.repeat(100) })])
    expect(cjk).toBeGreaterThan(ascii)
  })

  it('图片计入占位 token', () => {
    const noImg = estimateTokens([msg({ content: 'hi' })])
    const withImg = estimateTokens([msg({
      content: 'hi',
      images: [{ dataUrl: 'data:image/png;base64,xx', mimeType: 'image/png' }],
    })])
    expect(withImg).toBeGreaterThan(noImg + 500)
  })

  it('完整请求预算包含工具 schema', () => {
    const tool: ToolDefinition = {
      name: 'file_write',
      description: '写入一个文件并保存内容',
      parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      execute: async () => 'ok',
    }
    expect(estimateRequestTokens([msg({ content: '创建文件' })], [tool]))
      .toBeGreaterThan(estimateTokens([msg({ content: '创建文件' })]))
  })
})

describe('stripImagesForCompression G5', () => {
  it('剥离 images 并写入占位文案', () => {
    const input = [msg({
      content: 'see this',
      images: [
        { dataUrl: 'data:image/png;base64,aa', mimeType: 'image/png' },
        { dataUrl: 'data:image/png;base64,bb', mimeType: 'image/png' },
      ],
    })]
    const out = stripImagesForCompression(input)
    expect(out[0].images).toBeUndefined()
    expect(out[0].content).toContain('压缩前已移除 2 张图片')
    expect(out[0].content).toContain('see this')
  })

  it('无图片时原样返回', () => {
    const input = [msg({ content: 'plain' })]
    expect(stripImagesForCompression(input)[0]).toEqual(input[0])
  })
})

describe('pruneHistoricalToolResults', () => {
  it('只修剪历史工具结果并保留最近结果', () => {
    const long = 'x'.repeat(13_000)
    const messages: ChatMessage[] = [
      msg({ role: 'system', content: 'sys' }),
      msg({ role: 'tool', content: long }),
      ...Array.from({ length: 6 }, (_, index) => msg({ role: index % 2 ? 'assistant' : 'user', content: 'recent' })),
      msg({ role: 'tool', content: long }),
    ]
    const result = pruneHistoricalToolResults(messages)
    expect(result[1].content).toContain('历史工具结果已修剪')
    expect(result.at(-1)?.content).toBe(long)
  })
})
