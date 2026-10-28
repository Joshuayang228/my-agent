import { describe, expect, it, vi } from 'vitest'
const mocked = vi.hoisted(() => ({ model: vi.fn(), add: vi.fn(), usage: vi.fn() }))
vi.mock('../../electron/main/llm/index', () => ({ chatComplete: mocked.model }))
vi.mock('../../electron/main/storage/memory-store', () => ({ addMemory: mocked.add, listMemories: async () => [] }))
vi.mock('../../electron/main/utils/asset-usage', () => ({ recordAssetUsage: mocked.usage }))
import { hasUserSourceEvidence, maybeExtractProfile } from '../../electron/main/agent/profile-extractor'
import type { ChatMessage } from '../../src/shared/types'
const messages: ChatMessage[] = [
  { id: 'u', role: 'user', content: '我喜欢简短直接的回答', timestamp: 1 },
  { id: 'a', role: 'assistant', content: '用户是一名医生', timestamp: 2 },
]
describe('自动记忆原话证据', () => {
  it('生产提取路径在写入前拒绝助手事实与无证据候选', async () => {
    mocked.model.mockResolvedValue(JSON.stringify([
      { category: 'voice', content: '喜欢简短直接的回答', subject: 'user', sourceQuote: '喜欢简短直接' },
      { category: 'identity', content: '是一名医生', subject: 'user', sourceQuote: '用户是一名医生' },
      { category: 'fact', content: '没有原话依据' },
    ]))
    await maybeExtractProfile([...messages, { ...messages[0], id: 'u2' }, { ...messages[0], id: 'u3' }], { apiKey: 'test', baseUrl: 'https://example.invalid', model: 'test' })
    expect(mocked.add).toHaveBeenCalledTimes(1)
    expect(mocked.add).toHaveBeenCalledWith('voice', '喜欢简短直接的回答', { roleId: undefined })
  })
  it('仅接受用户主体及当前可见用户消息的原文', () => {
    expect(hasUserSourceEvidence({ subject: 'user', sourceQuote: '喜欢简短直接' }, messages)).toBe(true)
    for (const value of [{ subject: 'assistant', sourceQuote: '喜欢简短直接' }, { subject: 'user', sourceQuote: '用户是一名医生' }, { subject: 'user' }, { subject: 'user', sourceQuote: '喜欢' }]) {
      expect(hasUserSourceEvidence(value, messages)).toBe(false)
    }
    expect(hasUserSourceEvidence({ subject: 'user', sourceQuote: '不可见的证据' }, [{ ...messages[0], content: '字'.repeat(500) + '不可见的证据' }])).toBe(false)
  })

  it('路飞的身份和动态不会因为助手原话进入用户画像', () => {
    const luffyConversation: ChatMessage[] = [
      { id: 'user-1', role: 'user', content: '我想先把今天最重要的事做完', timestamp: 1 },
      { id: 'assistant-1', role: 'assistant', content: '我是路飞，现在在千里阳光号甲板上。', timestamp: 2 },
    ]
    expect(hasUserSourceEvidence({ subject: 'user', sourceQuote: '我是路飞' }, luffyConversation)).toBe(false)
    expect(hasUserSourceEvidence({ subject: 'user', sourceQuote: '千里阳光号甲板' }, luffyConversation)).toBe(false)
    expect(hasUserSourceEvidence({ subject: 'user', sourceQuote: '今天最重要的事' }, luffyConversation)).toBe(true)
  })
})
