import { readRegisteredImageRequest, type RegisteredImageRequest } from '../prompts/registered-request'
import type { LLMConfig } from '../../../src/shared/types'
import { appendApiPath } from './provider-router'
import { detectProviderFromBaseUrl } from '../../../src/shared/llm-connection-test'
import { createRestrictedFetch, isLoopbackUrl } from '../utils/restricted-fetch'

export const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_JSON_BYTES = 12 * 1024 * 1024
const GENERATION_TIMEOUT_MS = 180_000
export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '16:9' | '9:16'
export interface GeneratedImageBytes { bytes: Buffer; mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }
export interface ImageGenerationOptions {
  /** 可选参考垫图（最多 3 张，单张不超过 4MB）；Gemini 附带 inlineData，OpenAI 走 /images/edits 多图垫图并在不支持时自动降级纯文生图。 */
  referenceImages?: ReadonlyArray<GeneratedImageBytes>
  /** 可选画幅比例；传值时适配 Gemini imageConfig.aspectRatio 与 OpenAI size。 */
  aspectRatio?: ImageAspectRatio
}

/**
 * 进程级 OpenAI `/images/edits` 能力熔断缓存。
 *
 * 背景：部分 OpenAI 兼容中转站或旧模型只提供 `/images/generations` 而不支持 `/images/edits` 垫图。
 * 设计意图：首次探测到明确的不支持状态（404/405/501 或 unsupported 文案）时记录 `${origin}|${model}` 并平滑降级纯文生图，
 * 避免同进程后续每次生图重复试错；不影响 401/403/429/5xx 错误上抛，避免重复计费。
 * 关键约束：仅缓存明确不支持垫图的端点，不缓存瞬态网络或限流故障。
 */
const unsupportedOpenAIEditEndpoints = new Set<string>()

export function resetImageEditCapabilityCache(): void {
  unsupportedOpenAIEditEndpoints.clear()
}

function buildOpenAIEditMultipart(
  model: string,
  prompt: string,
  refs: ReadonlyArray<GeneratedImageBytes>,
  fieldName: 'image' | 'image[]',
  size?: string,
): { contentType: string; body: Buffer } {
  const boundary = `----MyAgentImgEdit${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  const chunks: Buffer[] = []
  const pushField = (name: string, value: string): void => {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`, 'utf8'))
  }
  pushField('model', model)
  pushField('prompt', prompt)
  pushField('n', '1')
  if (size) pushField('size', size)
  refs.forEach((img, index) => {
    const ext = img.mimeType === 'image/jpeg' ? 'jpg' : img.mimeType === 'image/webp' ? 'webp' : 'png'
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="ref${index + 1}.${ext}"\r\nContent-Type: ${img.mimeType}\r\n\r\n`,
      'utf8',
    ))
    chunks.push(img.bytes)
    chunks.push(Buffer.from('\r\n', 'utf8'))
  })
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'))
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(chunks),
  }
}

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
export async function requestGeneratedImage(config: LLMConfig, request: RegisteredImageRequest, signal?: AbortSignal, opts?: ImageGenerationOptions): Promise<GeneratedImageBytes> {
  let prompt: string
  try { prompt = readRegisteredImageRequest(request).prompt }
  catch { throw new ImageGenerationError('生图请求必须由已登记的图片配方生成。') }
  if (!config.baseUrl?.trim() || !config.model?.trim()) throw new ImageGenerationError('请先在模型设置中安排生图模型。')
  const provider = config.provider && config.provider !== 'auto' ? config.provider : detectProviderFromBaseUrl(config.baseUrl)
  if (provider !== 'openai' && provider !== 'gemini') throw new ImageGenerationError('当前连接协议不支持生图，请选择兼容 Images 或 Gemini 的连接。')
  const bounded = AbortSignal.any([AbortSignal.timeout(GENERATION_TIMEOUT_MS), ...(signal ? [signal] : [])])
  try {
    bounded.throwIfAborted()
    const base = new URL(config.baseUrl)
    if (base.search || base.hash || base.username || base.password) throw new ImageGenerationError('生成服务地址无效，请检查连接设置。')
    if (!config.apiKey?.trim() && !isLoopbackUrl(base)) throw new ImageGenerationError('请先为生图连接配置密钥。')
    const validRefs = Array.isArray(opts?.referenceImages)
      ? opts.referenceImages
        .filter((img) => Buffer.isBuffer(img.bytes) && img.bytes.length > 0 && img.bytes.length <= 4 * 1024 * 1024)
        .slice(0, 3)
      : []
    const openaiSize = opts?.aspectRatio === '16:9' || opts?.aspectRatio === '4:3'
      ? '1536x1024'
      : opts?.aspectRatio === '3:4' || opts?.aspectRatio === '9:16'
        ? '1024x1536'
        : opts?.aspectRatio === '1:1'
          ? '1024x1024'
          : undefined
    const restrictedFetch = createRestrictedFetch(base.href, bounded, { maxBytes: MAX_JSON_BYTES, timeoutMs: GENERATION_TIMEOUT_MS })
    let response: Response

    if (provider === 'gemini') {
      const url = appendApiPath(base.href, `v1beta/models/${encodeURIComponent(config.model)}:generateContent`)
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
      if (config.apiKey) headers['x-goog-api-key'] = config.apiKey
      const refParts = validRefs.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.bytes.toString('base64') } }))
      const body = {
        contents: [{ role: 'user', parts: [...refParts, { text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          ...(opts?.aspectRatio ? { imageConfig: { aspectRatio: opts.aspectRatio } } : {}),
        },
      }
      response = await restrictedFetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    } else {
      const editCacheKey = `${base.origin}|${config.model}`
      const shouldTryEdit = validRefs.length > 0 && !unsupportedOpenAIEditEndpoints.has(editCacheKey)
      const jsonHeaders: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
      const authHeaders: Record<string, string> = { Accept: 'application/json' }
      if (config.apiKey) {
        jsonHeaders.Authorization = `Bearer ${config.apiKey}`
        authHeaders.Authorization = `Bearer ${config.apiKey}`
      }
      const generationsUrl = appendApiPath(base.href, 'v1/images/generations')
      const generationsBody = JSON.stringify({ model: config.model, prompt, n: 1, ...(openaiSize ? { size: openaiSize } : {}) })

      if (shouldTryEdit) {
        const editsUrl = appendApiPath(base.href, 'v1/images/edits')
        const firstPayload = buildOpenAIEditMultipart(config.model, prompt, validRefs, 'image', openaiSize)
        response = await restrictedFetch(editsUrl, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': firstPayload.contentType },
          body: firstPayload.body as unknown as BodyInit,
        })
        if (!response.ok && (response.status === 400 || response.status === 422)) {
          const firstErrText = await response.text().catch(() => '')
          if (/not.?support|unsupport|unknown.?endpoint/i.test(firstErrText)) {
            unsupportedOpenAIEditEndpoints.add(editCacheKey)
            response = await restrictedFetch(generationsUrl, { method: 'POST', headers: jsonHeaders, body: generationsBody })
          } else {
            // 兼容要求 multipart 数组字段名 image[] 的 OpenAI / 中转站实现
            const retryPayload = buildOpenAIEditMultipart(config.model, prompt, validRefs, 'image[]', openaiSize)
            response = await restrictedFetch(editsUrl, {
              method: 'POST',
              headers: { ...authHeaders, 'Content-Type': retryPayload.contentType },
              body: retryPayload.body as unknown as BodyInit,
            })
            if (!response.ok && (response.status === 404 || response.status === 405 || response.status === 501)) {
              unsupportedOpenAIEditEndpoints.add(editCacheKey)
              response = await restrictedFetch(generationsUrl, { method: 'POST', headers: jsonHeaders, body: generationsBody })
            }
          }
        } else if (!response.ok && (response.status === 404 || response.status === 405 || response.status === 501)) {
          unsupportedOpenAIEditEndpoints.add(editCacheKey)
          response = await restrictedFetch(generationsUrl, { method: 'POST', headers: jsonHeaders, body: generationsBody })
        }
      } else {
        response = await restrictedFetch(generationsUrl, { method: 'POST', headers: jsonHeaders, body: generationsBody })
      }
    }
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
