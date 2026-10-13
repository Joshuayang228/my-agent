/**
 * 历史测试输入夹具，仅用于保持行为断言，不进入生产或 Eval。
 *
 * 背景：仓库内仍有若干行为单测直接构造旧的角色切片；生产运行时已统一走 prompts/compiler。
 * 设计意图：只转换输入，不再维护第二套 Prompt 文案，避免测试夹具阻止语义编译器迁移。
 * 关键约束：这里不得新增 Prompt 规则；所有正文必须由 compiler 生成。
 */
import { characterDefinitionFromRolePack, compileMainChatPrompt } from '../../electron/main/prompts/compiler'
import { formatRoleProfileForPrompt, formatRoleWorldDefaultsForPrompt } from '../../electron/main/companion/identity/profile'
import type { RoleProfile, RoleWorldDefaults } from '../../electron/main/companion/types'

export interface RolePromptParts {
  id: string
  name: string
  description: string
  protected: string
  profile?: string
  worldProfile?: string
  mutable: string
  aside_style?: string
  voice?: string
}
export type PersonaTemplate = RolePromptParts
export interface PromptContext {
  persona: RolePromptParts
  toolNames: string[]
  userProfile?: { identity: string; workflow: string; voice: string }
  memories?: string
  sessionInfo?: string
  skillSummary?: string
  activeSkillBody?: string
  executionMode?: string
  catchupSummary?: string
  worldSlice?: string
  recentMomentsSlice?: string
  bookshelfSlice?: string
  rosterLines?: string
  replyStanceHint?: string
  toneControlHint?: string
  relationshipStageHint?: string
  milestoneHint?: string
  expertiseHint?: string
}

export function rolePackToPromptParts(pack: {
  id: string; name: string; description: string; protected: string; mutableDefault: string
  asideStyle?: string; voice?: string; profile?: RoleProfile; worldDefaults?: RoleWorldDefaults
}, mutableBody?: string): RolePromptParts {
  return {
    id: pack.id, name: pack.name, description: pack.description, protected: pack.protected,
    mutable: mutableBody ?? pack.mutableDefault, aside_style: pack.asideStyle,
    profile: pack.profile ? formatRoleProfileForPrompt(pack.profile) : undefined,
    worldProfile: pack.worldDefaults ? formatRoleWorldDefaultsForPrompt(pack.worldDefaults) : undefined,
    voice: pack.voice,
  }
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const character = characterDefinitionFromRolePack({
    id: ctx.persona.id, name: ctx.persona.name, description: ctx.persona.description,
    protected: ctx.persona.protected, mutableDefault: ctx.persona.mutable,
    voice: ctx.persona.voice, asideStyle: ctx.persona.aside_style,
  }, ctx.persona.mutable)
  return compileMainChatPrompt({
    character: { ...character, profile: ctx.persona.profile, worldDefault: ctx.persona.worldProfile },
    platform: { toolNames: ctx.toolNames, executionMode: ctx.executionMode },
    behavior: {
      key: 'main-chat', purpose: '在当前人物与会话情境中回应用户并完成请求。',
      replyStance: ctx.replyStanceHint, toneControl: ctx.toneControlHint,
      relationshipStage: ctx.relationshipStageHint, milestone: ctx.milestoneHint,
      expertise: ctx.expertiseHint, skillSummary: ctx.skillSummary, activeSkillBody: ctx.activeSkillBody,
    },
    situation: {
      userProfile: ctx.userProfile, memories: ctx.memories, sessionInfo: ctx.sessionInfo,
      catchupSummary: ctx.catchupSummary, worldSlice: ctx.worldSlice,
      recentMomentsSlice: ctx.recentMomentsSlice, bookshelfSlice: ctx.bookshelfSlice, rosterLines: ctx.rosterLines,
    },
    currentDate: new Date().toLocaleDateString('sv-SE'),
  }).text
}
