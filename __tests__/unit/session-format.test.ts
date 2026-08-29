import { describe, expect, it } from 'vitest'
import { formatSessionPreview, formatSessionStamp } from '../../src/components/shell/session-format'
import { shouldShowSecondaryNav } from '../../src/components/shell/SecondaryNav'

describe('session-format', () => {
  it('formatSessionStamp 今天/昨天/更早', () => {
    const now = new Date('2026-08-05T20:00:00').getTime()
    const today = new Date('2026-08-05T15:51:00').getTime()
    const yesterday = new Date('2026-08-04T15:51:00').getTime()
    const earlier = new Date('2026-06-20T15:51:00').getTime()
    expect(formatSessionStamp(today, now)).toMatch(/^今天 /)
    expect(formatSessionStamp(yesterday, now)).toMatch(/^昨天 /)
    expect(formatSessionStamp(earlier, now)).toBe('06/20(六) 15:51')
  })

  it('formatSessionPreview 截断', () => {
    expect(formatSessionPreview('你好\n世界')).toBe('你好 世界')
    expect(formatSessionPreview('a'.repeat(50)).endsWith('…')).toBe(true)
  })
})

describe('shouldShowSecondaryNav', () => {
  it('产品壳不再显示二级列，记忆与 Skills 由设置进入', () => {
    expect(shouldShowSecondaryNav('chat')).toBe(false)
    expect(shouldShowSecondaryNav('settings')).toBe(false)
    expect(shouldShowSecondaryNav('debug')).toBe(false)
    expect(shouldShowSecondaryNav('playground')).toBe(false)
    expect(shouldShowSecondaryNav('world')).toBe(false)
    expect(shouldShowSecondaryNav('moments')).toBe(false)
    expect(shouldShowSecondaryNav('memory')).toBe(false)
    expect(shouldShowSecondaryNav('skills')).toBe(false)
  })
})
