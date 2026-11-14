import { scheduleReflectionAfterChat } from '../companion/growth/reflection-service'
import { settleVitalsAfterChat } from '../companion/life/world-state'
import { markResonanceFeedbackDelivered, settleChatResonance } from '../companion/life/chat-resonance'
import type { LLMConfig } from '../../../src/shared/types'
import { createLogger } from '../utils/logger'
import { formatRelationshipStageForPrompt, resolveRelationshipStageForRole } from '../companion/growth/relationship-stage'
import { getMilestonePromptHint, recordAndBroadcastMilestone } from '../companion/growth/milestones'
import { loadRoleAssembleInput } from '../companion/orchestrator'

export const loadConversationAssemblyInput = loadRoleAssembleInput

const log = createLogger('ConversationApplicationService')

/**
 * 组织一次对话完成后的产品领域副作用。
 *
 * 背景：Runtime 同时承担 Agent Loop 生命周期和伙伴生活结算，新增领域行为会持续扩大通用执行器的依赖面。
 * 设计意图：应用服务接收会话完成事实并编排 Companion 用例，Runtime 只负责调用生命周期边界。
 * 关键约束：只有主角主会话结算生命体征、共鸣和反馈，召唤会话仍只触发反思任务，所有副作用失败都记录后异步收敛。
 */
export function settleConversationCompletion(input: {
  roleId: string
  sessionId: string
  sessionKind?: string
  llmConfig: LLMConfig
  pendingFeedbackId?: string
}): void {
  void scheduleReflectionAfterChat(input.roleId, input.sessionId, input.llmConfig, { sessionKind: input.sessionKind })
  if (input.sessionKind !== 'main') return
  settleVitalsAfterChat(input.roleId).catch(error => {
    log.warn('对话后结算角色生命体征失败', { roleId: input.roleId, error: error instanceof Error ? error.message : String(error) })
  })
  settleChatResonance(input.roleId, input.sessionId, input.llmConfig).catch(error => {
    log.warn('对话后提取生活因果反哺失败', { roleId: input.roleId, error: error instanceof Error ? error.message : String(error) })
  })
  if (input.pendingFeedbackId) {
    markResonanceFeedbackDelivered(input.pendingFeedbackId).catch(error => {
      log.warn('标记心愿反馈已送达失败', { feedbackId: input.pendingFeedbackId, error: error instanceof Error ? error.message : String(error) })
    })
  }
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
