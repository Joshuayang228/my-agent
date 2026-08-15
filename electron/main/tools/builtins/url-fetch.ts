import { buildTool } from '../builder'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createLogger, hashForLog } from '../../utils/logger'

const log = createLogger('UrlFetch')

const MAX_CONTENT_LENGTH = 50_000
const MAX_RESPONSE_BYTES = 256 * 1024
const TIMEOUT_MS = 15_000

export const urlFetchTool = buildTool({
  name: 'url_fetch',
  description:
    "获取网页 URL 的内容并以纯文本返回，适合阅读文章、文档或其他网页内容；返回前会去除 HTML 标签。",
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: "要获取的 URL，必须以 http:// 或 https:// 开头。",
      },
    },
    required: ['url'],
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args) => {
    const url = args.url as string
    if (!url?.trim()) return '错误：必须提供 URL'

    const validation = await validateFetchUrl(url)
    if (!validation.ok) return `错误：${validation.reason}`

    log.info('Fetching URL', { urlHash: hashForLog(url) })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const resp = await fetch(validation.url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyAgent/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json,*/*',
        },
      })

      if (resp.status >= 300 && resp.status < 400) {
        return '错误：为避免跳转到本地或内网地址，不跟随 URL 重定向'
      }
      if (!resp.ok) {
        return `错误：HTTP ${resp.status} ${resp.statusText}`
      }

      const contentLength = Number(resp.headers.get('content-length') || 0)
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        return `错误：响应过大（>${MAX_RESPONSE_BYTES} 字节）`
      }

      const body = await readResponseBody(resp, MAX_RESPONSE_BYTES)
      if (body.truncated) return `错误：响应过大（>${MAX_RESPONSE_BYTES} 字节）`

      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        return body.text.length > MAX_CONTENT_LENGTH
          ? body.text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... 已截断]'
          : body.text
      }

      const text = stripHtml(body.text)
      return text.length > MAX_CONTENT_LENGTH
        ? text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... 已截断]'
        : text || '（页面为空）'
    } catch (err) {
      log.error('Fetch failed', {
        urlHash: hashForLog(url),
        errorType: err instanceof Error ? err.name : 'unknown',
      })
      return '获取 URL 失败，请检查地址或网络连接'
    } finally {
      clearTimeout(timeout)
    }
  },
})

function stripHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')

  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n')
  return text.trim()
}


/**
 * URL 抓取的网络边界：禁止凭据 URL、环回/内网/链路本地地址以及自动重定向。
 *
 * 背景：该工具由 Agent 调用，远端网页内容可能诱导模型访问本机管理面板或云元数据服务。
 * 设计意图：在真正 fetch 前校验 URL，并解析域名的当前地址；不把“用户输入了 URL”当作
 * 足够授权。重定向由调用方显式拒绝，避免公共地址跳入内网。
 * 关键约束：这是应用层 SSRF 防线，不替代系统防火墙；DNS 在请求和连接之间仍可能变化，
 * 因此不允许把此工具用于访问受保护内网服务。
 */
export async function validateFetchUrl(raw: string): Promise<
  | { ok: true; url: string }
  | { ok: false; reason: string }
> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'URL 格式无效' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'URL 必须以 http:// 或 https:// 开头' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: '不允许携带 URL 用户名或密码' }
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: '出于安全原因，不允许访问本机或内网地址' }
  }

  if (!isIP(hostname)) {
    try {
      const addresses = await lookup(hostname, { all: true, verbatim: true })
      if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
        return { ok: false, reason: '出于安全原因，不允许访问解析到本机或内网的地址' }
      }
    } catch {
      return { ok: false, reason: '无法解析目标域名' }
    }
  }

  return { ok: true, url: parsed.toString() }
}

export function isBlockedAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase()
  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map(Number)
    const [a, b] = octets
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 192 && b === 168
      || a === 172 && b >= 16 && b <= 31 || a === 100 && b >= 64 && b <= 127
  }
  if (isIP(normalized) === 6) {
    if (normalized === '::1' || normalized === '::') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return true
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7)
      if (mapped.includes('.')) return isBlockedAddress(mapped)
      const groups = mapped.split(':')
      if (groups.length === 2 && groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
        const high = parseInt(groups[0], 16)
        const low = parseInt(groups[1], 16)
        const ipv4 = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
        return isBlockedAddress(ipv4)
      }
    }
  }
  return false
}

function isBlockedHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === 'local'
    || hostname.endsWith('.local')
    || hostname === 'metadata.google.internal'
    || hostname === 'metadata'
    || hostname === 'instance-data.ec2.internal'
    || isBlockedAddress(hostname)
}

async function readResponseBody(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    const text = await response.text()
    return { text: text.slice(0, maxBytes), truncated: new TextEncoder().encode(text).byteLength > maxBytes }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return { text, truncated: true }
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return { text, truncated: false }
  } finally {
    reader.releaseLock()
  }
}
