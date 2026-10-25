import type { LLMCallDetail } from '../../shared/types'
import { DEBUG_RECORD_FIXTURES } from './debug-experience-fixtures'

/** 背景：新日志不持久化消息正文；意图：使用同形虚构元数据验收阅读；约束：不复制生产 Prompt，不根据当前定义补历史。 */
export const DEBUG_CONTEXT_CALLS: readonly LLMCallDetail[] = DEBUG_RECORD_FIXTURES.map((entry, index) => ({
  id: entry.id, sessionId: entry.sessionId, startedAt: Date.parse(`2026-10-13T${entry.time}+08:00`),
  provider: '示例服务', model: entry.model, caller: index === 2 ? 'memory' : 'main', status: entry.status,
  promptTokens: entry.inputTokens ?? 0, completionTokens: entry.outputTokens ?? 0,
  totalTokens: (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0), durationMs: entry.durationMs ?? 0,
  toolCallCount: 0, cacheReadTokens: 0, cacheCreationTokens: 0,
  requestMessages: Array.from({ length: index === 2 ? 2 : 12 }, (_, i) => ({
    role: i === 0 ? 'system' : i % 2 ? 'user' : 'assistant', content: '（正文未持久化）', contentLength: i === 0 ? 2400 : 80 + i,
  })),
  requestTools: index === 2 ? [] : [{ type: 'function', function: { name: 'demo_read', description: '【工具格式样张】仅用于阅读展示，无可执行实现。', parameters: { type: 'object', properties: { demoId: { type: 'string' } } } } }],
  requestExtra: { fixture: true, note: '【参数样张】仅表示当次日志保存的结构，不是当前模型配置。' },
  responseToolCalls: [],
}))

export { savedMessages, messageScope } from '../debug/saved-context'
