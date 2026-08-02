/**
 * Moments 投影（W3 / M24-G2）
 *
 * 背景：朋友圈是 published 事件的 UI 截面，不是另一套生活真相。
 * 意图：事件 → companion_moments；可选 LLM 润色仍绑定 event。
 * 约束：列表仅按 role 查询（IPC 再限 active）；Catch-up 批量默认不润色。
 */

import type { LLMConfig } from '../../../../src/shared/types'
import { loadAuxLLMConfig } from '../../llm/aux-config'
import type { CompanionEvent, CompanionMoment } from '../types'
import { getAsset } from './assets'
import { formatMomentText } from './moment-format'
import { resolveMomentText } from './moment-polish'
import * as store from './store'

export { formatMomentText } from './moment-format'

export interface ProjectMomentOpts {
  /** tick 路径可为 true；Catch-up 细补默认 false */
  preferLlm?: boolean
  llmConfig?: LLMConfig
  universeId?: string
}

/** 将已 published 事件投影为 moment（幂等） */
export async function projectMomentFromEvent(
  event: CompanionEvent,
  opts?: ProjectMomentOpts,
): Promise<CompanionMoment | null> {
  if (event.status !== 'published') return null
  let outfitName: string | undefined
  const assetId = typeof event.payload.assetId === 'string' ? event.payload.assetId : null
  if (assetId) {
    const asset = await getAsset(assetId)
    if (asset) outfitName = asset.name
  }

  let llmConfig = opts?.llmConfig
  if (opts?.preferLlm && !llmConfig) {
    try {
      llmConfig = await loadAuxLLMConfig()
    } catch {
      llmConfig = undefined
    }
  }

  const { text, source } = await resolveMomentText(event, {
    preferLlm: opts?.preferLlm,
    llmConfig,
    outfitName,
    universeId: opts?.universeId,
  })

  return store.insertMoment({
    roleId: event.roleId,
    eventId: event.id,
    publishedAt: event.scheduledAt,
    text,
    meta: {
      type: event.type,
      mood: event.payload.mood,
      location: event.payload.location,
      theme: event.payload.theme,
      assetId: assetId ?? undefined,
      outfit: outfitName,
      textSource: source,
    },
  })
}

/**
 * 发布 [fromMs, toMs] 内 planned 事件并投影 moments。
 * 返回新 published 数量。
 */
export async function publishAndProjectRange(
  roleId: string,
  fromMs: number,
  toMs: number,
  opts?: ProjectMomentOpts,
): Promise<number> {
  const planned = await store.listEvents(roleId, { status: 'planned' })
  let n = 0
  for (const ev of planned) {
    if (ev.scheduledAt < fromMs || ev.scheduledAt > toMs) continue
    await store.markEventPublished(ev.id)
    const published: CompanionEvent = { ...ev, status: 'published' }
    await projectMomentFromEvent(published, opts)
    n += 1
  }
  return n
}

/** tick 用：发布所有 scheduled_at <= now 的 planned 并投影（prefer LLM 润色） */
export async function publishAndProjectDue(roleId: string, now: number): Promise<number> {
  return publishAndProjectRange(roleId, 0, now, { preferLlm: true })
}

export async function listMomentsForRole(
  roleId: string,
  opts?: { limit?: number; offset?: number },
): Promise<CompanionMoment[]> {
  return store.listMoments(roleId, opts)
}
