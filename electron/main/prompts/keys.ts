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
  featureMomentReply: promptKey('feature:moment-reply'),
  featureProactiveGreeting: promptKey('feature:proactive-greeting'),
  featureImageGeneration: promptKey('feature:image-generation'),
  featureProfileExtraction: promptKey('feature:profile-extraction'),
  imageDraft: promptKey('image-request-draft'),
  worldAssetImageDraft: promptKey('world-asset-image-request-draft'),
  imageGeneration: promptKey('image-generation'),
  momentComment: promptKey('companion-moment-comment'),
  momentReply: promptKey('companion-moment-reply'),
  proactiveGreeting: promptKey('companion-proactive-greeting'),
  promptCompiler: promptKey('prompt-compiler'),
  loopDefault: promptKey('loop-default'),
  loopTimeContext: promptKey('loop-time-context'),
  loopOutputRecovery: promptKey('loop-output-recovery'),
  compactRestoreContext: promptKey('compact-restore-context'),
  playgroundDefault: promptKey('playground-default'),
  playgroundDraft: promptKey('playground-draft'),
  playgroundModelTest: promptKey('playground-model-test'),
  l3Collapse: promptKey('l3-collapse'),
  l4Autocompact: promptKey('l4-autocompact'),
  profileExtraction: promptKey('profile-extraction'),
  profileExtractionInput: promptKey('profile-extraction-input'),
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
  workspaceContext: promptKey('workspace-context'),
  companionContext: promptKey('companion-context'),
  companionMutableState: promptKey('companion-mutable-state'),
  companionCompiler: promptKey('companion-compiler'),
  companionReflection: promptKey('companion-reflection'),
  companionCatchup: promptKey('companion-catchup'),
  companionMomentPolish: promptKey('companion-moment-polish'),
  companionDayScript: promptKey('companion-day-script'),
  subagentSystem: promptKey('subagent-system'),
  permissionDenial: promptKey('permission-denial'),
  evalInput: promptKey('eval-input'),
  evalJudge: promptKey('eval-judge'),
} as const

export type CorePromptAssetKey = typeof PROMPT_KEYS[keyof typeof PROMPT_KEYS]
export const ROLE_PROMPT_SUMMARY_SUFFIX = 'summary.txt' as const

export type RolePromptSuffix =
  | 'protected.md'
  | 'mutable.default.md'
  | 'voice.md'
  | 'summary.txt'
  | 'manifest.json'
  | 'profile.json'
  | 'world.default.json'
  | 'scenes/display.md'
  | 'scenes/interact.md'
  | 'scenes/execute.md'
  | `behaviors/${'moment-polish' | 'day-script' | 'catchup' | 'reflection'}.md`

export const ROLE_BEHAVIOR_PROMPT_SUFFIX = {
  momentPolish: 'behaviors/moment-polish.md',
  dayScript: 'behaviors/day-script.md',
  catchup: 'behaviors/catchup.md',
  reflection: 'behaviors/reflection.md',
} as const satisfies Record<string, RolePromptSuffix>

export const ROLE_BEHAVIOR_IDS = {
  momentPolish: 'moment-polish',
  dayScript: 'day-script',
  catchup: 'catchup',
  reflection: 'reflection',
} as const

export const PROMPT_BEHAVIOR_IDS = {
  momentPolish: PROMPT_KEYS.companionMomentPolish,
  dayScript: PROMPT_KEYS.companionDayScript,
  catchup: PROMPT_KEYS.companionCatchup,
  reflection: PROMPT_KEYS.companionReflection,
} as const

export function rolePromptAssetKey(roleId: string, suffix: RolePromptSuffix): PromptAssetKey {
  const structured = { 'manifest.json': 'manifest', 'profile.json': 'profile', 'world.default.json': 'world-default' } as const
  if (suffix in structured) return promptKey(`companion:default:${roleId}:${structured[suffix as keyof typeof structured]}`)
  return promptKey(`role-${roleId}-${suffix.replace(/[^a-z0-9]+/gi, '-')}`)
}
