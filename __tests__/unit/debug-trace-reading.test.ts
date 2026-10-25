import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DebugTraceSpan, DebugTracesSnapshot } from '../../src/shared/debug-traces'
import { TraceReading } from '../../src/components/debug/TraceReading'
import { traceTree } from '../../src/components/debug/trace-tree'
import { clearSpans, startSpan, startLinkedAsyncSpan, getRecentSpans, getCallerStats } from '../../electron/main/utils/tracer'
import { getTraceSampleRate, setTraceSampleRate } from '../../electron/main/utils/session-sampler'

const span = (id: string, parentId?: string): DebugTraceSpan => ({ id, name: id, type: 'tool', caller: 'main', parentId, status: 'running', attributes: {}, links: ['root'] })
describe('真实调用树与单 Span 阅读', () => {
  it('显式父级决定树，后台 links 不成为父子关系，环 / 孤立 / 重复条目不消失', () => {
    const records = [span('root'), span('child', 'root'), span('async'), span('orphan', 'outside'), span('a', 'b'), span('b', 'a'), span('self', 'self'), span('child', 'root')]
    const before = JSON.stringify(records), tree = traceTree(records)
    expect(tree.nodes.map(node => node.span.id)).toEqual(['root', 'child', 'async', 'orphan', 'a', 'b', 'self'])
    expect(tree.nodes.find(node => node.span.id === 'async')?.depth).toBe(0)
    expect(tree.nodes.find(node => node.span.id === 'child')?.depth).toBe(1)
    expect(tree.orphans).toBe(1); expect(tree.cyclic).toBe(true); expect(tree.duplicates).toBe(1)
    expect(JSON.stringify(records)).toBe(before)
  })
  it('原始属性保留，只对 LLM Span 提供请求入口，未知时间 / 耗时不补零', () => {
    const original = { ...span('tool'), duration: -1, attributes: { note: '属性原文' } }
    const render = (record: DebugTraceSpan) => renderToStaticMarkup(createElement(TraceReading, { spans: [record], selectedId: record.id, onSelect: () => {}, onRecord: () => {} }))
    expect(render(original)).toContain('属性原文')
    expect(render(original)).toContain('耗时未记录')
    expect(render(original)).not.toContain('查看请求记录')
    expect(render({ ...original, type: 'llm_request', duration: 0 })).toContain('查看请求记录')
    expect(render({ ...original, type: 'constructor' })).toContain('未识别 Span 类型')
    const chain = Array.from({ length: 100 }, (_, index) => span(String(index), index ? String(index - 1) : undefined))
    expect(traceTree(chain).nodes).toHaveLength(100)
    expect(renderToStaticMarkup(createElement(TraceReading, { spans: chain, onSelect: () => {}, onRecord: () => {} }))).not.toContain('padding-left:1782px')
  })
  it('实际 tracer 的异步关联经过共享传输形状完整保留', () => {
    const rate = getTraceSampleRate(); setTraceSampleRate(1); clearSpans()
    try {
      const root = startSpan('主交互', 'main'), background = startLinkedAsyncSpan('后台任务', 'memory', { linkToSpanId: root.id, type: 'subagent' })
      background.end(); root.end()
      const snapshot: DebugTracesSnapshot = { spans: getRecentSpans(100), callerStats: getCallerStats() }
      expect(snapshot.spans.find(span => span.id === background.id)?.links).toEqual([root.id])
      expect(snapshot.spans.find(span => span.id === background.id)?.parentId).toBeUndefined()
      expect(traceTree(snapshot.spans).nodes.every(node => node.depth === 0)).toBe(true)
    } finally { clearSpans(); setTraceSampleRate(rate) }
  })
})
