/**
 * Companion 域公共类型（W0 Identity / Assemble）。
 *
 * 背景：伙伴世界用 Role Pack 取代硬编码 BUILTIN_PERSONAS；文案在仓库资产目录，代码只加载与拼装。
 * 约束：语义对齐 docs/requirements/companion-tech-spec.md；W1+ 再扩 Growth / Life 类型。
 */

export interface UniverseManifest {
  id: string
  title: string
  version: number
  /** 已交付主角 id（可逐步加到 3） */
  protagonistIds: string[]
  /** 架构容量，当前为 3 */
  plannedProtagonistSlots: number
  defaultProtagonistId: string
}

export interface RoleManifest {
  id: string
  name: string
  description: string
  canBeProtagonist: boolean
  asideStyle?: string
}

export interface RoleSummary {
  id: string
  name: string
  description: string
}

/** 完整 Role Pack（仓库资产 + 组装用正文） */
export interface RolePack {
  id: string
  name: string
  description: string
  canBeProtagonist: boolean
  protected: string
  /** 默认 MUTABLE；用户覆盖在 W1 companion_mutable */
  mutableDefault: string
  summary: string
  asideStyle?: string
  voice?: string
}

export interface UniverseRelations {
  edges: Array<{
    from: string
    to: string
    type: string
    note?: string
  }>
}

export type SwitchResult =
  | { ok: true; catchupQueued: boolean }
  | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE' }

/** 日剧本槽位（W2 LifeEngine；LLM 生成前用确定性 mock） */
export interface DayScriptSlot {
  hour: number
  minute: number
  activity: string
  mood: string
  location: string
  type: 'moment' | 'activity'
}

export interface DayScriptPayload {
  date: string
  theme: string
  slots: DayScriptSlot[]
}

export interface DayScriptRow {
  id: string
  roleId: string
  date: string
  payload: DayScriptPayload
  createdAt: number
}

export type CompanionEventStatus = 'planned' | 'published' | 'cancelled'

export interface CompanionEvent {
  id: string
  roleId: string
  scheduledAt: number
  status: CompanionEventStatus
  type: string
  payload: Record<string, unknown>
  dayScriptId: string | null
}

export interface CompanionRoleState {
  roleId: string
  pausedAt: number | null
  lastTickAt: number
  catchupSummary: string
  updatedAt: number
}

/** 朋友圈截面（由 published 事件投影） */
export interface CompanionMoment {
  id: string
  roleId: string
  eventId: string
  publishedAt: number
  text: string
  meta: Record<string, unknown>
}

/** 角色资产（衣柜等，按 role 分桶） */
export interface CompanionAsset {
  id: string
  roleId: string
  kind: string
  name: string
  payload: Record<string, unknown>
  acquiredAt: number
  sourceEventId: string | null
}
