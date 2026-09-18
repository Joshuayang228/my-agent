import { appendApiPath, detectProvider } from './provider-router'
import { hasLLMAuthentication } from '../../../src/shared/llm-connection-test'
import { MODEL_FETCH_MESSAGES, MODEL_FETCH_TIMEOUT_MS, parseRemoteModelList } from '../../../src/shared/llm-model-fetch'
import type { LLMConfig, LLMModelFetchReason, LLMModelFetchResult } from '../../../src/shared/types'

function classifyHttpStatus(status: number): { error: string; reason: LLMModelFetchReason; retryable: boolean } {
  if (status === 401 || status === 403) return { error: MODEL_FETCH_MESSAGES.auth, reason: 'auth', retryable: true }
  if (status === 404 || status === 405) return { error: MODEL_FETCH_MESSAGES.notFound, reason: 'not-found', retryable: false }
  if (status === 408 || status === 429 || status >= 500) return { error: MODEL_FETCH_MESSAGES.network, reason: 'network', retryable: true }
  return { error: MODEL_FETCH_MESSAGES.network, reason: 'network', retryable: true }
}

function classifyFetchError(error: unknown): { error: string; reason: LLMModelFetchReason; retryable: boolean } {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|aborted/i.test(message)) {
    return { error: MODEL_FETCH_MESSAGES.timeout, reason: 'timeout', retryable: true }
  }
  return { error: MODEL_FETCH_MESSAGES.network, reason: 'network', retryable: true }
}

function buildModelListRequest(config: LLMConfig): { url: string; headers: Record<string, string> } | { unsupported: true } {
  const provider = detectProvider(config)
  if (provider === 'gemini') return { unsupported: true }
  if (provider === 'anthropic') {
    return {
      url: appendApiPath(config.baseUrl, 'v1/models'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
    }
  }
  return {
    url: appendApiPath(config.baseUrl, 'v1/models'),
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey.trim() ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
  }
}

/**
 * 按适配器读取连接下的模型清单。
 *
 * 背景：正式设置需要“获取已有模型”，但不能让 Renderer 直连供应商或读回已存密钥。
 * 设计意图：复用现有 Provider 检测和路径拼接；OpenAI Compatible / Anthropic 走 /v1/models，Gemini 明确不支持。
 * 关键约束：远程无 API Key 不发请求，本机兼容服务不发送空认证头；错误不回传凭据或正文。
 */
export async function fetchRemoteModels(
  config: LLMConfig,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<LLMModelFetchResult> {
  if (!hasLLMAuthentication(config)) {
    return { ok: false, error: MODEL_FETCH_MESSAGES.missingKey, reason: 'missing-key', retryable: false }
  }
  const request = buildModelListRequest(config)
  if ('unsupported' in request) {
    return { ok: false, error: MODEL_FETCH_MESSAGES.unsupported, reason: 'unsupported', retryable: false }
  }

  const timeoutMs = options?.timeoutMs ?? MODEL_FETCH_TIMEOUT_MS
  const fetchImpl = options?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(request.url, {
      method: 'GET',
      headers: request.headers,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      const classified = classifyHttpStatus(response.status)
      return { ok: false, ...classified }
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      return { ok: false, error: MODEL_FETCH_MESSAGES.invalidResponse, reason: 'invalid-response', retryable: false }
    }
    if (payload && typeof payload === 'object' && !Array.isArray((payload as Record<string, unknown>).data) && !Array.isArray((payload as Record<string, unknown>).models)) {
      return { ok: false, error: MODEL_FETCH_MESSAGES.invalidResponse, reason: 'invalid-response', retryable: false }
    }
    return { ok: true, models: parseRemoteModelList(payload) }
  } catch (error) {
    return { ok: false, ...classifyFetchError(error) }
  }
}

export const __test = { buildModelListRequest, classifyHttpStatus, classifyFetchError }
