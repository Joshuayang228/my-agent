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
