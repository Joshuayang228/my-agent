import type { CompanionMoment } from '../../types'
import * as legacyStore from '../../life/store'

/**
 * 迁移期生活投影写入口。
 *
 * 背景：朋友圈、关系、情绪和事件关联仍由旧表提供查询接口，多个生活服务直接写这些表会让投影边界继续扩散。
 * 设计意图：把旧表写入集中为 Core Projection Adapter，所有调用者先提交 Domain Event，再由该层写幂等查询投影。
 * 关键约束：这些函数只能在对应的 Unit of Work 内调用，不能生成新的业务事实，也不能向窗口或会话发送通知。
 */
export async function projectLegacyMoment(input: Parameters<typeof legacyStore.insertMoment>[0]): Promise<CompanionMoment | null> {
  return legacyStore.insertMoment(input)
}

export async function projectLegacyRelationshipEvent(input: Parameters<typeof legacyStore.recordRelationshipEvent>[0]): ReturnType<typeof legacyStore.recordRelationshipEvent> {
  return legacyStore.recordRelationshipEvent(input)
}

export async function projectLegacyEmotionEvent(input: Parameters<typeof legacyStore.recordEmotionEvent>[0]): ReturnType<typeof legacyStore.recordEmotionEvent> {
  return legacyStore.recordEmotionEvent(input)
}

export async function replaceLegacyEventLinks(roleId: string, eventId: string, links: Parameters<typeof legacyStore.replaceEventLinks>[2]): Promise<void> {
  await legacyStore.replaceEventLinks(roleId, eventId, links)
}

export async function markLegacyEventPublished(eventId: string): Promise<void> {
  await legacyStore.markEventPublished(eventId)
}

export async function recordLegacyEventExecution(input: Parameters<typeof legacyStore.recordEventExecution>[0]): ReturnType<typeof legacyStore.recordEventExecution> {
  return legacyStore.recordEventExecution(input)
}
