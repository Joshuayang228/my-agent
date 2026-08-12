/**
 * M27-G3：语气收放
 */

import { describe, it, expect } from 'vitest'
import { resolveToneControl, formatToneControlForPrompt } from '../../electron/main/agent/tone-control'
import { buildSystemPrompt, rolePackToPromptParts } from '../../electron/main/agent/prompt-builder'
import { loadRolePack } from '../../electron/main/companion/identity/loader'

describe('resolveToneControl', () => {
  it('报错高潮 → tight + discourage aside', () => {
    const t = resolveToneControl({
      stance: 'balanced',
      userText: '又崩了 TypeError: Cannot read properties',
    })
    expect(t.register).toBe('tight')
    expect(t.asidePolicy).toBe('discourage')
    expect(t.signals).toContain('error-climax')
  })

  it('confirm-all → tight', () => {
    const t = resolveToneControl({ stance: 'ask', executionMode: 'confirm-all' })
    expect(t.register).toBe('tight')
    expect(t.asidePolicy).toBe('discourage')
  })

  it('comfort → soft + encourage-once', () => {
    const t = resolveToneControl({ stance: 'comfort', userText: '好累' })
    expect(t.register).toBe('soft')
    expect(t.asidePolicy).toBe('encourage-once')
  })

  it('act → tight', () => {
    const t = resolveToneControl({ stance: 'act' })
    expect(t.register).toBe('tight')
  })

  it('注入 prompt-builder', () => {
    const pack = loadRolePack('lin')
    const tone = resolveToneControl({ stance: 'comfort' })
    const prompt = buildSystemPrompt({
      persona: rolePackToPromptParts(pack),
      toolNames: [],
      toneControlHint: formatToneControlForPrompt(tone),
    })
    expect(prompt).toContain('## 本轮语气控制')
    expect(prompt).toContain('语气档位：soft')
  })
})
