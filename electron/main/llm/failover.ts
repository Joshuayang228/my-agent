/**
 * LLM 顺序 Failover 的纯配置事实。
 *
 * 背景：主模型失败后需要按用户声明顺序尝试备用模型，同时避免 fallbackModels 递归嵌套。
 * 设计意图：运行时和 Debug 资产目录共同引用字段继承规则。
 * 关键约束：函数可能携带 API Key，只能用于运行装配；静态目录仅展示字段名，不展示值。
 */

import type { FallbackModelConfig, LLMConfig } from '../../../src/shared/types'

export const SEQUENTIAL_FAILOVER_POLICY = {
  mode: 'sequential',
  primaryFirst: true,
  overrideFields: ['model', 'baseUrl', 'apiKey', 'provider'],
  inheritedFields: ['temperature', 'topP', 'maxTokens', 'thinking'],
  recursiveFallbackDisabled: true,
} as const

export function buildFallbackConfig(
  primary: LLMConfig,
  fallback: FallbackModelConfig,
): LLMConfig {
  return {
    ...primary,
    model: fallback.model,
    baseUrl: fallback.baseUrl ?? primary.baseUrl,
    apiKey: fallback.apiKey ?? primary.apiKey,
    provider: fallback.provider ?? primary.provider,
    fallbackModels: undefined,
  }
}
