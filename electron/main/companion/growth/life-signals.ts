/**
 * 反思用生活世界薄信号（M22-G4）
 *
 * 背景：成长核原先只吃用户消息 + feedback；生活事件能提示「相处节奏」，但不应灌全量 Moments。
 * 意图：按 role 取 Catch-up 一句 + 近 N 条 Moment 一行摘要，供反思 Prompt。
 * 约束：只读投影截面；不读 day_scripts 全文；事实仍不得写进 MUTABLE。
 */

import { listMomentsForRole } from '../life/moments'
import { getCompanionLegacyRoleState as getRoleState } from '../core/read-models/legacy-companion-read-model'
import { ASSET_KIND_BOOKSHELF, latestReadingNote, listAssets } from '../life/assets'

export const LIFE_SIGNAL_MOMENT_LIMIT = 12

export interface LifeSignalMoment {
  publishedAt: number
  text: string
}
export interface LifeSignalReading {
  name: string
  note?: string
  observation?: string
  inference?: string
  status?: string
}

function formatLocalStamp(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/**
 * 把 Catch-up + Moments 压成多行文本（无信号时返回空串）。
 */
export function formatLifeSignalsForReflection(input: {
  catchupSummary?: string | null
  moments: LifeSignalMoment[]
  readings?: LifeSignalReading[]
  maxMoments?: number
}): string {
  const lines: string[] = []
  const catchup = input.catchupSummary?.trim()
  if (catchup) {
    lines.push(`【追赶】${catchup.slice(0, 200)}`)
  }
  const limit = input.maxMoments ?? LIFE_SIGNAL_MOMENT_LIMIT
  const moments = input.moments.slice(0, limit)
  if (moments.length > 0) {
    lines.push('【近动态】')
    for (const m of moments) {
      const text = m.text.trim().slice(0, 120)
      if (!text) continue
      lines.push(`- ${formatLocalStamp(m.publishedAt)} ${text}`)
    }
  }
  const readings = input.readings ?? []
  if (readings.length > 0) {
    lines.push('【阅读记录】')
    for (const reading of readings.slice(0, 6)) {
      const name = reading.name.trim().slice(0, 80)
      if (!name) continue
      const note = reading.note?.trim().slice(0, 120)
      const observation = reading.observation?.trim().slice(0, 120)
      const inference = reading.inference?.trim().slice(0, 120)
      const status = reading.status?.trim().slice(0, 40)
      const grounding = [observation ? `材料观察：${observation}` : '', inference ? `人物推断：${inference}` : ''].filter(Boolean).join('；')
      lines.push(`- ${name}${status ? `（${status}）` : ''}${note ? `：${note}` : ''}${grounding ? `｜${grounding}` : ''}`)
    }
  }
  return lines.join('\n').trim()
}

/** 拉取该角色的薄信号（仅 published Moments + catchup） */
export async function collectLifeSignalsForRole(
  roleId: string,
  opts?: { limit?: number },
): Promise<string> {
  const limit = opts?.limit ?? LIFE_SIGNAL_MOMENT_LIMIT
  const [state, moments, bookshelf] = await Promise.all([
    getRoleState(roleId),
    listMomentsForRole(roleId, { limit }),
    listAssets(roleId, { kind: ASSET_KIND_BOOKSHELF, limit: 6 }),
  ])
  return formatLifeSignalsForReflection({
    catchupSummary: state?.catchupSummary ?? '',
    moments: moments.map((m) => ({ publishedAt: m.publishedAt, text: m.text })),
    readings: bookshelf.map((asset) => ({
      name: asset.name,
      note: latestReadingNote(asset.payload) || undefined,
      observation: latestReadingNote(asset.payload, 'observation') || undefined,
      inference: latestReadingNote(asset.payload, 'inference') || undefined,
      status: typeof asset.payload.readingStatus === 'string' ? asset.payload.readingStatus : undefined,
    })),
    maxMoments: limit,
  })
}
