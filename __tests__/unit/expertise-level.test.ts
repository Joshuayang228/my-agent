/**
 * M30-G3：用户专家度 → 解释粒度
 */
import { describe, expect, it } from 'vitest'
import {
  resolveExpertiseLevel,
  formatExpertiseLevelForPrompt,
} from '../../electron/main/agent/expertise-level'
import { buildSystemPrompt } from '../../electron/main/agent/prompt-builder'

const persona = {
  id: 'lin',
  name: '小林',
  description: 't',
  protected: 'P',
  mutable: 'M',
}

describe('resolveExpertiseLevel', () => {
  it('设置覆盖优先', () => {
    const r = resolveExpertiseLevel({
      override: 'expert',
      recentUserTexts: ['我是新手能讲详细点吗'],
    })
    expect(r.level).toBe('expert')
    expect(r.fromOverride).toBe(true)
  })

  it('auto 时近窗新手信号生效', () => {
    const r = resolveExpertiseLevel({
      override: 'auto',
      recentUserTexts: ['我是新手，能通俗一点吗'],
    })
    expect(r.level).toBe('novice')
    expect(r.fromOverride).toBe(false)
  })

  it('画像专家信号', () => {
    const r = resolveExpertiseLevel({
      profileText: '资深架构师，十年后端',
    })
    expect(r.level).toBe('expert')
  })

  it('无信号 → unknown', () => {
    const r = resolveExpertiseLevel({})
    expect(r.level).toBe('unknown')
  })

  it('注入 Assemble', () => {
    const r = resolveExpertiseLevel({ override: 'novice' })
    const prompt = buildSystemPrompt({
      persona,
      toolNames: ['remember'],
      expertiseHint: formatExpertiseLevelForPrompt(r),
    })
    expect(prompt).toContain('## 解释粒度')
    expect(prompt).toContain('novice')
  })
})
