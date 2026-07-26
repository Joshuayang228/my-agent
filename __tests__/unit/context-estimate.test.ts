import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  stripImagesForCompression,
} from '../../electron/main/agent/context-manager'
import type { ChatMessage } from '../../src/shared/types'

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
    expect(out[0].content).toContain('2 image(s) stripped')
    expect(out[0].content).toContain('see this')
  })

  it('无图片时原样返回', () => {
    const input = [msg({ content: 'plain' })]
    expect(stripImagesForCompression(input)[0]).toEqual(input[0])
  })
})
