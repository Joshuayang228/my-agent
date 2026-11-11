/**
 * DevPanel Debug「世界态」只读快照（M32-G4）
 *
 * 背景：产品作者要一眼看到「它以为自己在哪」——角色、世界、日剧本、近 Moments、记忆薄片。
 * 意图：聚合只读，集中截断；不暴露 settings/密钥；不写库。
 * 约束：ipc/debug 调用；禁止 import ipc/。
 */

import { getActiveRole } from '../companion/orchestrator'
import { loadRolePack } from '../companion/identity/loader'
import { getMutable, getMutableMeta } from '../companion/growth/mutable-store'
import { getRoleState, getDayScript, listEvents, listRelationshipStates, listRelationshipEvents, listEmotionEvents, listEventExecutions } from '../companion/life/store'
import { getCompanionRuntimeState } from '../companion/core/state/runtime-state'
import { resolveMomentVisibilityDays } from '../companion/life/moment-visibility'
import { getSetting } from '../storage/settings-store'
import { listMomentsForRole } from '../companion/life/moments'
import { toLocalDateString } from '../companion/life/dates'
import { buildUserProfile, listMemories } from '../storage/memory-store'
import { createLogger } from '../utils/logger'
import type { RoleProfile, RoleWorldDefaults } from '../companion/types'

const log = createLogger('DebugWorldSnapshot')

const MUTABLE_MAX = 2_000
const CATCHUP_MAX = 800
const MEMORY_LIMIT = 20
const MEMORY_CONTENT_MAX = 160
const MOMENT_LIMIT = 10
const MOMENT_TEXT_MAX = 200
const SLOT_LIMIT = 12
const EVENT_LIMIT = 30

function clip(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

/**
 * 过滤人物快照中的记忆范围。
 *
 * 背景：记忆表同时保存共享用户事实和按人物分桶的反馈，世界态 Debug 不能把其他人物的反馈带入当前人物。
 * 设计意图：共享条目保留并明确标注，人物条目只保留当前 roleId，避免把全局列表误读成当前人物上下文。
 * 关键约束：该过滤只影响 Debug 展示，不改变记忆存储、召回或用户画像组装。
 */
function filterMemoriesForRole(memories: Array<{ id: string; category: string; content: string; updatedAt: number; roleId?: string }>, roleId: string) {
  return memories
    .filter(memory => !memory.roleId || memory.roleId === roleId)
    .map(memory => ({ ...memory, scope: memory.roleId ? 'role' as const : 'shared' as const }))
}

export type DebugWorldSnapshot = {
  role: { id: string; name: string; description: string; universeId: string }
  characterProfile: RoleProfile | null
  worldDefaults: RoleWorldDefaults | null
  mutable: {
    body: string
    truncated: boolean
    version: number | null
    updatedAt: number | null
    source: 'override' | 'pack-default'
  }
  world: {
    schemaVersion: 1
    home: string
    timezone: string
    situation: string
    mood: number
    energy: number
    socialNeed: number
    currentLocation: string
    locationDetail: string
    currentActivity: string
    statusTags: string[]
    updatedAt: number
  } | null
  life: {
    pausedAt: number | null
    lastTickAt: number
    catchupSummary: string
    catchupTruncated: boolean
  } | null
  dayScript: {
    date: string
    id: string
    theme: string
    slots: Array<{
      hour: number
      minute: number
      type: string
      activity: string
      mood: string
      location: string
    }>
    slotsTruncated: boolean
  } | null
  events: Array<{
    id: string
    scheduledAt: number
    status: 'planned' | 'published'
    type: string
    activity: string
    mood: string
    location: string
  }>
  eventsTruncated: boolean
  executions: Array<{ id: string; eventId: string; attemptedAt: number; action: 'published' | 'skipped' | 'deferred'; reason: string; momentId: string | null }>
  moments: Array<{ id: string; publishedAt: number; text: string }>
  momentsTruncated: boolean
  relationship: Array<{ subjectId: string; phase: string; signal: number; note: string; updatedAt: number }>
  relationshipEvents: Array<{ subjectId: string; phase: string; delta: number; note: string; sourceEventId: string | null; createdAt: number }>
  emotions: Array<{ label: string; intensity: number; note: string; createdAt: number }>
  momentPolicy: { cadence: string; visibility: string; visibilityDays: string; maxPerDay: string; cooldownMinutes: string; postingQuietStart: string; postingQuietEnd: string; imagePolicy: string; interactionPolicy: string }
  profile: { identity: string; workflow: string; voice: string } | null
  memories: Array<{ id: string; category: string; scope: 'role' | 'shared'; content: string; updatedAt: number }>
  memoriesTruncated: boolean
  generatedAt: number
}

/**
 * 组装活跃主角世界态透视快照。
 */
export async function buildDebugWorldSnapshot(): Promise<DebugWorldSnapshot> {
  const role = await getActiveRole()
  const pack = loadRolePack(role.id, role.universeId)
  const meta = await getMutableMeta(role.id)
  const mutableBody = meta?.body ?? (await getMutable(role.id, role.universeId))
  const mutableTrunc = mutableBody.length > MUTABLE_MAX

  const [state, runtimeState] = await Promise.all([
    getRoleState(role.id),
    getCompanionRuntimeState(role.id),
  ])
  const today = toLocalDateString(Date.now())
  const script = await getDayScript(role.id, today)
  const [plannedEvents, publishedEvents] = await Promise.all([
    listEvents(role.id, { status: 'planned', order: 'desc', limit: EVENT_LIMIT + 1 }),
    listEvents(role.id, { status: 'published', order: 'desc', limit: EVENT_LIMIT + 1 }),
  ])
  const executions = await listEventExecutions(role.id, EVENT_LIMIT)
  const eventsRaw = [...plannedEvents, ...publishedEvents]
    .sort((a, b) => b.scheduledAt - a.scheduledAt)
  const eventsTruncated = plannedEvents.length > EVENT_LIMIT
    || publishedEvents.length > EVENT_LIMIT
    || eventsRaw.length > EVENT_LIMIT
  const events = eventsRaw.slice(0, EVENT_LIMIT).reverse().map((event) => ({
    id: event.id,
    scheduledAt: event.scheduledAt,
    status: event.status as 'planned' | 'published',
    type: clip(event.type || '', 40),
    activity: clip(typeof event.payload.activity === 'string' ? event.payload.activity : '', 80),
    mood: clip(typeof event.payload.mood === 'string' ? event.payload.mood : '', 40),
    location: clip(typeof event.payload.location === 'string' ? event.payload.location : '', 40),
  }))

  let dayScript: DebugWorldSnapshot['dayScript'] = null
  if (script) {
    const slots = (script.payload.slots ?? []).slice(0, SLOT_LIMIT).map((s) => ({
      hour: s.hour,
      minute: s.minute ?? 0,
      type: s.type ?? '',
      activity: clip(s.activity || '', 80),
      mood: clip(s.mood || '', 40),
      location: clip(s.location || '', 40),
    }))
    dayScript = {
      date: script.date,
      id: script.id,
      theme: clip(script.payload.theme || '', 200),
      slots,
      slotsTruncated: (script.payload.slots?.length ?? 0) > SLOT_LIMIT,
    }
  }

  const momentsRaw = await listMomentsForRole(role.id, { limit: MOMENT_LIMIT + 1 })
  const momentsTruncated = momentsRaw.length > MOMENT_LIMIT
  const moments = momentsRaw.slice(0, MOMENT_LIMIT).map((m) => ({
    id: m.id,
    publishedAt: m.publishedAt,
    text: clip(m.text, MOMENT_TEXT_MAX),
  }))
  const [relationships, relationshipEvents, emotions, cadence, visibility, maxPerDay, cooldownMinutes, postingQuietStart, postingQuietEnd, imagePolicy, interactionPolicy] = await Promise.all([
    listRelationshipStates(role.id), listRelationshipEvents(role.id, 10), listEmotionEvents(role.id, 10),
    getSetting('companionMomentCadence'), getSetting('companionMomentVisibility'), getSetting('companionMomentMaxPerDay'),
    getSetting('companionMomentCooldownMinutes'), getSetting('companionMomentPostingQuietStart'), getSetting('companionMomentPostingQuietEnd'),
    getSetting('companionMomentImagePolicy'), getSetting('companionMomentInteractionPolicy'),
  ])

  const profile = await buildUserProfile(role.id)
  const allMem = filterMemoriesForRole(await listMemories(), role.id)
  const memoriesTruncated = allMem.length > MEMORY_LIMIT
  const memories = allMem.slice(0, MEMORY_LIMIT).map((m) => ({
    id: m.id,
    category: m.category,
    scope: m.scope,
    content: clip(m.content, MEMORY_CONTENT_MAX),
    updatedAt: m.updatedAt,
  }))

  const catchup = state?.catchupSummary ?? ''
  const snap: DebugWorldSnapshot = {
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      universeId: role.universeId,
    },
    characterProfile: pack.profile ?? null,
    worldDefaults: pack.worldDefaults ?? null,
    mutable: {
      body: clip(mutableBody, MUTABLE_MAX),
      truncated: mutableTrunc,
      version: meta?.version ?? null,
      updatedAt: meta?.updatedAt ?? null,
      source: meta ? 'override' : 'pack-default',
    },
    world: runtimeState
      ? {
          schemaVersion: 1,
          home: runtimeState.home,
          timezone: runtimeState.timezone,
          situation: clip(runtimeState.situation || '', 300),
          mood: runtimeState.mood,
          energy: runtimeState.energy,
          socialNeed: runtimeState.socialNeed,
          currentLocation: clip(runtimeState.currentLocation || '', 80),
          locationDetail: clip(runtimeState.locationDetail || '', 120),
          currentActivity: clip(runtimeState.currentActivity || '', 160),
          statusTags: runtimeState.statusTags.slice(0, 8),
          updatedAt: runtimeState.updatedAt,
        }
      : null,
    life: state
      ? {
          pausedAt: state.pausedAt,
          lastTickAt: state.lastTickAt,
          catchupSummary: clip(catchup, CATCHUP_MAX),
          catchupTruncated: catchup.length > CATCHUP_MAX,
        }
      : null,
    dayScript,
    events,
    eventsTruncated,
    executions,
    moments,
    momentsTruncated,
    relationship: relationships.map(({ subjectId, phase, signal, note, updatedAt }) => ({ subjectId, phase, signal, note: clip(note, 180), updatedAt })),
    relationshipEvents: relationshipEvents.map(({ subjectId, phase, delta, note, sourceEventId, createdAt }) => ({ subjectId, phase, delta, note: clip(note, 180), sourceEventId, createdAt })),
    emotions: emotions.map(({ label, intensity, note, createdAt }) => ({ label, intensity, note: clip(note, 180), createdAt })),
    momentPolicy: { cadence, visibility, visibilityDays: (() => { const days = resolveMomentVisibilityDays(visibility === 'always' ? 'ai' : visibility, relationships.find(item => item.subjectId === 'user')?.phase); return days === null ? 'private' : `${days}天` })(), maxPerDay, cooldownMinutes, postingQuietStart, postingQuietEnd, imagePolicy, interactionPolicy },
    profile: profile
      ? {
          identity: clip(profile.identity, 400),
          workflow: clip(profile.workflow, 400),
          voice: clip(profile.voice, 400),
        }
      : null,
    memories,
    memoriesTruncated,
    generatedAt: Date.now(),
  }

  log.info('World snapshot built', {
    roleId: role.id,
    events: events.length,
    moments: moments.length,
    memories: memories.length,
    hasDayScript: !!dayScript,
  })
  return snap
}

export const __test = {
  clip,
  filterMemoriesForRole,
  MUTABLE_MAX,
  MEMORY_LIMIT,
  MOMENT_LIMIT,
  SLOT_LIMIT,
  EVENT_LIMIT,
}
