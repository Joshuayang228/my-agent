import type { LLMConnectionTestInput } from './types'

export const CONNECTION_TEST_MESSAGES = [
  { role: 'system' as const, content: '你正在进行模型连接测试。请只回复“连接成功”，不要调用工具。' },
  { role: 'user' as const, content: '请回复：连接成功' },
]

export type ValidatedLLMConnectionTestInput = LLMConnectionTestInput

/**
 * 校验一次性模型连接测试的输入。
 *
 * 背景：设置页需要在不保存表单的情况下测试当前 Provider 配置。
 * 设计意图：把字段校验放在共享纯函数中，主进程只负责调用模型，避免 IPC 处理器承担隐式格式规则。
 * 关键约束：只接受 http/https；返回值不包含任何凭据加工或日志信息。
 */
export function validateLLMConnectionTestInput(input: unknown):
  | { ok: true; value: ValidatedLLMConnectionTestInput }
  | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: '连接测试参数无效' }
  const raw = input as Partial<LLMConnectionTestInput>
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : ''
  const useStoredApiKey = raw.useStoredApiKey === true
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl.trim().replace(/\/$/, '') : ''
  const model = typeof raw.model === 'string' ? raw.model.trim() : ''

  if (!apiKey && !useStoredApiKey) return { ok: false, error: '请先填写 API Key' }
  if (!baseUrl) return { ok: false, error: '请先填写 Base URL' }
  if (!model) return { ok: false, error: '请先填写模型名' }

  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Base URL 必须以 http:// 或 https:// 开头' }
    }
  } catch {
    return { ok: false, error: 'Base URL 格式不正确' }
  }

  return { ok: true, value: { apiKey: apiKey || undefined, ...(useStoredApiKey ? { useStoredApiKey: true } : {}), baseUrl, model } }
}
