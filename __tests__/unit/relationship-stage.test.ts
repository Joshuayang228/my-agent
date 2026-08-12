/**
 * M28-G1：relationshipStage 推导与 Prompt 注入
 */
import { describe, expect, it } from 'vitest'
import {
  resolveRelationshipStage,
  formatRelationshipStageForPrompt,
} from '../../electron/main/companion/growth/relationship-stage'
import { buildSystemPrompt } from '../../electron/main/agent/prompt-builder'
import { COLD_START_MS, MIN_USER_MESSAGES } from '../../electron/main/companion/growth/reflection-gate'

const HOUR = 3600_000
const now = 1_700_000_000_000

const persona = {
  id: 'lin',
  name: '小林',
  description: 'test',
  protected: 'P',
  mutable: 'M',
}

describe('resolveRelationshipStage', () => {
  it('召唤会话强制陌生', () => {
    const r = resolveRelationshipStage({
      growthStartedAt: now - 30 * 24 * HOUR,
      lastRunAt: now - HOUR,
      recentUserMessages: 99,
      now,
      sessionKind: 'summon',
    })
    expect(r.stage).toBe('stranger')
    expect(r.signals).toContain('summon-guest')
  })

  it('冷启动窗内为陌生', () => {
    const r = resolveRelationshipStage({
      growthStartedAt: now - 24 * HOUR,
      lastRunAt: 0,
      recentUserMessages: 20,
      now,
    })
    expect(r.stage).toBe('stranger')
    expect(r.signals).toContain('cold-start-window')
  })

  it('过了 72h 但消息不足仍为陌生', () => {
    const r = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: 0,
      recentUserMessages: MIN_USER_MESSAGES - 1,
      now,
    })
    expect(r.stage).toBe('stranger')
    expect(r.signals).toContain('insufficient-messages')
  })

  it('过门闸且未反思 → 熟悉', () => {
    const r = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: 0,
      recentUserMessages: MIN_USER_MESSAGES,
      now,
    })
    expect(r.stage).toBe('familiar')
  })

  it('已有反思 → 默契', () => {
    const r = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: now - 48 * HOUR,
      recentUserMessages: 10,
      now,
    })
    expect(r.stage).toBe('rapport')
    expect(r.signals).toContain('has-reflection')
  })

  it('注入 Assemble 含 Relationship stage', () => {
    const stage = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: 0,
      recentUserMessages: 8,
      now,
    })
    const prompt = buildSystemPrompt({
      persona,
      toolNames: ['remember'],
      relationshipStageHint: formatRelationshipStageForPrompt(stage),
    })
    expect(prompt).toContain('## 关系阶段')
    expect(prompt).toContain('familiar')
  })
})
