/**
 * Foundation 故事注册表：Playground 基础组件入口的唯一事实源。
 *
 * 背景：组件资产注册表回答“组件是什么”，但不能同时承担 Playground Tab、分组和预览渲染关系。
 * 设计意图：用稳定 story key 把组件资产、入口顺序、分组和 renderer 串成一条关系链；catalog 与工作台只做派生视图。
 * 关键约束：assetKey 必须指向 foundation 资产；候选故事可以展示隔离样张，但不能改变组件资产生命周期或生产默认行为。
 */

import {
  UI_COMPONENT_REGISTRY,
  type FoundationComponentKey,
  type UiComponentStatus,
} from './ui-component-registry'

export type FoundationStoryGroupId = 'behavior' | 'state' | 'developer'
export type FoundationStoryNavigationGroupId = 'buttons' | 'input-form' | 'tabs-selection' | 'overlay' | 'menu-tooltip' | 'badge-tag' | 'state-feedback' | 'loading-progress' | 'tool-card' | 'content-assets' | 'file-diff' | 'layout-scroll' | 'cards'
export type FoundationStoryRendererId = 'ui-controls' | 'advanced'
export type FoundationStoryLifecycle = UiComponentStatus

export interface FoundationStoryGroupDefinition {
  id: FoundationStoryGroupId
  label: string
  description: string
}

export interface FoundationStoryNavigationGroupDefinition {
  id: FoundationStoryNavigationGroupId
  label: string
  description: string
}

export interface FoundationStoryRecord {
  key: string
  viewId: string
  assetKey: FoundationComponentKey
  labelZh: string
  group: FoundationStoryGroupId
  renderer: FoundationStoryRendererId
  navigationGroup: FoundationStoryNavigationGroupId
}

export const FOUNDATION_STORY_GROUPS: readonly FoundationStoryGroupDefinition[] = [
  { id: 'behavior', label: '基础控件', description: '输入、选择、表单和浮层交互' },
  { id: 'state', label: '状态反馈', description: '空态、加载、错误与任务进度' },
  { id: 'developer', label: '开发基础', description: '工具、文档、文件和调试辅助视图' },
] as const

/** 入口按组件数量、预览空间和开发者任务拆分；每个入口仍渲染注册表里的完整故事。 */
export const FOUNDATION_STORY_NAVIGATION_GROUPS: readonly FoundationStoryNavigationGroupDefinition[] = [
  { id: 'buttons', label: '按钮', description: '主要、次要、图标、禁用与操作按钮' },
  { id: 'input-form', label: '输入与表单', description: '输入框、表单字段、复选框与开关' },
  { id: 'tabs-selection', label: '标签与选择', description: '标签切换、下拉选择和可搜索选择' },
  { id: 'overlay', label: '弹层', description: '对话框与弹出层等页面层级交互' },
  { id: 'menu-tooltip', label: '菜单与提示', description: '下拉菜单、命令面板、右键菜单和提示浮层' },
  { id: 'badge-tag', label: '徽标与标签', description: '状态徽标、分类标签和可移除芯片' },
  { id: 'state-feedback', label: '状态反馈', description: '空态、确认、错误和提示反馈' },
  { id: 'loading-progress', label: '加载与进度', description: '加载指示器、骨架屏和任务进度' },
  { id: 'tool-card', label: '工具卡', description: '工具调用过程、参数、结果和错误状态' },
  { id: 'content-assets', label: 'Markdown 与资产', description: '正文、代码、表格和资产信息展示' },
  { id: 'file-diff', label: '文件与差异', description: '文件树和版本差异查看' },
  { id: 'layout-scroll', label: '布局与滚动', description: '滚动区域、分隔线和分栏拖拽' },
  { id: 'cards', label: '卡片', description: '静态、可交互和长内容通用卡片' },
] as const

export const FOUNDATION_STORIES = [
  { key: 'foundation.button', viewId: 'buttons', assetKey: 'behavior.button', labelZh: '按钮', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'buttons' },
  { key: 'foundation.input', viewId: 'inputs', assetKey: 'behavior.input', labelZh: '输入', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'input-form' },
  { key: 'foundation.icon-button', viewId: 'icon-button', assetKey: 'behavior.icon-button', labelZh: '图标按钮', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'buttons' },
  { key: 'foundation.card', viewId: 'card', assetKey: 'behavior.card', labelZh: '卡片', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'cards' },
  { key: 'foundation.badge', viewId: 'badge', assetKey: 'behavior.badge', labelZh: '徽标', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'badge-tag' },
  { key: 'foundation.tag', viewId: 'tag', assetKey: 'behavior.tag', labelZh: '标签', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'badge-tag' },
  { key: 'foundation.tabs', viewId: 'tabs', assetKey: 'behavior.tabs', labelZh: '标签切换', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'tabs-selection' },
  { key: 'foundation.select', viewId: 'select', assetKey: 'behavior.select', labelZh: '下拉选择', group: 'behavior', renderer: 'advanced', navigationGroup: 'tabs-selection' },
  { key: 'foundation.combobox', viewId: 'combobox', assetKey: 'behavior.combobox', labelZh: '可搜索选择', group: 'behavior', renderer: 'advanced', navigationGroup: 'tabs-selection' },
  { key: 'foundation.form-field', viewId: 'form-field', assetKey: 'behavior.form-field', labelZh: '表单字段', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.checkbox', viewId: 'checkbox', assetKey: 'behavior.checkbox', labelZh: '复选框', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.switch', viewId: 'switch', assetKey: 'behavior.switch', labelZh: '开关', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.dialog', viewId: 'dialog', assetKey: 'behavior.dialog', labelZh: '对话框', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay' },
  { key: 'foundation.popover', viewId: 'popover', assetKey: 'behavior.popover', labelZh: '弹出层', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay' },
  { key: 'foundation.dropdown-menu', viewId: 'dropdown-menu', assetKey: 'behavior.dropdown-menu', labelZh: '下拉菜单', group: 'behavior', renderer: 'advanced', navigationGroup: 'menu-tooltip' },
  { key: 'foundation.command', viewId: 'command', assetKey: 'behavior.command', labelZh: '命令面板', group: 'behavior', renderer: 'advanced', navigationGroup: 'menu-tooltip' },
  { key: 'foundation.context-menu', viewId: 'context-menu', assetKey: 'behavior.context-menu', labelZh: '右键菜单', group: 'behavior', renderer: 'advanced', navigationGroup: 'menu-tooltip' },
  { key: 'foundation.tooltip', viewId: 'tooltip', assetKey: 'behavior.tooltip', labelZh: '提示浮层', group: 'behavior', renderer: 'advanced', navigationGroup: 'menu-tooltip' },
  { key: 'foundation.empty', viewId: 'empty', assetKey: 'state.empty', labelZh: '空态', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.confirm', viewId: 'confirm', assetKey: 'state.permission-confirm', labelZh: '确认框', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.feedback', viewId: 'feedback', assetKey: 'state.error', labelZh: '错误与反馈', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.toast', viewId: 'toast', assetKey: 'state.toast', labelZh: '提示条', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.spinner', viewId: 'spinner', assetKey: 'state.spinner', labelZh: '加载指示器', group: 'state', renderer: 'ui-controls', navigationGroup: 'loading-progress' },
  { key: 'foundation.skeleton', viewId: 'skeleton', assetKey: 'state.skeleton', labelZh: '骨架屏', group: 'state', renderer: 'advanced', navigationGroup: 'loading-progress' },
  { key: 'foundation.progress', viewId: 'progress', assetKey: 'state.progress', labelZh: '进度条', group: 'state', renderer: 'advanced', navigationGroup: 'loading-progress' },
  { key: 'foundation.tool-cards', viewId: 'tool-cards', assetKey: 'developer.tool-callback', labelZh: '工具卡', group: 'developer', renderer: 'ui-controls', navigationGroup: 'tool-card' },
  { key: 'foundation.markdown', viewId: 'markdown', assetKey: 'developer.markdown', labelZh: 'Markdown 渲染', group: 'developer', renderer: 'ui-controls', navigationGroup: 'content-assets' },
  { key: 'foundation.asset-table', viewId: 'asset-table', assetKey: 'developer.asset-table', labelZh: '资产目录', group: 'developer', renderer: 'ui-controls', navigationGroup: 'content-assets' },
  { key: 'foundation.file-tree', viewId: 'file-tree', assetKey: 'developer.file-tree', labelZh: '文件树', group: 'developer', renderer: 'ui-controls', navigationGroup: 'file-diff' },
  { key: 'foundation.diff-viewer', viewId: 'diff-viewer', assetKey: 'developer.diff-viewer', labelZh: '差异查看器', group: 'developer', renderer: 'advanced', navigationGroup: 'file-diff' },
  { key: 'foundation.scroll-area', viewId: 'scroll-area', assetKey: 'behavior.scroll-area', labelZh: '滚动区域', group: 'developer', renderer: 'advanced', navigationGroup: 'layout-scroll' },
  { key: 'foundation.resize-handle', viewId: 'resize-handle', assetKey: 'layout.resize-handle', labelZh: '分栏拖拽', group: 'developer', renderer: 'ui-controls', navigationGroup: 'layout-scroll' },
  { key: 'foundation.divider', viewId: 'divider', assetKey: 'layout.divider', labelZh: '分隔线', group: 'developer', renderer: 'ui-controls', navigationGroup: 'layout-scroll' },
] as const satisfies readonly FoundationStoryRecord[]

export type FoundationStoryDefinition = (typeof FOUNDATION_STORIES)[number]
export type FoundationStoryKey = FoundationStoryDefinition['key']
export type FoundationStoryViewId = FoundationStoryDefinition['viewId']
export type AdvancedFoundationStory = Extract<FoundationStoryDefinition, { renderer: 'advanced' }>
export type AdvancedFoundationStoryKey = AdvancedFoundationStory['key']

export const FOUNDATION_STORY_REGISTRY = Object.fromEntries(
  FOUNDATION_STORIES.map((story) => [story.key, story]),
) as Record<FoundationStoryKey, FoundationStoryDefinition>

const FOUNDATION_STORY_BY_VIEW = Object.fromEntries(
  FOUNDATION_STORIES.map((story) => [story.viewId, story]),
) as Record<FoundationStoryViewId, FoundationStoryDefinition>

export function getFoundationStory(key: FoundationStoryKey): FoundationStoryDefinition {
  return FOUNDATION_STORY_REGISTRY[key]
}

export function getFoundationStoryByViewId(viewId: string): FoundationStoryDefinition | undefined {
  return FOUNDATION_STORY_BY_VIEW[viewId as FoundationStoryViewId]
}

export function getFoundationStoriesByGroup(group: FoundationStoryGroupId): readonly FoundationStoryDefinition[] {
  return FOUNDATION_STORIES.filter((story) => story.group === group)
}

export function getFoundationStoriesByNavigationGroup(group: FoundationStoryNavigationGroupId): readonly FoundationStoryDefinition[] {
  return FOUNDATION_STORIES.filter((story) => story.navigationGroup === group)
}

export function getFoundationStoryLifecycle(story: FoundationStoryDefinition): FoundationStoryLifecycle {
  return UI_COMPONENT_REGISTRY[story.assetKey].status
}

export function getFoundationStoryLabels(): readonly string[] {
  return FOUNDATION_STORIES.map((story) => story.labelZh)
}
