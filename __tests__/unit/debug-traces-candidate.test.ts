import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugTracesCandidate, type TracesPreviewState } from '../../src/components/playground/DebugTracesCandidate'
const render=(state:TracesPreviewState, selected?:string, empty=false)=>renderToStaticMarkup(createElement(DebugTracesCandidate,{previewState:state,snapshotState:'ready',initialSelectedId:selected,empty,onRetry:()=>{},onRecord:()=>{}}))
describe('调用链候选',()=>{it('只按显式 parentId 与 links 展示',()=>{const html=render('ready','demo-span-03');expect(html).toContain('demo-span-01');expect(html).toContain('demo-span-03');expect(html).toContain('父 Span');expect(html).toContain('未记录')});it('状态与异常保留边界',()=>{for(const state of ['unread','loading','unavailable','error'] as const)expect(render(state)).not.toContain('条已读 Span');expect(render('orphan')).toContain('父级未在当前返回范围');expect(render('unknown-type')).toContain('future_span_type');expect(render('truncated')).toContain('属性读取有界');expect(render('ready',undefined,true)).toContain('不代表运行时没有调用');expect(render('long')).toContain('长 Span 名称样张')})})
