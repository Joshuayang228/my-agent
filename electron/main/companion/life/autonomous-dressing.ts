/**
 * 伙伴衣柜与穿搭自主演化引擎（Autonomous Contextual Dressing）
 *
 * 背景：角色作为有性格、有日常生活的活人数字伙伴，其穿搭状态不能只依赖用户手动在衣柜面板点击换装；
 * 角色在每日晨起开启新日程、参与特定生活活动或冷启初次活动时，应当具备顺应情境自主换装的能力。
 *
 * 设计意图：
 * 1. 结合角色日程（日剧本 theme/slots）、当日时段（清晨起床 routine）与当前衣柜资产，挑选适宜的套装或单品；
 * 2. 严格调用既有的 changeWardrobe 核心方法，确保版本号原子校验、槽位分类检验与受控图片同步继承；
 * 3. 健全的门控防线：每日频次上限（2 次）、冷却时间（4 小时）以及用户手动换装保护（近 2 小时用户手动选择不可覆盖）；
 * 4. 换装成功后广播 companion:timeline-updated，使前端衣柜画廊即时刷新，主会话提示词（formatLifeAssetsSliceForPrompt）自然感知。
 *
 * 关键约束：
 * - 纯主进程内部服务，换装严格走 changeWardrobe 事务；
 * - 绝不凭空捏造未登记或不存在的衣物 ID；
 * - 任何异常记录日志并不阻断生活世界推进 Ticker。
 */

import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { getDatabase, persist } from '../../storage/database'
import { createLogger } from '../../utils/logger'
import { toLocalDateString } from './dates'
import { getRoleState, getDayScript } from './store'
import {
  listAssets,
  ensureStarterWardrobe,
  changeWardrobe,
  ASSET_KIND_WARDROBE,
} from './assets'
import type { CompanionAsset } from '../types'
import type {
  CompanionAutonomousDressingRecord,
} from '../../../../src/shared/types'

const log = createLogger('AutonomousDressing')

export const AUTONOMOUS_DRESSING_POLICY = {
  cooldownMs: 4 * 3600 * 1000,
  dailyLimit: 2,
  userManualProtectionMs: 2 * 3600 * 1000,
  morningStartHour: 6,
  morningEndHour: 10,
  defaultTriggerReason: 'morning_routine',
} as const

interface AutonomousDressingDbRow {
  id: string
  role_id: string
  asset_id: string
  outfit_name: string
  trigger_reason: string
  outfit_version: number
  created_at: number
}

function rowToRecord(row: AutonomousDressingDbRow): CompanionAutonomousDressingRecord {
  return {
    id: row.id,
    roleId: row.role_id,
    assetId: row.asset_id,
    outfitName: row.outfit_name,
    triggerReason: row.trigger_reason,
    outfitVersion: row.outfit_version,
    createdAt: row.created_at,
  }
}

export async function ensureAutonomousDressingTable(): Promise<void> {
  const db = await getDatabase()
  db.run(`
    CREATE TABLE IF NOT EXISTS companion_autonomous_dressings (
      id             TEXT PRIMARY KEY,
      role_id        TEXT NOT NULL,
      asset_id       TEXT NOT NULL,
      outfit_name    TEXT NOT NULL,
      trigger_reason TEXT NOT NULL,
      outfit_version INTEGER NOT NULL,
      created_at     INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_autonomous_dressings_role_created
    ON companion_autonomous_dressings(role_id, created_at DESC)
  `)
}

export async function listAutonomousDressings(
  roleId: string,
  limit = 20,
): Promise<CompanionAutonomousDressingRecord[]> {
  await ensureAutonomousDressingTable()
  const db = await getDatabase()
  const stmt = db.prepare(
    'SELECT * FROM companion_autonomous_dressings WHERE role_id = ? ORDER BY created_at DESC LIMIT ?',
  )
  const rows: AutonomousDressingDbRow[] = []
  try {
    stmt.bind([roleId, limit])
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as AutonomousDressingDbRow)
    }
  } finally {
    stmt.free()
  }
  return rows.map(rowToRecord)
}

/** 检查当前穿戴槽位是否与目标套装完全一致 */
export function isWearingOutfit(
  currentSlots: Record<string, unknown> | undefined,
  outfitSlots: Record<string, unknown> | undefined,
): boolean {
  if (!currentSlots || !outfitSlots) return false
  const outfitKeys = Object.keys(outfitSlots)
  if (outfitKeys.length === 0) return false
  for (const key of outfitKeys) {
    if (currentSlots[key] !== outfitSlots[key]) return false
  }
  return true
}

/** 根据当天日程主题或槽位活动为套装打分 */
export function scoreOutfitForContext(outfit: CompanionAsset, contextText: string): number {
  let score = 0
  const name = outfit.name || ''
  const style = typeof outfit.payload?.style === 'string' ? outfit.payload.style : ''
  const desc = typeof outfit.payload?.description === 'string' ? outfit.payload.description : ''
  const text = `${name} ${style} ${desc}`.toLowerCase()
  const lowerContext = contextText.toLowerCase()

  const keywords = [
    '日常', '冒险', '航海', '甲板', '出海', '运动',
    '训练', '休息', '宴会', '庆典', '潜水', '海滩',
    '海风', '巡航', '战斗', '晚宴', '聚餐',
  ]
  for (const kw of keywords) {
    if (lowerContext.includes(kw) && text.includes(kw)) {
      score += 2
    }
  }
  // 日常/基础款有保底分 1
  if (text.includes('日常') || text.includes('冒险') || text.includes('基础') || text.includes('出厂')) {
    score += 1
  }
  return score
}

export interface ContextualDressingDecision {
  shouldDress: boolean
  reason?: 'starter_dress' | 'morning_routine' | 'contextual_activity' | 'user_manual_protection' | 'daily_limit_reached' | 'in_cooldown' | 'role_paused' | 'already_properly_dressed' | 'no_wardrobe_items'
  targetAsset?: CompanionAsset
  expectedVersion?: number
}

/**
 * 判定当前活跃角色是否需要自主换装。
 */
export async function shouldPerformContextualDressing(
  roleId: string,
  now = Date.now(),
): Promise<ContextualDressingDecision> {
  await ensureAutonomousDressingTable()
  const db = await getDatabase()

  const state = await getRoleState(roleId)
  if (state?.pausedAt != null) {
    return { shouldDress: false, reason: 'role_paused' }
  }

  // 1. 每日频次上限检查
  const dateStr = toLocalDateString(now)
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfDayMs = startOfDay.getTime()

  const countStmt = db.prepare(
    'SELECT COUNT(*) as count FROM companion_autonomous_dressings WHERE role_id = ? AND created_at >= ?',
  )
  let todayCount = 0
  try {
    countStmt.bind([roleId, startOfDayMs])
    if (countStmt.step()) {
      todayCount = (countStmt.getAsObject().count as number) || 0
    }
  } finally {
    countStmt.free()
  }

  if (todayCount >= AUTONOMOUS_DRESSING_POLICY.dailyLimit) {
    return { shouldDress: false, reason: 'daily_limit_reached' }
  }

  // 2. 冷却时间检查
  const lastStmt = db.prepare(
    'SELECT created_at, outfit_version FROM companion_autonomous_dressings WHERE role_id = ? ORDER BY created_at DESC LIMIT 1',
  )
  let lastCreatedAt: number | null = null
  let lastAutonomousVersion: number | null = null
  try {
    lastStmt.bind([roleId])
    if (lastStmt.step()) {
      const obj = lastStmt.getAsObject()
      lastCreatedAt = (obj.created_at as number) || null
      lastAutonomousVersion = typeof obj.outfit_version === 'number' ? obj.outfit_version : null
    }
  } finally {
    lastStmt.free()
  }

  if (lastCreatedAt != null && now - lastCreatedAt < AUTONOMOUS_DRESSING_POLICY.cooldownMs) {
    return { shouldDress: false, reason: 'in_cooldown' }
  }

  // 3. 读取衣柜资产
  await ensureStarterWardrobe(roleId)
  const assets = await listAssets(roleId, { kind: ASSET_KIND_WARDROBE })
  const wearState = assets.find((a) => a.payload.recordType === 'wear-state')

  // 4. 初次冷启（无 wear-state）——穿上初始日常套装
  if (!wearState) {
    const outfits = assets.filter((a) => a.payload.recordType === 'outfit')
    if (outfits.length > 0) {
      // 优先找日常/出厂套装
      const starterOutfit = outfits.find((o) => o.name.includes('日常') || o.name.includes('冒险')) || outfits[0]
      return {
        shouldDress: true,
        reason: 'starter_dress',
        targetAsset: starterOutfit,
        expectedVersion: 0,
      }
    }
    const garments = assets.filter((a) => a.payload.recordType === 'garment' || !a.payload.recordType)
    if (garments.length > 0) {
      return {
        shouldDress: true,
        reason: 'starter_dress',
        targetAsset: garments[0],
        expectedVersion: 0,
      }
    }
    return { shouldDress: false, reason: 'no_wardrobe_items' }
  }

  // 5. 用户手动换装保护（近 2 小时手动换装不覆盖）
  const currentVersion = typeof wearState.payload.outfitVersion === 'number' ? wearState.payload.outfitVersion : 0
  const timeSinceWearStateChange = now - (wearState.acquiredAt || 0)
  if (timeSinceWearStateChange < AUTONOMOUS_DRESSING_POLICY.userManualProtectionMs) {
    if (lastAutonomousVersion == null || lastAutonomousVersion !== currentVersion) {
      log.debug('Skip autonomous dressing: user manual protection active', {
        roleId,
        currentVersion,
        lastAutonomousVersion,
        timeSinceWearStateChange,
      })
      return { shouldDress: false, reason: 'user_manual_protection' }
    }
  }

  // 6. 清晨起床或生活情境匹配
  const hour = new Date(now).getHours()
  const isMorning = hour >= AUTONOMOUS_DRESSING_POLICY.morningStartHour && hour <= AUTONOMOUS_DRESSING_POLICY.morningEndHour

  const dayScript = await getDayScript(roleId, dateStr)
  const theme = dayScript?.payload?.theme || ''
  const currentSlot = dayScript?.payload?.slots?.find((s) => s.hour === hour)
  const activity = currentSlot?.activity || ''
  const contextText = `${theme} ${activity}`.trim()

  const outfits = assets.filter((a) => a.payload.recordType === 'outfit')
  if (outfits.length === 0) {
    return { shouldDress: false, reason: 'no_wardrobe_items' }
  }

  const currentSlots = wearState.payload.slots as Record<string, unknown> | undefined

  // 寻找最佳匹配套装
  let bestOutfit: CompanionAsset | null = null
  let highestScore = 0

  for (const outfit of outfits) {
    const score = scoreOutfitForContext(outfit, contextText)
    if (score > highestScore) {
      highestScore = score
      bestOutfit = outfit
    }
  }

  // 如果找到合适套装且当前并未穿着
  if (bestOutfit && !isWearingOutfit(currentSlots, bestOutfit.payload.slots as Record<string, unknown>)) {
    return {
      shouldDress: true,
      reason: isMorning && todayCount === 0 ? 'morning_routine' : 'contextual_activity',
      targetAsset: bestOutfit,
      expectedVersion: currentVersion,
    }
  }

  // 若处于清晨且今日尚未自主换装，且有未穿的日常套装
  if (isMorning && todayCount === 0) {
    const defaultOutfit = outfits.find((o) => o.name.includes('日常') || o.name.includes('冒险')) || outfits[0]
    if (!isWearingOutfit(currentSlots, defaultOutfit.payload.slots as Record<string, unknown>)) {
      return {
        shouldDress: true,
        reason: 'morning_routine',
        targetAsset: defaultOutfit,
        expectedVersion: currentVersion,
      }
    }
  }

  return { shouldDress: false, reason: 'already_properly_dressed' }
}

export interface ContextualDressingResult {
  ok: boolean
  asset?: CompanionAsset
  reason?: string
  dressingRecord?: CompanionAutonomousDressingRecord
  error?: string
}

/**
 * 评估并执行伙伴自主演化换装。
 */
export async function checkAndPerformContextualDressing(
  roleId: string,
  now = Date.now(),
): Promise<ContextualDressingResult | null> {
  try {
    const decision = await shouldPerformContextualDressing(roleId, now)
    if (!decision.shouldDress || !decision.targetAsset || decision.expectedVersion == null) {
      return null
    }

    const { targetAsset, expectedVersion, reason } = decision
    const changeResult = await changeWardrobe({
      roleId,
      assetId: targetAsset.id,
      expectedVersion,
    })

    if (!changeResult.ok) {
      log.warn('Contextual dressing changeWardrobe rejected', {
        roleId,
        assetId: targetAsset.id,
        expectedVersion,
        error: changeResult.error,
      })
      return { ok: false, error: changeResult.error }
    }

    const dressingRecord: CompanionAutonomousDressingRecord = {
      id: randomUUID(),
      roleId,
      assetId: targetAsset.id,
      outfitName: targetAsset.name,
      triggerReason: reason || 'contextual_activity',
      outfitVersion: (changeResult.asset.payload.outfitVersion as number) || 1,
      createdAt: now,
    }

    const db = await getDatabase()
    db.run(
      `INSERT INTO companion_autonomous_dressings
         (id, role_id, asset_id, outfit_name, trigger_reason, outfit_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dressingRecord.id,
        dressingRecord.roleId,
        dressingRecord.assetId,
        dressingRecord.outfitName,
        dressingRecord.triggerReason,
        dressingRecord.outfitVersion,
        dressingRecord.createdAt,
      ],
    )
    persist()

    log.info('Contextual dressing applied successfully', {
      roleId,
      outfitName: targetAsset.name,
      version: dressingRecord.outfitVersion,
      reason,
    })

    // 广播渲染端更新
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('companion:timeline-updated', { roleId, now })
        win.webContents.send('companion:wardrobe-changed', {
          roleId,
          asset: changeResult.asset,
          reason,
          now,
        })
      }
    }

    return {
      ok: true,
      asset: changeResult.asset,
      reason,
      dressingRecord,
    }
  } catch (error) {
    log.error('Contextual dressing threw error', { roleId, error: String(error) })
    return null
  }
}
