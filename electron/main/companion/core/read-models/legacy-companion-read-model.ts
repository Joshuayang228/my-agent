/**
 * 迁移期旧生活读模型适配层。
 *
 * 背景：Companion Core 已成为新的运行态和事件事实源，但日程、关系和历史事件仍有存量读取者。
 * 设计意图：把旧表读取集中在 Core Read Model 目录，避免 Runtime、Debug 和 Prompt 组装器继续直接依赖 life/store。
 * 关键约束：本适配层只读、不建事实、不写旧表；任何新写入必须经过 Core Command / Domain Event，迁移完成后可整体替换实现。
 */

import {
  getDayScript as readLegacyDayScript,
  getRoleState as readLegacyRoleState,
  listEmotionEvents as readLegacyEmotionEvents,
  listEvents as readLegacyEvents,
  listRelationshipEvents as readLegacyRelationshipEvents,
  listRelationshipStates as readLegacyRelationshipStates,
  listEventExecutions as readLegacyEventExecutions,
} from '../../life/store'

export const getCompanionLegacyRoleState = readLegacyRoleState
export const getCompanionLegacyDayScript = readLegacyDayScript
export const listCompanionLegacyEvents = readLegacyEvents
export const listCompanionLegacyRelationshipStates = readLegacyRelationshipStates
export const listCompanionLegacyRelationshipEvents = readLegacyRelationshipEvents
export const listCompanionLegacyEmotionEvents = readLegacyEmotionEvents
export const listCompanionLegacyEventExecutions = readLegacyEventExecutions
