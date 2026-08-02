/**
 * Moment 规则底稿（无 IO；供投影 / 润色共用）
 */

import type { CompanionEvent } from '../types'

export function formatMomentText(event: CompanionEvent, outfitName?: string): string {
  const p = event.payload
  const activity = String(p.activity ?? event.type)
  const mood = p.mood ? `（${String(p.mood)}）` : ''
  const location = p.location ? ` · ${String(p.location)}` : ''
  const outfit = outfitName ? ` · 穿着${outfitName}` : ''
  return `${activity}${mood}${location}${outfit}`
}
