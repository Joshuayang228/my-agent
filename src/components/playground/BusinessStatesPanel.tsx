/**
 * 产品体验状态工作台：展示业务语义如何组合基础能力，不登记新的基础组件。
 */

import { useState } from 'react'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { UiControlsPanel } from './UiControlsPanel'

const BUSINESS_STORIES: readonly UiControlsSubId[] = ['empty', 'confirm', 'status-bar', 'feedback']

export function BusinessStatesPanel() {
  const [story, setStory] = useState<UiControlsSubId>('feedback')
  const stories = UI_CONTROLS_SUBTABS.filter((item) => BUSINESS_STORIES.includes(item.id))

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="business-states-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>业务状态</h2>
        <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>
          这里展示基础能力在真实产品语义中的组合：空态、确认、伙伴状态和错误反馈。缺少基础能力时，先回到“基础组件”补齐。
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b pb-2" role="tablist" aria-label="业务状态故事筛选">
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
    </div>
  )
}
