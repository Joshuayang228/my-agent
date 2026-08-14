/**
 * Prompt 稳定 key 的编译期入口。
 *
 * 背景：裸字符串无法阻止拼写错误，只有运行到 Debug 才会暴露 unknown key。
 * 设计意图：核心资产统一通过常量引用，Role Pack 资产只能通过工厂生成。
 * 关键约束：key 表示语义身份；文案润色、文件移动和 UI 改名不得修改既有值。
 */

import type { PromptAssetKey } from '../../../src/shared/types'

function promptKey<T extends string>(value: T): T & PromptAssetKey {
  return value as T & PromptAssetKey
}

export const PROMPT_KEYS = {
  systemLayers: promptKey('system-layers'),
  loopDefault: promptKey('loop-default'),
  playgroundDefault: promptKey('playground-default'),
  playgroundDraft: promptKey('playground-draft'),
  playgroundModelTest: promptKey('playground-model-test'),
  l3Collapse: promptKey('l3-collapse'),
  l4Autocompact: promptKey('l4-autocompact'),
  profileExtraction: promptKey('profile-extraction'),
  userProfileContext: promptKey('user-profile-context'),
  memoryRecallContext: promptKey('memory-recall-context'),
  embeddingInput: promptKey('embedding-input'),
  sessionTitle: promptKey('session-title'),
  connectionTest: promptKey('connection-test'),
  settingsSystemPrompt: promptKey('settings-system-prompt'),
  replyStance: promptKey('reply-stance'),
  toneControl: promptKey('tone-control'),
  relationshipStage: promptKey('relationship-stage'),
  relationshipMilestones: promptKey('relationship-milestones'),
  expertiseLevel: promptKey('expertise-level'),
  skillContext: promptKey('skill-context'),
  companionContext: promptKey('companion-context'),
  companionMutableState: promptKey('companion-mutable-state'),
  companionBackgroundTasks: promptKey('companion-background-tasks'),
  companionReflection: promptKey('companion-reflection'),
  companionCatchup: promptKey('companion-catchup'),
  companionMomentPolish: promptKey('companion-moment-polish'),
  companionDayScript: promptKey('companion-day-script'),
  subagentSystem: promptKey('subagent-system'),
  permissionDenial: promptKey('permission-denial'),
  evalJudge: promptKey('eval-judge'),
} as const

export type CorePromptAssetKey = typeof PROMPT_KEYS[keyof typeof PROMPT_KEYS]

export type RolePromptSuffix =
  | 'protected.md'
  | 'mutable.default.md'
  | 'voice.md'
  | 'scenes/display.md'
  | 'scenes/interact.md'
  | 'scenes/execute.md'

export function rolePromptAssetKey(roleId: string, suffix: RolePromptSuffix): PromptAssetKey {
  return promptKey(`role-${roleId}-${suffix.replace(/[^a-z0-9]+/gi, '-')}`)
}
