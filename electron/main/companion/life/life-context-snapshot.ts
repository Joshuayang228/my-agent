/**
 * 统一生活上下文快照（15 维活人感因子单一事实源汇编器）。
 *
 * 背景：此前日剧本、朋友圈润色、日记、主动消息各自零散拼装上下文，缺少关系阶段、
 * 天气/星期节律、互动间隔、近期动态避重与短期挂念等活人感因子。
 * 设计意图：提供一次只读汇编的 `LifeContextSnapshot`，让所有生活 Prompt 消费者共享
 * 同一套结构化上下文，并提供面向朋友圈润色与日剧本的紧凑中文格式化切片。
 * 关键约束：纯只读、绝不隐式建表或触发写副作用；任何子数据源缺失时安全降级为空，
 * 不阻塞生活引擎或主对话；不向前端暴露数值型好感进度条。
 */

import { getCompanionRuntimeReadModel } from '../core/read-models/runtime-read-model'
import { listEvents, listMoments } from '../core/persistence/life-repository'
import { resolveRelationshipStageForRole, type RelationshipStage } from '../growth/relationship-stage'
import { listRecentUserMessagesForRole } from '../../storage/session-store'
import { listAssets } from './assets'
import { listLifeResonances } from './chat-resonance'
import { getRecentHostCareContext } from './host-presence'

export interface LifeContextSnapshot {
  roleId: string
  capturedAt: number
  relationshipStage: RelationshipStage
  relationshipLabel: string
  vitals: {
    mood: number | null
    energy: number | null
    socialNeed: number | null
    summary: string
  }
  dynamicStatusTags: string[]
  rhythm: {
    weekdayLabel: string
    isWeekend: boolean
    daypartLabel: string
    weatherLabel: string
  }
  interactionGap: {
    hoursSinceLastMoment: number | null
    summary: string
  }
  recentActivities: string[]
  recentMomentAvoidance: string[]
  activeOpenLoops: string[]
  recentUserVibe: string | null
  hostCareNote: string | null
  currentOutfit: string | null
  activeTripSummary: string | null
}

const STATIC_PLACEHOLDER_TAGS = new Set(['首个人物', '默认角色', '占位标签'])
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function stageLabel(stage: RelationshipStage): string {
  if (stage === 'rapport') return '默契'
  if (stage === 'familiar') return '熟悉'
  return '初识'
}

function describeDaypart(hour: number): string {
  if (hour >= 5 && hour < 9) return '清晨'
  if (hour >= 9 && hour < 12) return '上午'
  if (hour >= 12 && hour < 14) return '中午'
  if (hour >= 14 && hour < 18) return '下午'
  if (hour >= 18 && hour < 22) return '傍晚'
  return '深夜'
}

function describeVitals(mood: number | null, energy: number | null, socialNeed: number | null): string {
  const parts: string[] = []
  if (mood !== null) {
    if (mood >= 75) parts.push('心情明亮')
    else if (mood >= 45) parts.push('心境平稳')
    else if (mood >= 26) parts.push('有点低落')
    else parts.push('情绪很沉')
  }
  if (energy !== null) {
    if (energy >= 75) parts.push('精力充沛')
    else if (energy >= 40) parts.push('体力适中')
    else if (energy >= 21) parts.push('略显疲惫')
    else parts.push('精疲力竭')
  }
  if (socialNeed !== null) {
    if (socialNeed >= 75) parts.push('很想找人聊聊')
    else if (socialNeed <= 30) parts.push('更想安静独处')
  }
  return parts.join('、') || '状态平稳'
}

function inferUserVibe(recentUserMessages: string[]): string | null {
  if (!recentUserMessages.length) return null
  const combined = recentUserMessages.join(' ')
  if (/(难过|崩溃|好累|压力|焦虑|烦死|被骂|睡不着|难受|心情不好|糟糕)/.test(combined)) {
    return '用户近期似乎有些疲惫或压力，表达宜更温和体贴，避免过于喧闹'
  }
  if (/(开心|太好了|成功|搞定|上线|通过|拿到|庆祝|兴奋)/.test(combined)) {
    return '用户近期有值得高兴的进展，可以自然呼应这份轻快感'
  }
  return null
}

function deriveWeatherLabel(now: Date): string {
  const daySeed = now.getFullYear() * 1000 + (now.getMonth() + 1) * 40 + now.getDate()
  const pool = ['晴朗有微风', '多云微凉', '海风清爽', '小雨微润', '晴空万里'] as const
  return pool[daySeed % pool.length]
}

/**
 * 只读收集指定角色的统一生活上下文快照。
 */
export async function collectLifeContextSnapshot(
  roleId: string,
  now = Date.now(),
): Promise<LifeContextSnapshot> {
  const date = new Date(now)
  const dayOfWeek = date.getDay()
  const weekdayLabel = WEEKDAY_NAMES[dayOfWeek] ?? '今天'
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const daypartLabel = describeDaypart(date.getHours())
  const weatherLabel = deriveWeatherLabel(date)

  let relationshipStage: RelationshipStage = 'stranger'
  try {
    const resolved = await resolveRelationshipStageForRole(roleId, { now })
    relationshipStage = resolved.stage
  } catch {
    relationshipStage = 'stranger'
  }

  let mood: number | null = null
  let energy: number | null = null
  let socialNeed: number | null = null
  let dynamicStatusTags: string[] = []
  try {
    const runtime = await getCompanionRuntimeReadModel(roleId)
    if (runtime) {
      mood = typeof runtime.mood === 'number' ? runtime.mood : null
      energy = typeof runtime.energy === 'number' ? runtime.energy : null
      socialNeed = typeof runtime.socialNeed === 'number' ? runtime.socialNeed : null
      dynamicStatusTags = (runtime.statusTags || []).filter((tag) => tag && !STATIC_PLACEHOLDER_TAGS.has(tag))
    }
  } catch {
    // 只读降级
  }

  let recentActivities: string[] = []
  try {
    const events = await listEvents(roleId, { status: 'published', limit: 4, order: 'desc' })
    recentActivities = events
      .map((ev) => String(ev.payload.activity || '').trim())
      .filter(Boolean)
      .slice(0, 3)
  } catch {
    recentActivities = []
  }

  let recentMomentAvoidance: string[] = []
  let hoursSinceLastMoment: number | null = null
  try {
    const moments = await listMoments(roleId, { limit: 3 })
    if (moments.length > 0 && typeof moments[0].publishedAt === 'number') {
      hoursSinceLastMoment = Math.max(0, Math.round((now - moments[0].publishedAt) / 3_600_000))
    }
    recentMomentAvoidance = moments
      .map((m) => m.text.trim().slice(0, 28))
      .filter(Boolean)
  } catch {
    recentMomentAvoidance = []
  }

  let activeOpenLoops: string[] = []
  try {
    const resonances = await listLifeResonances(roleId, { status: 'active', limit: 3 })
    activeOpenLoops = resonances.map((r) => `${r.targetName}（${r.reason}）`)
  } catch {
    activeOpenLoops = []
  }

  let recentUserVibe: string | null = null
  try {
    const msgs = await listRecentUserMessagesForRole(roleId, now - 24 * 3_600_000, 4)
    recentUserVibe = inferUserVibe(msgs)
  } catch {
    recentUserVibe = null
  }

  let hostCareNote: string | null = null
  try {
    hostCareNote = (await getRecentHostCareContext(roleId, now)) || null
  } catch {
    hostCareNote = null
  }

  let currentOutfit: string | null = null
  let activeTripSummary: string | null = null
  try {
    const wardrobe = await listAssets(roleId, { kind: 'wardrobe' })
    const wearing = wardrobe.find((a) => a.payload.wearing === true || a.payload.isWearing === true)
    if (wearing) currentOutfit = wearing.name

    const footprints = await listAssets(roleId, { kind: 'footprint' })
    const activeTrip = footprints.find((a) => a.payload.recordType === 'trip' && a.payload.status === 'active')
    if (activeTrip) {
      const stops = Array.isArray(activeTrip.payload.stops) ? (activeTrip.payload.stops as Array<Record<string, unknown>>) : []
      const lastStop = typeof stops[stops.length - 1]?.name === 'string' ? String(stops[stops.length - 1].name).trim() : ''
      activeTripSummary = `${activeTrip.name}${lastStop ? `（当前停靠：${lastStop}）` : ''}`
    }
  } catch {
    // 只读降级
  }

  const gapSummary = hoursSinceLastMoment === null
    ? '近期尚未发过动态'
    : hoursSinceLastMoment >= 24
      ? `距上次发动态已约 ${Math.round(hoursSinceLastMoment / 24)} 天`
      : `距上次发动态约 ${hoursSinceLastMoment} 小时`

  return {
    roleId,
    capturedAt: now,
    relationshipStage,
    relationshipLabel: stageLabel(relationshipStage),
    vitals: {
      mood,
      energy,
      socialNeed,
      summary: describeVitals(mood, energy, socialNeed),
    },
    dynamicStatusTags,
    rhythm: {
      weekdayLabel,
      isWeekend,
      daypartLabel,
      weatherLabel,
    },
    interactionGap: {
      hoursSinceLastMoment,
      summary: gapSummary,
    },
    recentActivities,
    recentMomentAvoidance,
    activeOpenLoops,
    recentUserVibe,
    hostCareNote,
    currentOutfit,
    activeTripSummary,
  }
}

/**
 * 格式化给朋友圈润色 Prompt 使用的紧凑生活上下文切片。
 */
export function formatLifeContextForMomentPolish(snapshot: LifeContextSnapshot): string {
  const lines: string[] = [
    `- 与用户关系：${snapshot.relationshipLabel}（${
      snapshot.relationshipStage === 'stranger'
        ? '保持自然克制，不过度亲密或倾诉私密心事'
        : snapshot.relationshipStage === 'familiar'
          ? '可自然流露真实小情绪与日常吐槽'
          : '可流露默契感与放松的口吻'
    }）`,
    `- 此刻节律与状态：${snapshot.rhythm.weekdayLabel}${snapshot.rhythm.daypartLabel} · ${snapshot.rhythm.weatherLabel} · ${snapshot.vitals.summary}`,
  ]
  if (snapshot.dynamicStatusTags.length > 0) {
    lines.push(`- 当前状态标签：${snapshot.dynamicStatusTags.join('、')}`)
  }
  if (snapshot.recentActivities.length > 0) {
    lines.push(`- 近期经历：${snapshot.recentActivities.slice(0, 2).join('；')}`)
  }
  if (snapshot.recentUserVibe) {
    lines.push(`- 社交眼色：${snapshot.recentUserVibe}`)
  }
  if (snapshot.recentMomentAvoidance.length > 0) {
    lines.push(`- 近期已发动态（避免重复句式与角度）：${snapshot.recentMomentAvoidance.join(' / ')}`)
  }
  return lines.join('\n')
}
