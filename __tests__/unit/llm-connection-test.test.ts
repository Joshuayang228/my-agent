import { describe, expect, it } from 'vitest'
import { validateLLMConnectionTestInput } from '../../src/shared/llm-connection-test'

describe('LLM connection test input', () => {
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
})
