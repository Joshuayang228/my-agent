import { commitLifeAction } from '../application/commit-life-action'
/**
 * 伙伴足迹与航海旅行自主演化引擎（Travel Journey Progression）
 *
 * 背景：角色作为有持续探索欲与生活轨迹的数字伙伴，足迹旅行不能停留为固定过去的静态切片；
 * 在生活推进中，随着日程时间沉淀或受到用户在聊天中提及的旅行愿望驱动，角色需要能够自主开拓航段、抵达新岛屿并记录旅途经历。
 *
 * 设计意图：
 * 1. 结合生活时钟调度（Life Ticker）与用户旅行心愿（travel_wish 反哺），在受控冷却（24 小时）下自主演化航程；
 * 2. 为当前进行中的旅行（recordType: 'trip', status: 'active'）追加新的经停站点（stops），记录第一人称航海见闻；
 * 3. 产生的新站点即刻更新到 companion_assets，主会话提示词（formatLifeAssetsSliceForPrompt）自然感知「最近到过：新站点」；
 * 4. 记录独立历史至 companion_travel_progressions 表，广播 companion:timeline-updated 与 companion:travel-progressed 通知；
 * 5. 若站点契机源于用户旅行心愿，联动将活跃心愿推进为 completed，形成会话与航海探索的因果闭环。
 *
 * 关键约束：
 * - 纯主进程内部服务，站点结构严格遵循 world-records 的 tripStopSchema 校验规范；
 * - 冷却时间保护（24 小时）与单次旅行站点上限（8 站），防止无休止刷站破坏航海真实感；
 * - 任何异常记录日志并不阻断生活世界推进 Ticker。
 */

import { randomUUID } from 'node:crypto'
import { getDatabase, persist } from '../../storage/database'
import { ensureLifeSchema } from '../core/persistence/life-schema'
import { createLogger } from '../../utils/logger'
import { toLocalDateString } from './dates'
import { getCompanionRuntimeReadModel } from '../core/read-models/runtime-read-model'
import { loadRoleLifePresets } from '../identity/life-presets'
import { evaluateLifeActionGating } from './life-gating'
import {
  listAssets,
  ensureStarterFootprints,
  updateAsset,
  ASSET_KIND_FOOTPRINT,
} from './assets'
import type { CompanionAsset } from '../types'
import type {
  CompanionTravelProgressionRecord,
  CompanionTravelProgressedEvent,
} from '../../../../src/shared/types'
import { recordCompanionEventAndNotify } from '../application/record-event-notify'
import type { TripStopRecord } from '../../../../src/shared/world-records'
import { isActiveRole } from '../../storage/settings-store'

const log = createLogger('TravelProgression')

export const TRAVEL_PROGRESSION_POLICY = {
  cooldownMs: 24 * 3600 * 1000, // 24 小时冷却
  maxStopsPerTrip: 8,           // 单个航段最多 8 个站点
  defaultActiveTripKey: 'sunny-current-route',
} as const

/** 通用默认旅途候选站点（角色未提供 Role Pack 专属旅途奇遇时使用） */
const DEFAULT_TRAVEL_STOPS: ReadonlyArray<{
  id: string
  name: string
  story: string
}> = [
  {
    id: 'quiet-coastal-town',
    name: '海风小镇 · 旧灯塔与石阶',
    story: '沿着海岸线的石阶慢慢走上去，傍晚的灯塔刚好亮起微光，空气里带着淡淡的咸味与木头香。',
  },
  {
    id: 'mountain-tea-stop',
    name: '山腰茶亭 · 午后云雾歇脚处',
    story: '在半山腰的木亭里歇了会儿脚，点了一壶热茶看着山谷里的云雾缓缓散开，感觉整个人都松快下来。',
  },
]

export function getTravelCandidateStops(roleId: string): ReadonlyArray<{
  id: string
  name: string
  story: string
}> {
  const custom = loadRoleLifePresets(roleId).travelAdventures
  return custom?.length ? custom : DEFAULT_TRAVEL_STOPS
}

interface TravelProgressionDbRow {
  id: string
  role_id: string
  trip_id: string
  stop_id: string
  stop_name: string
  stop_date: string
  story: string
  trigger_reason: string
  created_at: number
}

function rowToRecord(row: TravelProgressionDbRow): CompanionTravelProgressionRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    tripId: row.trip_id,
    stopId: row.stop_id,
    stopName: row.stop_name,
    stopDate: row.stop_date,
    story: row.story,
    triggerReason: row.trigger_reason,
    createdAt: row.created_at,
  }
}

export async function ensureTravelProgressionTable(): Promise<void> {
  await ensureLifeSchema()
}

export async function listTravelProgressions(
  roleId: string,
  limit = 20,
): Promise<CompanionTravelProgressionRecord[]> {
  await ensureTravelProgressionTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT * FROM companion_travel_progressions WHERE role_id = ? ORDER BY created_at DESC LIMIT ?',
  )
  const rows: TravelProgressionDbRow[] = []
  try {
    stmt.bind([roleId, limit])
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as TravelProgressionDbRow)
    }
  } finally {
    stmt.free()
  }
  return rows.map(rowToRecord)
}

export interface TravelProgressionDecision {
  shouldProgress: boolean
  reason?: 'in_cooldown' | 'role_paused' | 'low_energy' | 'no_active_trip' | 'trip_completed' | 'all_stops_reached' | 'ready_to_progress'
  activeTrip?: CompanionAsset
  nextStop?: TripStopRecord
  triggerReason?: string
  resonanceId?: string
}

/**
 * 判定当前活跃角色是否需要自主推进航程并发现新站点。
 */
export async function shouldProgressTravelJourney(
  roleId: string,
  now = Date.now(),
): Promise<TravelProgressionDecision> {
  await ensureTravelProgressionTable()
  const db = await getDatabase()

  const state = await getCompanionRuntimeReadModel(roleId)
  if (state?.pausedAt != null) return { shouldProgress: false, reason: 'role_paused' }
  const gating = evaluateLifeActionGating({ kind: 'travel_progression', vitals: state })
  if (!gating.allow) return { shouldProgress: false, reason: 'low_energy' }


  // 1. 冷却检查
  const lastStmt = db.prepare(
    'SELECT created_at FROM companion_travel_progressions WHERE role_id = ? ORDER BY created_at DESC LIMIT 1',
  )
  let lastCreatedAt: number | null = null
  try {
    lastStmt.bind([roleId])
    if (lastStmt.step()) {
      lastCreatedAt = (lastStmt.getAsObject().created_at as number) || null
    }
  } finally {
    lastStmt.free()
  }

  if (lastCreatedAt != null && now - lastCreatedAt < TRAVEL_PROGRESSION_POLICY.cooldownMs) {
    return { shouldProgress: false, reason: 'in_cooldown' }
  }

  // 2. 查找进行中的旅行资产
  await ensureStarterFootprints(roleId)
  const assets = await listAssets(roleId, { kind: ASSET_KIND_FOOTPRINT })
  const activeTrip = assets.find(
    (a) => a.payload.recordType === 'trip' && a.payload.status === 'active',
  )

  if (!activeTrip) {
    return { shouldProgress: false, reason: 'no_active_trip' }
  }

  const existingStops = Array.isArray(activeTrip.payload.stops)
    ? (activeTrip.payload.stops as TripStopRecord[])
    : []

  if (existingStops.length >= TRAVEL_PROGRESSION_POLICY.maxStopsPerTrip) {
    return { shouldProgress: false, reason: 'trip_completed' }
  }

  const todayStr = toLocalDateString(now)
  const tripStartDate = typeof activeTrip.payload.start === 'string' ? activeTrip.payload.start : '2026-01-01'
  const stopDate = todayStr >= tripStartDate ? todayStr : tripStartDate

  // 3. 优先寻找来自用户交流激发的旅行心愿（travel_wish）
  let wishResonance: { id: string; targetName: string; reason: string } | null = null
  try {
    const wishStmt = db.prepare(
      "SELECT id, target_name, reason FROM companion_life_resonances WHERE role_id = ? AND kind = 'travel_wish' AND status = 'active' ORDER BY created_at ASC LIMIT 1",
    )
    wishStmt.bind([roleId])
    if (wishStmt.step()) {
      const row = wishStmt.getAsObject()
      wishResonance = {
        id: row.id as string,
        targetName: row.target_name as string,
        reason: (row.reason as string) || '',
      }
    }
    wishStmt.free()
  } catch {
    // 忽略心愿表未初始化
  }

  if (wishResonance) {
    const stopId = `wish-${wishResonance.id.slice(0, 8)}`
    // 防重：如果已经有同 ID 的站点
    if (!existingStops.some((s) => s.id === stopId)) {
      const wishTpl = loadRoleLifePresets(roleId).travelWishFallbackTemplate
      const defaultStory = wishTpl
        ? wishTpl
            .replace(/\{targetName\}/g, wishResonance.targetName)
            .replace(/\{reason\}/g, wishResonance.reason || '沿途的风景比想象中还要精彩。')
        : `终于来到了之前在闲聊中期待的「${wishResonance.targetName}」！${wishResonance.reason || '这里的风景和氛围让人忍不住想多停一会儿。'}`
      const nextStop: TripStopRecord = {
        id: stopId,
        name: wishResonance.targetName.slice(0, 24),
        date: stopDate,
        story: defaultStory.slice(0, 4000),
      }
      return {
        shouldProgress: true,
        reason: 'ready_to_progress',
        activeTrip,
        nextStop,
        triggerReason: 'user_travel_wish',
        resonanceId: wishResonance.id,
      }
    }
  }

  // 4. 若无特定心愿，从当前角色 Role Pack 候选站点库（或通用兜底）顺序推进
  const unusedCandidate = getTravelCandidateStops(roleId).find(
    (c) => !existingStops.some((s) => s.id === c.id),
  )

  if (!unusedCandidate) {
    return { shouldProgress: false, reason: 'all_stops_reached' }
  }

  const nextStop: TripStopRecord = {
    id: unusedCandidate.id,
    name: unusedCandidate.name.slice(0, 24),
    date: stopDate,
    story: unusedCandidate.story.slice(0, 4000),
  }

  return {
    shouldProgress: true,
    reason: 'ready_to_progress',
    activeTrip,
    nextStop,
    triggerReason: 'scheduled_voyage',
  }
}

export interface TravelProgressionResult {
  ok: boolean
  trip?: CompanionAsset
  newStop?: TripStopRecord
  record?: CompanionTravelProgressionRecord
  error?: string
}

/**
 * 评估并执行航海旅行自主推进。
 */
export async function checkAndProgressTravelJourney(
  roleId: string,
  now = Date.now(),
): Promise<TravelProgressionResult | null> {
  try {
    const decision = await shouldProgressTravelJourney(roleId, now)
    if (!decision.shouldProgress || !decision.activeTrip || !decision.nextStop) {
      return null
    }

    const { activeTrip, nextStop, triggerReason, resonanceId } = decision
    return await commitLifeAction(async () => {
      const existingStops = Array.isArray(activeTrip.payload.stops)
        ? (activeTrip.payload.stops as TripStopRecord[])
        : []

      const updatedStops = [...existingStops, nextStop]
      if (!(await isActiveRole(roleId))) return { ok: false, error: '伙伴已切换，请刷新人物页面后重试。' }
      const updateResult = await updateAsset(
        activeTrip.id,
        { payload: { stops: updatedStops } },
        { expectedRoleId: roleId },
      )

      if (!updateResult.ok) {
        log.warn('Failed to update trip asset for progression', {
          roleId,
          tripId: activeTrip.id,
          error: updateResult.error,
        })
        return { ok: false, error: updateResult.error }
      }

      const db = await getDatabase()
      const progressionRecord: CompanionTravelProgressionRecord = {
        id: randomUUID(),
        roleId,
        tripId: activeTrip.id,
        stopId: nextStop.id,
        stopName: nextStop.name,
        stopDate: nextStop.date || toLocalDateString(now),
        story: nextStop.story,
        triggerReason: triggerReason || 'scheduled_voyage',
        createdAt: now,
      }

      db.run(
        `INSERT INTO companion_travel_progressions
           (id, role_id, trip_id, stop_id, stop_name, stop_date, story, trigger_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          progressionRecord.id,
          progressionRecord.roleId,
          progressionRecord.tripId,
          progressionRecord.stopId,
          progressionRecord.stopName,
          progressionRecord.stopDate,
          progressionRecord.story,
          progressionRecord.triggerReason,
          progressionRecord.createdAt,
        ],
      )

      // 若源于旅行心愿，标记心愿已完成
      if (resonanceId) {
        db.run(
          `UPDATE companion_life_resonances
           SET status = 'completed', completed_at = ?, feedback_text = ?
           WHERE id = ?`,
          [now, `我们已经航行到达了「${nextStop.name}」！`, resonanceId],
        )
      }

      persist()

      log.info('Travel progression applied successfully', {
        roleId,
        tripTitle: activeTrip.name,
        stopName: nextStop.name,
        triggerReason,
      })

      const eventPayload: CompanionTravelProgressedEvent = {
        roleId,
        tripId: activeTrip.id,
        tripTitle: activeTrip.name,
        stop: {
          id: nextStop.id,
          name: nextStop.name,
          date: nextStop.date || toLocalDateString(now),
          story: nextStop.story,
        },
        toastTitle: `航海足迹已更新：${nextStop.name}`,
        timestamp: now,
      }

      await recordCompanionEventAndNotify({
        roleId,
        type: 'travel_progressed',
        sourceType: 'travel_progression',
        sourceId: progressionRecord.id,
        idempotencyKey: `travel-progressed:${progressionRecord.id}`,
        occurredAt: now,
        payload: eventPayload as unknown as Record<string, unknown>,
        notification: [
          { kind: 'timeline-updated', dedupeKey: `travel-timeline:${progressionRecord.id}`, payload: { roleId, now } },
          { kind: 'travel-progressed', dedupeKey: `travel-progressed:${progressionRecord.id}`, payload: eventPayload as unknown as Record<string, unknown> },
        ],
      })

      return {
        ok: true,
        trip: updateResult.asset,
        newStop: nextStop,
        record: progressionRecord,
      }
    })
  } catch (error) {
    log.error('Travel progression threw error', { roleId, error: String(error) })
    return null
  }
}

/**
 * 手动/受控触发一次航海推进（供调试或特定事件触发）。
 */
export async function triggerTravelProgression(
  roleId: string,
  customStop?: { name: string; story: string },
  now = Date.now(),
): Promise<CompanionTravelProgressionRecord | null> {
  await ensureStarterFootprints(roleId)
  await ensureTravelProgressionTable()
  const assets = await listAssets(roleId, { kind: ASSET_KIND_FOOTPRINT })
  const activeTrip = assets.find(
    (a) => a.payload.recordType === 'trip' && a.payload.status === 'active',
  )
  if (!activeTrip) return null

  const existingStops = Array.isArray(activeTrip.payload.stops)
    ? (activeTrip.payload.stops as TripStopRecord[])
    : []

  const todayStr = toLocalDateString(now)
  const stopId = `custom-stop-${randomUUID().slice(0, 8)}`
  const stop: TripStopRecord = {
    id: stopId,
    name: (customStop?.name || '未知海域奇遇浮岛').slice(0, 24),
    date: todayStr,
    story: (customStop?.story || '船员们在航线中发现了充满生机的新岛屿，展开了畅快的探索！').slice(0, 4000),
  }

  return await commitLifeAction(async () => {
    const updatedStops = [...existingStops, stop]
    if (!(await isActiveRole(roleId))) return null
    const updateResult = await updateAsset(
      activeTrip.id,
      { payload: { stops: updatedStops } },
      { expectedRoleId: roleId },
    )
    if (!updateResult.ok) return null

    const db = await getDatabase()
    const record: CompanionTravelProgressionRecord = {
      id: randomUUID(),
      roleId,
      tripId: activeTrip.id,
      stopId: stop.id,
      stopName: stop.name,
      stopDate: stop.date || toLocalDateString(now),
      story: stop.story,
      triggerReason: 'manual_trigger',
      createdAt: now,
    }

    db.run(
      `INSERT INTO companion_travel_progressions
         (id, role_id, trip_id, stop_id, stop_name, stop_date, story, trigger_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.roleId,
        record.tripId,
        record.stopId,
        record.stopName,
        record.stopDate,
        record.story,
        record.triggerReason,
        record.createdAt,
      ],
    )
    persist()

    const eventPayload: CompanionTravelProgressedEvent = {
      roleId,
      tripId: activeTrip.id,
      tripTitle: activeTrip.name,
      stop: { ...stop, date: stop.date || toLocalDateString(now) },
      toastTitle: `航海足迹已更新：${stop.name}`,
      timestamp: now,
    }
    await recordCompanionEventAndNotify({
      roleId,
      type: 'travel_progressed',
      sourceType: 'travel_progression',
      sourceId: record.id,
      idempotencyKey: `travel-progressed:${record.id}`,
      occurredAt: now,
      payload: eventPayload as unknown as Record<string, unknown>,
      notification: [
        { kind: 'timeline-updated', dedupeKey: `travel-timeline:${record.id}`, payload: { roleId, now } },
        { kind: 'travel-progressed', dedupeKey: `travel-progressed:${record.id}`, payload: eventPayload as unknown as Record<string, unknown> },
      ],
    })

    return record
  })
}
