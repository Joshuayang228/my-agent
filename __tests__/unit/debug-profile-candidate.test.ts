import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DebugProfileCandidate, type ProfilePreviewState } from '../../src/components/playground/DebugProfileCandidate'
import { DEBUG_PROFILE_SOURCES, profileSourcesForRole, profileSourceScope } from '../../src/components/playground/debug-profile-fixtures'

const render = (previewState: ProfilePreviewState, initialSelectedId?: string, empty = false) => renderToStaticMarkup(createElement(DebugProfileCandidate, { previewState, snapshotState: 'ready', initialSelectedId, empty, onRetry: () => {}, onPage: () => {}, onEvidence: () => {} }))
describe('用户画像候选的来源边界', () => {
  it('按人物限制反馈，其他类别仍保留全局来源', () => {
    const lin = profileSourcesForRole(DEBUG_PROFILE_SOURCES, 'lin')
    const yu = profileSourcesForRole(DEBUG_PROFILE_SOURCES, 'yu')
    expect(lin.some(row => row.id === 'demo-feedback-yu')).toBe(false)
    expect(yu.some(row => row.id === 'demo-feedback-yu')).toBe(true)
    expect(lin.some(row => row.id === 'demo-profile-identity')).toBe(true)
    expect(render('ready')).toContain('不是全量画像')
    expect(render('ready')).toContain('先列出可比较的选项')
    expect(render('ready')).not.toContain('demo-feedback-yu')
  })
  it('空、失败、缺失和异常范围不补摘要或替代来源', () => {
    for (const state of ['unread', 'loading', 'unavailable', 'error'] as const) expect(render(state)).not.toContain('身份</h3>')
    expect(render('ready', undefined, true)).toContain('不代表用户没有相关资料')
    expect(render('missing', 'demo-not-found')).toContain('未在当前人物查询范围返回')
    expect(render('only-other')).toContain('其他类别来源')
    expect(render('unknown-time', 'demo-profile-identity')).toContain('更新时间</dt><dd>未记录')
    expect(render('partial')).toContain('部分来源未返回')
    expect(render('truncated')).toContain('不保证正文完整')
    expect(render('long', 'demo-memory-lin')).toContain('长反馈样张')
  })
  it('原始来源保留，定位只消费显式来源 ID', () => {
    const html = render('ready', 'demo-memory-lin')
    expect(html).toContain('查看这条来源记忆')
    expect(html).toContain('memories')
    expect(profileSourceScope(DEBUG_PROFILE_SOURCES.find(row => row.id === 'demo-feedback-yu')!)).toContain('yu')
    expect(profileSourceScope(DEBUG_PROFILE_SOURCES.find(row => row.id === 'demo-profile-identity')!)).toContain('共享')
  })
})
