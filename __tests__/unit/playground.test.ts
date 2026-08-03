/**
 * Dev Playground：免上下文消息组装
 */
import { describe, expect, it } from 'vitest'
import {
  buildPlaygroundMessages,
  DEFAULT_PLAYGROUND_SYSTEM,
} from '../../electron/main/agent/playground'

describe('buildPlaygroundMessages', () => {
  it('空 system 用默认指令', () => {
    const msgs = buildPlaygroundMessages({ userPrompt: 'hello' })
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('system')
    expect(msgs[0].content).toBe(DEFAULT_PLAYGROUND_SYSTEM)
    expect(msgs[1].role).toBe('user')
    expect(msgs[1].content).toBe('hello')
  })

  it('自定义 system 覆盖默认', () => {
    const msgs = buildPlaygroundMessages({
      systemPrompt: '只回 JSON',
      userPrompt: '  ping  ',
    })
    expect(msgs[0].content).toBe('只回 JSON')
    expect(msgs[1].content).toBe('ping')
  })
})
