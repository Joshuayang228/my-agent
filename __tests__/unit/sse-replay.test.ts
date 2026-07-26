import { describe, it, expect } from 'vitest'
import { parseSseDataLines, replayOpenAiSse } from '../../electron/main/llm/sse-replay'

const FIXTURE = `
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}

data: [DONE]
`

describe('M17 G2 SSE fixture replay', () => {
  it('parseSseDataLines 忽略 DONE', () => {
    expect(parseSseDataLines(FIXTURE)).toHaveLength(2)
  })

  it('replayOpenAiSse 产出文本与 usage', async () => {
    const chunks: Array<{ type: string }> = []
    const gen = replayOpenAiSse(FIXTURE)
    let next = await gen.next()
    while (!next.done) {
      chunks.push(next.value)
      next = await gen.next()
    }
    expect(chunks.some(c => c.type === 'text')).toBe(true)
    expect(chunks.some(c => c.type === 'usage')).toBe(true)
    expect(next.value.content).toBe('Hello world')
    expect(next.value.usage?.promptTokens).toBe(5)
  })
})
