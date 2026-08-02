/**
 * 辅助模型配置（标题 / 反思 / 日剧本等轻量任务）
 *
 * 背景：多处各自拼 settings，易漂移。
 * 意图：统一读主配置 + 可选 auxModel。
 * 约束：无 apiKey 时调用方应回退本地逻辑，不抛。
 */

import type { LLMConfig } from '../../../src/shared/types'
import * as settings from '../storage/settings-store'

export async function loadMainLLMConfig(): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
    temperature: parseFloat(s.llmTemperature) || undefined,
    topP: parseFloat(s.llmTopP) || undefined,
    maxTokens: parseInt(s.llmMaxTokens) || undefined,
  }
}

export async function loadAuxLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  const auxModel = await settings.getSetting('auxModel')
  if (auxModel?.trim()) {
    return { ...main, model: auxModel.trim() }
  }
  return main
}
