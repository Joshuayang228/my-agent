import type { ToolDefinition } from '../../../../src/shared/types'
import { getSession } from '../../storage/session-store'
import { loadRelations } from '../identity/loader'
import { executeCompanionCommand } from '../core/commands/gateway'
import { createCompanionLifeEvent } from './life-event'
import { projectMomentFromEvent } from '../life/moments'

export function textArg(args: Record<string, unknown>, key: string, max: number): string {
  const value = typeof args[key] === 'string' ? args[key].trim() : ''
  return value.length <= max ? value : ''
}

function imageIdsFromSession(session: Awaited<ReturnType<typeof getSession>>, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return []
  if (raw.length > 9 || raw.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) return null
  const owned = new Set(session?.messages.filter(message => message.role === 'tool').flatMap(message => message.generatedImages ?? []).map(image => image.id))
  const ids = [...new Set(raw)] as string[]
  return ids.every(id => owned.has(id)) ? ids : null
}

const RELATION_PHASES = ['bonding', 'friction', 'repair', 'milestone'] as const
type RelationPhase = (typeof RELATION_PHASES)[number]

function relationParticipants(roleId: string, raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return []
  if (raw.length > 4 || raw.some(id => typeof id !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(id))) return null
  const known = new Set(loadRelations().edges.flatMap(edge => edge.from === roleId ? [edge.to] : edge.to === roleId ? [edge.from] : []))
  const ids = [...new Set(raw)] as string[]
  return ids.every(id => known.has(id)) ? ids : null
}

export const POST_MOMENT_DEFINITION: Pick<ToolDefinition, 'description' | 'parameters'> = {
  description: '把当前人物刚刚确认发生的生活片段发布到朋友圈；可附图片、关系参与者和关系阶段。只记录明确事实，不替人物编造经历。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '朋友圈正文，最多 2000 字。' },
      activity: { type: 'string', description: '这次生活事件的短标题，最多 120 字。' },
      location: { type: 'string', description: '发生地点，例如千里阳光号甲板；可省略。' },
      imageIds: { type: 'array', description: '可选：本会话已生成图片的摘要 ID，最多 9 个。' },
      participantIds: { type: 'array', description: '可选：共同在场的关系对象 ID，必须来自当前人物关系表，最多 4 个。' },
      relationshipPhase: { type: 'string', description: '可选：这次关系事件处于建立、摩擦、修复或里程碑阶段。', enum: [...RELATION_PHASES] },
      relationshipNote: { type: 'string', description: '可选：对关系变化的事实说明，最多 300 字。' },
    },
    required: ['text'],
  },
}

/**
 * 背景：自然语言工具与宿主工作流需要共享同一条朋友圈写入路径。
 * 设计意图：参数校验、人物校验和事务提交由应用用例承担，两种入口只负责协议转换。
 * 关键约束：图片归属本会话，关系参与者来自当前人物关系表，投影失败回滚整个本地事务。
 */
export async function publishCompanionMoment(args: Record<string, unknown>, context?: { roleId?: string; sessionId?: string; operationKey?: string; toolCallId?: string }): Promise<string> {
  const roleId = context?.roleId?.trim()
  if (!roleId) return '当前会话没有绑定人物，暂时不能发布朋友圈。'
  const text = textArg(args, 'text', 2000)
  if (!text) return '朋友圈正文不能为空，且不能超过 2000 字。'
  const session = context?.sessionId ? await getSession(context.sessionId) : null
  const imageIds = imageIdsFromSession(session, args.imageIds)
  if (imageIds === null) return '图片只能引用本会话已生成的图片，最多 9 张。'
  const participantIds = relationParticipants(roleId, args.participantIds)
  if (participantIds === null) return '关系参与者必须是当前人物关系表中的对象，最多 4 个。'
  const phase = typeof args.relationshipPhase === 'string' && RELATION_PHASES.includes(args.relationshipPhase as RelationPhase) ? args.relationshipPhase as RelationPhase : ''
  if (args.relationshipPhase !== undefined && !phase) return `关系阶段无效，可选：${RELATION_PHASES.join('、')}。`
  const relationshipNote = textArg(args, 'relationshipNote', 300)
  const activity = textArg(args, 'activity', 120) || text.slice(0, 80)
  const location = textArg(args, 'location', 160)
  return executeCompanionCommand({
    roleId,
    actionType: 'post-moment',
    idempotencyKey: context?.operationKey ?? (context?.sessionId && context.toolCallId
      ? JSON.stringify([context.sessionId, context.toolCallId])
      : undefined),
    local: true,
    handler: async () => {
      const event = await createCompanionLifeEvent({
        roleId,
        scheduledAt: Date.now(),
        status: 'published',
        type: 'moment',
        dayScriptId: null,
        payload: {
          activity,
          story: text,
          ...(location ? { location } : {}),
          ...(imageIds.length ? { imageIds } : {}),
          ...(participantIds.length ? { participantIds } : {}),
          ...(phase || relationshipNote ? { relationship: { ...(phase ? { phase } : {}), ...(relationshipNote ? { note: relationshipNote } : {}) } } : {}),
        },
      })
      try {
        const moment = await projectMomentFromEvent(event, { preferLlm: false })
        if (!moment) throw new Error('朋友圈投影未创建')
        return `已发布朋友圈（动态 ID：${moment.id}）。${imageIds.length ? `已附 ${imageIds.length} 张图片。` : ''}`
      } catch (error) {
        throw new Error(`朋友圈发布失败，已回滚未完成的记录：${error instanceof Error ? error.message : '投影失败'}`)
      }
    },
  })
}
