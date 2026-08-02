/**
 * M22-G4：反思用生活薄信号格式化
 */

import { describe, it, expect } from 'vitest'
import { formatLifeSignalsForReflection } from '../../electron/main/companion/growth/life-signals'

describe('formatLifeSignalsForReflection', () => {
  it('无信号时返回空串', () => {
    expect(formatLifeSignalsForReflection({ moments: [] })).toBe('')
  })

  it('拼 Catch-up + 近动态行', () => {
    const text = formatLifeSignalsForReflection({
      catchupSummary: '这几天在工位赶稿，晚上偶尔咖啡馆。',
      moments: [
        {
          publishedAt: Date.UTC(2026, 7, 2, 10, 30),
          text: '午饭散步（放松） · 附近街道',
        },
        {
          publishedAt: Date.UTC(2026, 7, 2, 4, 0),
          text: '清晨咖啡（清醒） · 家',
        },
      ],
    })
    expect(text).toContain('【追赶】这几天在工位赶稿')
    expect(text).toContain('【近动态】')
    expect(text).toContain('午饭散步（放松）')
    expect(text).toContain('清晨咖啡（清醒）')
  })

  it('截断过长 catchup / moment 文案', () => {
    const text = formatLifeSignalsForReflection({
      catchupSummary: '啊'.repeat(300),
      moments: [{ publishedAt: Date.now(), text: '动'.repeat(200) }],
    })
    expect(text.includes('啊'.repeat(201))).toBe(false)
    expect(text.includes('动'.repeat(121))).toBe(false)
  })
})
