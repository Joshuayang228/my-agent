/**
 * M29-G3：敏感记忆启发式
 */
import { describe, expect, it } from 'vitest'
import {
  detectSensitiveKinds,
  formatSensitiveCollectionHint,
  formatSensitiveRememberNote,
  labelSensitiveKinds,
} from '../../src/shared/sensitive-memory'

describe('detectSensitiveKinds', () => {
  it('识别健康/财务/凭据', () => {
    expect(detectSensitiveKinds('我在吃抗抑郁的药')).toContain('health')
    expect(detectSensitiveKinds('我的年薪大概五十万')).toContain('finance')
    expect(detectSensitiveKinds('api_key=sk-abc123xyz')).toContain('credentials')
  })

  it('普通偏好不命中', () => {
    expect(detectSensitiveKinds('喜欢深色主题和短回复')).toEqual([])
  })

  it('提示文案含种类名', () => {
    const kinds = detectSensitiveKinds('身份证号不要告诉别人')
    expect(kinds).toContain('privacy_path')
    expect(formatSensitiveCollectionHint(kinds)).toContain('隐私标识')
    expect(labelSensitiveKinds(kinds)).toContain('隐私标识')
  })

  it('remember 附注使用中文并提示可删除', () => {
    const note = formatSensitiveRememberNote(['credentials'])
    expect(note).toContain('凭据')
    expect(note).toContain('记忆面板')
    expect(note).not.toContain('Memory panel')
  })
})
