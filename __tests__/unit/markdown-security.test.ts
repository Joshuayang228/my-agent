import { describe, expect, it } from 'vitest'
import { isSafeMarkdownImageSource } from '../../src/shared/markdown-security'

describe('Markdown 图片安全边界', () => {
  it('只允许有界内联位图', () => {
    expect(isSafeMarkdownImageSource('data:image/png;base64,AA==')).toBe(true)
    expect(isSafeMarkdownImageSource('data:image/webp;base64,AA==')).toBe(true)
    expect(isSafeMarkdownImageSource('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(isSafeMarkdownImageSource(`data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`)).toBe(false)
  })

  it('拒绝远程、文件和脚本协议，避免无点击外带请求', () => {
    expect(isSafeMarkdownImageSource('https://example.com/track.png?secret=x')).toBe(false)
    expect(isSafeMarkdownImageSource('file:///C:/Users/me/.ssh/id_rsa')).toBe(false)
    expect(isSafeMarkdownImageSource('javascript:alert(1)')).toBe(false)
  })
})
