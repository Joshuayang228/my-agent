import { describe, expect, it } from 'vitest'
import { buildConversationContextEvidence, createConversationApplicationContext } from '../../electron/main/agent/conversation-application-service'

const domain = {
  pack: {} as any,
  mutableBody: '',
  worldSlice: '当前位置：甲板',
  recentMomentsSlice: '最近动态',
  relationshipSummary: '关系稳定',
  emotionSummary: '情绪平静',
  rosterLines: '索隆',
} as any

describe('Conversation Application Context', () => {
  it('keeps agent, session, trace and domain read model in one context', () => {
    const context = createConversationApplicationContext({
      agentId: 'luffy',
      sessionId: 'session-1',
      sessionKind: 'main',
      traceId: 'trace-1',
      permissionPolicyKey: 'companion-default',
      executionMode: 'auto',
      domain,
    })
    expect(context.agent).toEqual({ id: 'luffy' })
    expect(context.session).toEqual({ id: 'session-1', kind: 'main' })
    expect(context.traceId).toBe('trace-1')
    expect(context.permission).toEqual({ policyKey: 'companion-default', executionMode: 'auto' })
    expect(context.prompt.contextEvidence).toEqual([])
    expect(context.domain).toBe(domain)
  })

  it('only registers life read models when the session consumes life context', () => {
    const mainEvidence = buildConversationContextEvidence({
      domain,
      includeLifeContext: true,
      hasSessionContext: true,
      sessionContextSource: 'agent-host.context-providers',
    })
    expect(mainEvidence.map(item => item.key)).toEqual([
      'companion.relationship',
      'companion.emotion',
      'companion.world-state',
      'companion.recent-moments',
      'companion.roster',
      'session.context',
    ])

    const summonEvidence = buildConversationContextEvidence({
      domain,
      includeLifeContext: false,
      hasSessionContext: false,
      sessionContextSource: 'summon.context',
    })
    expect(summonEvidence.map(item => item.key)).toEqual(['companion.roster'])
  })
})
