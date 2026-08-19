/**
 * 基础组件工作台：把可复用基础故事收在一个工作域里，产品体验不得在这里之外复制基础样式。
 */

import { useState } from 'react'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { UiControlsPanel } from './UiControlsPanel'

const FOUNDATION_STORIES: readonly UiControlsSubId[] = [
  'component-catalog', 'buttons', 'inputs', 'tool-cards', 'memory-chips',
]

export function FoundationComponentsPanel() {
  const [story, setStory] = useState<UiControlsSubId>('component-catalog')
  const stories = UI_CONTROLS_SUBTABS.filter((item) => FOUNDATION_STORIES.includes(item.id))

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="foundation-components-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>基础组件</h2>
        <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>
          这里生产可复用的视觉和交互基础。产品体验只能引用这些基础，不在业务页面里复制组件样式。
        </p>
      </div>
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
    </div>
  )
}
