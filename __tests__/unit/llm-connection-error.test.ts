import { describe, expect, it } from 'vitest'
import { LLMError } from '../../electron/main/llm/index'
import { connectionTestError } from '../../electron/main/ipc/settings'

describe('LLM connection test errors', () => {
  it('maps common HTTP failures to user-facing Chinese messages', () => {
    expect(connectionTestError(new LLMError('secret server body', 401))).toBe('API Key 无效或没有权限')
    expect(connectionTestError(new LLMError('not found', 404))).toBe('Base URL 或模型名不存在')
    expect(connectionTestError(new LLMError('rate limit', 429))).toBe('请求过于频繁，请稍后再试')
  })

  it('does not echo internal errors or credentials', () => {
    expect(connectionTestError(new Error('sk-secret internal stack'))).toBe('连接失败，请检查网络、Base URL、模型名和 API Key')
  })
})
