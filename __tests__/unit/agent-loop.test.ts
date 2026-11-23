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

// Mock logger only — LLM 走 _streamChatOverride（M17-G1：少用 vi.mock(llm)）
vi.mock('../../electron/main/utils/logger', async importOriginal => ({
  ...await importOriginal<typeof import('../../electron/main/utils/logger')>(),
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

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

/** 测试用假 stream：yield text，return ChatResult 形态 */
function makeMockStream(
  textChunks: string[],
  toolCalls: { id: string; name: string; arguments: string }[] = [],
  stopReason?: string,
) {
  async function* gen(): AsyncGenerator<AgentStreamEvent, any> {
    for (const chunk of textChunks) {
      yield { type: 'text' as const, content: chunk }
    }
    return {
      content: textChunks.join(''),
      toolCalls,
      usage: { promptTokens: 10, completionTokens: 5 },
      ...(stopReason ? { stopReason } : {}),
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

  it('模型臆造已被会话目录排除的工具调用时，不确认也不执行', async () => {
    const registry = new ToolRegistry()
    const execute = vi.fn(async () => 'unexpected')
    registry.register({ ...echoTool(), execute })
    const confirmTool = vi.fn(async () => true)
    let turn = 0
    const events = await collectEvents(agentLoop({
      config: testConfig,
      messages: [userMsg('echo')],
      tools: registry.getAll(),
      filterTools: () => [],
      confirmTool,
      _streamChatOverride: () => ++turn === 1
        ? makeMockStream([], [{ id: 'hidden-call', name: 'echo', arguments: '{}' }])
        : makeMockStream(['finished']),
    }, registry))
    expect(execute).not.toHaveBeenCalled()
    expect(confirmTool).not.toHaveBeenCalled()
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_end', callId: 'hidden-call', isError: true, result: expect.stringContaining('没有授权') }))
  })

  it('纯文本回复：产出 text + done 事件', async () => {
    const registry = new ToolRegistry()
    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('Hi')],
      tools: [],
      _streamChatOverride: () => makeMockStream(['Hello', ' world']),
    }

    const events = await collectEvents(agentLoop(options, registry))

    const textEvents = events.filter(e => e.type === 'text')
    expect(textEvents).toHaveLength(2)
    expect(textEvents[0]).toEqual({ type: 'text', content: 'Hello' })
    expect(textEvents[1]).toEqual({ type: 'text', content: ' world' })

    const doneEvents = events.filter(e => e.type === 'done')
    expect(doneEvents).toHaveLength(1)
  })

  it('模型在输出上限前没有正文或工具调用时，不写入空 assistant，也不发送非法恢复请求', async () => {
    const stream = vi.fn(() => makeMockStream([], [], 'length'))
    const events = await collectEvents(agentLoop({
      config: testConfig,
      messages: [userMsg('请创建一个 HTML 动画文件')],
      tools: [echoTool()],
      _streamChatOverride: stream,
    }, new ToolRegistry()))

    expect(stream).toHaveBeenCalledTimes(1)
    expect(events).toContainEqual(expect.objectContaining({ type: 'error', code: 'LLM_OUTPUT_TRUNCATED' }))
    expect(events).toContainEqual({ type: 'done', reason: 'output_truncated' })
  })

  it('截断但已有正文时仍使用合法的续写恢复', async () => {
    let turn = 0
    const events = await collectEvents(agentLoop({
      config: testConfig,
      messages: [userMsg('继续写下去')],
      tools: [],
      _streamChatOverride: () => {
        turn++
        return turn === 1
          ? makeMockStream(['已写到一半'], [], 'length')
          : makeMockStream(['完成'])
      },
    }, new ToolRegistry()))

    expect(events.filter(event => event.type === 'done')).toEqual([{ type: 'done', reason: 'completed' }])
    expect(events.some(event => event.type === 'error' && event.code === 'LLM_OUTPUT_TRUNCATED')).toBe(false)
  })

  it('工具调用：产出 tool_start → tool_end 然后继续循环', async () => {
    let turn = 0
    const registry = new ToolRegistry()
    registry.register(echoTool())

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('echo ping')],
      tools: registry.getAll(),
      _streamChatOverride: () => {
        turn++
        if (turn === 1) {
          return makeMockStream([], [{ id: 'tc1', name: 'echo', arguments: '{"text":"ping"}' }])
        }
        return makeMockStream(['pong'])
      },
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
      _streamChatOverride: () => makeMockStream(['should not run']),
    }

    const events = await collectEvents(agentLoop(options, registry))

    expect(events.some(e => e.type === 'error' && e.message.includes('cancelled'))).toBe(true)
  })

  it('流读取中取消返回 aborted，不重试或转换为模型故障', async () => {
    const controller = new AbortController()
    const stream = vi.fn(async function* () {
      yield { type: 'text' as const, content: '已经开始输出' }
      controller.abort()
      expect(controller.signal.aborted).toBe(true)
      throw new DOMException('The operation was aborted', 'AbortError')
    })
    const received = await collectEvents(agentLoop({
      config: testConfig, messages: [userMsg('Hi')], tools: [],
      signal: controller.signal, _streamChatOverride: stream,
    }, new ToolRegistry()))
    expect(stream).toHaveBeenCalledTimes(1)
    expect(received.filter(event => event.type === 'done')).toEqual([{ type: 'done', reason: 'aborted' }])
    expect(received.filter(event => event.type === 'error').every(event => event.code === 'ABORTED')).toBe(true)
  })

  it('流已经发布正文后断开，不重新请求以免重复展示半截输出', async () => {
    const stream = vi.fn(async function* () {
      yield { type: 'text' as const, content: '已发布的一段' }
      throw new Error('socket closed')
    })
    const events = await collectEvents(agentLoop({
      config: testConfig,
      messages: [userMsg('继续')],
      tools: [],
      _streamChatOverride: stream,
    }, new ToolRegistry()))

    expect(stream).toHaveBeenCalledTimes(1)
    expect(events.filter((event) => event.type === 'text')).toEqual([{ type: 'text', content: '已发布的一段' }])
    expect(events.some((event) => event.type === 'error')).toBe(true)
  })

  it('LLM 错误产出 error 事件', async () => {
    const registry = new ToolRegistry()
    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('Hi')],
      tools: [],
      _streamChatOverride: () => {
        throw new Error('API timeout')
      },
    }

    const events = await collectEvents(agentLoop(options, registry))

    const errorEvent = events.find(e => e.type === 'error') as Extract<AgentStreamEvent, { type: 'error' }>
    expect(errorEvent).toBeTruthy()
    expect(errorEvent.message).toBe('运行过程中发生错误，请稍后重试。')
    expect(errorEvent.message).not.toContain('API timeout')
  })

  it('破坏性工具触发 confirmTool，拒绝后产出拒绝结果', async () => {
    const destructiveTool: ToolDefinition = {
      name: 'rm',
      description: 'delete file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      execute: async () => 'deleted',
    }

    let turn = 0
    const registry = new ToolRegistry()
    registry.register(destructiveTool)
    const confirmTool = vi.fn().mockResolvedValue(false)

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('delete /tmp/x')],
      tools: registry.getAll(),
      confirmTool,
      _streamChatOverride: () => {
        turn++
        if (turn === 1) {
          return makeMockStream([], [{ id: 'tc1', name: 'rm', arguments: '{"path":"/tmp/x"}' }])
        }
        return makeMockStream(['OK, cancelled'])
      },
    }

    const events = await collectEvents(agentLoop(options, registry))

    expect(confirmTool).toHaveBeenCalledWith('rm', { path: '/tmp/x' })

    const toolEnd = events.find(e => e.type === 'tool_end') as Extract<AgentStreamEvent, { type: 'tool_end' }>
    expect(toolEnd?.isError).toBe(true)
    expect(toolEnd?.result).toContain('拒绝')
  })

  it('auto 模式按参数化 metadata 确认可写工具', async () => {
    const dynamicTool: ToolDefinition = {
      name: 'delegate_like',
      description: 'dynamic risk',
      parameters: { type: 'object', properties: {} },
      metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      resolveMetadata: (args) => args.mode === 'write'
        ? { isReadOnly: false, isDestructive: true, isConcurrencySafe: false }
        : { isReadOnly: true, isDestructive: false, isConcurrencySafe: true },
      execute: async () => 'ran',
    }
    const registry = new ToolRegistry()
    registry.register(dynamicTool)
    const confirmTool = vi.fn().mockResolvedValue(false)
    let turn = 0

    await collectEvents(agentLoop({
      config: testConfig,
      messages: [userMsg('delegate write')],
      tools: registry.getAll(),
      confirmTool,
      _streamChatOverride: () => {
        turn++
        return turn === 1
          ? makeMockStream([], [{ id: 'tc-dyn', name: 'delegate_like', arguments: '{"mode":"write"}' }])
          : makeMockStream(['cancelled'])
      },
    }, registry))

    expect(confirmTool).toHaveBeenCalledWith('delegate_like', { mode: 'write' })
  })

  it('达到 maxIterations 上限时产出 error + done', async () => {
    const registry = new ToolRegistry()
    registry.register(echoTool())

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('loop forever')],
      tools: registry.getAll(),
      maxIterations: 2,
      _streamChatOverride: () =>
        makeMockStream([], [{ id: `tc-${Date.now()}`, name: 'echo', arguments: '{"text":"loop"}' }]),
    }

    const events = await collectEvents(agentLoop(options, registry))

    const errorEvent = events.find(e => e.type === 'error' && 'message' in e && e.message.includes('最大迭代次数'))
    expect(errorEvent).toBeTruthy()
    const doneEvent = events.find(e => e.type === 'done') as Extract<AgentStreamEvent, { type: 'done' }>
    expect(doneEvent?.reason).toBe('max_turns')
  })

  it('Deny-and-Continue 熔断：连续多次拒绝后终止（too_many_denials）', async () => {
    const destructiveTool: ToolDefinition = {
      name: 'rm',
      description: 'delete file',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      metadata: { isReadOnly: false, isDestructive: true, isConcurrencySafe: false },
      execute: async () => 'deleted',
    }

    const registry = new ToolRegistry()
    registry.register(destructiveTool)
    const confirmTool = vi.fn().mockResolvedValue(false)

    const options: AgentLoopOptions = {
      config: testConfig,
      messages: [userMsg('keep deleting')],
      tools: registry.getAll(),
      confirmTool,
      maxIterations: 50,
      _streamChatOverride: () =>
        makeMockStream([], [{ id: `tc-${Math.random()}`, name: 'rm', arguments: '{"path":"/tmp/x"}' }]),
    }

    const events = await collectEvents(agentLoop(options, registry))

    const doneEvent = events.find(e => e.type === 'done') as Extract<AgentStreamEvent, { type: 'done' }>
    expect(doneEvent?.reason).toBe('too_many_denials')

    const modeEvent = events.find(e => e.type === 'execution_mode_changed') as Extract<AgentStreamEvent, { type: 'execution_mode_changed' }>
    expect(modeEvent).toEqual({
      type: 'execution_mode_changed',
      mode: 'confirm-all',
      reason: '连续多次操作被拒绝，已自动切换为全部确认模式。',
    })

    expect(confirmTool.mock.calls.length).toBeLessThanOrEqual(4)
  })
})
