/**
 * 把「某条 assistant 发起的工具」解析成 ToolCallback 列表（Alice：tool 跟在 assistant 后）。
 *
 * 背景：旧 UI 把 activeTools 挂在消息流最底部，done 后清空 → 工具像蒸发，位置也怪。
 * 历史回合：用 assistant.toolCalls + 紧随其后的 role=tool 消息还原。
 * 进行中：调用方传入 liveTools 覆盖。
 */

import type { ChatMessage, GeneratedImageReference } from '../../../shared/types'
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
): Map<string, { content: string; isError?: boolean; generatedImages?: GeneratedImageReference[] }> {
  const map = new Map<string, { content: string; isError?: boolean; generatedImages?: GeneratedImageReference[] }>()
  const start = messages.findIndex((m) => m.id === assistantId)
  if (start < 0) return map

  for (let i = start + 1; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user') break
    if (m.role === 'assistant') break
    if (m.role === 'tool' && m.toolCallId) {
      const isError = m.content.startsWith('⚠️') || m.content.startsWith('Error')
      map.set(m.toolCallId, { content: m.content, isError, ...(m.generatedImages?.length ? { generatedImages: m.generatedImages } : {}) })
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
      ...(hit?.generatedImages?.length ? { generatedImages: hit.generatedImages } : {}),
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
    const calls = assistant.toolCalls
    if (!calls?.length) return opts.liveTools
    const callIds = new Set(calls.map((call) => call.id))
    return opts.liveTools.filter((tool) => callIds.has(tool.callId))
  }
  return resolveHistoricTools(assistant, messages, { expand: opts.expandHistoric })
}


export type ChatDisplayEntry =
  | { kind: 'user'; msg: ChatMessage; visibleIndex: number }
  | {
      kind: 'assistant-run'
      /** 中间轮次的助手消息（通常携带 toolCalls 与过渡话术） */
      intermediate: ChatMessage[]
      /** 最后一轮助手回复（面向用户的最终输出） */
      finalMsg: ChatMessage
      /** 最后一条消息在 visibleMessages 中的索引，用于判断 isLastMsg */
      lastVisibleIndex: number
    }

/**
 * 背景：多轮工具调用会产生多条连续的 `role === 'assistant'` 消息；直接平铺会让对话流充满中间过渡句与工具条。
 * 设计意图：将同一用户提问后的连续助手消息分为「中间过程步骤（intermediate）」与「最后一轮回复（finalMsg）」，
 * 进行中实时展开，跑完后默认折叠过程、只留最后一轮输出，同时保留中间产出的生成图片外露。
 * 关键约束：纯函数无副作用；单条助手回复保持 `intermediate: []`，不影响单轮对话与现有单测。
 */
export function groupVisibleMessages(visibleMessages: ChatMessage[]): ChatDisplayEntry[] {
  const entries: ChatDisplayEntry[] = []
  let i = 0
  while (i < visibleMessages.length) {
    const msg = visibleMessages[i]
    if (msg.role === 'user') {
      entries.push({ kind: 'user', msg, visibleIndex: i })
      i += 1
      continue
    }
    const run: ChatMessage[] = []
    while (i < visibleMessages.length && visibleMessages[i].role !== 'user') {
      run.push(visibleMessages[i])
      i += 1
    }
    const finalMsg = run[run.length - 1]
    entries.push({
      kind: 'assistant-run',
      intermediate: run.slice(0, -1),
      finalMsg,
      lastVisibleIndex: i - 1,
    })
  }
  return entries
}

const TOOL_SUMMARY_LABELS: Record<string, string> = {
  file_read: '读取文件',
  file_write: '修改文件',
  file_edit: '修改文件',
  file_search: '检索文件',
  grep_search: '检索文件',
  list_dir: '检索文件',
  shell_exec: '执行命令',
  web_search: '检索网页',
  web_fetch: '检索网页',
  image_generate: '生成图片',
  companion_take_photo: '拍一张照片',
  companion_post_moment: '发布朋友圈',
  companion_comment_moment: '评论朋友圈',
  companion_read_world: '查看生活世界',
  companion_create_asset: '记录生活资料',
  companion_add_reading_note: '记录生活资料',
  companion_change_wardrobe: '更换穿搭',
  companion_receive_gift: '收下礼物',
  remember: '记下记忆',
  recall: '回忆记忆',
  forget: '遗忘记忆',
}

/** 生成多轮过程折叠摘要文案（如：已完成 4 步处理 · 读取文件、发布朋友圈…） */
export function buildProcessSummaryText(toolNames: string[], stepCount: number, hasThinking: boolean): string {
  const uniqueLabels: string[] = []
  for (const name of toolNames) {
    const label = TOOL_SUMMARY_LABELS[name] ?? (name || '调用工具')
    if (!uniqueLabels.includes(label)) uniqueLabels.push(label)
  }
  const count = toolNames.length > 0 ? toolNames.length : stepCount
  const prefix = hasThinking ? `已思考并完成 ${count} 步处理` : `已完成 ${count} 步处理`
  if (uniqueLabels.length === 0) return prefix
  const preview = uniqueLabels.slice(0, 3).join('、')
  return uniqueLabels.length > 3 ? `${prefix} · ${preview}…` : `${prefix} · ${preview}`
}
