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
export type FoundationStoryNavigationGroupId = 'buttons' | 'input-form' | 'tabs-selection' | 'overlay-menu' | 'state-feedback' | 'developer-tools'
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

/** Playground 只展示较少的任务入口；每个入口下面仍渲染注册表里的完整故事。 */
export const FOUNDATION_STORY_NAVIGATION_GROUPS: readonly FoundationStoryNavigationGroupDefinition[] = [
  { id: 'buttons', label: '按钮', description: '主要、次要、禁用与操作按钮' },
  { id: 'input-form', label: '输入与表单', description: '输入框、表单字段、复选框与开关' },
  { id: 'tabs-selection', label: '标签与选择', description: '标签切换、下拉选择和可搜索选择' },
  { id: 'overlay-menu', label: '弹层与菜单', description: '对话框、弹出层、菜单和提示浮层' },
  { id: 'state-feedback', label: '状态与反馈', description: '空态、确认、错误、提示和进度' },
  { id: 'developer-tools', label: '开发基础', description: '工具卡、Markdown、文件和开发辅助视图' },
] as const

export const FOUNDATION_STORIES = [
  { key: 'foundation.button', viewId: 'buttons', assetKey: 'behavior.button', labelZh: '按钮', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'buttons' },
  { key: 'foundation.input', viewId: 'inputs', assetKey: 'behavior.input', labelZh: '输入', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'input-form' },
  { key: 'foundation.tabs', viewId: 'tabs', assetKey: 'behavior.tabs', labelZh: '标签切换', group: 'behavior', renderer: 'ui-controls', navigationGroup: 'tabs-selection' },
  { key: 'foundation.select', viewId: 'select', assetKey: 'behavior.select', labelZh: '下拉选择', group: 'behavior', renderer: 'advanced', navigationGroup: 'tabs-selection' },
  { key: 'foundation.combobox', viewId: 'combobox', assetKey: 'behavior.combobox', labelZh: '可搜索选择', group: 'behavior', renderer: 'advanced', navigationGroup: 'tabs-selection' },
  { key: 'foundation.form-field', viewId: 'form-field', assetKey: 'behavior.form-field', labelZh: '表单字段', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.checkbox', viewId: 'checkbox', assetKey: 'behavior.checkbox', labelZh: '复选框', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.switch', viewId: 'switch', assetKey: 'behavior.switch', labelZh: '开关', group: 'behavior', renderer: 'advanced', navigationGroup: 'input-form' },
  { key: 'foundation.dialog', viewId: 'dialog', assetKey: 'behavior.dialog', labelZh: '对话框', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.popover', viewId: 'popover', assetKey: 'behavior.popover', labelZh: '弹出层', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.dropdown-menu', viewId: 'dropdown-menu', assetKey: 'behavior.dropdown-menu', labelZh: '下拉菜单', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.command', viewId: 'command', assetKey: 'behavior.command', labelZh: '命令面板', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.context-menu', viewId: 'context-menu', assetKey: 'behavior.context-menu', labelZh: '右键菜单', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.tooltip', viewId: 'tooltip', assetKey: 'behavior.tooltip', labelZh: '提示浮层', group: 'behavior', renderer: 'advanced', navigationGroup: 'overlay-menu' },
  { key: 'foundation.empty', viewId: 'empty', assetKey: 'state.empty', labelZh: '空态', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.confirm', viewId: 'confirm', assetKey: 'state.permission-confirm', labelZh: '确认框', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.feedback', viewId: 'feedback', assetKey: 'state.error', labelZh: '错误与反馈', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.toast', viewId: 'toast', assetKey: 'state.toast', labelZh: '提示条', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.spinner', viewId: 'spinner', assetKey: 'state.spinner', labelZh: '加载指示器', group: 'state', renderer: 'ui-controls', navigationGroup: 'state-feedback' },
  { key: 'foundation.skeleton', viewId: 'skeleton', assetKey: 'state.skeleton', labelZh: '骨架屏', group: 'state', renderer: 'advanced', navigationGroup: 'state-feedback' },
  { key: 'foundation.progress', viewId: 'progress', assetKey: 'state.progress', labelZh: '进度条', group: 'state', renderer: 'advanced', navigationGroup: 'state-feedback' },
  { key: 'foundation.tool-cards', viewId: 'tool-cards', assetKey: 'developer.tool-callback', labelZh: '工具卡', group: 'developer', renderer: 'ui-controls', navigationGroup: 'developer-tools' },
  { key: 'foundation.markdown', viewId: 'markdown', assetKey: 'developer.markdown', labelZh: 'Markdown 渲染', group: 'developer', renderer: 'ui-controls', navigationGroup: 'developer-tools' },
  { key: 'foundation.asset-table', viewId: 'asset-table', assetKey: 'developer.asset-table', labelZh: '资产目录', group: 'developer', renderer: 'ui-controls', navigationGroup: 'developer-tools' },
  { key: 'foundation.file-tree', viewId: 'file-tree', assetKey: 'developer.file-tree', labelZh: '文件树', group: 'developer', renderer: 'ui-controls', navigationGroup: 'developer-tools' },
  { key: 'foundation.diff-viewer', viewId: 'diff-viewer', assetKey: 'developer.diff-viewer', labelZh: '差异查看器', group: 'developer', renderer: 'advanced', navigationGroup: 'developer-tools' },
  { key: 'foundation.scroll-area', viewId: 'scroll-area', assetKey: 'behavior.scroll-area', labelZh: '滚动区域', group: 'developer', renderer: 'advanced', navigationGroup: 'developer-tools' },
  { key: 'foundation.resize-handle', viewId: 'resize-handle', assetKey: 'layout.resize-handle', labelZh: '分栏拖拽', group: 'developer', renderer: 'ui-controls', navigationGroup: 'developer-tools' },
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
