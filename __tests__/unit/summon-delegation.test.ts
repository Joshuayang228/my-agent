/**
 * M26-G2：召唤 × M19 委派边界
 */

import { describe, it, expect } from 'vitest'
import {
  canDelegateInSession,
  summonParentDelegationHint,
  summonWorkerSystemAddon,
} from '../../electron/main/companion/cast/summon-delegation'
import { buildSubAgentSystemPrompt } from '../../electron/main/agent/subagent'

describe('summon-delegation (M26-G2)', () => {
  it('main / summon / 未标记均可委派', () => {
    expect(canDelegateInSession(undefined)).toBe(true)
    expect(canDelegateInSession('main')).toBe(true)
    expect(canDelegateInSession('summon')).toBe(true)
    expect(canDelegateInSession('other')).toBe(false)
  })

  it('父会话提示鼓励委派且强调任务工非卡司', () => {
    const hint = summonParentDelegationHint()
    expect(hint).toMatch(/delegate_task/)
    expect(hint).toMatch(/任务工|匿名/)
    expect(hint).toMatch(/卡司/)
  })

  it('worker addon 仅 summon 注入，禁止装人设/推生活', () => {
    expect(summonWorkerSystemAddon(undefined)).toBe('')
    expect(summonWorkerSystemAddon('main')).toBe('')
    const addon = summonWorkerSystemAddon('summon')
    expect(addon).toMatch(/task worker/i)
    expect(addon).toMatch(/NOT that companion/i)
    expect(addon).toMatch(/life world|moments|growth/i)
    expect(addon).not.toMatch(/protected/i)
  })

  it('buildSubAgentSystemPrompt 在 summon 下带边界段', () => {
    const main = buildSubAgentSystemPrompt('researcher')
    const summon = buildSubAgentSystemPrompt('researcher', { sessionKind: 'summon' })
    expect(main).not.toMatch(/summon × multi-agent/)
    expect(summon).toMatch(/summon × multi-agent/)
    expect(summon).toMatch(/task worker/i)
  })
})
