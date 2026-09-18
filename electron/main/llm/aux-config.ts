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

import type { LLMConfig, ModelConnectionProfile, ModelRoutePurpose } from '../../../src/shared/types'
import { resolveRoutedConfigs } from '../../../src/shared/model-routing'
import { readModelParameter } from '../../../src/shared/model-parameters'
import * as settings from '../storage/settings-store'
import { withAuxThinking } from './thinking'

export async function loadMainLLMConfig(overrides?: Partial<LLMConfig>): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  const chain = resolveRoutedConfigs(s.modelConnections, s.modelRoutes, 'primary')
  const routed = chain[0]
  return {
    // 背景：清空连接必须真正停止旧配置生效；意图：只读取用途路由；约束：空态不借用全局或环境身份，显式测试覆盖仍由调用方传入。
    apiKey: routed?.apiKey || '',
    baseUrl: routed?.baseUrl || '',
    model: routed?.model || '',
    provider: routed?.provider || 'auto',
    temperature: readModelParameter('llmTemperature', s.llmTemperature),
    topP: parseFloat(s.llmTopP) || undefined,
    maxTokens: parseInt(s.llmMaxTokens) || undefined,
    fallbackModels: chain.length > 1 ? chain.slice(1).map(connectionConfig) : undefined,
    ...overrides,
    ...(overrides?.baseUrl !== undefined ? {
      apiKey: overrides.apiKey || '',
      provider: overrides.provider || 'auto',
    } : {}),
    ...(overrides && ['baseUrl', 'apiKey', 'provider', 'model'].some(key => key in overrides)
      ? { fallbackModels: overrides.fallbackModels } : {}),
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
  const chain = resolveRoutedConfigs(all.modelConnections, all.modelRoutes, 'image')
  const routed = chain[0]
  if (!routed) return main
  return { ...main, ...connectionConfig(routed), fallbackModels: chain.length > 1 ? chain.slice(1).map(connectionConfig) : undefined }
}
export async function loadAuxLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  const all = await settings.getAllSettings()
  const chain = resolveRoutedConfigs(all.modelConnections, all.modelRoutes, 'auxiliary')
  const routed = chain[0]
  const base = routed
    ? { ...main, ...connectionConfig(routed), fallbackModels: chain.length > 1 ? chain.slice(1).map(connectionConfig) : undefined }
    : main
  // 标题/画像等：按探测缓存或启发式关闭 thinking，避免 max_tokens 被 reasoning 吃光
  const configured = await withAuxThinking(base)
  if (!base.fallbackModels?.length) return configured
  // 背景：备用端点可能不支持首模型的 thinking 策略；意图：逐目标装配；约束：显式清空首模型的策略与资产证据。
  configured.fallbackModels = await Promise.all(base.fallbackModels.map(async target => {
    const result = await withAuxThinking({ ...base, ...target, fallbackModels: undefined })
    return { ...target, thinking: result.thinking, runtimeAssetKeys: result.runtimeAssetKeys }
  }))
  return configured
}

/**
 * 背景：辅助 / 图片用途可能选择与主模型不同的连接。
 * 设计意图：整体替换连接身份，不按字段借用主连接凭据或协议。
 * 关键约束：空密钥保持为空；未指定协议时按目标地址检测，不能继承主连接的显式协议。
 */
function connectionConfig(connection: ModelConnectionProfile): Pick<LLMConfig, 'apiKey' | 'baseUrl' | 'model' | 'provider'> {
  return { apiKey: connection.apiKey || '', baseUrl: connection.baseUrl, model: connection.model, provider: connection.provider || 'auto' }
}

function resolveRoutedConfig(connectionsRaw: string, routesRaw: string, purpose: ModelRoutePurpose): ModelConnectionProfile | null {
  return resolveRoutedConfigs(connectionsRaw, routesRaw, purpose)[0] ?? null
}

export const __test = { resolveRoutedConfig }
