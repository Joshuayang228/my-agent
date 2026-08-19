/**
 * Playground 分组目录：用“设计 / Agent 实验”表达开发者任务，而不是平铺内部组件名。
 * 旧面板仍保留为独立实现，目录只负责入口、分组和可见性。
 */

export type PlaygroundGroupId = 'design' | 'agent-experiments'

export type PlaygroundTabId =
  | 'design-system'
  | 'ui-controls'
  | 'surface-baseline'
  | 'persona-review'
  | 'chat-lab'
  | 'model-test'
  | 'tools'
  | 'fixtures'
  | UiControlsSubId

export type PlaygroundTabStatus = 'active' | 'archived'

export interface PlaygroundTabDef {
  id: PlaygroundTabId
  label: string
  group: PlaygroundGroupId
  status?: PlaygroundTabStatus
}

export interface PlaygroundGroupDef {
  id: PlaygroundGroupId
  label: string
  description: string
}

export const PLAYGROUND_GROUPS: readonly PlaygroundGroupDef[] = [
  { id: 'design', label: '设计', description: 'Token、组件状态与页面组合实验' },
  { id: 'agent-experiments', label: 'Agent 实验', description: '隔离对话、模型能力与工具权限测试' },
] as const

/** 顶层入口只展示两个任务域；人格静态验收保留源码但不再作为 active 入口。 */
export const PLAYGROUND_TABS: readonly PlaygroundTabDef[] = [
  { id: 'design-system', label: 'Token 与主题', group: 'design' },
  { id: 'component-catalog', label: '组件目录', group: 'design' },
  { id: 'buttons', label: '按钮', group: 'design' },
  { id: 'inputs', label: '输入', group: 'design' },
  { id: 'tool-cards', label: '工具卡', group: 'design' },
  { id: 'empty', label: '空态', group: 'design' },
  { id: 'confirm', label: '确认框', group: 'design' },
  { id: 'memory-chips', label: '记忆芯片', group: 'design' },
  { id: 'status-bar', label: '状态条', group: 'design' },
  { id: 'icons', label: '图标', group: 'design' },
  { id: 'feedback', label: '系统反馈', group: 'design' },
  { id: 'surface-baseline', label: '页面组合', group: 'design' },
  { id: 'chat-lab', label: '对话试验', group: 'agent-experiments' },
  { id: 'model-test', label: '模型能力', group: 'agent-experiments' },
  { id: 'tools', label: '工具手测', group: 'agent-experiments' },
  { id: 'ui-controls', label: '组件（旧入口）', group: 'design', status: 'archived' },
  { id: 'fixtures', label: '状态与边缘态', group: 'design', status: 'archived' },
  { id: 'persona-review', label: '人格场景说明', group: 'agent-experiments', status: 'archived' },
] as const

export type UiControlsSubId =
  | 'component-catalog'
  | 'buttons'
  | 'inputs'
  | 'tool-cards'
  | 'empty'
  | 'confirm'
  | 'memory-chips'
  | 'status-bar'
  | 'icons'
  | 'feedback'

export const UI_CONTROLS_SUBTABS: readonly { id: UiControlsSubId; label: string }[] = [
  { id: 'component-catalog', label: '组件目录' },
  { id: 'buttons', label: '按钮' },
  { id: 'inputs', label: '输入' },
  { id: 'tool-cards', label: '工具卡' },
  { id: 'empty', label: '空态' },
  { id: 'confirm', label: '确认框' },
  { id: 'memory-chips', label: '记忆芯片' },
  { id: 'status-bar', label: '状态条' },
  { id: 'icons', label: '图标' },
  { id: 'feedback', label: '系统反馈' },
] as const
