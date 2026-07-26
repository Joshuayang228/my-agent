import { describe, it, expect } from 'vitest'
import { TracerObserver, CompositeObserver, setObserver, getObserver } from '../../electron/main/utils/observer'
import { clearSpans, getRecentSpans } from '../../electron/main/utils/tracer'

describe('M14 Observer', () => {
  it('TracerObserver 写入 span', () => {
    clearSpans()
    const obs = new TracerObserver()
    const h = obs.onLLMStart({ name: 'llm_test', caller: 'main' })
    obs.onLLMEnd(h, true)
    const spans = getRecentSpans(10)
    expect(spans.some(s => s.name === 'llm_test')).toBe(true)
  })

  it('setObserver 可替换默认实现', () => {
    const calls: string[] = []
    setObserver({
      onLLMStart: (info) => {
        calls.push(`start:${info.name}`)
        return new TracerObserver().onLLMStart(info)
      },
      onLLMEnd: (h, ok) => {
        calls.push(`end:${ok}`)
        h.end(ok ? 'ok' : 'error')
      },
      onToolStart: (info) => new TracerObserver().onToolStart(info),
      onToolEnd: (h, ok, err) => h.end(ok ? 'ok' : 'error', err),
    })
    const h = getObserver().onLLMStart({ name: 'x', caller: 'main' })
    getObserver().onLLMEnd(h, true)
    expect(calls).toEqual(['start:x', 'end:true'])
    setObserver(new TracerObserver())
  })

  it('CompositeObserver Start 正序 End 逆序', () => {
    const order: string[] = []
    const mk = (id: string) => ({
      onLLMStart: (info: { name: string; caller: 'main' }) => {
        order.push(`S${id}`)
        return new TracerObserver().onLLMStart(info)
      },
      onLLMEnd: (h: { end: (s: 'ok' | 'error') => void }, ok: boolean) => {
        order.push(`E${id}`)
        h.end(ok ? 'ok' : 'error')
      },
      onToolStart: (info: { name: string }) => new TracerObserver().onToolStart(info),
      onToolEnd: (h: { end: (s: 'ok' | 'error') => void }, ok: boolean) => {
        h.end(ok ? 'ok' : 'error')
      },
    })
    const comp = new CompositeObserver([mk('1'), mk('2')])
    const h = comp.onLLMStart({ name: 'c', caller: 'main' })
    comp.onLLMEnd(h, true)
    expect(order).toEqual(['S1', 'S2', 'E2', 'E1'])
  })
})
