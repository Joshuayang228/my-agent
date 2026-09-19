import type { LLMConfig } from '../../../src/shared/types'
import { appendApiPath } from './provider-router'
import { detectProviderFromBaseUrl } from '../../../src/shared/llm-connection-test'
import { createRestrictedFetch, isLoopbackUrl } from '../utils/restricted-fetch'

export const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_JSON_BYTES = 12 * 1024 * 1024
const GENERATION_TIMEOUT_MS = 180_000
export interface GeneratedImageBytes { bytes: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }

export class ImageGenerationError extends Error {
  constructor(message: string) { super(message); this.name = 'ImageGenerationError' }
}

function invalidResult(): never { throw new ImageGenerationError('生成服务没有返回有效图片，请检查模型是否支持生图。') }
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/**
 * 背景：生成服务可能把 HTML 或错误文本伪装成图片，不能仅相信响应 MIME。
 * 意图：传输层只接收有界的光栅格式，完整解码及像素限制由落盘层执行。
 * 约束：这里的签名检查不等于图片有效性验收；调用方不得直接将原始字节发布给 Renderer。
 */
export function inspectGeneratedImageBytes(bytes: Buffer): GeneratedImageBytes {
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) invalidResult()
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { bytes, mimeType: 'image/png' }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { bytes, mimeType: 'image/jpeg' }
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { bytes, mimeType: 'image/webp' }
  return invalidResult()
}

function decodeImage(value: unknown): GeneratedImageBytes {
  if (typeof value !== 'string' || value.length % 4 !== 0 || value.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) invalidResult()
  const bytes = Buffer.from(value, 'base64')
  if (bytes.toString('base64') !== value) invalidResult()
  return inspectGeneratedImageBytes(bytes)
}

/**
 * 背景：用户安排的生成模型不能走聊天补全，更不能在超时后重复计费。
 * 意图：独立适配 Images 与 Gemini 图片输出协议，一次调用只有一次生成请求；下载不携带服务凭据。
 * 约束：config 必须来自统一配置工厂；不回退主模型、不重试、不自动选择型号，取消覆盖下载阶段。
 */
export async function requestGeneratedImage(config: LLMConfig, prompt: string, signal?: AbortSignal): Promise<GeneratedImageBytes> {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 16_000) throw new ImageGenerationError('请提供不超过 16000 字的图片描述。')
  if (!config.baseUrl?.trim() || !config.model?.trim()) throw new ImageGenerationError('请先在模型设置中安排生图模型。')
  const provider = config.provider && config.provider !== 'auto' ? config.provider : detectProviderFromBaseUrl(config.baseUrl)
  if (provider !== 'openai' && provider !== 'gemini') throw new ImageGenerationError('当前连接协议不支持生图，请选择兼容 Images 或 Gemini 的连接。')
  const bounded = AbortSignal.any([AbortSignal.timeout(GENERATION_TIMEOUT_MS), ...(signal ? [signal] : [])])
  try {
    bounded.throwIfAborted()
    const base = new URL(config.baseUrl)
    if (base.search || base.hash || base.username || base.password) throw new ImageGenerationError('生成服务地址无效，请检查连接设置。')
    if (!config.apiKey?.trim() && !isLoopbackUrl(base)) throw new ImageGenerationError('请先为生图连接配置密钥。')
    const url = provider === 'gemini'
      ? appendApiPath(base.href, `v1beta/models/${encodeURIComponent(config.model)}:generateContent`)
      : appendApiPath(base.href, 'v1/images/generations')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
    if (config.apiKey) headers[provider === 'gemini' ? 'x-goog-api-key' : 'Authorization'] = provider === 'gemini' ? config.apiKey : `Bearer ${config.apiKey}`
    const body = provider === 'gemini'
      ? { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }
      : { model: config.model, prompt, n: 1 }
    const response = await createRestrictedFetch(base.href, bounded, { maxBytes: MAX_JSON_BYTES, timeoutMs: GENERATION_TIMEOUT_MS })(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new ImageGenerationError('生图服务拒绝认证，请检查密钥和模型权限。')
      if (response.status === 429) throw new ImageGenerationError('生图服务额度不足或请求过于频繁，请检查账户后重试。')
      throw new ImageGenerationError('生图请求失败，请检查服务状态；为避免重复计费，没有自动重试。')
    }
    const payload = record(await response.json())
    if (provider === 'gemini') {
      const candidates = payload.candidates
      if (!Array.isArray(candidates) || candidates.length !== 1) invalidResult()
      const parts = record(record(candidates[0]).content).parts
      if (!Array.isArray(parts)) invalidResult()
      const images = parts.map(part => record(part).inlineData).filter(value => value !== undefined)
      if (images.length !== 1) invalidResult()
      const image = record(images[0])
      const decoded = decodeImage(image.data)
      if (image.mimeType !== decoded.mimeType) invalidResult()
      return decoded
    }
    if (!Array.isArray(payload.data) || payload.data.length !== 1) invalidResult()
    const image = record(payload.data[0])
    if (image.b64_json !== undefined) return decodeImage(image.b64_json)
    if (typeof image.url !== 'string') invalidResult()
    // 外部响应里的下载地址不是用户配置：即使生成服务在本机，也不能授权响应任意读取回环资源。
    const download = await createRestrictedFetch(base.href, bounded, { maxBytes: MAX_GENERATED_IMAGE_BYTES, timeoutMs: 30_000, allowLocalOrigin: false })(image.url, { headers: { Accept: 'image/png,image/jpeg,image/webp' } })
    if (!download.ok) throw new ImageGenerationError('图片已生成，但下载失败。请检查服务中的生成记录，避免重复计费。')
    return inspectGeneratedImageBytes(Buffer.from(await download.arrayBuffer()))
  } catch (error) {
    if (signal?.aborted) throw new ImageGenerationError('已取消生图；服务端可能仍在处理，请勿重复提交。')
    if (bounded.aborted) throw new ImageGenerationError('生图等待超时，请检查服务端记录后再决定是否重试。')
    if (error instanceof ImageGenerationError) throw error
    throw new ImageGenerationError('无法完成生图请求，请检查服务地址、网络或返回格式；没有自动重试。')
  }
}
