import type { CompanionLifeSlice } from '../../../../src/shared/types'
import { listAssets } from './assets'
import { getEventById, getMomentByEventId, listEventLinks } from './store'

/**
 * 背景：生活切片详情需要同时展示事件、朋友圈投影和事件产生的资产，不能由 Renderer 依据多个接口自行猜测关联。
 * 设计意图：以 companion_events 作为事实源，在主进程按 role_id 聚合 moment、source_event_id 资产和结构化事件关联；不让 Renderer 自行跨表猜关系。
 * 关键约束：事件必须属于请求角色，动态、资产和 links 也必须经过同一 role_id 过滤；找不到事件时返回 null，不能用 UI 数据补齐。
 */
export async function getLifeSliceForRole(roleId: string, eventId: string): Promise<CompanionLifeSlice | null> {
  const event = await getEventById(eventId)
  if (!event || event.roleId !== roleId) return null

  const [moment, assets, links] = await Promise.all([
    getMomentByEventId(roleId, event.id),
    listAssets(roleId),
    listEventLinks(roleId, event.id),
  ])
  return {
    event,
    moment,
    assets: assets.filter((asset) => asset.sourceEventId === event.id),
    links,
  }
}
