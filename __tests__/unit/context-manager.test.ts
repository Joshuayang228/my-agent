import { describe, it, expect } from 'vitest'
import { estimateTokens, compressContext, emergencyTruncate } from '../../electron/main/agent/context-manager'
import type { ChatMessage } from '../../src/shared/types'

function msg(role: ChatMessage['role'], content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: Date.now(),
    ...extra,
  }
}

describe('estimateTokens', () => {
  it('空消息列表返回 0', () => {
    expect(estimateTokens([])).toBe(0)
  })

  it('短消息估算合理（每条 = ceil(len/2.5) + 4）', () => {
    const messages = [msg('user', 'hello')]
    const tokens = estimateTokens(messages)
    // "hello" = 5 chars → ceil(5/2.5) + 4 = 2 + 4 = 6
    expect(tokens).toBe(6)
  })

  it('带 toolCalls 的消息额外计算参数 token', () => {
    const messages = [msg('assistant', '', {
      toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{"text":"hi"}' }],
    })]
    const tokens = estimateTokens(messages)
    // content "" → ceil(0/2.5) + 4 = 4
    // toolCall arguments 13 chars → ceil(13/3) + 10 = 5 + 10 = 15
    expect(tokens).toBe(4 + 15)
  })
})

describe('compressContext', () => {
  it('短对话不压缩', async () => {
    const messages = [
      msg('system', 'You are helpful'),
      msg('user', 'Hi'),
      msg('assistant', 'Hello'),
    ]

    const result = await compressContext(messages)
    expect(result).toHaveLength(3)
    expect(result[0].role).toBe('system')
  })

  it('system prompt 永远保留', async () => {
    const system = msg('system', 'Important system prompt')
    const filler = Array.from({ length: 50 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(500)))

    const messages = [system, ...filler]
    const result = await compressContext(messages, { maxTokens: 500 })

    expect(result[0].id).toBe(system.id)
    expect(result[0].content).toBe(system.content)
  })

  it('L1 Snip 删除早期工具调用轮次', async () => {
    const system = msg('system', 'sys')
    const toolCallMsg = msg('assistant', '', {
      toolCalls: [{ id: 'tc1', name: 'echo', arguments: '{}' }],
    })
    const toolResult = msg('tool', 'result', { toolCallId: 'tc1' })
    const recent = Array.from({ length: 7 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'recent message'))

    const messages = [system, toolCallMsg, toolResult, ...recent]
    const result = await compressContext(messages, { maxTokens: 80 })

    const hasToolCall = result.some(m => m.role === 'assistant' && m.toolCalls?.length)
    const hasToolResult = result.some(m => m.role === 'tool' && m.toolCallId === 'tc1')
    expect(hasToolCall).toBe(false)
    expect(hasToolResult).toBe(false)
  })

  it('L3 Collapse 生成摘要占位符并保留近期消息', async () => {
    const system = msg('system', 'sys')
    const old = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? 'user' : 'assistant', 'x'.repeat(2000)))
    const recent = Array.from({ length: 3 }, (_, i) =>
      msg('user', 'recent'))

    const messages = [system, ...old, ...recent]
    const result = await compressContext(messages, { maxTokens: 2000 })

    const hasSummary = result.some(m => m.content.includes('[Context compressed'))
    expect(hasSummary).toBe(true)
    expect(result[0].role).toBe('system')
    expect(result.length).toBeLessThan(messages.length)
  })
})

describe('A1: L1 Snip 保护任务说明', () => {
  it('用户首条任务说明（在第一条 assistant 之前）不被 snip 删除', async () => {
    const system = msg('system', 'sys')
    // 用户任务说明是第一条 user 消息，preamble 保护到第一条 assistant
    const taskDescription = msg('user', 'TASK_MARKER: 请帮我重构整个项目的认证模块')
    const firstAssistant = msg('assistant', 'ok')
    // 中间大量工具调用轮次，触发 snip
    const toolRounds: ChatMessage[] = []
    for (let i = 0; i < 6; i++) {
      toolRounds.push(msg('assistant', '', {
        toolCalls: [{ id: `tc${i}`, name: 'echo', arguments: '{}' }],
      }))
      toolRounds.push(msg('tool', 'x'.repeat(300), { toolCallId: `tc${i}` }))
    }
    const recent = Array.from({ length: 7 }, () => msg('user', 'recent'))

    const messages = [system, taskDescription, firstAssistant, ...toolRounds, ...recent]
    const result = await compressContext(messages, { maxTokens: 200 })

    // 任务说明必须保留
    const hasTask = result.some(m => m.content.includes('TASK_MARKER'))
    expect(hasTask).toBe(true)
  })
})

describe('A2: Post-compact 文件恢复', () => {
  it('压缩后恢复最近读取的文件内容', async () => {
    const system = msg('system', 'sys')
    const task = msg('user', '分析代码')
    const firstAssistant = msg('assistant', '开始')
    // 大量填充触发 L3 collapse，中间包含 file_read
    const filler: ChatMessage[] = []
    for (let i = 0; i < 20; i++) {
      filler.push(msg('assistant', 'x'.repeat(1500)))
      filler.push(msg('user', 'y'.repeat(1500)))
    }
    // file_read 调用 + 结果（放在中段，会被摘要）
    const readCall = msg('assistant', '', {
      toolCalls: [{ id: 'read1', name: 'file_read', arguments: '{"path":"/src/auth.ts"}' }],
    })
    const readResult = msg('tool', 'UNIQUE_FILE_CONTENT: export function login() {}', { toolCallId: 'read1' })
    const moreFiller: ChatMessage[] = []
    for (let i = 0; i < 20; i++) {
      moreFiller.push(msg('assistant', 'z'.repeat(1500)))
      moreFiller.push(msg('user', 'w'.repeat(1500)))
    }
    const recent = Array.from({ length: 3 }, () => msg('user', 'recent'))

    const messages = [system, task, firstAssistant, ...filler, readCall, readResult, ...moreFiller, ...recent]
    const result = await compressContext(messages, { maxTokens: 3000 })

    const hasRestore = result.some(m => m.content.includes('文件恢复') && m.content.includes('/src/auth.ts'))
    expect(hasRestore).toBe(true)
  })

  it('file_read 错误结果不被恢复', async () => {
    const system = msg('system', 'sys')
    const task = msg('user', '分析代码')
    const firstAssistant = msg('assistant', '开始')
    const filler: ChatMessage[] = []
    for (let i = 0; i < 30; i++) {
      filler.push(msg('assistant', 'x'.repeat(1500)))
      filler.push(msg('user', 'y'.repeat(1500)))
    }
    const readCall = msg('assistant', '', {
      toolCalls: [{ id: 'read1', name: 'file_read', arguments: '{"path":"/missing.ts"}' }],
    })
    const readResult = msg('tool', 'Error reading file: ENOENT', { toolCallId: 'read1' })
    const recent = Array.from({ length: 3 }, () => msg('user', 'recent'))

    const messages = [system, task, firstAssistant, ...filler, readCall, readResult, ...recent]
    const result = await compressContext(messages, { maxTokens: 3000 })

    const hasErrorRestore = result.some(m => m.content.includes('/missing.ts'))
    expect(hasErrorRestore).toBe(false)
  })
})

describe('A3: emergencyTruncate 紧急截断', () => {
  it('保护 preamble + 保留最近消息，截断到目标 token 内', () => {
    const system = msg('system', 'sys')
    const task = msg('user', 'TASK: 核心任务说明')
    const firstAssistant = msg('assistant', 'ok')
    const middle = Array.from({ length: 50 }, () => msg('user', 'x'.repeat(1000)))
    const recent = msg('user', 'RECENT: 最新消息')

    const messages = [system, task, firstAssistant, ...middle, recent]
    const result = emergencyTruncate(messages, 500)

    // preamble 保留
    expect(result[0].content).toBe('sys')
    expect(result.some(m => m.content.includes('TASK: 核心任务说明'))).toBe(true)
    // 最近消息保留
    expect(result.some(m => m.content.includes('RECENT: 最新消息'))).toBe(true)
    // 总量下降
    expect(result.length).toBeLessThan(messages.length)
    // 逼近目标
    expect(estimateTokens(result)).toBeLessThan(estimateTokens(messages))
  })

  it('移除孤儿 tool 消息（对应 assistant 被截断）', () => {
    const system = msg('system', 'sys')
    const task = msg('user', 'task')
    const firstAssistant = msg('assistant', 'ok')
    // 大量填充把 assistant(toolCall) 挤到被删段
    const middle = Array.from({ length: 50 }, () => msg('user', 'x'.repeat(1000)))
    // 孤儿：tool 结果没有对应的 assistant toolCall 在保留段
    const orphanTool = msg('tool', 'orphan result', { toolCallId: 'gone' })
    const recent = msg('user', 'recent')

    const messages = [system, task, firstAssistant, ...middle, orphanTool, recent]
    const result = emergencyTruncate(messages, 300)

    const hasOrphan = result.some(m => m.role === 'tool' && m.toolCallId === 'gone')
    expect(hasOrphan).toBe(false)
  })

  it('空消息列表返回空', () => {
    expect(emergencyTruncate([], 1000)).toEqual([])
  })
})
