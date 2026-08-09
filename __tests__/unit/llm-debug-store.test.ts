/**
 * LLM Debug store 单元测试。
 *
 * 覆盖：pending → success 生命周期、正文懒查询、子 Agent 聚合与按会话清空。
 * 使用内存 sql.js 夹具，验证 store 与现有 database API 的边界，不启动 Electron。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

let db: import('sql.js').Database

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: async () => db,
  persist: vi.fn(),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  sanitizeLogData: (value: unknown) => value,
}))

const { llmDebugStore } = await import('../../electron/main/storage/llm-debug-store')

function createTables(database: import('sql.js').Database): void {
  database.run(`
    CREATE TABLE llm_debug_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      parent_span_id TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      provider TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      caller TEXT NOT NULL DEFAULT 'system',
      status TEXT NOT NULL DEFAULT 'pending',
      request_messages TEXT NOT NULL DEFAULT '',
      request_tools TEXT NOT NULL DEFAULT '',
      request_extra TEXT NOT NULL DEFAULT '{}',
      response_content TEXT,
      response_reasoning TEXT,
      response_tool_calls TEXT,
      error TEXT,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      completion_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      tool_call_count INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE llm_debug_subagent_sessions (
      debug_session_id TEXT PRIMARY KEY,
      main_session_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      parent_span_id TEXT,
      created_at INTEGER NOT NULL
    );
  `)
}

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  createTables(db)
})

describe('LLM Debug store', () => {
  it('persists one Span lifecycle and lazily returns full detail', async () => {
    await llmDebugStore.onLLMStart({
      spanId: 'span-main-1',
      sessionId: 'session-main',
      provider: 'openai',
      model: 'gpt-4o',
      caller: 'main',
      parentSpanId: 'interaction-1',
      messages: [{ role: 'user', content: 'hello' }],
      tools: [{ name: 'echo' }],
      extra: { agentAttempt: 0 },
    })

    const pending = await llmDebugStore.query({ sessionId: 'session-main' })
    expect(pending.records[0]).toMatchObject({
      id: 'span-main-1',
      status: 'pending',
      model: 'gpt-4o',
      totalTokens: 0,
    })

    await llmDebugStore.onLLMEnd('span-main-1', {
      status: 'success',
      content: 'world',
      reasoning: 'short thought',
      toolCalls: [{ id: 'call-1', name: 'echo' }],
      usage: { promptTokens: 10, completionTokens: 4 },
      durationMs: 123,
    })

    const result = await llmDebugStore.query({ sessionId: 'session-main' })
    expect(result.records[0]).toMatchObject({
      status: 'success',
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      toolCallCount: 1,
      durationMs: 123,
    })

    const detail = await llmDebugStore.getById('span-main-1')
    expect(detail).toMatchObject({
      responseContent: 'world',
      responseReasoning: 'short thought',
      requestMessages: [{ role: 'user', content: 'hello' }],
      requestTools: [{ name: 'echo' }],
      requestExtra: { agentAttempt: 0 },
    })
  })

  it('按主会话聚合子 Agent，并清空时不影响其他会话', async () => {
    await llmDebugStore.registerSubagentSession('debug-child', 'session-main', 'researcher', 'span-parent')
    await llmDebugStore.onLLMStart({
      spanId: 'span-child-1',
      sessionId: 'debug-child',
      provider: 'openai',
      model: 'gpt-4o-mini',
      caller: 'subagent',
      messages: [],
      tools: [],
      extra: {},
    })
    await llmDebugStore.onLLMStart({
      spanId: 'span-other-1',
      sessionId: 'session-other',
      provider: 'openai',
      model: 'gpt-4o-mini',
      caller: 'main',
      messages: [],
      tools: [],
      extra: {},
    })

    const aggregated = await llmDebugStore.query({
      sessionId: 'session-main',
      includeSubagents: true,
    })
    expect(aggregated.records.map((record) => record.id)).toEqual(['span-child-1'])

    await llmDebugStore.clear('session-main')
    expect((await llmDebugStore.query({ sessionId: 'session-main', includeSubagents: true })).total).toBe(0)
    expect((await llmDebugStore.query({ sessionId: 'session-other' })).total).toBe(1)
  })

  it('按元数据筛选并让列表与 JSONL 导出保持同一顺序', async () => {
    for (const call of [
      { id: 'span-a', provider: 'openai', model: 'gpt-4o', caller: 'main', sessionId: 'session-alpha' },
      { id: 'span-b', provider: 'anthropic', model: 'claude-sonnet', caller: 'profile', sessionId: 'session-beta' },
      { id: 'span-c', provider: 'openai', model: 'gpt-4o', caller: 'main', sessionId: 'session-gamma' },
    ]) {
      await llmDebugStore.onLLMStart({
        spanId: call.id,
        sessionId: call.sessionId,
        provider: call.provider,
        model: call.model,
        caller: call.caller,
        messages: [{ role: 'user', content: call.id }],
        tools: [],
        extra: {},
      })
    }
    await llmDebugStore.onLLMEnd('span-a', { status: 'success', content: 'ok' })
    await llmDebugStore.onLLMEnd('span-b', { status: 'error', error: 'failed' })
    await llmDebugStore.onLLMEnd('span-c', { status: 'success', content: 'ok' })

    const filtered = await llmDebugStore.query({
      caller: 'main',
      model: 'gpt-4o',
      status: 'success',
      search: 'session-',
      order: 'desc',
    })
    expect(filtered.records.map((record) => record.id)).toEqual(['span-c', 'span-a'])
    expect(filtered.total).toBe(2)
    expect(filtered.storageBytes).toBeGreaterThan(0)

    const exported = await llmDebugStore.exportJsonl({
      caller: 'main',
      model: 'gpt-4o',
      status: 'success',
      search: 'session-',
      order: 'desc',
    })
    expect(exported.trim().split('\n').map((line) => JSON.parse(line).id)).toEqual(['span-c', 'span-a'])
  })
})
