/**
 * M8 补齐：子 Agent 实例注册表 + continue 机制
 *
 * continueSubAgent 依赖 agentLoop（调 LLM），mock 掉 './loop' 让它产出固定事件。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// mock agentLoop：产出一段文本 + 一次工具调用事件，不碰真实 LLM
vi.mock('../../electron/main/agent/loop', () => ({
  agentLoop: async function* () {
    yield { type: 'text', content: 'continued response' }
    yield { type: 'tool_start', name: 'file_read', callId: 'c1', args: {} }
    yield { type: 'done', reason: 'completed' }
  },
}))

import {
  registerSubAgent,
  getSubAgent,
  continueSubAgent,
  clearSessionSubAgents,
  clearAllSubAgents,
  getSubAgentCount,
} from '../../electron/main/agent/subagent-registry'
import { ToolRegistry } from '../../electron/main/tools/registry'
import type { ChatMessage } from '../../src/shared/types'

function makeRegParams(sessionId = 'sess-1', role = 'researcher') {
  const messages: ChatMessage[] = [
    { id: 'u1', role: 'user', content: 'task', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'done', timestamp: 2 },
  ]
  return {
    sessionId,
    role,
    messages,
    childRegistry: new ToolRegistry(),
    llmConfig: { apiKey: 'k', baseUrl: 'u', model: 'm' },
    executionMode: 'auto' as const,
    maxIterations: 10,
    parentSpanId: 'span-1',
  }
}

beforeEach(() => {
  clearAllSubAgents()
})

describe('子 Agent 注册与取回', () => {
  it('registerSubAgent 返回唯一 agentId', () => {
    const id1 = registerSubAgent(makeRegParams())
    const id2 = registerSubAgent(makeRegParams())
    expect(id1).toMatch(/^subagent-\d+-/)
    expect(id1).not.toBe(id2)
  })

  it('getSubAgent 能取回注册的实例', () => {
    const id = registerSubAgent(makeRegParams('sess-1', 'coder'))
    const inst = getSubAgent(id)
    expect(inst).toBeDefined()
    expect(inst!.role).toBe('coder')
    expect(inst!.sessionId).toBe('sess-1')
  })

  it('getSubAgent 对不存在的 id 返回 undefined', () => {
    expect(getSubAgent('nope')).toBeUndefined()
  })
})

describe('continue 机制', () => {
  it('continueSubAgent 追加消息并续跑', async () => {
    const id = registerSubAgent(makeRegParams())
    const before = getSubAgent(id)!.messages.length

    const result = await continueSubAgent(id, 'follow-up instruction')
    expect(result.success).toBe(true)
    expect(result.content).toBe('continued response')
    expect(result.toolsUsed).toContain('file_read')

    // 追加了 user 消息 + assistant 回复
    const after = getSubAgent(id)!.messages.length
    expect(after).toBe(before + 2)
  })

  it('continue 后历史保留，可再次 continue', async () => {
    const id = registerSubAgent(makeRegParams())
    await continueSubAgent(id, 'first follow-up')
    const mid = getSubAgent(id)!.messages.length
    await continueSubAgent(id, 'second follow-up')
    const end = getSubAgent(id)!.messages.length
    expect(end).toBe(mid + 2)
    // 第一条 follow-up 仍在历史里
    const contents = getSubAgent(id)!.messages.map(m => m.content)
    expect(contents).toContain('first follow-up')
    expect(contents).toContain('second follow-up')
  })

  it('continue 不存在的 agent 返回失败', async () => {
    const result = await continueSubAgent('ghost-id', 'hi')
    expect(result.success).toBe(false)
    expect(result.content).toContain('not found')
  })
})

describe('会话级清理', () => {
  it('clearSessionSubAgents 只清指定会话', () => {
    registerSubAgent(makeRegParams('sess-A'))
    registerSubAgent(makeRegParams('sess-A'))
    registerSubAgent(makeRegParams('sess-B'))
    expect(getSubAgentCount()).toBe(3)

    clearSessionSubAgents('sess-A')
    expect(getSubAgentCount()).toBe(1)  // 只剩 sess-B 的
  })

  it('清理后 continue 该会话的 agent 会失败', async () => {
    const id = registerSubAgent(makeRegParams('sess-X'))
    clearSessionSubAgents('sess-X')
    const result = await continueSubAgent(id, 'hi')
    expect(result.success).toBe(false)
  })
})
