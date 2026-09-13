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

import { ipcMain } from 'electron'
import { validateFetchUrl } from '../tools/builtins/url-fetch'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('BrowserIPC')
const MAX_URL_LENGTH = 4_096
const MAX_RESPONSE_BYTES = 512 * 1024
const TIMEOUT_MS = 15_000

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

export function registerBrowserIPC(): void {
  ipcMain.handle('browser:load', async (_event, rawUrl: unknown) => {
    if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > MAX_URL_LENGTH) {
      return { ok: false, error: '网页地址无效或过长' }
    }
    const validation = await validateFetchUrl(rawUrl.trim())
    if (!validation.ok) return { ok: false, error: validation.reason }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(validation.url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyAgent/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain',
        },
      })
      if (response.status >= 300 && response.status < 400) return { ok: false, error: '为避免跳转到未知地址，暂不跟随网页重定向' }
      if (!response.ok) return { ok: false, error: `网页暂时无法打开（HTTP ${response.status}）` }
      const body = await readBody(response)
      if (body == null) return { ok: false, error: '网页内容过大，无法在工作区显示' }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
        return { ok: false, error: '该地址不是可预览的网页文档' }
      }
      return { ok: true, url: validation.url, contentType, body }
    } catch (error) {
      log.warn('Browser load failed', { urlHash: hashForLog(validation.url), errorType: error instanceof Error ? error.name : 'unknown' })
      return { ok: false, error: '网页加载失败，请检查地址或网络连接' }
    } finally {
      clearTimeout(timer)
    }
  })
  log.info('Browser IPC registered')
}
