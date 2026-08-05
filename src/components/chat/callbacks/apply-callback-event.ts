/**
 * 三通道流式 Callback 的纯 apply（无 React）。
 *
 * 背景：App.handleEvent 曾把 thinking/text/tool 全塞进一个 switch，难测也难演进。
 * 意图：按灵犀 reasoning/content/tool 拆开 Start/Progress/Complete 状态迁移。
 * 约束：不改消息 id 生成策略（由调用方传入 genId）；只处理本通道事件，其它返回 null。
 * 调用方：App.handleEvent；单测直接覆盖迁移表。
 */

import type { AgentStreamEvent, ChatMessage, MemoryCitation, ToolCall } from '../../../shared/types'
import type { ReasoningCallbackState, ToolCallbackItem } from './types'

/** Reasoning：thinking delta → Start/Progress */
export function applyReasoningEvent(
  state: ReasoningCallbackState,
  ev: AgentStreamEvent,
): ReasoningCallbackState | null {
  if (ev.type !== 'thinking') return null
  const chunks = [...state.chunks, { content: ev.content }]
  return { phase: 'active', chunks }
}

export function resetReasoning(): ReasoningCallbackState {
  return { phase: 'idle', chunks: [] }
}

export function completeReasoning(state: ReasoningCallbackState): ReasoningCallbackState {
  if (state.chunks.length === 0) return { phase: 'idle', chunks: [] }
  return { ...state, phase: 'complete' }
}

export interface ContentApplyOpts {
  genId: () => string
  citations: MemoryCitation[]
}

/** Content：text / 预置 citations / 挂 toolCalls 的 assistant 骨架 */
export function applyContentEvent(
  messages: ChatMessage[],
  ev: AgentStreamEvent,
  opts: ContentApplyOpts,
): ChatMessage[] | null {
  if (ev.type === 'text') {
    return appendTextDelta(messages, ev.content, opts)
  }
  if (ev.type === 'memory_citations') {
    return ensureAssistantCitations(messages, ev.items, opts.genId)
  }
  if (ev.type === 'tool_calls') {
    return attachToolCalls(messages, ev.calls, opts)
  }
  return null
}

function appendTextDelta(
  messages: ChatMessage[],
  content: string,
  opts: ContentApplyOpts,
): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role !== 'assistant') {
    return [
      ...messages,
      {
        id: opts.genId(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        memoryCitations: opts.citations.length ? opts.citations : undefined,
      },
    ]
  }
  return [...messages.slice(0, -1), { ...last, content: last.content + content }]
}

function ensureAssistantCitations(
  messages: ChatMessage[],
  items: MemoryCitation[],
  genId: () => string,
): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant') {
    return [...messages.slice(0, -1), { ...last, memoryCitations: items }]
  }
  return [
    ...messages,
    {
      id: genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      memoryCitations: items,
    },
  ]
}

function attachToolCalls(
  messages: ChatMessage[],
  calls: ToolCall[],
  opts: ContentApplyOpts,
): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant' && !last.content && !last.toolCalls?.length) {
    return [
      ...messages.slice(0, -1),
      {
        ...last,
        toolCalls: calls,
        memoryCitations: last.memoryCitations ?? (
          opts.citations.length ? opts.citations : undefined
        ),
      },
    ]
  }
  return [
    ...messages,
    {
      id: opts.genId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: calls,
      memoryCitations: opts.citations.length ? opts.citations : undefined,
    },
  ]
}

/** Tool：delta / start / end → Start/Progress/Complete */
export function applyToolEvent(
  tools: ToolCallbackItem[],
  ev: AgentStreamEvent,
  opts?: { keepExpanded?: boolean },
): ToolCallbackItem[] | null {
  if (ev.type === 'tool_call_delta') {
    const existing = tools[ev.index]
    if (!existing) {
      return [
        ...tools,
        {
          callId: ev.id || `pending-${ev.index}`,
          name: ev.name || '',
          args: {},
          status: 'pending',
          streamingArgs: ev.argumentsDelta,
          collapsed: opts?.keepExpanded ? false : undefined,
        },
      ]
    }
    return tools.map((t, i) =>
      i === ev.index
        ? {
            ...t,
            streamingArgs: (t.streamingArgs || '') + ev.argumentsDelta,
            name: ev.name || t.name,
            callId: ev.id || t.callId,
          }
        : t,
    )
  }

  if (ev.type === 'tool_start') {
    return [
      ...tools.filter((t) => !(t.status === 'pending' && t.callId === ev.callId)),
      {
        callId: ev.callId,
        name: ev.name,
        args: ev.args,
        status: 'running',
        collapsed: opts?.keepExpanded ? false : undefined,
      },
    ]
  }

  if (ev.type === 'tool_end') {
    return tools.map((t) =>
      t.callId === ev.callId
        ? {
            ...t,
            status: ev.isError ? 'error' : 'done',
            result: ev.result,
            // 产品态：完成后折叠；对话 debug：保持展开便于审计
            collapsed: opts?.keepExpanded ? false : true,
          }
        : t,
    )
  }

  return null
}

/** tool_end 时追加 role=tool 消息（仍属 tool Complete 副作用） */
export function appendToolResultMessage(
  messages: ChatMessage[],
  ev: Extract<AgentStreamEvent, { type: 'tool_end' }>,
): ChatMessage[] {
  return [
    ...messages,
    {
      id: `tool-${ev.callId}`,
      role: 'tool',
      content: ev.result,
      timestamp: Date.now(),
      toolCallId: ev.callId,
    },
  ]
}
