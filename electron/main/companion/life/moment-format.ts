/**
 * Moment 规则底稿（无 IO；供投影 / 润色共用）
 */

import type { CompanionEvent } from '../types'

export type MomentAssetRefs = {
  outfitName?: string
  /** M25 旁路：书架可读引用 */
  bookName?: string
}

/**
 * 规则底稿。第二参可为旧式 outfit 字符串，或 { outfitName, bookName }。
 */
export function formatMomentText(
  event: CompanionEvent,
  outfitOrRefs?: string | MomentAssetRefs,
): string {
  const refs: MomentAssetRefs =
    typeof outfitOrRefs === 'string'
      ? { outfitName: outfitOrRefs }
      : outfitOrRefs ?? {}
  const p = event.payload
  const activity = String(p.activity ?? event.type)
  const mood = p.mood ? `（${String(p.mood)}）` : ''
  const location = p.location ? ` · ${String(p.location)}` : ''
  const outfit = refs.outfitName ? ` · 穿着${refs.outfitName}` : ''
  const book = refs.bookName ? ` · 在读${refs.bookName}` : ''
  return `${activity}${mood}${location}${outfit}${book}`
}
