import type { LLMConfig } from '../../../../src/shared/types'
import { hasLLMAuthentication } from '../../../../src/shared/llm-connection-test'
import { chatComplete } from '../../llm/index'
import { compileMomentCommentRequest } from '../../prompts/registered-request'
import { MOMENT_COMMENT_POLICY as policy } from '../../prompts/moment-comment'
import { buildRosterLines, type RosterLine } from '../cast/roster'
import { createLogger } from '../../utils/logger'
import type { CompanionEvent } from '../types'
import { deriveCastInteractions, type MomentInteraction } from './moment-interactions'

const log = createLogger('MomentComment')
export function parseMomentComment(raw: string): string | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (Object.keys(record).length !== 1 || typeof record.comment !== 'string') return null
    const comment = record.comment.trim()
    return comment.length >= policy.minCharacters && comment.length <= policy.maxCharacters && !/[\r\n<>]/.test(comment) ? comment : null
  } catch { return null }
}

/** 背景：NPC 评论已有展示与投影，但原来只选固定短句；意图：在原有 preferLlm 路径增强内容，失败仍可完整发布。
 * 约束：不改变选人和同框，不启动对方生活，不读取 protected；仅既有 preferLlm 路径新增最多一次评论请求，失败只影响该条评论。
 */
export async function resolveCastInteractions(event: CompanionEvent, options: {
  preferLlm?: boolean; llmConfig?: LLMConfig; universeId?: string; postText: string; roster?: RosterLine[]
}): Promise<MomentInteraction[]> {
  const roster = options.roster ?? buildRosterLines(event.roleId, options.universeId)
  const original = deriveCastInteractions(event, { roster })
  if (!options.preferLlm || !options.llmConfig || !hasLLMAuthentication(options.llmConfig) || !options.postText.trim()) return original
  const result: MomentInteraction[] = []
  for (const item of original) {
    const brief = item.kind === 'comment' ? roster.find(person => person.otherId === item.castId) : undefined
    if (!brief || item.kind !== 'comment') { result.push(item); continue }
    try {
      const raw = await chatComplete({ config: options.llmConfig, request: compileMomentCommentRequest({ posterName: event.roleId, postText: options.postText.slice(0, policy.maxPostCharacters), commenterName: item.castName, commenterBrief: brief.text.slice(0, policy.maxBriefCharacters) }), caller: 'moment-comment', temperature: policy.temperature, maxTokens: policy.maxTokens })
      const text = parseMomentComment(raw)
      if (!text) log.warn('Generated comment rejected', { eventId: event.id, commenterId: item.castId })
      result.push(text ? { ...item, text } : item)
    } catch {
      log.warn('Generated comment unavailable; keeping rule text', { eventId: event.id, commenterId: item.castId })
      result.push(item)
    }
  }
  return result
}
