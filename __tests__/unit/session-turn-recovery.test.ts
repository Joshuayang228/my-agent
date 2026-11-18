import { expect, it } from 'vitest'
import type { ChatMessage, ChatSession } from '../../src/shared/types'
import { completedTurnCheckpoint, conversationIndexId, resolveCompletedTurn } from '../../electron/main/agent/session-turn-recovery'

it('任务重启继续处理原始对话和相同索引键，后续回复不改变输入', () => {
  const user: ChatMessage = { id: 'first-user', role: 'user', content: '第一轮输入', timestamp: 1 }
  const reply: ChatMessage = { id: 'first-reply', role: 'assistant', content: '第一轮回复', timestamp: 2 }
  const next: ChatMessage = { id: 'later-user', role: 'user', content: '下一轮输入', timestamp: 3 }
  const session: ChatSession = { id: 'session-a', roleId: 'luffy', createdAt: 0, messages: [user, reply, next] }
  const checkpoint = JSON.parse(JSON.stringify(completedTurnCheckpoint(reply, user)))
  expect(checkpoint.payload).toEqual({ replyId: reply.id, userId: user.id })
  expect(resolveCompletedTurn(session, checkpoint)).toEqual({ messages: [user], reply, user })
  expect(resolveCompletedTurn({ ...session, messages: [reply, next] }, checkpoint)).toBeNull()
  expect(conversationIndexId(session.id, user.id)).toBe(conversationIndexId(session.id, checkpoint.payload.userId))
  expect(conversationIndexId('another-session', user.id)).not.toBe(conversationIndexId(session.id, user.id))
})
