import type { LLMConnectionTestInput, LLMProvider } from './types'

export const PROVIDER_DETECTION_RULES: ReadonlyArray<{ pattern: RegExp; provider: LLMProvider }> = [
  // Anthropic 协议也可能由中转服务的路径指定，不能只检查域名。
  { pattern: /anthropic\.com|claude\.ai|\/anthropic(?:\/|$)/, provider: 'anthropic' },
  { pattern: /googleapis\.com|generativelanguage/, provider: 'gemini' },
  { pattern: /openai\.com|deepseek\.com|api\.openai|together\.xyz|groq\.com|openrouter\.ai/, provider: 'openai' },
]

export function detectProviderFromBaseUrl(baseUrl: string): Exclude<LLMProvider, 'auto'> {
  for (const { pattern, provider } of PROVIDER_DETECTION_RULES) {
    if (pattern.test(baseUrl)) return provider as Exclude<LLMProvider, 'auto'>
  }
  return 'openai'
}

type ConnectionIdentity = { baseUrl?: string; provider?: LLMProvider }

/**
 * 背景：本机兼容服务可不设密钥，不能把无 Key 等同于未配置。
 * 意图：按真实 URL 与同源协议规则判断，不信来源标签，也不借用其他连接凭据。
 * 约束：只放行 HTTP(S) 回环 OpenAI 兼容端点；userinfo、域名后缀与局域网不获豁免。
 */
export function allowsKeylessConnection(config: ConnectionIdentity): boolean {
  if (!config.baseUrl) return false
  try {
    const url = new URL(config.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    const local = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    const provider = config.provider && config.provider !== 'auto' ? config.provider : detectProviderFromBaseUrl(config.baseUrl)
    return local && provider === 'openai'
  } catch { return false }
}

/** 背景：首选未配 Key 也可能有可用备用；意图：就绪检查整条链；约束：发请求前须去掉备用列表，重新校验当前目标。 */
export function hasLLMAuthentication(config?: ConnectionIdentity & { apiKey?: string; fallbackModels?: Array<ConnectionIdentity & { apiKey?: string }> }): boolean {
  if (!config) return false
  const authenticated = (target: ConnectionIdentity & { apiKey?: string }) => Boolean(target.apiKey?.trim() || allowsKeylessConnection(target))
  return authenticated(config) || Boolean(config.fallbackModels?.some(target => authenticated({
    baseUrl: target.baseUrl ?? config.baseUrl,
    provider: target.provider ?? config.provider,
    apiKey: target.apiKey ?? config.apiKey,
  })))
}

export const CONNECTION_TEST_MESSAGES = [
  { role: 'system' as const, content: '你正在进行模型连接测试。请只回复“连接成功”，不要调用工具。' },
  { role: 'user' as const, content: '请回复：连接成功' },
]

export type ValidatedLLMConnectionTestInput = LLMConnectionTestInput

/** 背景：编辑可更换供应商；意图：旧凭据仅在同端点同协议留用；约束：不按连接 id 单独授权，不忽略路径与大小写差异。 */
export function sameConnectionEndpoint(a: { baseUrl?: unknown; provider?: unknown }, b: { baseUrl?: unknown; provider?: unknown }): boolean {
  return typeof a.baseUrl === 'string' && typeof b.baseUrl === 'string'
    && a.baseUrl.trim().replace(/\/$/, '') === b.baseUrl.trim().replace(/\/$/, '')
    && (a.provider || 'auto') === (b.provider || 'auto')
}

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
  const connectionId = typeof raw.connectionId === 'string' ? raw.connectionId.trim() : ''
  const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl.trim().replace(/\/$/, '') : ''
  const model = typeof raw.model === 'string' ? raw.model.trim() : ''
  if (raw.provider !== undefined && !['openai', 'anthropic', 'gemini', 'auto'].includes(raw.provider)) {
    return { ok: false, error: '请选择有效的连接适配器' }
  }

  if (!apiKey && !useStoredApiKey && !allowsKeylessConnection({ baseUrl, provider: raw.provider })) return { ok: false, error: '请先填写 API Key' }
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

  return {
    ok: true,
    value: {
      apiKey: apiKey || undefined,
      ...(useStoredApiKey ? { useStoredApiKey: true } : {}),
      ...(connectionId ? { connectionId } : {}),
      baseUrl,
      model,
      ...(raw.provider ? { provider: raw.provider } : {}),
    },
  }
}
