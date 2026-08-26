/**
 * Foundation 基础能力工作台：用较少的任务入口承载注册表里的完整基础故事。
 *
 * 设计约束：产品体验只能引用这里登记为 foundation 的资产；业务专属结构不在此重复实现。
 * 导航分组只减少入口数量，不删除或合并底层 story key；每个组仍渲染完整的隔离预览。
 */

import { useState } from 'react'
import { type UiControlsSubId } from './catalog'
import { FOUNDATION_STORY_NAVIGATION_GROUPS, getFoundationStoriesByNavigationGroup, type FoundationStoryNavigationGroupId } from '../../shared/foundation-story-registry'
import { UiControlsPanel } from './UiControlsPanel'
import { PlaygroundStoryTabs } from './PlaygroundLayout'

export function FoundationComponentsPanel() {
  const [navigationGroup, setNavigationGroup] = useState<FoundationStoryNavigationGroupId>('buttons')
  const activeStories = getFoundationStoriesByNavigationGroup(navigationGroup)

  return (
    <div className="w-full space-y-4" data-testid="foundation-components-panel">
      <PlaygroundStoryTabs
        groups={[{
          label: '基础组件',
          items: FOUNDATION_STORY_NAVIGATION_GROUPS.map((group) => ({ id: group.id, label: group.label })),
        }]}
        value={navigationGroup}
        onChange={(value) => setNavigationGroup(value as FoundationStoryNavigationGroupId)}
        ariaLabel="基础组件故事筛选"
      />
      <div className="space-y-4" data-testid="foundation-story-group" data-group={navigationGroup}>
        {activeStories.map((story) => (
          <UiControlsPanel key={story.viewId} initialSub={story.viewId as UiControlsSubId} />
        ))}
      </div>
    </div>
  )
}
