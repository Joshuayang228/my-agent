import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmbedding, createEmbeddings } from '../../electron/main/memory/embeddings'

afterEach(() => vi.unstubAllGlobals())

describe('embedding authentication headers', () => {
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
