/**
 * M17 G3：可选真对话 E2E。
 * 无 TEST_LLM_API_KEY 时整文件 skip，不阻断 CI。
 */
import { describe, it, expect } from 'vitest'
import { chatComplete } from '../../electron/main/llm/index'

const apiKey = process.env.TEST_LLM_API_KEY || ''
const baseUrl = process.env.TEST_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1'
const model = process.env.TEST_LLM_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini'

describe.skipIf(!apiKey)('M17 G3 live LLM chat', () => {
  it('最小真实对话返回非空文本', async () => {
    const content = await chatComplete({
      promptlessReason: 'Live LLM 基础连通性测试使用测试文件内联消息',
      config: { apiKey, baseUrl, model },
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      caller: 'system',
      maxTokens: 32,
    })
    expect(content.trim().length).toBeGreaterThan(0)
  }, 60_000)
})
