import { recoverCompanionFollowups } from '../companion/application/companion-followups'
import { recordCompanionEventAndNotify } from '../companion/application/record-event-notify'
import { COMPANION_FOLLOWUP } from '../companion/core/outbox/followup-kinds'
import type { PromptContextEvidence } from '../../../src/shared/types'
import { formatRelationshipStageForPrompt, resolveRelationshipStageForRole } from '../companion/growth/relationship-stage'
import { getMilestonePromptHint, recordAndBroadcastMilestone } from '../companion/growth/milestones'
import { loadRoleAssembleInput } from '../companion/orchestrator'
import { assertSessionRole } from '../companion/orchestrator'
import { describeCastPresence } from '../companion/cast/availability'
import { formatSummonSceneBlock } from '../companion/cast/scene-prompts'
import { summonParentDelegationHint } from '../companion/cast/summon-delegation'
import { registerStreamingProbe } from '../companion/streaming-gate'

export interface ConversationApplicationContext {
  agent: { id: string }
  session: { id: string; kind: string }
  traceId: string
  permission: { policyKey: string; executionMode: string }
  prompt: { contextEvidence: readonly PromptContextEvidence[] }
  domain: Awaited<ReturnType<typeof loadRoleAssembleInput>>
}

/**
 * 将一次对话所需的执行边界收拢到 Application 层。
 *
 * 背景：Runtime 需要同时协调会话、权限、领域读模型和 Prompt 证据，分散传参会让主会话、召唤会话和工作区会话逐渐产生不同事实源。
 * 设计意图：先建立不可变的上下文骨架，再由后续阶段附加 Prompt 证据，放弃在编译 Prompt 时临时拼装会话边界。
 * 关键约束：domain 必须来自当前会话绑定的 role，session 与 trace 标识必须保持原值，权限字段只描述策略选择，不能替代实际权限校验。
 */
export function createConversationApplicationContext(input: {
  agentId: string
  sessionId: string
  sessionKind: string
  traceId: string
  permissionPolicyKey: string
  executionMode: string
  domain: Awaited<ReturnType<typeof loadRoleAssembleInput>>
}): ConversationApplicationContext {
  return {
    agent: { id: input.agentId },
    session: { id: input.sessionId, kind: input.sessionKind },
    traceId: input.traceId,
    permission: { policyKey: input.permissionPolicyKey, executionMode: input.executionMode },
    prompt: { contextEvidence: [] },
    domain: input.domain,
  }
}

/**
 * 将已解析的上下文证据附着到对话上下文。
 *
 * 背景：Prompt 编译需要知道本轮允许引用哪些运行时数据，Application Context 是这份证据清单的唯一承载点。
 * 设计意图：返回新对象而不是原地改写，避免编译前后的上下文被异步任务共享时发生隐式变化。
 * 关键约束：证据数组会被复制，调用方不得借此写回领域读模型或扩大会话权限。
 */
export function attachConversationPromptContext(
  context: ConversationApplicationContext,
  contextEvidence: readonly PromptContextEvidence[],
): ConversationApplicationContext {
  return { ...context, prompt: { contextEvidence: [...contextEvidence] } }
}

/**
 * 根据会话类型生成可供 Prompt 编译器消费的领域证据索引。
 *
 * 背景：主会话需要生活世界，召唤会话只需要角色名册，工作区会话还可能需要外部上下文；这些差异必须在 Application 层显式表达。
 * 设计意图：只登记实际存在且当前场景允许使用的读模型，放弃在编译器内部通过大量条件分支重新判断会话语义。
 * 关键约束：证据索引不携带运行时正文，也不能把召唤会话的生活状态或无会话来源的数据注入 Prompt。
 */
export function buildConversationContextEvidence(input: {
  domain: Awaited<ReturnType<typeof loadRoleAssembleInput>>
  includeLifeContext: boolean
  hasSessionContext: boolean
  sessionContextSource: string
}): PromptContextEvidence[] {
  const { domain } = input
  return [
    ...(input.includeLifeContext && domain.relationshipSummary ? [{ key: 'companion.relationship', source: 'companion.relationship-state', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.emotionSummary ? [{ key: 'companion.emotion', source: 'companion.emotion-events', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.worldSlice ? [{ key: 'companion.world-state', source: 'companion.runtime-state', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.recentMomentsSlice ? [{ key: 'companion.recent-moments', source: 'companion.moments-read-model', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.lifeAssetsSlice ? [{ key: 'companion.life-assets', source: 'companion.assets-read-model', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.conversationImpulse ? [{ key: 'companion.conversation-impulse', source: 'companion.relationship-and-memory', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.catchupSummary ? [{ key: 'companion.catchup', source: 'companion.catchup-read-model', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(input.includeLifeContext && domain.bookshelfSlice ? [{ key: 'companion.bookshelf', source: 'companion.bookshelf-read-model', scope: 'turn' as const, maxChars: 4000 }] : []),
    ...(domain.rosterLines ? [{ key: 'companion.roster', source: 'companion.roster-read-model', scope: 'agent' as const, maxChars: 4000 }] : []),
    ...(input.hasSessionContext ? [{ key: 'session.context', source: input.sessionContextSource, scope: 'session' as const, maxChars: 12000 }] : []),
  ]
}

export async function loadConversationAssemblyInput(...args: Parameters<typeof loadRoleAssembleInput>): ReturnType<typeof loadRoleAssembleInput> {
  return loadRoleAssembleInput(...args)
}

export async function assertConversationSessionRole(sessionRoleId: string | undefined | null): ReturnType<typeof assertSessionRole> {
  return assertSessionRole(sessionRoleId)
}

export async function resolveConversationCastPresence(roleId: string): ReturnType<typeof describeCastPresence> {
  return describeCastPresence(roleId)
}

export function formatConversationSummonScene(roleId: string): ReturnType<typeof formatSummonSceneBlock> {
  return formatSummonSceneBlock(roleId)
}

export function getConversationDelegationHint(): string {
  return summonParentDelegationHint()
}

export function registerConversationStreamingProbe(probe: () => boolean): void {
  registerStreamingProbe(probe)
}

/**
 * 背景：主对话正文已保存但进程立即退出时，生命体征和已展示反馈仍需完成结算。
 * 设计意图：以真正保存的回复 ID 为来源，把最小结算任务和回复共同提交。
 * 关键约束：当前回调只允许写本地回复；消费使用原人物与反馈 ID，可以发生在后续进程。
 */
export async function commitConversationCompletion(input: {
  roleId: string
  sessionId: string
  assistantMessageId: string
  occurredAt: number
  pendingFeedbackId?: string
  saveReply: () => Promise<void>
}): Promise<void> {
  await recordCompanionEventAndNotify({
    roleId: input.roleId,
    type: 'conversation_turn_completed',
    sourceType: 'chat_message',
    sourceId: input.assistantMessageId,
    idempotencyKey: `conversation-completed:${input.sessionId}:${input.assistantMessageId}`,
    occurredAt: input.occurredAt,
    payload: { sessionId: input.sessionId, pendingFeedbackId: input.pendingFeedbackId },
    commit: input.saveReply,
    notification: [],
    followups: [COMPANION_FOLLOWUP.chatVitals, COMPANION_FOLLOWUP.chatResonance, COMPANION_FOLLOWUP.personaReflection, ...(input.pendingFeedbackId ? [COMPANION_FOLLOWUP.chatFeedback] : [])],
    dispatch: false,
  })
}

/**
 * 组织一次对话完成后的产品领域副作用。
 *
 * 背景：Runtime 同时承担 Agent Loop 生命周期和伙伴生活结算，新增领域行为会持续扩大通用执行器的依赖面。
 * 设计意图：应用服务接收会话完成事实并编排 Companion 用例，Runtime 只负责调用生命周期边界。
 * 关键约束：只有主角主会话登记生活副作用。这里只唤醒已经保存的任务，重启可从同一来源恢复。
 */
export function settleConversationCompletion(): void {
  void recoverCompanionFollowups()
}

export async function resolveConversationRelationshipHints(input: {
  roleId: string
  sessionKind: 'main' | 'summon'
  roleDisplayName: string
}): Promise<{ relationshipStageHint: string; milestoneHint?: string }> {
  const relationship = await resolveRelationshipStageForRole(input.roleId, { sessionKind: input.sessionKind })
  if (input.sessionKind === 'main' && relationship.stage === 'rapport') {
    void recordAndBroadcastMilestone(input.roleId, 'first_rapport', {
      roleDisplayName: input.roleDisplayName,
    }).catch(() => {})
  }
  return {
    relationshipStageHint: formatRelationshipStageForPrompt(relationship),
    milestoneHint: input.sessionKind === 'main' ? await getMilestonePromptHint(input.roleId) : undefined,
  }
}
