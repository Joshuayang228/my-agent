/**
 * Foundation 基础能力工作台：按单行故事筛选展示可复用基础资产的真实预览。
 *
 * 设计约束：产品体验只能引用这里登记为 foundation 的资产；业务专属结构不在此重复实现。
 * 完整资产登记和候选状态由注册表 / Debug 承担，这里不重复堆叠无预览价值的文字清单。
 */

import { useState } from 'react'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { UiControlsPanel } from './UiControlsPanel'
import { PlaygroundStoryTabs } from './PlaygroundLayout'

const FOUNDATION_STORY_GROUPS: readonly { label: string; ids: readonly UiControlsSubId[] }[] = [
  { label: '基础控件', ids: ['buttons', 'inputs', 'tabs', 'select', 'combobox', 'form-field', 'checkbox', 'switch', 'dialog', 'popover', 'dropdown-menu', 'command', 'context-menu', 'tooltip'] },
  { label: '状态反馈', ids: ['empty', 'toast', 'spinner', 'skeleton', 'progress', 'confirm', 'feedback'] },
  { label: '开发基础', ids: ['tool-cards', 'markdown', 'asset-table', 'file-tree', 'diff-viewer', 'scroll-area', 'resize-handle'] },
] as const

export function FoundationComponentsPanel() {
  const [story, setStory] = useState<UiControlsSubId>('buttons')

  return (
    <div className="w-full space-y-4" data-testid="foundation-components-panel">
      <PlaygroundStoryTabs
        groups={FOUNDATION_STORY_GROUPS.map((group) => ({
          label: group.label,
          items: UI_CONTROLS_SUBTABS.filter((item) => group.ids.includes(item.id)),
        }))}
        value={story}
        onChange={(value) => setStory(value as UiControlsSubId)}
        ariaLabel="基础组件故事筛选"
      />
      <UiControlsPanel initialSub={story} />
    </div>
  )
}
