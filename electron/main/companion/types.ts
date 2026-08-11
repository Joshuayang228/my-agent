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

/** 角色稳定表达基线；与 LLM temperature 无关，由本轮 tone-control 再做场景收放。 */
export interface RoleExpressionBaseline {
  warmth: number
  energy: number
  directness: number
  playfulness: number
  initiative: number
}

export interface RoleAppearance {
  overall: string
  hair: string
  eyes: string
  build: string
  clothingStyle: string
  distinguishingFeatures: string[]
}

export interface RoleFavorites {
  foods: string[]
  drinks: string[]
  music: string[]
  books: string[]
  activities: string[]
  weather: string[]
  colors: string[]
}

export interface RoleLifeAnchor {
  period: string
  title: string
  summary: string
}

/** 角色稳定人物档案；只保存“这个人是谁”，不保存本轮心情或当前位置。 */
export interface RoleProfile {
  schemaVersion: 1
  agePresentation: string
  birthday: string
  genderPresentation: string
  pronouns: string
  origin: string
  occupation: string
  background: string[]
  education: string[]
  careerHistory: string[]
  skills: string[]
  dailyRhythm: string[]
  interests: string[]
  dislikes: string[]
  habits: string[]
  flaws: string[]
  socialStyle: string[]
  valuesInPractice: string[]
  lifeAnchors: RoleLifeAnchor[]
  appearance: RoleAppearance
  favorites: RoleFavorites
  selfAwareness: string
  expression: RoleExpressionBaseline
}

export interface RoleHomeScene {
  id: string
  name: string
  day: string
  night: string
}

export interface RoleWorldPlace {
  id: string
  name: string
  kind: string
  description: string
  travelMinutes: number
}

export interface RoleWorldPossession {
  id: string
  kind: string
  name: string
  description: string
  condition: string
}

export interface RoleWorldInitialState {
  mood: number
  energy: number
  socialNeed: number
  currentLocation: string
  locationDetail: string
  currentActivity: string
  statusTags: string[]
}

/** 角色出厂世界；运行后当前位置与近况仍以 companion_role_state.world_json 为准。 */
export interface RoleWorldDefaults {
  schemaVersion: 1
  city: {
    id: string
    name: string
    fictional: boolean
    description: string
    climate: string
  }
  timezone: string
  district: string
  districtDescription: string
  home: {
    shortName: string
    residence: string
    surroundings: string
    interior: string
    layout: string
    view: string
    sensoryDetails: string[]
  }
  initialLocation: string
  mobility: {
    primary: string
    alternatives: string[]
  }
  favoritePlaces: RoleWorldPlace[]
  possessions: RoleWorldPossession[]
  routines: {
    weekday: string[]
    weekend: string[]
  }
  standingFacts: string[]
  initialState: RoleWorldInitialState
  rooms: RoleHomeScene[]
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
  profile?: RoleProfile
  worldDefaults?: RoleWorldDefaults
}

export interface UniverseRelations {
  edges: Array<{
    from: string
    to: string
    type: string
    note?: string
  }>
}

/** 换角成功时附带再认识微文案（M28-G3） */
export interface ReacquaintCopyPayload {
  title: string
  body: string
  toast: string
}

export type SwitchResult =
  | { ok: true; catchupQueued: boolean; reacquaint: ReacquaintCopyPayload }
  | { ok: false; code: 'SESSION_ACTIVE' | 'UNKNOWN_ROLE' | 'ALREADY_ACTIVE' }

/** 事件/槽位可选：发布时写入 companion_assets（M25-G2） */
export interface GrantAssetSpec {
  kind: string
  name: string
  payload?: Record<string, unknown>
}

/** 日剧本槽位（W2 LifeEngine；哈希确定性 / LLM 可选） */
export interface DayScriptSlot {
  hour: number
  minute: number
  activity: string
  mood: string
  location: string
  type: 'moment' | 'activity'
  /** 发布该槽事件时入库一件资产（可选；哈希剧本默认不填） */
  grantAsset?: GrantAssetSpec
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

/** 角色世界状态薄片（M23-G2；存 companion_role_state.world_json） */
export interface CompanionWorldState {
  schemaVersion: 1
  /** 稳定居所短名 */
  home: string
  /** IANA 时区；日历日仍用本机 local，此字段供叙事/展示 */
  timezone: string
  /** 短期情境短句（常由最近 published 事件刷新） */
  situation: string
  mood: number
  energy: number
  socialNeed: number
  currentLocation: string
  locationDetail: string
  currentActivity: string
  statusTags: string[]
  updatedAt: number
}

export interface CompanionRoleState {
  roleId: string
  pausedAt: number | null
  lastTickAt: number
  catchupSummary: string
  /** M23-G2：居所 / 时区 / 短期情境 */
  world: CompanionWorldState
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
