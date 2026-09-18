import type { ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from './types'

/**
 * 正式测试目标与主进程装配必须选中同一用途，不能各自实现一套筛选。
 * 这里只解析传入快照并过滤，不读取存储或解密；Renderer 传脱敏连接，主进程传真实连接。
 * 顺序、启用状态、模型清单与独立身份必须保留，不能因缺 Key 借用其他连接。
 */
export function resolveRoutedConfigs(connectionsRaw: string, routesRaw: string, purpose: ModelRoutePurpose): ModelConnectionProfile[] {
  let connections: ModelConnectionProfile[]
  let routes: ModelRouteProfile[]
  try { connections = JSON.parse(connectionsRaw); routes = JSON.parse(routesRaw) } catch { return [] }
  if (!Array.isArray(connections) || !Array.isArray(routes)) return []
  const result: ModelConnectionProfile[] = []
  const seen = new Set<string>()
  for (const item of routes) {
    if (item.purpose !== purpose || !item.enabled || !item.model.trim()) continue
    const connection = connections.find((candidate) => candidate.id === item.connectionId && candidate.enabled && candidate.baseUrl.trim())
    if (!connection) continue
    const models = Array.isArray(connection.models) ? connection.models : []
    if (models.length && !models.some((model) => model.id === item.model.trim() && model.enabled !== false)) continue
    const key = JSON.stringify([connection.id, item.model.trim()])
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...connection, model: item.model.trim() })
  }
  return result
}
