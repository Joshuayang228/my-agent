/**
 * TraceContext AsyncLocalStorage 传播
 */
import { describe, expect, it } from 'vitest'
import {
  getTraceContext,
  runWithTraceContext,
  runWithTraceContextAsyncGen,
} from '../../electron/main/utils/trace-context'

describe('runWithTraceContext', () => {
  it('同步回调可读到 identity', () => {
    runWithTraceContext({ sessionId: 's1', userId: 'u1' }, () => {
      expect(getTraceContext()).toEqual({ sessionId: 's1', userId: 'u1' })
    })
    expect(getTraceContext().sessionId).toBeUndefined()
  })

  it('嵌套合并，内层覆盖', () => {
    runWithTraceContext({ sessionId: 'outer', userId: 'local' }, () => {
      runWithTraceContext({ sessionId: 'inner' }, () => {
        expect(getTraceContext()).toEqual({ sessionId: 'inner', userId: 'local' })
      })
    })
  })
})

describe('runWithTraceContextAsyncGen', () => {
  it('yield 后仍保持上下文', async () => {
    const seen: Array<string | undefined> = []
    async function* body() {
      seen.push(getTraceContext().sessionId)
      yield 1
      seen.push(getTraceContext().sessionId)
      yield 2
    }
    const out: number[] = []
    for await (const n of runWithTraceContextAsyncGen({ sessionId: 'gen-s' }, () => body())) {
      out.push(n)
    }
    expect(out).toEqual([1, 2])
    expect(seen).toEqual(['gen-s', 'gen-s'])
  })
})
