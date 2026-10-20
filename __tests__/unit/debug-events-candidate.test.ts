import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugEventsCandidate, type EventsPreviewState } from '../../src/components/playground/DebugEventsCandidate'
const render=(state:EventsPreviewState,selected?:string,empty=false)=>renderToStaticMarkup(createElement(DebugEventsCandidate,{previewState:state,snapshotState:'ready',initialSelectedId:selected,empty,onRetry:()=>{},onPage:()=>{}}))
describe('实时事件候选',()=>{it('时间线保留事件与显式 Span 边界',()=>{const html=render('ready','demo-runtime-asset');expect(html).toContain('资产证据已绑定');expect(html).toContain('demo-span-02');expect(html).toContain('事件不等于行动完成')});it('状态不补记录',()=>{for(const state of ['unread','loading','unavailable','error'] as const)expect(render(state)).not.toContain('当前查询没有已读事件');expect(render('truncated')).toContain('有界窗口事件');expect(render('unknown-time')).toContain('时间未记录');expect(render('missing')).toContain('引用事件未在当前窗口');expect(render('ready',undefined,true)).toContain('不代表运行时没有发生事件');expect(render('long')).toContain('长事件标题样张')})})
