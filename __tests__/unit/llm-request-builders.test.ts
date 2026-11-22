import { describe, expect, it } from 'vitest'
import { buildOpenAICompatibleMessages, buildOpenAIRequest } from '../../electron/main/llm/request-builders'

describe('buildOpenAICompatibleMessages', () => {
  it('不会把没有正文和工具调用的空 assistant 消息发送给 Provider', () => {
    const messages = buildOpenAICompatibleMessages([
      { id: 'u', role: 'user', content: '创建文件', timestamp: 1 },
      { id: 'bad', role: 'assistant', content: '', timestamp: 2 },
      { id: 'a', role: 'assistant', content: '已完成', timestamp: 3 },
    ])

    expect(messages).toEqual([
      { role: 'user', content: '创建文件' },
      { role: 'assistant', content: '已完成' },
    ])
  })

  it('未显式设置输出预算时不注入全局 max_tokens，让模型能力决定上限', () => {
    const request = buildOpenAIRequest({
      config: { apiKey: 'key', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
      messages: [{ id: 'u', role: 'user', content: '生成文件', timestamp: 1 }],
    })

    expect(request.body).not.toHaveProperty('max_tokens')
  })
})
