/**
 * Foundation 基础能力工作台：按组件数量、预览空间和开发者任务拆分入口，同时承载注册表里的完整基础故事。
 *
 * 设计约束：产品体验只能引用这里登记为 foundation 的资产；业务专属结构不在此重复实现。
 * 导航分组只调整入口边界，不删除或合并底层 story key；每个组仍渲染完整的隔离预览。
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
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]" data-testid="foundation-state-matrix" style={{ color: 'var(--text-muted)' }}>
        <span className="mr-1 font-medium" style={{ color: 'var(--text-secondary)' }}>统一检查</span>
        {['默认', 'hover', 'pressed', 'focus', '禁用', '错误 / 空态', '窄宽', '键盘 / ARIA'].map((item) => (
          <span key={item} className="rounded-full border px-1.5 py-0.5" style={{ borderColor: 'var(--border-subtle)' }}>{item}</span>
        ))}
      </div>
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
