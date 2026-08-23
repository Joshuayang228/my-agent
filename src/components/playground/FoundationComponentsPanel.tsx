/**
 * Foundation 基础能力工作台：完整展示可复用基础资产的已建立故事与候选清单。
 *
 * 设计约束：产品体验只能引用这里登记为 foundation 的资产；业务专属结构不在此重复实现。
 * 候选资产只展示真实注册信息，不伪造“已经有组件”或把候选来源当成正式依赖。
 */

import { useState } from 'react'
import { UI_COMPONENT_ASSETS, UI_COMPONENT_STATUSES, isFoundationComponentAsset } from '../../shared/ui-component-registry'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { UiControlsPanel } from './UiControlsPanel'

const FOUNDATION_STORIES: readonly UiControlsSubId[] = [
  'buttons',
  'inputs',
  'tabs',
  'tool-cards',
  'empty',
  'toast',
  'spinner',
  'confirm',
  'markdown',
  'asset-table',
  'file-tree',
  'resize-handle',
  'feedback',
]

const FOUNDATION_ASSETS = UI_COMPONENT_ASSETS.filter(isFoundationComponentAsset)
const STATUS_LABELS = Object.fromEntries(UI_COMPONENT_STATUSES.map((item) => [item.id, item.label])) as Record<string, string>

function FoundationAssetInventory() {
  const storyAssets = FOUNDATION_ASSETS.filter((asset) => asset.status === 'playground' || asset.status === 'adopted')
  const candidateAssets = FOUNDATION_ASSETS.filter((asset) => asset.status === 'candidate')

  return (
    <div className="space-y-4" data-testid="foundation-asset-inventory">
      <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>基础资产总览</h2>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>共 {FOUNDATION_ASSETS.length} 项；已建立故事的资产进入上方筛选；候选资产全部在下方登记，但不会伪装成已安装组件。</p>
          </div>
          <span className="rounded px-2 py-1 text-[10px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{storyAssets.length} 项已有故事</span>
        </div>
      </section>

      <section aria-labelledby="foundation-story-assets">
        <h3 id="foundation-story-assets" className="mb-2 text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>已建立故事</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {storyAssets.map((asset) => (
            <div key={asset.key} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.labelZh}</span>
                <span className="text-[9px]" style={{ color: asset.status === 'adopted' ? 'var(--success)' : 'var(--warning)' }}>{STATUS_LABELS[asset.status]}</span>
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.labelEn}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="foundation-candidate-assets">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 id="foundation-candidate-assets" className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>候选能力</h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>候选不等于已安装</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {candidateAssets.map((asset) => (
            <div key={asset.key} className="rounded-lg border border-dashed px-3 py-2.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.labelZh}</span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{STATUS_LABELS[asset.status]}</span>
              </div>
              <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.labelEn}</div>
              <p className="mt-1.5 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{asset.reference ?? '等待真实使用场景后建立故事。'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export function FoundationComponentsPanel() {
  const [story, setStory] = useState<UiControlsSubId>('buttons')
  const stories = UI_CONTROLS_SUBTABS.filter((item) => FOUNDATION_STORIES.includes(item.id))

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="foundation-components-panel">
      <div className="flex flex-wrap gap-1 border-b pb-2" role="tablist" aria-label="基础组件故事筛选">
        {stories.map((item) => {
          const selected = item.id === story
          return (
            <button key={item.id} type="button" role="tab" aria-selected={selected} onClick={() => setStory(item.id)}
              className="rounded-md px-2.5 py-1.5 text-[11px] transition"
              style={{ color: selected ? 'var(--accent-fg)' : 'var(--text-muted)', background: selected ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', fontWeight: selected ? 600 : 400 }}>
              {item.label}
            </button>
          )
        })}
      </div>
      <UiControlsPanel initialSub={story} />
      <FoundationAssetInventory />
    </div>
  )
}
