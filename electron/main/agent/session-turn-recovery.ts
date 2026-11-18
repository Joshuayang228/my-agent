import { createHash } from 'node:crypto'
import type { ChatMessage, ChatSession, TaskCheckpoint } from '../../../src/shared/types'

const TURN_SOURCE_LABEL = 'completed-turn-source'

export function completedTurnCheckpoint(reply: ChatMessage, user?: ChatMessage): TaskCheckpoint {
  return {
    label: TURN_SOURCE_LABEL,
    payload: { replyId: reply.id, userId: user?.id },
    updatedAt: reply.timestamp,
  }
}

/**
 * 背景：重启期间同一会话可能收到新消息，恢复任务不能改用最新一轮输入。
 * 设计意图：以存下的消息 ID 读取原回复和它之前的会话，避免在任务表复制正文。
 * 关键约束：回复或指定用户消息已删除时停止恢复。后续对话不会代替原来的来源。
 */
export function resolveCompletedTurn(session: ChatSession, checkpoint?: TaskCheckpoint) {
  if (checkpoint?.label !== TURN_SOURCE_LABEL || typeof checkpoint.payload?.replyId !== 'string') return null
  const replyIndex = session.messages.findIndex(message => message.id === checkpoint.payload?.replyId && message.role === 'assistant')
  if (replyIndex < 0) return null
  const messages = session.messages.slice(0, replyIndex)
  const sourceUserId = checkpoint.payload.userId
  const user = messages.find(message => message.id === sourceUserId && message.role === 'user')
  if (sourceUserId && !user) return null
  return { messages, reply: session.messages[replyIndex], user }
}

export function conversationIndexId(sessionId: string, messageId: string): string {
  return `conv-user-${createHash('sha256').update(JSON.stringify([sessionId, messageId])).digest('hex')}`
}
