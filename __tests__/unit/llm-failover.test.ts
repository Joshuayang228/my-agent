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

import { streamChat, chatComplete, LLMError, parseRetryAfterMs, type StreamChatOptions } from '../../electron/main/llm/index'

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

describe('chatComplete（非流式辅助调用入口）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('消费流式生成器并返回完整文本', async () => {
    // 分多个 chunk 返回，验证内部把流收敛成整段
    mockFetch.mockResolvedValueOnce(makeSSEResponse(['标', '题', '内容']))

    const result = await chatComplete({
      config: baseConfig,
      messages: [{ role: 'user', content: '生成标题' }],
      caller: 'title',
    })

    expect(result).toBe('标题内容')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('空结果时抛错（带 caller 标识）', async () => {
    // 无内容的流 → 收敛后为空 → 应抛错让调用方兜底
    mockFetch.mockResolvedValueOnce(makeSSEResponse([]))

    await expect(
      chatComplete({
        config: baseConfig,
        messages: [{ role: 'user', content: 'x' }],
        caller: 'profile',
      }),
    ).rejects.toThrow(/profile/)
  })

  it('传入的 temperature / maxTokens 覆盖到请求体', async () => {
    mockFetch.mockResolvedValueOnce(makeSSEResponse(['ok']))

    await chatComplete({
      config: baseConfig,
      messages: [{ role: 'user', content: 'x' }],
      temperature: 0.1,
      maxTokens: 42,
      caller: 'summary',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.temperature).toBe(0.1)
    expect(body.max_tokens).toBe(42)
    // 辅助调用不带 tools
    expect(body.tools).toBeUndefined()
  })

  it('复用 streamChat 的 failover（主模型失败降级到备用）', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('primary error', { status: 500 }))
      .mockResolvedValueOnce(makeSSEResponse(['降级结果']))

    const config: LLMConfig = {
      ...baseConfig,
      fallbackModels: [{ model: 'backup-model', baseUrl: 'http://backup' }],
    }

    const result = await chatComplete({
      config,
      messages: [{ role: 'user', content: 'x' }],
      caller: 'summary',
    })

    // failover 会额外注入「已切换」提示文本，故用 contains 断言
    expect(result).toContain('降级结果')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('G2/G3：usage guard + retry-after', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('G2：OpenAI usage >0 guard 防止中间 chunk 的 0 值覆盖真实统计', async () => {
    // 构造异常流：第一个 chunk 带真实 usage，第二个 chunk 带 0 值
    const sse = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'hi' } }], usage: { prompt_tokens: 100, completion_tokens: 0 } }),
      'data: ' + JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 0, completion_tokens: 0 } }),
      'data: [DONE]',
    ].join('\n')
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      },
    })
    mockFetch.mockResolvedValueOnce(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }))

    const gen = streamChat({
      config: baseConfig,
      messages: [{ id: '1', role: 'user', content: 'test', timestamp: Date.now() }],
    })
    const events = await collectEvents(gen)
    const usageEvent = events.find(e => e.type === 'usage') as { promptTokens: number; completionTokens: number } | undefined

    // guard 应保留第一个 chunk 的真实值 100，忽略第二个 chunk 的 0
    expect(usageEvent?.promptTokens).toBe(100)
  })

  it('G3：parseRetryAfterMs 正确解析秒数和 HTTP 日期两种格式', () => {
    const resp1 = new Response('', { headers: { 'retry-after': '30' } })
    expect(parseRetryAfterMs(resp1)).toBe(30_000)

    const futureDate = new Date(Date.now() + 45_000).toUTCString()
    const resp2 = new Response('', { headers: { 'retry-after': futureDate } })
    const parsed = parseRetryAfterMs(resp2)
    expect(parsed).toBeGreaterThan(40_000) // 容忍时间差
    expect(parsed).toBeLessThan(50_000)

    const resp3 = new Response('', { headers: {} })
    expect(parseRetryAfterMs(resp3)).toBeUndefined()
  })

  it('G3：LLMError 携带 retry-after（从响应头提取）', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Rate limit', {
        status: 429,
        headers: { 'retry-after': '60' },
      }),
    )

    try {
      const gen = streamChat({
        config: baseConfig,
        messages: [{ id: '1', role: 'user', content: 'x', timestamp: Date.now() }],
      })
      await collectEvents(gen)
      throw new Error('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(LLMError)
      expect((err as LLMError).status).toBe(429)
      expect((err as LLMError).retryAfterMs).toBe(60_000)
    }
  })
})
