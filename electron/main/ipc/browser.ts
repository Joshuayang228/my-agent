import { registerSecureIpcHandler } from './ipc-security'
/**
 * 工作区安全网页查看器 IPC。
 *
 * 背景：正式右坞需要读取用户明确输入的网页，但 Renderer 不能直接访问外站，
 *       也不能让外站内容继承 Electron 能力。
 * 设计意图：主进程复用 URL 抓取的 DNS / 内网校验，手动拒绝重定向，只返回受大小限制的
 *       文档文本；Renderer 再放入无权限 sandbox 和 CSP 文档中。放弃直接 loadURL，避免
 *       外站页面接触应用桥接层。
 * 关键约束：只允许 HTTP(S)、不允许账号密码和内网地址、不跟随重定向；响应超过上限直接失败。
 *       Renderer 只将结果放入无权限 sandbox，不能把该查看器当作完整浏览器或登录容器。
 */

import { validateFetchUrl } from '../tools/builtins/url-fetch'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('BrowserIPC')
const MAX_URL_LENGTH = 4_096
const MAX_RESPONSE_BYTES = 512 * 1024
const TIMEOUT_MS = 15_000
const MAX_REQUEST_ID_LENGTH = 200
const MAX_REDIRECTS = 3
const activeRequests = new Map<string, AbortController>()

function requestKey(senderId: number, requestId: string): string {
  return `${senderId}:${requestId}`
}

async function readBody(response: Response): Promise<string | null> {
  if (!response.body) {
    const text = await response.text()
    return new TextEncoder().encode(text).byteLength <= MAX_RESPONSE_BYTES ? text : null
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let total = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

/**
 * 将地址栏中的常见裸域名补成 HTTPS 地址。
 *
 * 背景：用户通常输入 `baidu.com` 或 `www.example.com`，而 `URL` 构造器只接受带协议的绝对 URL，
 *       直接传入会在真正发起网络请求前返回“URL 格式无效”。
 * 设计意图：仅对没有协议分隔符且不含空白的裸域名补 `https://`；带协议的输入仍完整交给统一 SSRF 校验，
 *       不接受 `javascript:`、`file:` 等伪装协议。
 * 关键约束：不改写带协议的用户输入，不放宽 `validateFetchUrl` 的协议、凭据、内网和 DNS 检查。
 */
export function normalizeBrowserUrl(raw: string): string {
  const value = raw.trim()
  if (!value || /\s/.test(value) || value.includes('://')) return value
  return `https://${value}`
}

export function registerBrowserIPC(): void {
  registerSecureIpcHandler('browser:load', async (event, rawUrl: unknown, rawRequestId: unknown) => {
    if (typeof rawRequestId !== 'string' || rawRequestId.length === 0 || rawRequestId.length > MAX_REQUEST_ID_LENGTH) {
      return { ok: false, error: '网页请求标识无效' }
    }
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > MAX_URL_LENGTH) {
      return { ok: false, error: '网页地址无效或过长' }
    }
    let validation = await validateFetchUrl(normalizeBrowserUrl(rawUrl))
    if (!validation.ok) return { ok: false, error: validation.reason }

    const controller = new AbortController()
    const key = requestKey(event.sender.id, rawRequestId)
    activeRequests.set(key, controller)
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      let response: Response | null = null
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
        response = await fetch(validation.url, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MyAgent/1.0)',
            Accept: 'text/html,application/xhtml+xml,text/plain',
          },
        })
        if (response.status < 300 || response.status >= 400) break
        if (redirectCount === MAX_REDIRECTS) return { ok: false, error: '网页跳转次数过多，已停止加载' }
        const location = response.headers.get('location')
        if (!location) return { ok: false, error: '网页跳转地址缺失，无法加载' }
        const redirectUrl = new URL(location, validation.url).toString()
        validation = await validateFetchUrl(redirectUrl)
        if (!validation.ok) return { ok: false, error: `网页跳转被安全策略拦截：${validation.reason}` }
      }
      if (!response) return { ok: false, error: '网页加载失败，请重试' }
      if (!response.ok) return { ok: false, error: `网页暂时无法打开（HTTP ${response.status}）` }
      const body = await readBody(response)
      if (body == null) return { ok: false, error: '网页内容过大，无法在工作区显示' }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
        return { ok: false, error: '该地址不是可预览的网页文档' }
      }
      return { ok: true, url: validation.url, contentType, body }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return { ok: false, error: '网页加载已取消' }
      log.warn('Browser load failed', { urlHash: hashForLog(validation.ok ? validation.url : ''), errorType: error instanceof Error ? error.name : 'unknown' })
      return { ok: false, error: '网页加载失败，请检查地址或网络连接' }
    } finally {
      clearTimeout(timer)
      if (activeRequests.get(key) === controller) activeRequests.delete(key)
    }
  })
  registerSecureIpcHandler('browser:cancel', (event, rawRequestId: unknown) => {
    if (typeof rawRequestId !== 'string' || rawRequestId.length === 0 || rawRequestId.length > MAX_REQUEST_ID_LENGTH) return { ok: false }
    const key = requestKey(event.sender.id, rawRequestId)
    const controller = activeRequests.get(key)
    if (!controller) return { ok: false }
    controller.abort()
    return { ok: true }
  })
  log.info('Browser IPC registered')
}
