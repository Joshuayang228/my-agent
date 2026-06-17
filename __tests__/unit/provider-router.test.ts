import { describe, it, expect, vi } from 'vitest'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}))

import { detectProvider, buildAnthropicBody, buildGeminiBody } from '../../electron/main/llm/provider-router'
import type { LLMConfig } from '../../src/shared/types'

const baseConfig: LLMConfig = {
  apiKey: 'test-key',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
}

describe('detectProvider', () => {
  it('OpenAI baseUrl 检测为 openai', () => {
    expect(detectProvider({ ...baseConfig, baseUrl: 'https://api.openai.com/v1' })).toBe('openai')
  })

  it('DeepSeek baseUrl 检测为 openai（兼容格式）', () => {
    expect(detectProvider({ ...baseConfig, baseUrl: 'https://api.deepseek.com' })).toBe('openai')
  })

  it('Anthropic baseUrl 检测为 anthropic', () => {
    expect(detectProvider({ ...baseConfig, baseUrl: 'https://api.anthropic.com' })).toBe('anthropic')
  })

  it('Gemini baseUrl 检测为 gemini', () => {
    expect(detectProvider({ ...baseConfig, baseUrl: 'https://generativelanguage.googleapis.com' })).toBe('gemini')
  })

  it('显式指定 provider 优先于自动检测', () => {
    expect(detectProvider({ ...baseConfig, provider: 'anthropic' })).toBe('anthropic')
  })

  it('未知 baseUrl fallback 到 openai', () => {
    expect(detectProvider({ ...baseConfig, baseUrl: 'https://custom-llm.example.com' })).toBe('openai')
  })

  it('auto provider 走自动检测', () => {
    expect(detectProvider({ ...baseConfig, provider: 'auto', baseUrl: 'https://api.anthropic.com' })).toBe('anthropic')
  })
})

describe('buildAnthropicBody', () => {
  it('system 消息提取到 body.system', () => {
    const messages = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' },
    ]
    const config = { ...baseConfig, baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' }
    const { body, headers, url } = buildAnthropicBody(config, messages)

    expect(body.system).toBe('You are helpful')
    expect((body.messages as any[]).every((m: any) => m.role !== 'system')).toBe(true)
    expect(headers['x-api-key']).toBe('test-key')
    expect(headers['anthropic-version']).toBe('2023-06-01')
    expect(url).toContain('/v1/messages')
  })

  it('包含 stream: true', () => {
    const { body } = buildAnthropicBody(baseConfig, [{ role: 'user', content: 'Hi' }])
    expect(body.stream).toBe(true)
  })
})

describe('buildGeminiBody', () => {
  it('system 消息提取到 systemInstruction', () => {
    const messages = [
      { role: 'system', content: 'Be helpful' },
      { role: 'user', content: 'Hello' },
    ]
    const config = { ...baseConfig, baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-pro' }
    const { body, url } = buildGeminiBody(config, messages)

    expect((body.systemInstruction as any).parts[0].text).toBe('Be helpful')
    expect((body.contents as any[]).every((c: any) => c.role !== 'system')).toBe(true)
    expect(url).toContain('gemini-pro')
    expect(url).toContain('streamGenerateContent')
  })

  it('assistant 角色映射为 model', () => {
    const messages = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello' },
    ]
    const { body } = buildGeminiBody(baseConfig, messages)
    const contents = body.contents as any[]
    expect(contents[1].role).toBe('model')
  })
})
