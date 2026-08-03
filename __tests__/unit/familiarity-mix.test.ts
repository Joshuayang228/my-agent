/**
 * M28-G2：交心 vs 干活熟悉度混合
 */
import { describe, expect, it } from 'vitest'
import {
  classifyFamiliarityLabel,
  resolveFamiliarityMix,
  formatFamiliarityMixForPrompt,
} from '../../electron/main/companion/growth/familiarity-mix'
import { resolveRelationshipStage } from '../../electron/main/companion/growth/relationship-stage'
import { COLD_START_MS, MIN_USER_MESSAGES } from '../../electron/main/companion/growth/reflection-gate'

const now = 1_700_000_000_000
const HOUR = 3600_000

describe('classifyFamiliarityLabel', () => {
  it('识别交心', () => {
    expect(classifyFamiliarityLabel('今天好累，想找人聊聊')).toBe('bond')
  })

  it('识别干活', () => {
    expect(classifyFamiliarityLabel('这个 TypeError 帮我改一下 npm test')).toBe('task')
  })

  it('情绪+催办仍算 bond', () => {
    expect(classifyFamiliarityLabel('好累，直接帮我改代码')).toBe('bond')
  })
})

describe('resolveFamiliarityMix', () => {
  it('样本不足 → sparse', () => {
    const m = resolveFamiliarityMix(['hello'])
    expect(m.lean).toBe('sparse')
  })

  it('多数干活 → task-leaning', () => {
    const m = resolveFamiliarityMix([
      '修一下这个 bug',
      '跑一下 npm test',
      '提交 commit',
      '聊聊天气',
    ])
    expect(m.lean).toBe('task-leaning')
    expect(m.task).toBeGreaterThanOrEqual(3)
  })

  it('多数交心 → bond-leaning', () => {
    const m = resolveFamiliarityMix([
      '好累想哭',
      '陪陪我聊聊',
      '睡不着心里乱',
      '帮我看下报错',
    ])
    expect(m.lean).toBe('bond-leaning')
  })

  it('format 含 lean', () => {
    const m = resolveFamiliarityMix(['修 bug', 'npm run test', '改代码'])
    expect(formatFamiliarityMixForPrompt(m)).toContain('task-leaning')
  })
})

describe('relationship stage × mix', () => {
  it('task-leaning 把 rapport 压回 familiar', () => {
    const mix = resolveFamiliarityMix(['修 bug', 'npm test', 'commit 一下', 'tsc 报错'])
    expect(mix.lean).toBe('task-leaning')
    const r = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: now - HOUR,
      recentUserMessages: MIN_USER_MESSAGES + 2,
      now,
      mix,
    })
    expect(r.stage).toBe('familiar')
    expect(r.signals).toContain('cap-rapport-task-leaning')
    expect(r.mix?.lean).toBe('task-leaning')
  })

  it('bond-leaning 保留 rapport', () => {
    const mix = resolveFamiliarityMix(['好累', '想聊聊', '睡不着', '心里乱'])
    const r = resolveRelationshipStage({
      growthStartedAt: now - COLD_START_MS - HOUR,
      lastRunAt: now - HOUR,
      recentUserMessages: 10,
      now,
      mix,
    })
    expect(r.stage).toBe('rapport')
  })
})
