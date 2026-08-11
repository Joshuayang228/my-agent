/**
 * 世界状态编解码。
 *
 * 背景：第一版人物世界资产已成为唯一真相，旧占位 world_json 不再具有保留价值。
 * 设计意图：只接受当前 schema；旧版、缺字段或坏 JSON 直接重置为 Role Pack 出厂世界。
 * 关键约束：所有数值和字符串有界；有 world.default.json 时以资产为准，未进入结构化设计的旧角色暂时保留既有中性默认值。
 */

import { loadRoleWorldDefaults } from '../identity/loader'
import type { CompanionWorldState, RoleWorldInitialState } from '../types'

export const WORLD_STATE_SCHEMA_VERSION = 1 as const
const DEFAULT_TZ = 'Asia/Shanghai'
const DEFAULT_RUNTIME: RoleWorldInitialState = {
  mood: 60,
  energy: 70,
  socialNeed: 45,
  currentLocation: '家',
  locationDetail: '',
  currentActivity: '',
  statusTags: [],
}
const DEFAULT_HOME: Record<string, string> = {
  lin: '城西小公寓',
  zhou: '热闹街区合租',
  xia: '靠窗的安静小屋',
}

function boundedScore(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback
}

function shortText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function statusTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 8)
}

/**
 * 判定持久化世界态是否属于当前 schema。
 *
 * 背景：第一版明确废弃旧三字段占位数据，不能在读取时暗中迁移成新结构。
 * 设计意图：先做结构门闸，再在返回阶段统一裁剪字段；坏结构直接回到角色默认世界。
 * 关键约束：这里只判断必需字段类型，数组内容和数值范围仍由规范化函数收口。
 */
function isCurrentWorldState(value: unknown): value is CompanionWorldState {
  if (!value || typeof value !== 'object') return false
  const world = value as Record<string, unknown>
  return world.schemaVersion === WORLD_STATE_SCHEMA_VERSION
    && typeof world.home === 'string'
    && typeof world.timezone === 'string'
    && typeof world.situation === 'string'
    && typeof world.mood === 'number'
    && typeof world.energy === 'number'
    && typeof world.socialNeed === 'number'
    && typeof world.currentLocation === 'string'
    && typeof world.locationDetail === 'string'
    && typeof world.currentActivity === 'string'
    && Array.isArray(world.statusTags)
    && typeof world.updatedAt === 'number'
    && Number.isFinite(world.updatedAt)
}

export function defaultWorldState(roleId: string): CompanionWorldState {
  const defaults = loadRoleWorldDefaults(roleId)
  if (!defaults) {
    return {
      schemaVersion: WORLD_STATE_SCHEMA_VERSION,
      home: DEFAULT_HOME[roleId] || '日常住处',
      timezone: DEFAULT_TZ,
      situation: '',
      ...DEFAULT_RUNTIME,
      updatedAt: 0,
    }
  }
  return {
    schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    home: defaults.home.shortName,
    timezone: defaults.timezone,
    situation: '',
    mood: boundedScore(defaults.initialState.mood, 0),
    energy: boundedScore(defaults.initialState.energy, 0),
    socialNeed: boundedScore(defaults.initialState.socialNeed, 0),
    currentLocation: defaults.initialState.currentLocation || defaults.initialLocation,
    locationDetail: defaults.initialState.locationDetail,
    currentActivity: defaults.initialState.currentActivity,
    statusTags: statusTags(defaults.initialState.statusTags),
    updatedAt: 0,
  }
}

export function parseWorldJson(
  raw: string | null | undefined,
  roleId: string,
): CompanionWorldState {
  if (!raw?.trim()) return defaultWorldState(roleId)
  try {
    const obj = JSON.parse(raw) as unknown
    if (!isCurrentWorldState(obj)) return defaultWorldState(roleId)
    return {
      schemaVersion: WORLD_STATE_SCHEMA_VERSION,
      home: shortText(obj.home, 40),
      timezone: shortText(obj.timezone, 64),
      situation: shortText(obj.situation, 80),
      mood: boundedScore(obj.mood, 0),
      energy: boundedScore(obj.energy, 0),
      socialNeed: boundedScore(obj.socialNeed, 0),
      currentLocation: shortText(obj.currentLocation, 40),
      locationDetail: shortText(obj.locationDetail, 80),
      currentActivity: shortText(obj.currentActivity, 80),
      statusTags: statusTags(obj.statusTags),
      updatedAt: obj.updatedAt,
    }
  } catch {
    return defaultWorldState(roleId)
  }
}

export function serializeWorldState(world: CompanionWorldState): string {
  return JSON.stringify({
    schemaVersion: WORLD_STATE_SCHEMA_VERSION,
    home: shortText(world.home, 40),
    timezone: shortText(world.timezone, 64),
    situation: shortText(world.situation, 80),
    mood: boundedScore(world.mood, 0),
    energy: boundedScore(world.energy, 0),
    socialNeed: boundedScore(world.socialNeed, 0),
    currentLocation: shortText(world.currentLocation, 40),
    locationDetail: shortText(world.locationDetail, 80),
    currentActivity: shortText(world.currentActivity, 80),
    statusTags: statusTags(world.statusTags),
    updatedAt: Number.isFinite(world.updatedAt) ? Math.max(0, Math.round(world.updatedAt)) : 0,
  })
}

export function formatWorldSliceForPrompt(world: CompanionWorldState): string {
  const bits: string[] = []
  if (world.home) bits.push(`居所${world.home}`)
  if (world.timezone) bits.push(`时区${world.timezone}`)
  if (world.currentLocation) {
    bits.push(`当前地点${world.currentLocation}${world.locationDetail ? `（${world.locationDetail}）` : ''}`)
  }
  if (world.currentActivity) bits.push(`正在${world.currentActivity}`)
  bits.push(`心情${world.mood}/100`)
  bits.push(`精力${world.energy}/100`)
  bits.push(`社交需求${world.socialNeed}/100`)
  if (world.statusTags.length > 0) bits.push(`状态${world.statusTags.join('、')}`)
  if (world.situation) bits.push(`近况${world.situation}`)
  return bits.join(' · ')
}

export const __test = { boundedScore, statusTags }
