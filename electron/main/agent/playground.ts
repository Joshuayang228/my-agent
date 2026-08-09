/**
 * Dev Playground — 免伴侣上下文的 LLM 试跑（可多轮，仍不写 settings）
 *
 * 背景：wishlist「Playground」；调试 Prompt 时不想带着 Assemble/记忆/工具。
 * 设计意图：可选 system + 历史 + 本轮 user → chatComplete；不建真会话、不跑 Agent Loop。
 *           LLM 配置走 loadMainLLMConfig，禁止在本文件手拼 apiKey/baseUrl。
 * 关键约束：不注入 Role Pack / Moments / 记忆；失败返回可读错误。
 */

import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { chatComplete } from '../llm/index'
import { loadMainLLMConfig } from '../llm/aux-config'
import { createLogger } from '../utils/logger'
import { startLinkedAsyncSpan } from '../utils/tracer'

const log = createLogger('Playground')

export const DEFAULT_PLAYGROUND_SYSTEM =
  'You are a helpful assistant in a developer playground. Keep replies concise. No tools.'

/** 试验场历史轮（不含 system） */
export type PlaygroundTurn = { role: 'user' | 'assistant'; content: string }

export function buildPlaygroundMessages(input: {
  systemPrompt?: string
  userPrompt: string
  history?: PlaygroundTurn[]
}): ChatMessage[] {
  const user = input.userPrompt.trim()
  const system = (input.systemPrompt ?? '').trim() || DEFAULT_PLAYGROUND_SYSTEM
  const now = Date.now()
  const msgs: ChatMessage[] = [
    {
      id: `pg-sys-${now}`,
      role: 'system',
      content: system,
      timestamp: now,
    },
  ]
  const history = input.history ?? []
  for (let i = 0; i < history.length; i++) {
    const h = history[i]
    const content = (h.content ?? '').trim()
    if (!content) continue
    if (h.role !== 'user' && h.role !== 'assistant') continue
    msgs.push({
      id: `pg-h-${now}-${i}`,
      role: h.role,
      content,
      timestamp: now + i + 1,
    })
  }
  msgs.push({
    id: `pg-user-${now}`,
    role: 'user',
    content: user,
    timestamp: now + history.length + 1,
  })
  return msgs
}

async function loadPlaygroundLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  return {
    ...main,
    temperature: 0.7,
    maxTokens: 1024,
  }
}

export type PlaygroundRunResult =
  | { ok: true; text: string; ms: number; model: string }
  | { ok: false; error: string }

/**
 * 试跑（无工具、无会话持久化）。可带 history 做多轮隔离对话。
 */
export async function runPlayground(input: {
  systemPrompt?: string
  userPrompt: string
  history?: PlaygroundTurn[]
}): Promise<PlaygroundRunResult> {
  const user = input.userPrompt?.trim() || ''
  if (!user) return { ok: false, error: '请输入用户 Prompt' }

  const config = await loadPlaygroundLLMConfig()
  if (!config.apiKey?.trim()) {
    return { ok: false, error: '请先在设置中配置 API Key' }
  }

  const messages = buildPlaygroundMessages({
    systemPrompt: input.systemPrompt,
    userPrompt: user,
    history: input.history,
  })
  const span = startLinkedAsyncSpan('playground:run', 'system', {
    attributes: {
      model: config.model,
      playground: true,
      historyTurns: (input.history ?? []).length,
    },
  })
  const t0 = Date.now()
  try {
    const text = await chatComplete({
      config,
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : String(m.content),
      })),
      caller: 'playground',
      temperature: 0.7,
      maxTokens: 1024,
    })
    const ms = Date.now() - t0
    span.end('ok')
    log.info('Playground run ok', { ms, model: config.model, chars: text.length })
    return { ok: true, text: text.trim(), ms, model: config.model }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    span.end('error', message)
    log.warn('Playground run failed', { error: message })
    return { ok: false, error: message }
  }
}

export const __test = { buildPlaygroundMessages, DEFAULT_PLAYGROUND_SYSTEM }
