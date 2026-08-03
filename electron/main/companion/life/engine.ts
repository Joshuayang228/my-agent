/**
 * LifeEngine 核心（W2 / M23-G1）
 *
 * 背景：非活跃角色生活世界完全暂停；活跃角色按日补剧本并 tick 物化到期事件。
 * 意图：pauseRole / resumeRole / ensureDayScripts / tickActiveRole。
 * 约束：tick 仅处理 active；当日剧本 prefer LLM（失败回退哈希）；Catch-up 细补默认哈希。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import { createLogger } from '../../utils/logger'
import * as settings from '../../storage/settings-store'
import * as identity from '../identity/loader'
import type { DayScriptPayload } from '../types'
import { eachLocalDateInclusive, localDateTimeMs, toLocalDateString } from './dates'
import { pickWardrobeAssetId } from './assets'
import { publishAndProjectDue } from './moments'
import { resolveDayScript } from './script-generator'
import { refreshSituationFromLife } from './world-state'
import * as store from './store'

/** 解析当前活跃主角（不经过 orchestrator，避免 life ↔ orchestrator 循环依赖） */
async function resolveActiveRoleId(): Promise<string> {
  const universeId = await settings.getSetting('universeId')
  const active = await settings.getSetting('activeRoleId')
  if (active && identity.isKnownProtagonist(active, universeId)) return active
  return identity.getDefaultProtagonistId(universeId)
}

const log = createLogger('LifeEngine')

export async function pauseRole(roleId: string, at: number): Promise<void> {
  await store.writePausedAt(roleId, at)
  log.info('Role paused', { roleId, at })
}

/** W2：清除暂停。完整 Catch-up 由 W3 runCatchup 接管。 */
export async function resumeRole(roleId: string): Promise<void> {
  await store.clearPausedAt(roleId)
  log.info('Role resumed (pause cleared)', { roleId })
}

export interface EnsureDayScriptsOpts {
  /** 为 true 且提供 llmConfig/可加载 aux 时，缺页走 LLM（失败回退哈希） */
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
}

/**
 * 补齐 [fromDate, toDate] 缺失日剧本，并为新剧本写入 planned 事件。
 * 可对任意 role 调用（供 Catch-up）；日常 tick 只应对 active 调用。
 * Catch-up 应默认 preferLlm=false，避免换角连打多日 LLM。
 */
export async function ensureDayScripts(
  roleId: string,
  fromDate: string,
  toDate: string,
  opts?: EnsureDayScriptsOpts,
): Promise<{ created: number; llmDays: number }> {
  const dates = eachLocalDateInclusive(fromDate, toDate)
  let created = 0
  let llmDays = 0
  let llmConfig = opts?.llmConfig
  if (opts?.preferLlm && !llmConfig) {
    try {
      llmConfig = await loadAuxLLMConfig()
    } catch (err) {
      log.warn('loadAuxLLMConfig failed; fall back to hash scripts', {
        error: String(err),
      })
    }
  }
  for (const date of dates) {
    const existing = await store.getDayScript(roleId, date)
    if (existing) {
      // 剧本已在但事件缺失时补事件（幂等）
      if (!(await store.hasEventsForScript(existing.id))) {
        await materializePlannedEvents(roleId, existing.id, existing.payload)
      }
      continue
    }
    const { payload, source } = await resolveDayScript(roleId, date, {
      preferLlm: opts?.preferLlm,
      llmConfig,
      universeId: opts?.universeId,
    })
    if (source === 'llm') llmDays += 1
    const row = await store.insertDayScript(roleId, date, payload)
    await materializePlannedEvents(roleId, row.id, payload)
    created += 1
  }
  if (created) {
    log.info('Day scripts ensured', { roleId, fromDate, toDate, created, llmDays })
  }
  return { created, llmDays }
}

async function materializePlannedEvents(
  roleId: string,
  dayScriptId: string,
  payload: DayScriptPayload,
): Promise<void> {
  for (const slot of payload.slots) {
    const scheduledAt = localDateTimeMs(payload.date, slot.hour, slot.minute)
    // moment 槽位挂衣柜引用（派生截面，非独立真相）
    const assetId =
      slot.type === 'moment'
        ? await pickWardrobeAssetId(roleId, scheduledAt)
        : null
    await store.insertEvent({
      roleId,
      scheduledAt,
      status: 'planned',
      type: slot.type,
      dayScriptId,
      payload: {
        activity: slot.activity,
        mood: slot.mood,
        location: slot.location,
        date: payload.date,
        theme: payload.theme,
        ...(assetId ? { assetId } : {}),
        ...(slot.grantAsset ? { grantAsset: slot.grantAsset } : {}),
      },
    })
  }
}

/**
 * 仅对当前 active 角色：确保今日剧本，发布到期事件，更新 last_tick_at。
 * 若 active 仍带 paused_at（异常态），跳过生成（等 resume/catchup）。
 */
export async function tickActiveRole(now: number): Promise<{
  roleId: string | null
  published: number
  scriptsCreated: number
}> {
  const roleId = await resolveActiveRoleId()
  const state = await store.getRoleState(roleId)
  if (state?.pausedAt != null) {
    log.debug('Skip tick: active role still paused', { roleId, pausedAt: state.pausedAt })
    return { roleId, published: 0, scriptsCreated: 0 }
  }

  const today = toLocalDateString(now)
  const universeId = (await settings.getSetting('universeId')) || 'default'
  const { created } = await ensureDayScripts(roleId, today, today, {
    preferLlm: true,
    universeId,
  })
  const published = await publishAndProjectDue(roleId, now)
  // M23-G2：用最近 published 事件刷新短期情境（居所/时区保持稳定）
  await refreshSituationFromLife(roleId, now)
  await store.touchLastTick(roleId, now)
  if (published || created) {
    log.info('Active role ticked', { roleId, published, scriptsCreated: created, now })
  }
  return { roleId, published, scriptsCreated: created }
}

/** 供单测 / IPC 调试读取 */
export const __lifeStore = {
  getRoleState: store.getRoleState,
  getDayScript: store.getDayScript,
  countDayScripts: store.countDayScripts,
  countEvents: store.countEvents,
  listEvents: store.listEvents,
  countMoments: store.countMoments,
  listMoments: store.listMoments,
  insertEvent: store.insertEvent,
}
