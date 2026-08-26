/**
 * Playground 分组目录：用“设计 / Agent 实验”表达开发者任务，而不是平铺内部组件名。
 * 旧面板仍保留为独立实现，目录只负责入口、分组和可见性。
 */

import type { ProductExperienceTabId } from '../../shared/product-experience-registry'
import { FOUNDATION_STORIES, type FoundationStoryViewId } from '../../shared/foundation-story-registry'

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
  | 'tabs'
  | 'toast'
  | 'spinner'
  | 'markdown'
  | 'asset-table'
  | 'file-tree'
  | 'resize-handle'
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
  description?: string
  /** 页头右侧的实现来源；只登记真实文件路径，不复制组件实现。 */
  sourcePaths?: readonly string[]
  status?: PlaygroundTabStatus
}

export interface PlaygroundGroupDef {
  id: PlaygroundGroupId
  label: string
  description: string
}

export const PLAYGROUND_GROUPS: readonly PlaygroundGroupDef[] = [
  { id: 'foundation', label: '基础', description: '设计语言、视觉资产与可复用基础组件' },
  { id: 'experience', label: '产品体验', description: '页面、业务场景与状态组合' },
  { id: 'agent-experiments', label: 'Agent 实验', description: '隔离对话、模型能力与工具权限测试' },
] as const

/** 顶层入口只表达工作域；基础故事通过工作台筛选，产品页面按场景直接进入。 */
export const PLAYGROUND_TABS: readonly PlaygroundTabDef[] = [
  { id: 'design-tokens', label: '设计语言', group: 'foundation', description: '颜色、主题、圆角与动效，先建立可复用的视觉语言。', sourcePaths: ['src/components/playground/DesignSystemPanel.tsx', 'src/index.css'] },
  { id: 'visual-assets', label: '图标与视觉', group: 'foundation', description: '统一查看可复用图标和视觉资产，确认名称、尺寸与采用证据。', sourcePaths: ['src/components/playground/UiControlsPanel.tsx', 'src/shared/icon-registry.ts'] },
  { id: 'foundation-components', label: '基础组件', group: 'foundation', description: '先验收可复用基础能力，再让产品体验引用。', sourcePaths: ['src/components/playground/FoundationComponentsPanel.tsx', 'src/components/playground/FoundationAdvancedStories.tsx', 'src/shared/foundation-story-registry.ts'] },
  { id: 'chat', label: 'Chat', group: 'experience', description: '确认伙伴身份、会话导航、欢迎区与消息流的组合关系。' },
  { id: 'world', label: '人物世界', group: 'experience', description: '确认朋友圈、物什、名册和角色架如何组成生活面。' },
  { id: 'memory', label: '记忆', group: 'experience', description: '确认记忆列表、筛选、敏感项和编辑状态的阅读顺序。' },
  { id: 'settings', label: '设置', group: 'experience', description: '确认设置分组、字段编辑、自动保存和失败恢复的密度。' },
  { id: 'workspace', label: '工作区', group: 'experience', description: '确认文件、预览、审阅和终端在右侧工作区中的组合。' },
  { id: 'business-states', label: '业务状态', group: 'experience', description: '确认基础状态如何进入具体产品语义，而不是反向污染 Foundation。' },
  { id: 'chat-lab', label: '对话试验', group: 'agent-experiments', description: '隔离测试对话输入、上下文和回复行为。', sourcePaths: ['src/components/playground/PromptLabPanel.tsx'] },
  { id: 'model-test', label: '模型能力', group: 'agent-experiments', description: '隔离检查模型连接、能力探测和辅助调用。', sourcePaths: ['src/components/playground/ModelTestPanel.tsx'] },
  { id: 'tools', label: '工具手测', group: 'agent-experiments', description: '隔离检查工具参数、权限边界和执行反馈。', sourcePaths: ['src/components/playground/ToolRunPanel.tsx'] },
  // 兼容历史 localStorage / 深链接；不再显示为 active 导航。
  { id: 'design-system', label: 'Token 与主题（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'component-catalog', label: '组件目录（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'buttons', label: '按钮（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'inputs', label: '输入（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'tool-cards', label: '工具卡（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'empty', label: '空态（旧入口）', group: 'experience', status: 'archived' },
  { id: 'confirm', label: '确认框（旧入口）', group: 'experience', status: 'archived' },
  { id: 'memory-chips', label: '记忆引用（旧入口）', group: 'experience', status: 'archived' },
  { id: 'status-bar', label: '状态条（旧入口）', group: 'experience', status: 'archived' },
  { id: 'icons', label: '图标（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'feedback', label: '系统反馈（旧入口）', group: 'experience', status: 'archived' },
  { id: 'surface-baseline', label: '页面组合（旧入口）', group: 'experience', status: 'archived' },
  { id: 'ui-controls', label: '组件（旧入口）', group: 'foundation', status: 'archived' },
  { id: 'fixtures', label: '状态与边缘态（旧入口）', group: 'experience', status: 'archived' },
  { id: 'persona-review', label: '人格场景说明（旧入口）', group: 'agent-experiments', status: 'archived' },
] as const

export type UiControlsSubId = FoundationStoryViewId | 'memory-chips' | 'status-bar' | 'icons'

export interface UiControlsSubTab {
  id: UiControlsSubId
  label: string
}

/** Foundation Tab 由故事注册表派生；后三项是产品体验工作台仍复用的业务样张入口。 */
export const UI_CONTROLS_SUBTABS: readonly UiControlsSubTab[] = [
  ...FOUNDATION_STORIES.map((story) => ({ id: story.viewId, label: story.labelZh })),
  { id: 'memory-chips', label: '记忆引用' },
  { id: 'status-bar', label: '状态条' },
  { id: 'icons', label: '图标' },
]
