/**
 * Playground 目录与故事类型（轻量「故事」心智，非 Storybook）。
 * 纪律：只增不删；可标 archived。
 */

export type PlaygroundTabId =
  | 'design-system'
  | 'ui-controls'
  | 'surface-baseline'
  | 'persona-review'
  | 'chat-lab'
  | 'model-test'
  | 'tools'
  | 'fixtures'

export type PlaygroundTabStatus = 'active' | 'archived'

export interface PlaygroundTabDef {
  id: PlaygroundTabId
  label: string
  status?: PlaygroundTabStatus
}

/** 顶栏一等 tab（对齐 Alice 活目录，我方精简映射） */
export const PLAYGROUND_TABS: readonly PlaygroundTabDef[] = [
  { id: 'design-system', label: '设计系统' },
  { id: 'ui-controls', label: 'UI 控件' },
  { id: 'surface-baseline', label: '页面基线' },
  { id: 'persona-review', label: '人格验收' },
  { id: 'chat-lab', label: '对话试验' },
  { id: 'model-test', label: '模型测试' },
  { id: 'tools', label: '工具' },
  { id: 'fixtures', label: '体验夹具' },
] as const

export type UiControlsSubId =
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
