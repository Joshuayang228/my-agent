import type { ChatMessage } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'

const log = createLogger('MessagePipeline')

/**
 * 修复孤儿 tool_call 配对 — 确保每个 assistant 的 toolCalls 都有对应的 tool result。
 *
 * 场景：应用崩溃在工具执行中途，导致 assistant(toolCalls) 已保存但 tool result 缺失。
 * 策略：为缺失的 tool result 补充占位消息，避免 LLM API 400 错误。
 */
export function sanitizeToolCallPairs(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []
  const allToolResultIds = new Set<string>()

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.toolCallId) {
      allToolResultIds.add(msg.toolCallId)
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    result.push(msg)

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const missingIds: string[] = []
      for (const tc of msg.toolCalls) {
        if (!allToolResultIds.has(tc.id)) {
          missingIds.push(tc.id)
        }
      }

      if (missingIds.length > 0) {
        log.warn('Patching orphan tool_calls with placeholder results', {
          assistantMsgId: msg.id,
          missingCount: missingIds.length,
          missingIds,
        })

        const nextMessages = messages.slice(i + 1)
        const existingToolResultIds = new Set(
          nextMessages
            .filter(m => m.role === 'tool' && m.toolCallId)
            .map(m => m.toolCallId!),
        )

        for (const callId of missingIds) {
          if (!existingToolResultIds.has(callId)) {
            const tc = msg.toolCalls.find(t => t.id === callId)
            result.push({
              id: `tool-patch-${callId}`,
              role: 'tool',
              content: `[Tool execution was interrupted — no result available for ${tc?.name ?? 'unknown'}]`,
              timestamp: msg.timestamp,
              toolCallId: callId,
            })
            allToolResultIds.add(callId)
          }
        }
      }
    }
  }

  return result
}

/**
 * 移除孤儿 tool result — 没有对应 assistant toolCalls 的 tool 消息。
 */
export function removeOrphanToolResults(messages: ChatMessage[]): ChatMessage[] {
  const validToolCallIds = new Set<string>()

  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tc of msg.toolCalls) {
        validToolCallIds.add(tc.id)
      }
    }
  }

  return messages.filter(msg => {
    if (msg.role === 'tool' && msg.toolCallId) {
      if (!validToolCallIds.has(msg.toolCallId)) {
        log.warn('Removing orphan tool result', { toolCallId: msg.toolCallId })
        return false
      }
    }
    return true
  })
}

/**
 * 确保不存在连续相同 role（除 tool 外）的消息。
 * 某些 LLM API 不接受连续两条 assistant 消息。
 */
export function mergeConsecutiveRoles(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages

  const result: ChatMessage[] = [messages[0]]

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1]
    const curr = messages[i]

    if (
      curr.role === prev.role &&
      curr.role !== 'tool' &&
      curr.role !== 'system' &&
      !curr.toolCalls?.length &&
      !prev.toolCalls?.length
    ) {
      log.debug('Merging consecutive messages', { role: curr.role, ids: [prev.id, curr.id] })
      result[result.length - 1] = {
        ...prev,
        content: prev.content + '\n' + curr.content,
        timestamp: curr.timestamp,
      }
    } else {
      result.push(curr)
    }
  }

  return result
}

/**
 * 完整消息清洗管道 — 按顺序应用所有修复。
 *
 * 在将历史消息送入 Agent Loop 前调用。
 */
export function sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages

  let result = messages
  const originalCount = result.length

  result = sanitizeToolCallPairs(result)
  result = removeOrphanToolResults(result)
  result = mergeConsecutiveRoles(result)

  if (result.length !== originalCount) {
    log.info('Message pipeline applied', {
      before: originalCount,
      after: result.length,
      delta: result.length - originalCount,
    })
  }

  return result
}
