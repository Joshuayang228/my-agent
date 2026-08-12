/**
 * Eval transcript 文本投影。
 *
 * 背景：真实 LLM 的 text 事件是流式 chunk，不是多条独立回复；逐 chunk 交给 Judge 会破坏
 *       句子并制造虚假的回复分隔。
 * 设计意图：按事件顺序拼接当前 AgentLoop 的全部用户可见文本，供 Judge 和远程报告共用。
 * 关键约束：不包含 reasoning、tool result 或 error；当前场景一次 AgentLoop 只产生一条最终回复。
 */

import type { AgentStreamEvent } from '../src/shared/types'

export function collectAgentText(transcript: AgentStreamEvent[]): string {
  return transcript
    .filter((event): event is Extract<AgentStreamEvent, { type: 'text' }> =>
      event.type === 'text'
    )
    .map((event) => event.content)
    .join('')
    .trim()
}
