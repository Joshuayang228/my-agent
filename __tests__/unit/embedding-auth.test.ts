import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmbedding, createEmbeddings, getEmbeddingMetadata, getEmbeddingSpaceKey } from '../../electron/main/memory/embeddings'

afterEach(() => vi.unstubAllGlobals())

describe('embedding authentication headers', () => {
  it('独立向量出口按数据原文发送，不追加聊天指令或虚构模板', async () => {
    const requests: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ data: [{ embedding: [1, 0], index: 0 }], model: 'embedding', usage: { total_tokens: 1 } }))
    }))
    const config = { apiKey: '', baseUrl: 'http://example.invalid/v1', model: 'chat' }
    await createEmbedding('用户资料 {{不是模板}}', config)
    await createEmbeddings(['原文一', '原文二'], config)
    expect(requests[0].input).toBe('用户资料 {{不是模板}}')
    expect(requests[1].input).toEqual(['原文一', '原文二'])
    expect(requests.every(request => !('messages' in request) && !('prompt' in request))).toBe(true)
  })
  it('空间身份由实际嵌入请求决定，不受聊天模型和密钥轮换影响', () => {
    const config = { apiKey: 'secret-fixture', baseUrl: 'http://localhost/v1/', model: 'chat-a' }
    const key = getEmbeddingSpaceKey(config)
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(getEmbeddingSpaceKey({ ...config, apiKey: 'rotated', baseUrl: 'http://localhost/v1', model: 'chat-b' })).toBe(key)
    expect(getEmbeddingSpaceKey(config, 'different-embedding')).not.toBe(key)
    expect(getEmbeddingSpaceKey({ ...config, baseUrl: 'http://other.local/v1' })).not.toBe(key)
    const metadata = getEmbeddingMetadata(config, { vector: [1, 0], model: 'reported-model', tokenCount: 1 })
    expect(metadata).toEqual({ embeddingSpace: key, embeddingModel: 'reported-model', embeddingDimensions: 2 })
    expect(JSON.stringify(metadata)).not.toContain(config.apiKey)
    expect(JSON.stringify(metadata)).not.toContain(config.baseUrl)
  })

  it.each(['', 'fixture-key'])('single and batch keep optional credentials: %s', async (apiKey) => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ data: [{ embedding: [1, 0], index: 0 }], model: 'test-embedding', usage: { total_tokens: 1 } })))
    vi.stubGlobal('fetch', fetchMock)
    const config = { apiKey, baseUrl: 'http://127.0.0.1/v1', model: 'local' }
    await createEmbedding('hello', config, 'test-embedding')
    await createEmbeddings(['hello'], config, 'test-embedding')
    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('Authorization')).toBe(apiKey ? `Bearer ${apiKey}` : null)
    }
  })

  it('一个端点失败不会熔断其他连接，同一端点恢复后可以再次尝试', async () => {
    const goodResponse = () => new Response(JSON.stringify({
      data: [{ embedding: [1, 0], index: 0 }],
      model: 'test-embedding',
      usage: { total_tokens: 1 },
    }))
    let badRecovered = false
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)
      if (url.includes('bad.test') && !badRecovered) return new Response('missing', { status: 404 })
      return goodResponse()
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createEmbedding('bad first', { apiKey: '', baseUrl: 'http://bad.test/v1', model: 'local' }))
      .rejects.toThrow('Embedding API error (404)')
    await expect(createEmbedding('other connection', { apiKey: '', baseUrl: 'http://good.test/v1', model: 'local' }))
      .resolves.toMatchObject({ vector: [1, 0] })

    badRecovered = true
    await expect(createEmbedding('bad recovered', { apiKey: '', baseUrl: 'http://bad.test/v1', model: 'local' }))
      .resolves.toMatchObject({ vector: [1, 0] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
