/**
 * 产品体验状态工作台：展示业务语义如何组合基础能力，不登记新的基础组件。伙伴状态、记忆引用等业务结构只在这里展示，不进入基础组件目录。
 */

import { useState } from 'react'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { UiControlsPanel } from './UiControlsPanel'
import { PlaygroundStoryTabs } from './PlaygroundLayout'

const BUSINESS_STORIES: readonly UiControlsSubId[] = ['status-bar', 'memory-chips', 'empty', 'confirm', 'feedback']

export function BusinessStatesPanel() {
  const [story, setStory] = useState<UiControlsSubId>('feedback')
  const stories = UI_CONTROLS_SUBTABS.filter((item) => BUSINESS_STORIES.includes(item.id))

  return (
    <div className="w-full space-y-4" data-testid="business-states-panel">
      <PlaygroundStoryTabs
        groups={[{ label: '业务状态', items: stories }]}
        value={story}
        onChange={(value) => setStory(value as UiControlsSubId)}
        ariaLabel="业务状态故事筛选"
      />
      <UiControlsPanel initialSub={story} />
    </div>
  )
}
