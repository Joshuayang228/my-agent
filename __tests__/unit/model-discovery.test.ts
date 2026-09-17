import { describe, expect, it, vi } from 'vitest'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

import { fetchRemoteModels, __test } from '../../electron/main/llm/model-discovery'
import { MODEL_FETCH_MESSAGES } from '../../src/shared/llm-model-fetch'
import type { LLMConfig } from '../../src/shared/types'

const openai: LLMConfig = { apiKey: 'sk-test', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' }
const anthropic: LLMConfig = { apiKey: 'sk-test', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4', provider: 'anthropic' }
const gemini: LLMConfig = { apiKey: 'sk-test', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-pro', provider: 'gemini' }

describe('model discovery requests', () => {
  it('builds OpenAI Compatible and Anthropic /v1/models requests, and marks Gemini unsupported', () => {
    expect(__test.buildModelListRequest(openai)).toEqual({
      url: 'https://api.openai.com/v1/models',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-test' },
    })
    expect(__test.buildModelListRequest(anthropic)).toEqual({
      url: 'https://api.anthropic.com/v1/models',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'sk-test', 'anthropic-version': '2023-06-01' },
    })
    expect(__test.buildModelListRequest(gemini)).toEqual({ unsupported: true })
  })

  it('does not send a request without an API key', async () => {
    const fetchImpl = vi.fn()
    await expect(fetchRemoteModels({ ...openai, apiKey: '' }, { fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toEqual({
      ok: false, error: MODEL_FETCH_MESSAGES.missingKey, reason: 'missing-key', retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns structured auth, unsupported, empty and timeout results without leaking secrets', async () => {
    await expect(fetchRemoteModels(gemini, { fetchImpl: vi.fn() as unknown as typeof fetch })).resolves.toEqual({
      ok: false, error: MODEL_FETCH_MESSAGES.unsupported, reason: 'unsupported', retryable: false,
    })
    const auth = await fetchRemoteModels(openai, {
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ error: 'sk-test leaked' }), { status: 401 })) as unknown as typeof fetch,
    })
    expect(auth).toEqual({ ok: false, error: MODEL_FETCH_MESSAGES.auth, reason: 'auth', retryable: true })
    expect(JSON.stringify(auth)).not.toContain('sk-test')
    await expect(fetchRemoteModels(openai, {
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch,
    })).resolves.toEqual({ ok: true, models: [] })
    const timeout = new Error('aborted')
    timeout.name = 'TimeoutError'
    await expect(fetchRemoteModels(openai, {
      fetchImpl: vi.fn(async () => { throw timeout }) as unknown as typeof fetch,
    })).resolves.toEqual({ ok: false, error: MODEL_FETCH_MESSAGES.timeout, reason: 'timeout', retryable: true })
  })
})
