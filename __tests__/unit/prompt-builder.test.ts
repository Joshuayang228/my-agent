import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, BUILTIN_PERSONAS } from '../../electron/main/agent/prompt-builder'
import type { PersonaTemplate, PromptContext } from '../../electron/main/agent/prompt-builder'

const minimalPersona: PersonaTemplate = {
  id: 'test',
  name: 'Test',
  description: 'Test persona',
  protected: 'I am protected.',
  mutable: 'I am mutable.',
}

function makeCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    persona: overrides.persona ?? minimalPersona,
    toolNames: overrides.toolNames ?? ['tool_a', 'tool_b'],
    ...overrides,
  }
}

describe('buildSystemPrompt', () => {
  it('包含 PROTECTED 和 MUTABLE 区块', () => {
    const prompt = buildSystemPrompt(makeCtx())

    expect(prompt).toContain('[PROTECTED]')
    expect(prompt).toContain('I am protected.')
    expect(prompt).toContain('[/PROTECTED]')
    expect(prompt).toContain('[MUTABLE]')
    expect(prompt).toContain('I am mutable.')
    expect(prompt).toContain('[/MUTABLE]')
  })

  it('L2 层包含工具名列表', () => {
    const prompt = buildSystemPrompt(makeCtx({ toolNames: ['web_search', 'file_read'] }))

    expect(prompt).toContain('web_search')
    expect(prompt).toContain('file_read')
    expect(prompt).toContain('## Capabilities')
  })

  it('有 aside_style 时包含 Response format 段', () => {
    const persona = { ...minimalPersona, aside_style: '温柔碎碎念' }
    const prompt = buildSystemPrompt(makeCtx({ persona }))

    expect(prompt).toContain('## Response format')
    expect(prompt).toContain('<aside>')
    expect(prompt).toContain('温柔碎碎念')
  })

  it('无 aside_style 时不包含 Response format', () => {
    const prompt = buildSystemPrompt(makeCtx())
    expect(prompt).not.toContain('## Response format')
  })

  it('L3 注入用户画像', () => {
    const prompt = buildSystemPrompt(makeCtx({
      userProfile: {
        identity: 'Full-stack developer',
        workflow: 'Uses TDD',
        voice: 'Prefers concise responses',
      },
    }))

    expect(prompt).toContain('## User profile')
    expect(prompt).toContain('Full-stack developer')
    expect(prompt).toContain('Uses TDD')
    expect(prompt).toContain('Prefers concise responses')
  })

  it('L3 注入记忆上下文', () => {
    const prompt = buildSystemPrompt(makeCtx({ memories: '- User likes dark mode' }))
    expect(prompt).toContain('## Remembered context')
    expect(prompt).toContain('User likes dark mode')
  })

  it('L3 注入会话上下文', () => {
    const prompt = buildSystemPrompt(makeCtx({ sessionInfo: 'Focus on security review' }))
    expect(prompt).toContain('## Session context')
    expect(prompt).toContain('Focus on security review')
  })

  it('L4 包含动态时间戳', () => {
    const prompt = buildSystemPrompt(makeCtx())
    expect(prompt).toContain('[Dynamic Context]')
    expect(prompt).toContain('Current time:')
  })

  it('层级顺序：PROTECTED → MUTABLE → Capabilities → Profile → Memory → Session → Dynamic', () => {
    const prompt = buildSystemPrompt(makeCtx({
      persona: { ...minimalPersona, aside_style: 'test' },
      userProfile: { identity: 'dev', workflow: 'agile', voice: 'formal' },
      memories: 'some memories',
      sessionInfo: 'some session',
    }))

    const indices = [
      prompt.indexOf('[PROTECTED]'),
      prompt.indexOf('[MUTABLE]'),
      prompt.indexOf('## Capabilities'),
      prompt.indexOf('## Response format'),
      prompt.indexOf('## User profile'),
      prompt.indexOf('## Remembered context'),
      prompt.indexOf('## Session context'),
      prompt.indexOf('[Dynamic Context]'),
    ]

    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  it('BUILTIN_PERSONAS 至少有 3 个模板', () => {
    expect(BUILTIN_PERSONAS.length).toBeGreaterThanOrEqual(3)
    for (const p of BUILTIN_PERSONAS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.protected).toBeTruthy()
      expect(p.mutable).toBeTruthy()
    }
  })
})
