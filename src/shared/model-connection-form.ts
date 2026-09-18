import { PROVIDER_PRESETS, type ProviderPreset } from './provider-presets'
import type { LLMProvider, ModelConnectionProfile, ModelConnectionSource } from './types'
import { allowsKeylessConnection } from './llm-connection-test'
export { sameConnectionEndpoint } from './llm-connection-test'

export function connectionCredentialLabel(connection: { baseUrl: string; provider?: LLMProvider; hasApiKey?: boolean }): string {
  return connection.hasApiKey ? '已配置' : allowsKeylessConnection(connection) ? '可留空' : '未配置'
}

export const CONNECTION_SOURCE_OPTIONS: ReadonlyArray<{ id: ModelConnectionSource; label: string }> = [
  { id: 'official', label: '官方服务商' },
  { id: 'coding', label: '编程套餐' },
  { id: 'relay', label: '聚合 / 中转' },
  { id: 'local', label: '本地模型' },
  { id: 'custom', label: '自定义连接' },
]
export const CONNECTION_ADAPTERS = [
  { id: 'openai-compatible', label: 'OpenAI Compatible', provider: 'openai' },
  { id: 'anthropic', label: 'Anthropic', provider: 'anthropic' },
  { id: 'google', label: 'Gemini', provider: 'gemini' },
] as const

export interface ModelConnectionDraft {
  name: string
  source: ModelConnectionSource
  presetId: string
  provider: LLMProvider
  baseUrl: string
  apiKey: string
}

/** 背景：预设分组与产品来源不同；意图：共享候选已确认映射；约束：不改预设端点，Ark 非套餐入口归聚合。 */
export function providerSource(provider: Pick<ProviderPreset, 'providerId'> & { group?: string }): ModelConnectionSource {
  if (provider.group === '编程套餐') return 'coding'
  if (provider.group === '聚合与代理' || provider.providerId === 'volces') return 'relay'
  if (provider.group === '本地 / 自定义') return 'local'
  return 'official'
}

export const CONNECTION_PRESETS = PROVIDER_PRESETS.filter((provider) => provider.providerId !== 'miyang')

export function connectionDraftForSource(source: ModelConnectionSource, presetId?: string): ModelConnectionDraft {
  const empty: ModelConnectionDraft = { name: '', source, presetId: '', provider: 'openai', baseUrl: '', apiKey: '' }
  if (source === 'custom') return empty
  const options = CONNECTION_PRESETS.filter((preset) => providerSource(preset) === source)
  const preset = options.find((item) => item.providerId === (presetId ?? (source === 'relay' ? 'openrouter' : ''))) ?? options[0]
  if (!preset) return empty
  return {
    ...empty, presetId: preset.providerId, provider: 'auto', baseUrl: preset.baseUrl,
    name: source === 'relay' ? `${preset.label} 聚合` : source === 'local' ? preset.label : `${preset.label} 连接`,
  }
}

export function modelConnectionDraft(connection: ModelConnectionProfile): ModelConnectionDraft {
  return { name: connection.name, source: connection.source ?? 'custom', presetId: connection.presetId ?? '',
    provider: connection.provider ?? 'auto', baseUrl: connection.baseUrl, apiKey: '' }
}

export function validConnectionDraft(draft: ModelConnectionDraft): boolean {
  if (!draft.name.trim()) return false
  try { if (!['http:', 'https:'].includes(new URL(draft.baseUrl.trim()).protocol)) return false } catch { return false }
  return draft.source === 'custom'
    ? CONNECTION_ADAPTERS.some((item) => item.provider === draft.provider)
    : CONNECTION_PRESETS.some((item) => item.providerId === draft.presetId && providerSource(item) === draft.source)
}
