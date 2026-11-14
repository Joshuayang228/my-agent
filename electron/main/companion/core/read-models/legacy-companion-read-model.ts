/**
 * 迁移期旧生活读模型适配层。
 *
 * 背景：Companion Core 已成为新的运行态和事件事实源，但日程、关系和历史事件仍有存量读取者。
 * 设计意图：把旧表读取集中在 Core Read Model 目录，避免 Runtime、Debug 和 Prompt 组装器继续直接依赖 life/store。
 * 关键约束：本适配层只读、不建事实、不写旧表；任何新写入必须经过 Core Command / Domain Event，迁移完成后可整体替换实现。
 */

import * as legacyStore from '../../life/store'

export function getCompanionLegacyRoleState(...args: Parameters<typeof legacyStore.getRoleState>): ReturnType<typeof legacyStore.getRoleState> { return legacyStore.getRoleState(...args) }
export function getCompanionLegacyDayScript(...args: Parameters<typeof legacyStore.getDayScript>): ReturnType<typeof legacyStore.getDayScript> { return legacyStore.getDayScript(...args) }
export function listCompanionLegacyEvents(...args: Parameters<typeof legacyStore.listEvents>): ReturnType<typeof legacyStore.listEvents> { return legacyStore.listEvents(...args) }
export function listCompanionLegacyRelationshipStates(...args: Parameters<typeof legacyStore.listRelationshipStates>): ReturnType<typeof legacyStore.listRelationshipStates> { return legacyStore.listRelationshipStates(...args) }
export function listCompanionLegacyRelationshipEvents(...args: Parameters<typeof legacyStore.listRelationshipEvents>): ReturnType<typeof legacyStore.listRelationshipEvents> { return legacyStore.listRelationshipEvents(...args) }
export function listCompanionLegacyEmotionEvents(...args: Parameters<typeof legacyStore.listEmotionEvents>): ReturnType<typeof legacyStore.listEmotionEvents> { return legacyStore.listEmotionEvents(...args) }
export function listCompanionLegacyEventExecutions(...args: Parameters<typeof legacyStore.listEventExecutions>): ReturnType<typeof legacyStore.listEventExecutions> { return legacyStore.listEventExecutions(...args) }
export function getCompanionLegacyEventById(...args: Parameters<typeof legacyStore.getEventById>): ReturnType<typeof legacyStore.getEventById> { return legacyStore.getEventById(...args) }
export function listCompanionLegacyEventLinks(...args: Parameters<typeof legacyStore.listEventLinks>): ReturnType<typeof legacyStore.listEventLinks> { return legacyStore.listEventLinks(...args) }
export function listCompanionLegacyMoments(...args: Parameters<typeof legacyStore.listMoments>): ReturnType<typeof legacyStore.listMoments> { return legacyStore.listMoments(...args) }
export function getCompanionLegacyMomentByEventId(...args: Parameters<typeof legacyStore.getMomentByEventId>): ReturnType<typeof legacyStore.getMomentByEventId> { return legacyStore.getMomentByEventId(...args) }
