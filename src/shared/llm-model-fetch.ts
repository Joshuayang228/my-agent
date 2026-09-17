import type { LLMModelFetchInput } from './types'

export const MODEL_FETCH_TIMEOUT_MS = 15_000

export type ValidatedLLMModelFetchInput = LLMModelFetchInput

export const MODEL_FETCH_MESSAGES = {
  missingKey: '请先填写 API Key',
  missingBaseUrl: '请先填写 Base URL',
  invalidBaseUrl: 'Base URL 格式不正确',
  unsupportedProtocol: 'Base URL 必须以 http:// 或 https:// 开头',
  unsupported: '这个连接暂不提供模型列表；请手动添加模型 ID。',
  auth: 'API Key 无效或没有权限',
  notFound: '这个地址不提供模型列表；请手动添加模型 ID。',
  timeout: '获取模型超时，请稍后重试；仍可手动添加模型 ID。',
  network: '无法连接模型服务，请检查网络和 Base URL；仍可手动添加模型 ID。',
  invalidResponse: '模型列表格式无法识别；请手动添加模型 ID。',
} as const

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '')
}

/**
 * 校验一次性模型发现请求。
 *
 * 背景：正式设置需要从连接端点读取模型清单，但不能让 Renderer 直连供应商或读回已存密钥。
 * 设计意图：把 URL、凭据来源和适配器字段放进共享纯函数；主进程只负责安全取钥和发请求。
 * 关键约束：没有草稿 Key 且未声明使用已存 Key 时不得发起请求；返回值不包含凭据加工。
 */
export function validateLLMModelFetchInput(input: unknown):
  | { ok: true; value: ValidatedLLMModelFetchInput }
  | { ok: false; error: string; reason: 'missing-key' | 'network' } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: '模型获取参数无效', reason: 'network' }
  }
  const raw = input as Partial<LLMModelFetchInput>
  const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : ''
  const useStoredApiKey = raw.useStoredApiKey === true
  const connectionId = typeof raw.connectionId === 'string' ? raw.connectionId.trim() : ''
  const baseUrl = typeof raw.baseUrl === 'string' ? normalizeBaseUrl(raw.baseUrl) : ''
  const provider = raw.provider === 'openai' || raw.provider === 'anthropic' || raw.provider === 'gemini' || raw.provider === 'auto'
    ? raw.provider
    : undefined

  if (!apiKey && !useStoredApiKey) return { ok: false, error: MODEL_FETCH_MESSAGES.missingKey, reason: 'missing-key' }
  if (!baseUrl) return { ok: false, error: MODEL_FETCH_MESSAGES.missingBaseUrl, reason: 'network' }

  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: MODEL_FETCH_MESSAGES.unsupportedProtocol, reason: 'network' }
    }
  } catch {
    return { ok: false, error: MODEL_FETCH_MESSAGES.invalidBaseUrl, reason: 'network' }
  }

  return {
    ok: true,
    value: {
      apiKey: apiKey || undefined,
      ...(useStoredApiKey ? { useStoredApiKey: true } : {}),
      ...(connectionId ? { connectionId } : {}),
      ...(provider ? { provider } : {}),
      baseUrl,
    },
  }
}

export function parseRemoteModelList(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const raw = payload as Record<string, unknown>
  const source = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.models) ? raw.models : []
  const seen = new Set<string>()
  const models: string[] = []
  for (const item of source) {
    const id = typeof item === 'string'
      ? item.trim()
      : item && typeof item === 'object'
        ? String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).model ?? '').trim()
        : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push(id)
  }
  return models
}

export function connectionModelIds(connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> }): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  }
  if (Array.isArray(connection.models)) {
    for (const item of connection.models) push(item?.id)
  }
  push(connection.model)
  return ids
}

export function normalizeConnectionModels(
  connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> },
): Array<{ id: string; enabled: boolean }> {
  const enabledById = new Map<string, boolean>()
  if (Array.isArray(connection.models)) {
    for (const item of connection.models) {
      const id = typeof item?.id === 'string' ? item.id.trim() : ''
      if (!id) continue
      enabledById.set(id, item.enabled !== false)
    }
  }
  const model = typeof connection.model === 'string' ? connection.model.trim() : ''
  if (model && !enabledById.has(model)) enabledById.set(model, true)
  return Array.from(enabledById.entries()).map(([id, enabled]) => ({ id, enabled }))
}

export function addConnectionModel(
  connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> },
  modelId: string,
): { model: string; models: Array<{ id: string; enabled: boolean }> } {
  const id = modelId.trim()
  const models = normalizeConnectionModels(connection)
  if (id && !models.some((item) => item.id === id)) models.push({ id, enabled: true })
  return { model: models[0]?.id ?? '', models }
}

export function removeConnectionModel(
  connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> },
  modelId: string,
): { model: string; models: Array<{ id: string; enabled: boolean }> } {
  const models = normalizeConnectionModels(connection).filter((item) => item.id !== modelId)
  return { model: models[0]?.id ?? '', models }
}

export function setConnectionModelEnabled(
  connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> },
  modelId: string,
  enabled: boolean,
): { model: string; models: Array<{ id: string; enabled: boolean }> } {
  const models = normalizeConnectionModels(connection).map((item) => item.id === modelId ? { ...item, enabled } : item)
  const firstEnabled = models.find((item) => item.enabled)?.id ?? models[0]?.id ?? ''
  return { model: firstEnabled, models }
}

export function enabledConnectionModelIds(connection: { model?: string; models?: Array<{ id?: string; enabled?: boolean }> }): string[] {
  const models = normalizeConnectionModels(connection)
  return models.filter((item) => item.enabled).map((item) => item.id)
}
