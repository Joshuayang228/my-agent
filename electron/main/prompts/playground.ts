/** Playground 的纯消息组装来源；领域服务校验预算，注册配方绑定实验来源。 */
import type { ChatMessage } from '../../../src/shared/types'
import { DEFAULT_PLAYGROUND_SYSTEM } from './texts'

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
