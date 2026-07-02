import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ChatMessage } from '../../src/shared/types'

// Mock chatComplete 以捕获传入的结构化指令
const capturedCalls: Array<{ messages: Array<{ role: string; content: string }> }> = []

vi.mock('../../electron/main/llm/index', () => ({
  chatComplete: vi.fn(async (opts: { messages: Array<{ role: string; content: string }> }) => {
    capturedCalls.push({ messages: opts.messages })
    return '## 当前任务\n测试任务\n## 已完成步骤\n无\n## 当前状态\n进行中\n## 下一步计划\n无\n## 关键上下文\n无'
  }),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const { compressContext } = await import('../../electron/main/agent/context-manager')

function msg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: `${role}-${Math.random().toString(36).slice(2, 8)}`, role, content, timestamp: Date.now(), ...extra }
}

describe('B1: 结构化摘要', () => {
  beforeEach(() => {
    capturedCalls.length = 0
  })

  it('L3 Collapse 使用结构化框架指令调用 LLM', async () => {
    const system = msg('system', 'sys')
    const old = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(2000)))
    const recent = Array.from({ length: 3 }, () => msg('user', 'recent'))

    const llmConfig = { apiKey: 'test', baseUrl: 'https://api.test.com', model: 'test-model' }
    const result = await compressContext([system, ...old, ...recent], {
      maxTokens: 2000,
      llmConfig,
      querySource: 'main',
    })

    // 验证 LLM 被调用且指令包含结构化框架的关键节
    expect(capturedCalls.length).toBeGreaterThan(0)
    const instruction = capturedCalls[0].messages.find(m => m.role === 'system')?.content ?? ''
    expect(instruction).toContain('## 当前任务')
    expect(instruction).toContain('## 已完成步骤')
    expect(instruction).toContain('## 当前状态')
    expect(instruction).toContain('## 下一步计划')
    expect(instruction).toContain('## 关键上下文')

    // 验证摘要被标记为 usedLLM
    const summaryMsg = result.find(m => m.compactMetadata)
    expect(summaryMsg?.compactMetadata?.usedLLM).toBe(true)
  })
})
