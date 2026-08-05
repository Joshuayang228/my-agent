import { describe, expect, it } from 'vitest'
import {
  appendToolResultMessage,
  applyContentEvent,
  applyReasoningEvent,
  applyToolEvent,
  completeReasoning,
  contentPhase,
  resetReasoning,
  toolItemPhase,
} from '../../src/components/chat/callbacks'
import type { ChatMessage } from '../../src/shared/types'

const genId = () => 'id-1'

describe('stream callbacks — reasoning', () => {
  it('thinking 进入 active 并累积 chunks', () => {
    let state = resetReasoning()
    state = applyReasoningEvent(state, { type: 'thinking', content: 'a' })!
    state = applyReasoningEvent(state, { type: 'thinking', content: 'b' })!
    expect(state.phase).toBe('active')
    expect(state.chunks.map((c) => c.content).join('')).toBe('ab')
    expect(completeReasoning(state).phase).toBe('complete')
  })
})

describe('stream callbacks — content', () => {
  it('text 追加到 assistant；无则新建', () => {
    let msgs: ChatMessage[] = []
    msgs = applyContentEvent(msgs, { type: 'text', content: 'hi' }, { genId, citations: [] })!
    expect(msgs).toHaveLength(1)
    expect(msgs[0].content).toBe('hi')
    msgs = applyContentEvent(msgs, { type: 'text', content: '!' }, { genId, citations: [] })!
    expect(msgs[0].content).toBe('hi!')
  })

  it('memory_citations 预置空 assistant，tool_calls 合并', () => {
    let msgs: ChatMessage[] = []
    msgs = applyContentEvent(
      msgs,
      { type: 'memory_citations', items: [{ id: 'm1', category: 'fact', summary: 'x' }] },
      { genId, citations: [] },
    )!
    msgs = applyContentEvent(
      msgs,
      { type: 'tool_calls', calls: [{ id: 'c1', name: 'shell_exec', arguments: '{}' }] },
      { genId, citations: [] },
    )!
    expect(msgs).toHaveLength(1)
    expect(msgs[0].memoryCitations?.[0].id).toBe('m1')
    expect(msgs[0].toolCalls).toHaveLength(1)
  })

  it('contentPhase：首字前 active，有字流式时 idle（交给光标）', () => {
    expect(contentPhase(false, true)).toBe('active')
    expect(contentPhase(true, true)).toBe('idle')
    expect(contentPhase(true, false)).toBe('complete')
  })
})

describe('stream callbacks — tool', () => {
  it('delta → start → end 生命周期', () => {
    let tools = applyToolEvent([], {
      type: 'tool_call_delta',
      index: 0,
      id: 't1',
      name: 'shell_exec',
      argumentsDelta: '{"c',
    })!
    expect(tools[0].status).toBe('pending')
    expect(toolItemPhase(tools[0].status)).toBe('active')

    tools = applyToolEvent(tools, {
      type: 'tool_start',
      callId: 't1',
      name: 'shell_exec',
      args: { command: 'ls' },
    })!
    expect(tools[0].status).toBe('running')

    tools = applyToolEvent(tools, {
      type: 'tool_end',
      callId: 't1',
      name: 'shell_exec',
      result: 'ok',
    })!
    expect(tools[0].status).toBe('done')
    expect(tools[0].collapsed).toBe(true)
    expect(toolItemPhase(tools[0].status)).toBe('complete')

    const msgs = appendToolResultMessage([], {
      type: 'tool_end',
      callId: 't1',
      name: 'shell_exec',
      result: 'ok',
    })
    expect(msgs[0].role).toBe('tool')
    expect(msgs[0].toolCallId).toBe('t1')
  })

  it('keepExpanded=true 时完成后不折叠（对话 debug）', () => {
    let tools = applyToolEvent(
      [],
      { type: 'tool_start', callId: 't2', name: 'read_file', args: { path: 'a.ts' } },
      { keepExpanded: true },
    )!
    tools = applyToolEvent(
      tools,
      { type: 'tool_end', callId: 't2', name: 'read_file', result: 'src' },
      { keepExpanded: true },
    )!
    expect(tools[0].collapsed).toBe(false)
  })
})
