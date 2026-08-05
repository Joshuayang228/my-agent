import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../../src/shared/types'
import {
  collectToolResultsAfter,
  findLiveToolHostId,
  resolveHistoricTools,
  resolveToolsForAssistant,
} from '../../src/components/chat/callbacks/resolve-tools-for-message'

const base = (partial: Partial<ChatMessage> & Pick<ChatMessage, 'id' | 'role'>): ChatMessage => ({
  content: '',
  timestamp: 1,
  ...partial,
})

describe('resolve-tools-for-message', () => {
  const messages: ChatMessage[] = [
    base({ id: 'u1', role: 'user', content: '查文件' }),
    base({
      id: 'a1',
      role: 'assistant',
      content: '',
      toolCalls: [
        { id: 'c1', name: 'read_file', arguments: '{"path":"a.ts"}' },
        { id: 'c2', name: 'grep', arguments: 'not-json' },
      ],
    }),
    base({ id: 't1', role: 'tool', content: 'src', toolCallId: 'c1' }),
    base({ id: 't2', role: 'tool', content: '⚠️ fail', toolCallId: 'c2' }),
    base({ id: 'a2', role: 'assistant', content: '好了' }),
  ]

  it('collectToolResultsAfter 只收本回合 tool', () => {
    const map = collectToolResultsAfter(messages, 'a1')
    expect(map.get('c1')?.content).toBe('src')
    expect(map.get('c2')?.isError).toBe(true)
    expect(collectToolResultsAfter(messages, 'a2').size).toBe(0)
  })

  it('resolveHistoricTools 还原 args/status/折叠', () => {
    const tools = resolveHistoricTools(messages[1], messages)
    expect(tools).toHaveLength(2)
    expect(tools[0].args).toEqual({ path: 'a.ts' })
    expect(tools[0].status).toBe('done')
    expect(tools[0].collapsed).toBe(true)
    expect(tools[1].args).toEqual({ _raw: 'not-json' })
    expect(tools[1].status).toBe('error')
  })

  it('live 挂在命中 toolCalls 的 host 上', () => {
    const live = [
      {
        callId: 'c1',
        name: 'read_file',
        args: {},
        status: 'running' as const,
      },
    ]
    expect(findLiveToolHostId(messages, live, true)).toBe('a1')
    const onA1 = resolveToolsForAssistant(messages[1], messages, {
      liveHostId: 'a1',
      liveTools: live,
    })
    expect(onA1[0].status).toBe('running')
    const historic = resolveToolsForAssistant(messages[1], messages, {
      liveHostId: 'a2',
      liveTools: live,
    })
    expect(historic[0].status).toBe('done')
  })
})
