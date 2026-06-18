import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentStreamEvent, LLMConfig } from '../../src/shared/types'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../../electron/main/llm/provider-router', () => ({
  detectProvider: vi.fn().mockReturnValue('openai'),
  buildAnthropicBody: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { streamChat, type StreamChatOptions } from '../../electron/main/llm/index'

function makeSSEResponse(textChunks: string[], statusCode = 200) {
  const lines = textChunks.map(chunk => {
    const data = {
      choices: [{ delta: { content: chunk } }],
    }
    return `data: ${JSON.stringify(data)}`
  })
  lines.push('data: [DONE]')
  const body = lines.join('\n') + '\n'

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })

  return new Response(stream, {
    status: statusCode,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

const baseConfig: LLMConfig = {
  apiKey: 'test-key',
  baseUrl: 'http://primary',
  model: 'primary-model',
}

async function collectEvents(gen: AsyncGenerator<AgentStreamEvent>): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  for await (const ev of gen) {
    events.push(ev)
  }
  return events
}

describe('streamChat failover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('主模型成功时不触发降级', async () => {
    mockFetch.mockResolvedValueOnce(makeSSEResponse(['Hello']))

    const options: StreamChatOptions = {
      config: baseConfig,
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: Date.now() }],
    }

    const gen = streamChat(options)
    const events = await collectEvents(gen)

    expect(events.some(e => e.type === 'text' && e.content === 'Hello')).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toContain('primary')
  })

  it('主模型失败 + 无 fallback 时抛异常', async () => {
    mockFetch.mockResolvedValueOnce(new Response('error', { status: 500 }))

    const options: StreamChatOptions = {
      config: baseConfig,
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: Date.now() }],
    }

    await expect(async () => {
      const gen = streamChat(options)
      await collectEvents(gen)
    }).rejects.toThrow()
  })

  it('主模型失败时降级到 fallback 模型', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('primary error', { status: 500 }))
      .mockResolvedValueOnce(makeSSEResponse(['Fallback reply']))

    const config: LLMConfig = {
      ...baseConfig,
      fallbackModels: [
        { model: 'backup-model', baseUrl: 'http://backup' },
      ],
    }

    const options: StreamChatOptions = {
      config,
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: Date.now() }],
    }

    const gen = streamChat(options)
    const events = await collectEvents(gen)

    const textEvents = events.filter(e => e.type === 'text')
    const allText = textEvents.map(e => (e as { content: string }).content).join('')
    expect(allText).toContain('Fallback reply')
    expect(allText).toContain('已切换')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1][0]).toContain('backup')
  })

  it('主模型 + 所有 fallback 都失败时抛异常', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('err1', { status: 500 }))
      .mockResolvedValueOnce(new Response('err2', { status: 500 }))

    const config: LLMConfig = {
      ...baseConfig,
      fallbackModels: [
        { model: 'backup-model', baseUrl: 'http://backup' },
      ],
    }

    const options: StreamChatOptions = {
      config,
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: Date.now() }],
    }

    await expect(async () => {
      const gen = streamChat(options)
      await collectEvents(gen)
    }).rejects.toThrow()
  })

  it('fallback 使用主模型的 apiKey（如果 fallback 未指定）', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(makeSSEResponse(['OK']))

    const config: LLMConfig = {
      ...baseConfig,
      apiKey: 'shared-key',
      fallbackModels: [
        { model: 'backup' },
      ],
    }

    const options: StreamChatOptions = {
      config,
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: Date.now() }],
    }

    const gen = streamChat(options)
    await collectEvents(gen)

    const secondCallHeaders = mockFetch.mock.calls[1][1]?.headers
    expect(secondCallHeaders?.Authorization).toContain('shared-key')
  })
})
