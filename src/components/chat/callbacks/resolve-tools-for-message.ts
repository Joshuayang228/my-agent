/**
 * 把「某条 assistant 发起的工具」解析成 ToolCallback 列表（Alice：tool 跟在 assistant 后）。
 *
 * 背景：旧 UI 把 activeTools 挂在消息流最底部，done 后清空 → 工具像蒸发，位置也怪。
 * 历史回合：用 assistant.toolCalls + 紧随其后的 role=tool 消息还原。
 * 进行中：调用方传入 liveTools 覆盖。
 */

import type { ChatMessage } from '../../../shared/types'
import type { ToolCallbackItem } from './types'

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const v = JSON.parse(raw) as unknown
    return v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : { value: v as unknown }
  } catch {
    return { _raw: raw }
  }
}

/**
 * 收集 assistant 之后、下一轮 user/新 assistant 之前的 tool 结果。
 */
export function collectToolResultsAfter(
  messages: ChatMessage[],
  assistantId: string,
): Map<string, { content: string; isError?: boolean }> {
  const map = new Map<string, { content: string; isError?: boolean }>()
  const start = messages.findIndex((m) => m.id === assistantId)
  if (start < 0) return map

  for (let i = start + 1; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user') break
    if (m.role === 'assistant') break
    if (m.role === 'tool' && m.toolCallId) {
      const isError = m.content.startsWith('⚠️') || m.content.startsWith('Error')
      map.set(m.toolCallId, { content: m.content, isError })
    }
  }
  return map
}

/** 历史回合：从持久化消息还原工具卡（默认折叠） */
export function resolveHistoricTools(
  assistant: ChatMessage,
  messages: ChatMessage[],
  opts?: { expand?: boolean },
): ToolCallbackItem[] {
  const calls = assistant.toolCalls
  if (!calls?.length) return []
  const results = collectToolResultsAfter(messages, assistant.id)
  const expand = !!opts?.expand

  return calls.map((c) => {
    const hit = results.get(c.id)
    return {
      callId: c.id,
      name: c.name,
      args: parseArgs(c.arguments),
      status: (hit?.isError ? 'error' : 'done') as ToolCallbackItem['status'],
      result: hit?.content,
      collapsed: !expand,
    }
  })
}

/**
 * 当前应把 live activeTools 挂在哪条 assistant 上。
 * 优先：toolCalls 命中 live callId 的 assistant；否则最近一条 assistant。
 */
export function findLiveToolHostId(
  messages: ChatMessage[],
  activeTools: ToolCallbackItem[],
  isStreaming: boolean,
): string | null {
  if (activeTools.length === 0 && !isStreaming) return null

  const liveIds = new Set(activeTools.map((t) => t.callId))
  if (liveIds.size > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'user') break
      if (m.role === 'assistant' && m.toolCalls?.some((c) => liveIds.has(c.id))) {
        return m.id
      }
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') return null
    if (m.role === 'assistant') return m.id
  }
  return null
}

export function resolveToolsForAssistant(
  assistant: ChatMessage,
  messages: ChatMessage[],
  opts: {
    liveHostId: string | null
    liveTools: ToolCallbackItem[]
    expandHistoric?: boolean
  },
): ToolCallbackItem[] {
  if (opts.liveHostId === assistant.id && opts.liveTools.length > 0) {
    return opts.liveTools
  }
  return resolveHistoricTools(assistant, messages, { expand: opts.expandHistoric })
}
