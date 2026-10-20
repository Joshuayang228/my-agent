import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugMemoryCandidate, type MemoryPreviewState } from '../../src/components/playground/DebugMemoryCandidate'
const render = (state: MemoryPreviewState, selected?: string, empty = false) => renderToStaticMarkup(createElement(DebugMemoryCandidate, { previewState: state, snapshotState: 'ready', initialSelectedId: selected, empty, onRetry: () => {}, onPage: () => {} }))
describe('用户记忆候选', () => {
  it('范围、类别与来源边界清晰', () => { expect(render('ready')).toContain('共享条目会随人物范围保留'); expect(render('ready')).toContain('记忆样张'); expect(render('ready')).toContain('身份样张'); expect(render('ready')).not.toContain('demo-memory-yu') })
  it('失败、分页、异常与长文保留真实边界', () => { for (const state of ['unread','loading','unavailable','error'] as const) expect(render(state)).not.toContain('条当前已读记忆'); expect(render('ready', undefined, true)).toContain('不代表系统没有长期记忆'); expect(render('paged')).toContain('读取下一页记忆样张'); expect(render('unknown-time', 'demo-memory-lin')).toContain('更新时间未记录'); expect(render('invalid')).toContain('结构异常'); expect(render('long','demo-memory-lin')).toContain('长记忆正文样张') })
  it('详情使用稳定 ID并保留来源结构', () => { const html = render('ready','demo-memory-lin'); expect(html).toContain('demo-memory-lin'); expect(html).toContain('来源与完整结构'); expect(html).toContain('不证明此次已经被模型召回') })
})
