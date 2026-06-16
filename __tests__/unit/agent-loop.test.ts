import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentLoop } from '../../electron/main/agent/loop'
import { ToolRegistry } from '../../electron/main/tools/registry'
import type {
  AgentLoopOptions,
  AgentStreamEvent,
  ChatMessage,
  ToolDefinition,
  LLMConfig,
} from '../../src/shared/types'

// Mock streamChat — 我们不实际调用 LLM
vi.mock('../../electron/main/llm/index', () => ({
  streamChat: vi.fn(),
}))

// Mock logger to suppress output
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { streamChat } from '../../electron/main/llm/index'

const mockStreamChat = vi.mocked(streamChat)

const testConfig: LLMConfig = {
  apiKey: 'test-key',
  baseUrl: 'http://localhost',
  model: 'test-model',
}

function userMsg(content: string): ChatMessage {
  return { id: 'u1', role: 'user', content, timestamp: Date.now() }
}

function echoTool(): ToolDefinition {
  return {
    name: 'echo',
    description: 'echo',
    parameters: { type: 'object', properties: { text: { type: 'string' } } },
    metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
    execute: async (args) => `echoed: ${args.text}`,
  }
}

/**
 * Helper: create a mock AsyncGenerator that yields text events then returns a result.
 */
function makeMockStream(
  textChunks: string[],
  toolCalls: { id: string; name: string; arguments: string }[] = [],
) {
  async function* gen(): AsyncGenerator<AgentStreamEvent, any> {
    for (const chunk of textChunks) {
      yield { type: 'text' as const, content: chunk }
    }
    return {
      content: textChunks.join(''),
      toolCalls,
      usage: { promptTokens: 10, completionTokens: 5 },
    }
  }
  return gen()
}

async function collectEvents(gen: AsyncGenerator<AgentStreamEvent>): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  for await (const ev of gen) {
    events.push(ev)
  }
  return events
}

describe('agentLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('纯文本回复：产出 text + done 事件', async () => {
    mockStreamChat.mockReturnValueOnce(makeMockStream(['Hello', ' world']))

    const registry = new ToolRegistry()
    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('Hi')],
      tools: [],
    }

    const events = await collectEvents(agentLoop(options, registry))

    const textEvents = events.filter(e => e.type === 'text')
    expect(textEvents).toHaveLength(2)
    expect(textEvents[0]).toEqual({ type: 'text', content: 'Hello' })
    expect(textEvents[1]).toEqual({ type: 'text', content: ' world' })

    const doneEvents = events.filter(e => e.type === 'done')
    expect(doneEvents).toHaveLength(1)
  })

  it('工具调用：产出 tool_start → tool_end 然后继续循环', async () => {
    // 第一轮：LLM 返回 tool_call
    mockStreamChat.mockReturnValueOnce(makeMockStream(
      [],
      [{ id: 'tc1', name: 'echo', arguments: '{"text":"ping"}' }],
    ))
    // 第二轮：LLM 返回文本
    mockStreamChat.mockReturnValueOnce(makeMockStream(['pong']))

    const registry = new ToolRegistry()
    registry.register(echoTool())

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('echo ping')],
      tools: registry.getAll(),
    }

    const events = await collectEvents(agentLoop(options, registry))

    const toolStart = events.find(e => e.type === 'tool_start') as Extract<AgentStreamEvent, { type: 'tool_start' }>
    expect(toolStart).toBeTruthy()
    expect(toolStart.name).toBe('echo')

    const toolEnd = events.find(e => e.type === 'tool_end') as Extract<AgentStreamEvent, { type: 'tool_end' }>
    expect(toolEnd).toBeTruthy()
    expect(toolEnd.result).toContain('echoed: ping')

    expect(events.some(e => e.type === 'done')).toBe(true)
  })

  it('AbortSignal 取消循环', async () => {
    const controller = new AbortController()
    controller.abort()

    const registry = new ToolRegistry()
    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('Hi')],
      tools: [],
      signal: controller.signal,
    }

    const events = await collectEvents(agentLoop(options, registry))

    expect(events.some(e => e.type === 'error' && e.message.includes('cancelled'))).toBe(true)
  })

  it('LLM 错误产出 error 事件', async () => {
    mockStreamChat.mockImplementation(() => {
      throw new Error('API timeout')
    })

    const registry = new ToolRegistry()
    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('Hi')],
      tools: [],
    }

    const events = await collectEvents(agentLoop(options, registry))

    const errorEvent = events.find(e => e.type === 'error') as Extract<AgentStreamEvent, { type: 'error' }>
    expect(errorEvent).toBeTruthy()
    expect(errorEvent.message).toContain('API timeout')
  })

  it('破坏性工具触发 confirmTool，拒绝后产出拒绝结果', async () => {
    const destructiveTool: ToolDefinition = {
      name: 'rm',
      description: 'delete file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      execute: async () => 'deleted',
    }

    // 第一轮：LLM 要调用破坏性工具
    mockStreamChat.mockReturnValueOnce(makeMockStream(
      [],
      [{ id: 'tc1', name: 'rm', arguments: '{"path":"/tmp/x"}' }],
    ))
    // 第二轮：LLM 看到拒绝后正常回复
    mockStreamChat.mockReturnValueOnce(makeMockStream(['OK, cancelled']))

    const registry = new ToolRegistry()
    registry.register(destructiveTool)

    const confirmTool = vi.fn().mockResolvedValue(false)

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('delete /tmp/x')],
      tools: registry.getAll(),
      confirmTool,
    }

    const events = await collectEvents(agentLoop(options, registry))

    expect(confirmTool).toHaveBeenCalledWith('rm', { path: '/tmp/x' })

    const toolEnd = events.find(e => e.type === 'tool_end') as Extract<AgentStreamEvent, { type: 'tool_end' }>
    expect(toolEnd?.isError).toBe(true)
    expect(toolEnd?.result).toContain('denied')
  })

  it('达到 maxIterations 上限时产出 error + done', async () => {
    // 每轮都返回 tool call，永远不停
    mockStreamChat.mockImplementation(() =>
      makeMockStream([], [{ id: `tc-${Date.now()}`, name: 'echo', arguments: '{"text":"loop"}' }]))

    const registry = new ToolRegistry()
    registry.register(echoTool())

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('loop forever')],
      tools: registry.getAll(),
      maxIterations: 2,
    }

    const events = await collectEvents(agentLoop(options, registry))

    const errorEvent = events.find(e => e.type === 'error' && 'message' in e && e.message.includes('maximum iterations'))
    expect(errorEvent).toBeTruthy()
  })
})
