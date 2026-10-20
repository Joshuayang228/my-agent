import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugContextCandidate, type ContextPreviewState } from '../../src/components/playground/DebugContextCandidate'
import { DEBUG_CONTEXT_CALLS, savedMessages, messageScope } from '../../src/components/playground/debug-context-fixtures'
import { DEBUG_RECORD_FIXTURES } from '../../src/components/playground/debug-experience-fixtures'

const render = (previewState: ContextPreviewState, initialSelectedId?: string, empty = false) => renderToStaticMarkup(createElement(DebugContextCandidate, {
  previewState, snapshotState: 'legacy', initialSelectedId, empty, onRetry: () => {}, onRecord: () => {},
}))
describe('上下文候选的已保存输入边界', () => {
  it('失败与未读没有计数或自动替代，详情故障不伪装成无消息', () => {
    for (const state of ['unread', 'loading', 'unavailable', 'error'] as const) {
      expect(render(state)).not.toContain('条已保存消息结构')
      expect(render(state)).not.toContain('aria-label="上下文保存范围"')
    }
    expect(render('ready', undefined, true)).toContain('当前查询没有调用记录')
    expect(render('detail-error')).toContain('详情读取失败')
    expect(render('detail-error')).not.toContain('条已保存消息结构')
    expect(render('ready', 'demo-absent')).toContain('未选择其他调用代替')
    expect(render('ready', 'demo-absent')).not.toContain('aria-label="上下文保存范围"')
    expect(render('malformed')).toContain('消息结构不是数组')
    expect(render('malformed')).toContain('结构异常样张')
    expect(render('malformed')).not.toContain('0 条已保存消息结构')
  })
  it('占位、旧记录内容、消息索引与原始字段不混淆', () => {
    const before = JSON.stringify(DEBUG_CONTEXT_CALLS)
    expect(render('ready')).toContain('12 条已保存消息结构')
    expect(render('ready')).toContain('1 · system')
    expect(render('ready')).toContain('正文未持久化 · 保存长度 2400 字符')
    expect(render('ready')).toContain('显示其余 4 条消息')
    expect(render('no-system')).toContain('未返回独立 System 消息')
    expect(render('empty-input')).toContain('0 条已保存消息结构')
    expect(render('empty-input')).toContain('不能据此证明请求未携带输入')
    expect(render('legacy')).toContain('不是当前提示词')
    expect(render('legacy')).toContain('原字段保留')
    expect(render('long')).toContain('【历史内容样张】这是旧记录中返回的虚构文字，不是当前提示词。\n'.repeat(90))
    expect(render('refresh-error')).toContain('历史内容样张')
    expect(render('truncated')).toContain('不代表全部调用历史')
    expect(JSON.stringify(DEBUG_CONTEXT_CALLS)).toBe(before)
    expect(DEBUG_CONTEXT_CALLS.map(call => call.id)).toEqual(DEBUG_RECORD_FIXTURES.map(call => call.id))
  })
  it('数组异常不报零，保存长度不从占位文字估算', () => {
    expect(savedMessages({})).toBeNull()
    expect(savedMessages(null)).toBeNull()
    expect(savedMessages([null, 'raw'])?.[1]).toEqual({ role: 'unknown', raw: 'raw' })
    expect(messageScope({ content: '（正文未持久化）' })).toContain('长度未记录')
    expect(messageScope({ content: '（正文未持久化）', contentLength: 0 })).toContain('0 字符')
    expect(messageScope({ content: '' })).toContain('包含已保存内容')
    expect(messageScope({})).toContain('未返回正文字段')
  })
})
