/**
 * Foundation 基础能力工作台：按单行故事筛选展示可复用基础资产的真实预览。
 *
 * 设计约束：产品体验只能引用这里登记为 foundation 的资产；业务专属结构不在此重复实现。
 * 完整资产登记和候选状态由注册表 / Debug 承担，这里不重复堆叠无预览价值的文字清单。
 */

import { useState } from 'react'
import { type UiControlsSubId } from './catalog'
import { FOUNDATION_STORY_GROUPS, getFoundationStoriesByGroup } from '../../shared/foundation-story-registry'
import { UiControlsPanel } from './UiControlsPanel'
import { PlaygroundStoryTabs } from './PlaygroundLayout'

export function FoundationComponentsPanel() {
  const [story, setStory] = useState<UiControlsSubId>('buttons')

  return (
    <div className="w-full space-y-4" data-testid="foundation-components-panel">
      <PlaygroundStoryTabs
        groups={FOUNDATION_STORY_GROUPS.map((group) => ({
          label: group.label,
          items: getFoundationStoriesByGroup(group.id).map((story) => ({ id: story.viewId, label: story.labelZh })),
        }))}
        value={story}
        onChange={(value) => setStory(value as UiControlsSubId)}
        ariaLabel="基础组件故事筛选"
      />
      <UiControlsPanel initialSub={story} />
    </div>
  )
}
