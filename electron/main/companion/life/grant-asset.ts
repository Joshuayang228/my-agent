/**
 * grantAsset 规格规范化（纯函数，无 DB）
 *
 * 背景：日剧本解析与 publish 入库共用校验，避免 script-generator 依赖 assets 整模块。
 */

import type { GrantAssetSpec } from '../types'

/**
 * 规范化 grant 规格；非法则 null。
 */
export function normalizeGrantAsset(raw: unknown): GrantAssetSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const kind = typeof r.kind === 'string' ? r.kind.trim().slice(0, 24) : ''
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : ''
  if (!kind || !name) return null
  let payload: Record<string, unknown> | undefined
  if (r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)) {
    payload = {}
    for (const [k, v] of Object.entries(r.payload as Record<string, unknown>)) {
      if (typeof v === 'string') {
        const t = v.trim().slice(0, 24)
        if (t) payload[k] = t
      }
    }
  }
  return payload && Object.keys(payload).length ? { kind, name, payload } : { kind, name }
}
