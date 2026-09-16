/**
 * 通讯录忙闲展示
 *
 * 背景：召唤忙闲判定已在 companion:check-cast-availability / startSummon 落地，但正式通讯录列表只展示关系，忙碌要等点开聊才出现。
 * 设计意图：把 IPC 结果收成固定文案和语气，列表只做预检展示；开聊仍走 startSummon 的二次判定和强制确认，不另造忙闲源。
 * 关键约束：available 只能来自既有 IPC；查询失败必须显示未读到，不能假装空闲；忙碌时仍允许开聊。
 */

export interface CastAvailabilitySnapshot {
  available: boolean
  roleId: string
  name: string
  reason?: string
  alternative?: string
  presence?: string
}

export type CastAvailabilityTone = 'available' | 'busy' | 'unknown'

export interface CastAvailabilityView {
  label: string
  detail: string
  tone: CastAvailabilityTone
}

export function isCastAvailabilitySnapshot(value: unknown): value is CastAvailabilitySnapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.available === 'boolean' && typeof record.roleId === 'string' && typeof record.name === 'string'
}

export function describeCastAvailability(snapshot: CastAvailabilitySnapshot | null | undefined): CastAvailabilityView {
  if (!snapshot) {
    return { label: '状态未读到', detail: '开聊时会再确认一次。', tone: 'unknown' }
  }
  if (snapshot.available) {
    const detail = snapshot.presence ? ('此刻：' + snapshot.presence) : '现在方便联系。'
    return { label: '方便开聊', detail, tone: 'available' }
  }
  const presence = snapshot.presence ? ('此刻：' + snapshot.presence) : ''
  const detail = [snapshot.reason, snapshot.alternative, presence]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' · ')
  return {
    label: '现在忙碌',
    detail: detail || '现在不太方便，开聊前会再确认。',
    tone: 'busy',
  }
}

export function describeCastAvailabilityWhileLoading(snapshot: CastAvailabilitySnapshot | null | undefined, loading: boolean): CastAvailabilityView {
  if (snapshot) return describeCastAvailability(snapshot)
  if (loading) return { label: '正在查看忙闲', detail: '开聊前会再确认一次。', tone: 'unknown' }
  return describeCastAvailability(null)
}
