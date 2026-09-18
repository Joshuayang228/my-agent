import { describe, expect, it } from 'vitest'
import { allowsKeylessConnection, hasLLMAuthentication } from '../../src/shared/llm-connection-test'
import { buildOpenAIRequest } from '../../electron/main/llm/request-builders'

describe('local connection authentication', () => {
  it.each(['http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'https://[::1]/v1', 'http://127.1.2.3/v1'])('allows compatible loopback %s', (baseUrl) => {
    expect(allowsKeylessConnection({ baseUrl })).toBe(true)
    expect(hasLLMAuthentication({ baseUrl, apiKey: ' ' })).toBe(true)
    const request = buildOpenAIRequest({ config: { baseUrl, apiKey: '', model: 'local' }, messages: [] })
    expect(request.headers).not.toHaveProperty('Authorization')
  })
  it.each(['anthropic', 'gemini'] as const)('does not assume keyless support for %s', (provider) => {
    expect(allowsKeylessConnection({ baseUrl: 'http://localhost/v1', provider })).toBe(false)
  })
  it('uses the same automatic protocol rules and never borrows or fabricates credentials', () => {
    expect(allowsKeylessConnection({ baseUrl: 'http://localhost/anthropic', provider: 'auto' })).toBe(false)
    expect(hasLLMAuthentication({ baseUrl: 'https://example.test/v1', apiKey: '' })).toBe(false)
    expect(hasLLMAuthentication(undefined)).toBe(false)
    const config = { baseUrl: 'http://localhost/v1', apiKey: 'fixture-local-key', model: 'local' }
    expect(buildOpenAIRequest({ config, messages: [] }).headers.Authorization).toBe('Bearer fixture-local-key')
  })
})
