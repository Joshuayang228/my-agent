/**
 * M27-G3：语气收放
 */

import { describe, it, expect } from 'vitest'
import { resolveToneControl, formatToneControlForPrompt } from '../../electron/main/agent/tone-control'
import { buildSystemPrompt, rolePackToPromptParts } from '../helpers/prompt-fixture'
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

  it('最近两轮出现过旁白时触发硬冷却 → discourage + aside-cooldown', () => {
    const t = resolveToneControl({
      stance: 'balanced',
      userText: '今天天气不错',
      recentAssistantTurns: ['普通回复', '是呀\n~>海风吹得挺舒服'],
    })
    expect(t.asidePolicy).toBe('discourage')
    expect(t.signals).toContain('aside-cooldown')
  })

  it('显式严格格式约束 → tight + discourage + strict-format 守约指引', () => {
    const en = resolveToneControl({
      stance: 'balanced',
      userText: 'Your entire response should be in all lowercase with at least 2 placeholders.',
    })
    expect(en.register).toBe('tight')
    expect(en.asidePolicy).toBe('discourage')
    expect(en.signals).toContain('strict-format')
    expect(en.guidance).toContain('格式守约')

    const zh = resolveToneControl({
      stance: 'balanced',
      userText: '只输出纯 JSON，不要解释，严禁出现多余文字。',
    })
    expect(zh.register).toBe('tight')
    expect(zh.asidePolicy).toBe('discourage')
    expect(zh.signals).toContain('strict-format')

    const casual = resolveToneControl({
      stance: 'comfort',
      userText: '今天加班好累啊，陪我聊会儿天吧',
    })
    expect(casual.register).toBe('soft')
    expect(casual.asidePolicy).toBe('encourage-once')
    expect(casual.signals).not.toContain('strict-format')
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
