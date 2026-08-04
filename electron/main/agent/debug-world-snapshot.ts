/**
 * DevPanel Debug「世界态」只读快照（M32-G4）
 *
 * 背景：产品作者要一眼看到「它以为自己在哪」——角色、世界、日剧本、近 Moments、记忆薄片。
 * 意图：聚合只读，集中截断；不暴露 settings/密钥；不写库。
 * 约束：ipc/debug 调用；禁止 import ipc/。
 */

import { getActiveRole } from '../companion/orchestrator'
import { getMutable, getMutableMeta } from '../companion/growth/mutable-store'
import { getRoleState, getDayScript } from '../companion/life/store'
import { listMomentsForRole } from '../companion/life/moments'
import { toLocalDateString } from '../companion/life/dates'
import { buildUserProfile, listMemories } from '../storage/memory-store'
import { createLogger } from '../utils/logger'

const log = createLogger('DebugWorldSnapshot')

const MUTABLE_MAX = 2_000
const CATCHUP_MAX = 800
const MEMORY_LIMIT = 20
const MEMORY_CONTENT_MAX = 160
const MOMENT_LIMIT = 10
const MOMENT_TEXT_MAX = 200
const SLOT_LIMIT = 12

function clip(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

export type DebugWorldSnapshot = {
  role: { id: string; name: string; description: string; universeId: string }
  mutable: {
    body: string
    truncated: boolean
    version: number | null
    updatedAt: number | null
    source: 'override' | 'pack-default'
  }
  world: {
    home: string
    timezone: string
    situation: string
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
  moments: Array<{ id: string; publishedAt: number; text: string }>
  momentsTruncated: boolean
  profile: { identity: string; workflow: string; voice: string } | null
  memories: Array<{ id: string; category: string; content: string; updatedAt: number }>
  memoriesTruncated: boolean
  generatedAt: number
}

/**
 * 组装活跃主角世界态透视快照。
 */
export async function buildDebugWorldSnapshot(): Promise<DebugWorldSnapshot> {
  const role = await getActiveRole()
  const meta = await getMutableMeta(role.id)
  const mutableBody = meta?.body ?? (await getMutable(role.id, role.universeId))
  const mutableTrunc = mutableBody.length > MUTABLE_MAX

  const state = await getRoleState(role.id)
  const today = toLocalDateString(new Date())
  const script = await getDayScript(role.id, today)

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

  const profile = await buildUserProfile(role.id)
  const allMem = await listMemories()
  const memoriesTruncated = allMem.length > MEMORY_LIMIT
  const memories = allMem.slice(0, MEMORY_LIMIT).map((m) => ({
    id: m.id,
    category: m.category,
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
    mutable: {
      body: clip(mutableBody, MUTABLE_MAX),
      truncated: mutableTrunc,
      version: meta?.version ?? null,
      updatedAt: meta?.updatedAt ?? null,
      source: meta ? 'override' : 'pack-default',
    },
    world: state
      ? {
          home: state.world.home,
          timezone: state.world.timezone,
          situation: clip(state.world.situation || '', 300),
          updatedAt: state.world.updatedAt,
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
    moments,
    momentsTruncated,
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
    moments: moments.length,
    memories: memories.length,
    hasDayScript: !!dayScript,
  })
  return snap
}

export const __test = {
  clip,
  MUTABLE_MAX,
  MEMORY_LIMIT,
  MOMENT_LIMIT,
  SLOT_LIMIT,
}
