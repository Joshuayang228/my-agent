/**
 * 人物生活预设资产加载器（Identity / Role Pack）
 *
 * 背景：此前日剧本保底活动、重排模板、初始衣柜/文化角/朋友圈/日记/信物/脆弱心境/共同决策、礼物喜好、
 * 航海奇遇站点、宿主关怀与聊天共鸣保底文案散落并硬编码在 `companion/life/*` 与 `companion/growth/*` 平台代码中，
 * 导致平台层耦合具体角色（如 `roleId === 'luffy'`）。
 * 设计意图：将全部角色专属的预设与保底内容下沉到 `universes/<universeId>/roles/<roleId>/life-presets.json`，
 * 平台各模块统一经 `loadRoleLifePresets(roleId)` 读取；未提供预设的新角色自动平滑回退到平台中性兜底。
 * 关键约束：通过 Vite `import.meta.glob(?raw)` 打包并在测试/自定义宇宙环境回退文件系统读取；
 * 绝不在本模块硬编码任何特定角色 ID 或人设台词。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CompanionGiftItem, VulnerabilityMoodState } from '../../../../src/shared/types'

export interface RoleStarterAsset {
  key: string
  name: string
  payload: Record<string, unknown>
}

export interface RoleStarterOutfit {
  idSuffix: string
  name: string
  requiredGarmentKeys: string[]
  slots: { top: string; bottom: string; shoes: string }
  style: string
  description: string
  visualPath: string
}

export interface RoleStarterMoment {
  key: string
  hoursAgo: number
  text: string
  visualPath?: string
  eventPayload: Record<string, unknown>
  momentMeta: Record<string, unknown>
  links: Array<{
    idSuffix: string
    targetType: 'asset' | 'cast' | 'image'
    targetId: string
    relation: string
    metadata?: Record<string, unknown>
  }>
}

export interface RolePresetKeepsake {
  key: string
  name: string
  description: string
  lore: string
  giftMessage: string
  giftReason: string
  iconName: string
}

export interface RoleCoDecisionPreset {
  key: string
  title: string
  dilemma: string
  options: Array<{
    id: string
    label: string
    desc: string
    moodHint?: string
  }>
  defaultReactions: Record<string, string>
}

export interface RoleVulnerabilityPreset {
  key: string
  title: string
  moodState: VulnerabilityMoodState
  triggerContext: string
  vulnerabilityText: string
  comfortPromptHint: string
  fallbackReaction: string
}

export interface RoleStarterThought {
  title: string
  content: string
  mood: string
  weather?: string
  thoughtType: string
  location?: string
  activity?: string
  isFavorite?: boolean
  epiphany?: string
  offsetMs: number
}

export interface RoleActivitySeed {
  activity: string
  mood: string
  location: string
  type: 'activity' | 'moment'
}

export interface RoleReplanSlotSeed {
  activity: string
  mood: string
  location: string
  type: 'activity' | 'moment'
}

export interface RoleTravelAdventure {
  id: string
  name: string
  story: string
}

export interface RoleLifePresets {
  defaultLocation?: string
  scriptThemes?: string[]
  scriptActivities?: RoleActivitySeed[]
  replan?: {
    exhaustion?: RoleReplanSlotSeed[]
    vulnerability?: RoleReplanSlotSeed[]
    defaultLocation?: string
  }
  hostCare?: {
    fatigue_break?: { careMessage: string; suggestedAction: string }
    late_night_sleep?: { careMessage: string; suggestedAction: string }
    welcome_back?: { careMessage: string; suggestedAction: string }
  }
  starterWardrobe?: RoleStarterAsset[]
  starterOutfit?: RoleStarterOutfit
  starterCulture?: RoleStarterAsset[]
  starterMoments?: RoleStarterMoment[]
  presetKeepsakes?: RolePresetKeepsake[]
  resonanceKeepsakeKey?: string
  coDecisions?: RoleCoDecisionPreset[]
  vulnerabilities?: RoleVulnerabilityPreset[]
  starterThoughts?: RoleStarterThought[]
  fallbackThought?: {
    title: string
    content: string
    mood: string
    weather?: string
    epiphany?: string
  }
  giftPresets?: Array<Omit<CompanionGiftItem, 'roleAffinity'> & { affinity?: 'favorite' | 'liked' | 'neutral' }>
  giftAffinities?: Record<string, 'favorite' | 'liked' | 'neutral'>
  giftFallbackReactions?: Record<string, string>
  travelAdventures?: RoleTravelAdventure[]
  travelWishFallbackTemplate?: string
  chatResonanceFallback?: {
    reviewText: string
    chatOpener: string
    momentText: string
  }
  nightlyReflectionFallback?: {
    title: string
    content: string
    epiphany: string
    mood: string
    weather: string
    location: string
  }
  spontaneousImpulseFallback?: Record<string, { text: string; hint: string }>
}

const bundledPresets = import.meta.glob('../universes/**/life-presets.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const cache = new Map<string, RoleLifePresets>()

function readRawPresets(roleId: string, universeId = 'default'): string | null {
  const rel = `${universeId}/roles/${roleId}/life-presets.json`
  const key = `../universes/${rel}`
  if (typeof bundledPresets[key] === 'string') {
    return bundledPresets[key].replace(/^\uFEFF/, '').trim()
  }
  const hit = Object.entries(bundledPresets).find(([k]) =>
    k.replace(/\\/g, '/').endsWith(`/universes/${rel}`),
  )
  if (hit && typeof hit[1] === 'string') {
    return hit[1].replace(/^\uFEFF/, '').trim()
  }
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url))
    const fsPath = path.join(dir, '..', 'universes', universeId, 'roles', roleId, 'life-presets.json')
    if (fs.existsSync(fsPath)) {
      return fs.readFileSync(fsPath, 'utf8').replace(/^\uFEFF/, '').trim()
    }
  } catch {
    // 非文件系统环境忽略
  }
  return null
}

/**
 * 读取指定角色的生活预设配置。
 * 若该角色未提供 `life-presets.json` 或 JSON 无效，返回空对象，由平台层使用中性通用兜底。
 */
export function loadRoleLifePresets(roleId: string, universeId = 'default'): RoleLifePresets {
  if (!roleId || typeof roleId !== 'string') return {}
  const cacheKey = `${universeId}:${roleId}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const raw = readRawPresets(roleId, universeId)
  if (!raw) {
    const empty: RoleLifePresets = {}
    cache.set(cacheKey, empty)
    return empty
  }
  try {
    const parsed = JSON.parse(raw) as RoleLifePresets
    const normalized = parsed && typeof parsed === 'object' ? parsed : {}
    cache.set(cacheKey, normalized)
    return normalized
  } catch {
    const empty: RoleLifePresets = {}
    cache.set(cacheKey, empty)
    return empty
  }
}
