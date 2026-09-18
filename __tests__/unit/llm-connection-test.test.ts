import { describe, expect, it } from 'vitest'
import { validateLLMConnectionTestInput } from '../../src/shared/llm-connection-test'
import { validateLLMModelFetchInput } from '../../src/shared/llm-model-fetch'

describe('LLM connection test input', () => {
  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'http://[::1]:11434/v1'])('allows keyless local compatible input %s', (baseUrl) => {
    expect(validateLLMConnectionTestInput({ baseUrl, model: 'local', provider: 'auto' })).toMatchObject({ ok: true })
    expect(validateLLMModelFetchInput({ baseUrl, provider: 'auto' })).toMatchObject({ ok: true })
  })
  it.each(['https://localhost.evil.test/v1', 'https://127.0.0.1.evil.test/v1', 'http://localhost@evil.test/v1', 'http://user@localhost/v1', 'file:///localhost/v1', 'http://192.168.1.2/v1'])('does not authorize remote or disguised local input %s', (baseUrl) => {
    expect(validateLLMConnectionTestInput({ baseUrl, model: 'local' }).ok).toBe(false)
    expect(validateLLMModelFetchInput({ baseUrl }).ok).toBe(false)
  })
  it('preserves explicit adapters and rejects unknown protocols', () => {
    for (const provider of ['openai', 'anthropic', 'gemini', 'auto']) {
      expect(validateLLMConnectionTestInput({ provider, apiKey: 'fixture', baseUrl: 'https://example.test', model: 'model' })).toMatchObject({ ok: true, value: { provider } })
    }
    expect(validateLLMConnectionTestInput({ provider: 'invalid', apiKey: 'fixture', baseUrl: 'https://example.test', model: 'model' })).toEqual({ ok: false, error: '请选择有效的连接适配器' })
  })
  it('accepts a valid http configuration and normalizes the trailing slash', () => {
    expect(validateLLMConnectionTestInput({
      apiKey: 'secret',
      baseUrl: 'https://example.com/v1/',
      model: 'demo-model',
    })).toEqual({
      ok: true,
      value: { apiKey: 'secret', baseUrl: 'https://example.com/v1', model: 'demo-model' },
    })
  })

  it('rejects missing fields and unsupported URL protocols', () => {
    expect(validateLLMConnectionTestInput({ apiKey: '', baseUrl: 'https://example.com/v1', model: 'demo' })).toEqual({
      ok: false, error: '请先填写 API Key',
    })
    expect(validateLLMConnectionTestInput({ apiKey: 'secret', baseUrl: 'file:///tmp/model', model: 'demo' })).toEqual({
      ok: false, error: 'Base URL 必须以 http:// 或 https:// 开头',
    })
  })

  it('never echoes the API key in validation errors', () => {
    const result = validateLLMConnectionTestInput({ apiKey: 'do-not-leak', baseUrl: 'not-a-url', model: 'demo' })
    expect(result).toEqual({ ok: false, error: 'Base URL 格式不正确' })
    expect(JSON.stringify(result)).not.toContain('do-not-leak')
  })

  it('keeps useStoredApiKey and connectionId without requiring a draft key', () => {
    expect(validateLLMConnectionTestInput({
      useStoredApiKey: true,
      connectionId: 'conn-1',
      baseUrl: 'https://example.com/v1/',
      model: 'demo-model',
    })).toEqual({
      ok: true,
      value: {
        useStoredApiKey: true,
        connectionId: 'conn-1',
        baseUrl: 'https://example.com/v1',
        model: 'demo-model',
      },
    })
  })
})
