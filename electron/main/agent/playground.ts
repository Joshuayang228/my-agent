/**
 * Dev Playground — 免伴侣上下文的单轮 LLM 试跑
 *
 * 背景：wishlist「Playground」；调试 Prompt 时不想带着 Assemble/记忆/工具。
 * 意图：可选 system + 必填 user → 一次 chatComplete；不建会话、不跑 Agent Loop。
 * 约束：不注入 Role Pack / Moments / 记忆；失败返回可读错误。
 */

import type { ChatMessage, LLMConfig } from '../../../src/shared/types'
import { chatComplete } from '../llm/index'
import * as settings from '../storage/settings-store'
import { createLogger } from '../utils/logger'
import { startLinkedAsyncSpan } from '../utils/tracer'

const log = createLogger('Playground')

export const DEFAULT_PLAYGROUND_SYSTEM =
  'You are a helpful assistant in a developer playground. Keep replies concise. No tools.'

export function buildPlaygroundMessages(input: {
  systemPrompt?: string
  userPrompt: string
}): ChatMessage[] {
  const user = input.userPrompt.trim()
  const system = (input.systemPrompt ?? '').trim() || DEFAULT_PLAYGROUND_SYSTEM
  const now = Date.now()
  return [
    {
      id: `pg-sys-${now}`,
      role: 'system',
      content: system,
      timestamp: now,
    },
    {
      id: `pg-user-${now}`,
      role: 'user',
      content: user,
      timestamp: now,
    },
  ]
}

async function loadPlaygroundLLMConfig(): Promise<LLMConfig> {
  const apiKey = await settings.getSetting('llmApiKey')
  const baseUrl = (await settings.getSetting('llmBaseUrl')) || 'https://api.openai.com/v1'
  const model = (await settings.getSetting('llmModel')) || 'gpt-4o'
  return {
    apiKey,
    baseUrl,
    model,
    temperature: 0.7,
    maxTokens: 1024,
  }
}

export type PlaygroundRunResult =
  | { ok: true; text: string; ms: number; model: string }
  | { ok: false; error: string }

/**
 * 单轮试跑（无工具、无会话持久化）。
 */
export async function runPlayground(input: {
  systemPrompt?: string
  userPrompt: string
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
  })
  const span = startLinkedAsyncSpan('playground:run', 'system', {
    attributes: { model: config.model, playground: true },
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
