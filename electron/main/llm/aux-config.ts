/**
 * 辅助 / 主模型配置工厂（唯一装配入口）
 *
 * 背景：历史上 IPC、Playground、memory、delegate 等各自拼 settings，
 *       导致 thinking / auxModel 等策略漏挂（如右键「重新生成标题」仍开 thinking）。
 * 设计意图：所有需要 LLMConfig 的调用只走本文件的两个 loader；
 *           真正打模型仍统一经 streamChat / chatComplete。
 *           放弃「每个调用点自己记得关 thinking」——那必然漏网。
 * 关键约束：
 * - 主对话用 loadMainLLMConfig（保留厂商默认 thinking）
 * - 辅助任务（title/profile/生活脚本/子 Agent 等）用 loadAuxLLMConfig
 * - 禁止在 ipc/ / storage/ / tools/ 里手拼 apiKey + baseUrl + model
 * - 无 apiKey 时返回空字符串，由调用方决定报错或降级，本文件不抛
 */

import type { LLMConfig, ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from '../../../src/shared/types'
import * as settings from '../storage/settings-store'
import { withAuxThinking } from './thinking'

export async function loadMainLLMConfig(overrides?: Partial<LLMConfig>): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  const routed = resolveRoutedConfig(s.modelConnections, s.modelRoutes, 'primary')
  return {
    apiKey: routed?.apiKey || s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: routed?.baseUrl || s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: routed?.model || s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
    temperature: parseFloat(s.llmTemperature) || undefined,
    topP: parseFloat(s.llmTopP) || undefined,
    maxTokens: parseInt(s.llmMaxTokens) || undefined,
    ...overrides,
  }
}

/**
 * 背景：图片理解路由已经可在正式设置中配置，但主对话此前始终读取 primary，导致界面安排与真实请求脱节。
 * 设计意图：图片请求只在显式带图片时读取 image 路由；没有图片时继续使用主模型，避免普通对话被意外切换。
 * 关键约束：image 路由必须经过与 primary/auxiliary 相同的启用、连接存在和 Base URL 校验；无有效路由必须完整回退主模型。
 */
export async function loadImageLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  const all = await settings.getAllSettings()
  const routed = resolveRoutedConfig(all.modelConnections, all.modelRoutes, 'image')
  if (!routed) return main
  return { ...main, apiKey: routed.apiKey || main.apiKey, baseUrl: routed.baseUrl, model: routed.model }
}
export async function loadAuxLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  const all = await settings.getAllSettings()
  const routed = resolveRoutedConfig(all.modelConnections, all.modelRoutes, 'auxiliary')
  const auxModel = routed?.model || await settings.getSetting('auxModel')
  const base = auxModel?.trim()
    ? { ...main, ...(routed?.baseUrl ? { baseUrl: routed.baseUrl } : {}), ...(routed?.apiKey ? { apiKey: routed.apiKey } : {}), model: auxModel.trim() }
    : main
  // 标题/画像等：按探测缓存或启发式关闭 thinking，避免 max_tokens 被 reasoning 吃光
  return withAuxThinking(base)
}

function parseJson<T>(raw: string): T | null {
  try { return JSON.parse(raw) as T } catch { return null }
}

function resolveRoutedConfig(connectionsRaw: string, routesRaw: string, purpose: ModelRoutePurpose): ModelConnectionProfile | null {
  const connections = parseJson<ModelConnectionProfile[]>(connectionsRaw)
  const routes = parseJson<ModelRouteProfile[]>(routesRaw)
  if (!Array.isArray(connections) || !Array.isArray(routes)) return null
  const route = routes.find((item) => {
    if (item.purpose !== purpose || !item.enabled || !item.model.trim()) return false
    const connection = connections.find((candidate) => candidate.id === item.connectionId && candidate.enabled && candidate.baseUrl.trim())
    return Boolean(connection)
  })
  if (!route) return null
  const connection = connections.find((item) => item.id === route.connectionId && item.enabled && item.baseUrl.trim())
  if (!connection) return null
  return { ...connection, model: route.model.trim() }
}

export const __test = { resolveRoutedConfig }
