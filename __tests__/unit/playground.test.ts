/**
 * Dev Playground：免上下文消息组装
 */
import { describe, expect, it } from 'vitest'
import {
  buildPlaygroundMessages,
  DEFAULT_PLAYGROUND_SYSTEM,
  MAX_PLAYGROUND_HISTORY_TURNS,
  MAX_PLAYGROUND_TEXT_LENGTH,
  runPlayground,
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

  it('带 history 拼多轮', () => {
    const msgs = buildPlaygroundMessages({
      userPrompt: '再问一句',
      history: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '嗨' },
      ],
    })
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(msgs[1].content).toBe('你好')
    expect(msgs[2].content).toBe('嗨')
    expect(msgs[3].content).toBe('再问一句')
  })
})

describe('runPlayground 输入边界', () => {
  it('在调用模型前拒绝超长 Prompt 和过多历史轮', async () => {
    await expect(runPlayground({ userPrompt: 'x'.repeat(MAX_PLAYGROUND_TEXT_LENGTH + 1) }))
      .resolves.toMatchObject({ ok: false, error: '用户 Prompt 过长' })
    await expect(runPlayground({
      userPrompt: 'test',
      history: Array.from({ length: MAX_PLAYGROUND_HISTORY_TURNS + 1 }, () => ({ role: 'user' as const, content: 'x' })),
    })).resolves.toMatchObject({ ok: false })
  })
})
