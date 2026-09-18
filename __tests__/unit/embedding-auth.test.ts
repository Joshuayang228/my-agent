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
})
