import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DebugPromptCandidate } from '../../src/components/playground/DebugPromptCandidate'
import { filterReviewAssets, PROMPT_REVIEW_ASSETS, reviewBody, reviewShape, reviewGroup, sortReviewAssets, uniqueReviewAssets } from '../../src/components/playground/debug-prompt-review'

describe('开发者提示词审阅候选', () => {
  it('以唯一 key 统计定义，不把结构资产、场景与裁判混入提示词数', () => {
    const assets = [...PROMPT_REVIEW_ASSETS, PROMPT_REVIEW_ASSETS[0]]
    expect(uniqueReviewAssets(assets)).toHaveLength(21)
    expect(filterReviewAssets(assets, 'prompts', 'all', 'all', '')).toHaveLength(4)
    expect(filterReviewAssets(assets, 'other', 'all', 'all', '')).toHaveLength(17)
    expect(filterReviewAssets(assets, 'other', 'all', '模板', '').map(asset => asset.assetType)).toEqual(['companion-scene', 'eval-judge'])
  })
  it('人物专属与平台共用都可达，搜索用途、定义符号与变量', () => {
    const yu = filterReviewAssets(PROMPT_REVIEW_ASSETS, 'prompts', 'yu', 'all', '')
    expect(yu.map(asset => asset.key)).toEqual(['demo.prompt.main', 'demo.prompt.runtime'])
    expect(filterReviewAssets(PROMPT_REVIEW_ASSETS, 'prompts', 'lin', '模板', '旅行计划')).toHaveLength(1)
    expect(filterReviewAssets(PROMPT_REVIEW_ASSETS, 'prompts', 'all', 'all', 'compileTravelPrompt')).toHaveLength(1)
    expect(filterReviewAssets(PROMPT_REVIEW_ASSETS, 'prompts', 'all', 'all', 'session_facts')).toHaveLength(1)
  })
  it('主对话与人物优先，平台后置，加载顺序及名称改变不改变优先级', () => {
    const expected = ['demo.prompt.main', 'demo.prompt.identity', 'demo.prompt.growth', 'demo.prompt.runtime']
    const reversed = [...PROMPT_REVIEW_ASSETS].reverse().map(asset => ({ ...asset, label: `变化的名称 ${asset.key}` }))
    const before = reversed.map(asset => asset.key)
    expect(filterReviewAssets(reversed, 'prompts', 'all', 'all', '').map(asset => asset.key)).toEqual(expected)
    const all = sortReviewAssets(reversed)
    expect(all[0].key).toBe('demo.prompt.main')
    expect(reviewGroup(all[all.length - 1])).toBe('平台规则与上下文')
    expect(reversed.map(asset => asset.key)).toEqual(before)
    expect(PROMPT_REVIEW_ASSETS[0].key).toBe('demo.prompt.main')
  })
  it('动态无固定正文与模板、结构分别说明，不拿预览重建正文', () => {
    const asset = PROMPT_REVIEW_ASSETS.find(asset => asset.key === 'demo.prompt.runtime')!
    expect(reviewShape(asset)).toBe('动态组装')
    expect(reviewBody(asset)).toBeNull()
    const html = renderToStaticMarkup(createElement(DebugPromptCandidate, { empty: false, selectedKey: asset.key, onSelect() {}, onRecord() {}, records: [] }))
    expect(html).toContain('此项没有固定正文')
    expect(html).not.toContain('复制正文')
    expect(html).toContain('demo/context.ts#buildSessionContextPrompt')
  })
  it('保留有阅读用途的信息；首次失败不显示计数与正文', () => {
    const render = (previewState: 'ready' | 'error') => renderToStaticMarkup(createElement(DebugPromptCandidate, { empty: false, selectedKey: 'demo.prompt.main', previewState, onSelect() {}, onRecord() {}, records: [] }))
    const html = render('ready')
    expect(html).toContain('组织人物表达')
    expect(html).not.toContain('失败回退')
    expect(html).not.toContain('审阅信息')
    expect(html).toContain('样张工具清单')
    expect(html).toContain('示例（非实际值）')
    expect(html).toContain('未保存的完整输入不能重建')
    expect(render('error')).not.toContain('aria-label="目录计数"')
    expect(render('error')).not.toContain('复制正文')
  })
})
