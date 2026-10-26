import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRuntimeEventProjector, runtimeEventTime, type RuntimeEventSummary } from '../../src/components/debug/runtime-events'
import { EventReading } from '../../src/components/debug/EventReading'

describe('运行事件摘要与浏览身份', () => {
  it('追加、裁剪和同毫秒同内容不重指选中事件，不按摘要推导关联', () => {
    const project = createRuntimeEventProjector()
    const first = { time: 1, type: 'text', detail: '相同内容' }, same = { ...first }, linkedText = { time: 1, type: 'tool_end', detail: 'ERR sessionId=x spanId=y' }
    const records: RuntimeEventSummary[] = [first, same, linkedText], before = JSON.stringify(records)
    const initial = project(records)
    expect(new Set(initial.map(event => event.id)).size).toBe(3)
    expect(project(records.slice(1)).map(event => event.id)).toEqual(initial.slice(1).map(event => event.id))
    expect(project([...records, { time: 2, type: 'error', detail: '错误摘要' }])[1].id).toBe(initial[1].id)
    expect(initial[2].status).toBe('已收到')
    expect(initial.every(event => event.spanId === undefined && event.sessionId === undefined)).toBe(true)
    expect(initial[2].body).toBe(linkedText.detail)
    expect(initial[2].title).toContain(linkedText.detail)
    expect(initial[2].raw).toEqual(linkedText)
    expect(JSON.stringify(records)).toBe(before)
  })
  it('空摘要不借额外字段补正文，未知类型和时间可核对，原始记录保持折叠', () => {
    const project = createRuntimeEventProjector(), source = { time: 0, type: 'constructor', detail: '', sessionId: '不能作为关联', content: '没有保存在摘要中' }
    const [event] = project([source])
    expect(event.title).toBe('constructor')
    expect(event.body).toBe('')
    expect(event.sessionId).toBeUndefined()
    const html = renderToStaticMarkup(createElement(EventReading, { events: [event], allEvents: [event], selectedId: event.id, onSelect: () => {} }))
    expect(html).toContain('时间未记录')
    expect(html).toContain('已保存摘要为空')
    expect(html).toContain('已保存记录')
    expect(html).toContain('未关联')
    expect(html).not.toContain('查看调用链')
    expect(runtimeEventTime(Date.parse('2026-10-26T06:31:56Z'), 'Asia/Shanghai')).toContain('14:31:56')
    for (const time of [null, 0, NaN, Infinity, 1e30]) expect(runtimeEventTime(time, 'Asia/Shanghai')).toBe('时间未记录')
  })
})
