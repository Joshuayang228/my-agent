/**
 * Playground 分组目录：用“设计 / Agent 实验”表达开发者任务，而不是平铺内部组件名。
 * 旧面板仍保留为独立实现，目录只负责入口、分组和可见性。
 */

import type { ProductExperienceTabId } from '../../shared/product-experience-registry'

export type PlaygroundGroupId = 'foundation' | 'experience' | 'agent-experiments'

export type PlaygroundTabId =
  | 'design-tokens'
  | 'visual-assets'
  | 'foundation-components'
  | ProductExperienceTabId
  | 'chat-lab'
  | 'model-test'
  | 'tools'
  | 'design-system'
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
  | 'surface-baseline'
  | 'ui-controls'
  | 'persona-review'
  | 'fixtures'

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
  { id: 'foundation', label: '基础', description: '设计令牌、视觉资产与可复用基础组件' },
  { id: 'experience', label: '产品体验', description: '页面、业务场景与状态组合' },
  { id: 'agent-experiments', label: 'Agent 实验', description: '隔离对话、模型能力与工具权限测试' },
] as const

/** 顶层入口只表达工作域；基础故事通过工作台筛选，产品页面按场景直接进入。 */
export const PLAYGROUND_TABS: readonly PlaygroundTabDef[] = [
  { id: 'design-tokens', label: '设计令牌', group: 'foundation' },
  { id: 'visual-assets', label: '图标与视觉', group: 'foundation' },
  { id: 'foundation-components', label: '基础组件', group: 'foundation' },
  { id: 'chat', label: 'Chat', group: 'experience' },
  { id: 'world', label: '人物世界', group: 'experience' },
  { id: 'memory', label: '记忆', group: 'experience' },
  { id: 'settings', label: '设置', group: 'experience' },
  { id: 'workspace', label: '工作区', group: 'experience' },
  { id: 'business-states', label: '业务状态', group: 'experience' },
  { id: 'chat-lab', label: '对话试验', group: 'agent-experiments' },
  { id: 'model-test', label: '模型能力', group: 'agent-experiments' },
  { id: 'tools', label: '工具手测', group: 'agent-experiments' },
  // 兼容历史 localStorage / 深链接；不再显示为 active 导航。
  { id: 'design-system', label: 'Token 与主题（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'component-catalog', label: '组件目录（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'buttons', label: '按钮（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'inputs', label: '输入（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'tool-cards', label: '工具卡（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'empty', label: '空态（旧入口）', group: 'experience', status: 'archived' },
  { id: 'confirm', label: '确认框（旧入口）', group: 'experience', status: 'archived' },
  { id: 'memory-chips', label: '记忆芯片（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'status-bar', label: '状态条（旧入口）', group: 'experience', status: 'archived' },
  { id: 'icons', label: '图标（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'feedback', label: '系统反馈（旧入口）', group: 'experience', status: 'archived' },
  { id: 'surface-baseline', label: '页面组合（旧入口）', group: 'experience', status: 'archived' },
  { id: 'ui-controls', label: '组件（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'fixtures', label: '状态与边缘态（旧入口）', group: 'experience', status: 'archived' },
  { id: 'persona-review', label: '人格场景说明（旧入口）', group: 'agent-experiments', status: 'archived' },
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
  { id: 'component-catalog', label: '组件索引' },
  { id: 'buttons', label: '按钮' },
  { id: 'inputs', label: '输入' },
  { id: 'tool-cards', label: '工具卡' },
  { id: 'memory-chips', label: '记忆芯片' },
  { id: 'empty', label: '空态' },
  { id: 'confirm', label: '确认框' },
  { id: 'status-bar', label: '状态条' },
  { id: 'feedback', label: '错误与反馈' },
  { id: 'icons', label: '图标' },
] as const
