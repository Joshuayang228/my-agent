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

import type { LLMConfig } from '../../../src/shared/types'
import * as settings from '../storage/settings-store'
import { withAuxThinking } from './thinking'

export async function loadMainLLMConfig(overrides?: Partial<LLMConfig>): Promise<LLMConfig> {
  const s = await settings.getAllSettings()
  return {
    apiKey: s.llmApiKey || process.env.LLM_API_KEY || '',
    baseUrl: s.llmBaseUrl || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: s.llmModel || process.env.LLM_MODEL || 'gpt-4o',
    temperature: parseFloat(s.llmTemperature) || undefined,
    topP: parseFloat(s.llmTopP) || undefined,
    maxTokens: parseInt(s.llmMaxTokens) || undefined,
    ...overrides,
  }
}

export async function loadAuxLLMConfig(): Promise<LLMConfig> {
  const main = await loadMainLLMConfig()
  const auxModel = await settings.getSetting('auxModel')
  const base = auxModel?.trim()
    ? { ...main, model: auxModel.trim() }
    : main
  // 标题/画像等：按探测缓存或启发式关闭 thinking，避免 max_tokens 被 reasoning 吃光
  return withAuxThinking(base)
}
