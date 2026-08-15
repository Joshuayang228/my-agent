import { buildTool } from '../builder'
import { createLogger, hashForLog } from '../../utils/logger'

const log = createLogger('UrlFetch')

const MAX_CONTENT_LENGTH = 50_000
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
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return '错误：URL 必须以 http:// 或 https:// 开头'
    }

    log.info('Fetching URL', { urlHash: hashForLog(url) })

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MyAgent/1.0)',
          Accept: 'text/html,application/xhtml+xml,text/plain,application/json,*/*',
        },
      })
      clearTimeout(timeout)

      if (!resp.ok) {
        return `错误：HTTP ${resp.status} ${resp.statusText}`
      }

      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const json = await resp.text()
        return json.length > MAX_CONTENT_LENGTH
          ? json.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... 已截断]'
          : json
      }

      const html = await resp.text()
      const text = stripHtml(html)

      if (text.length > MAX_CONTENT_LENGTH) {
        return text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... 已截断]'
      }

      return text || '（页面为空）'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('Fetch failed', { urlHash: hashForLog(url), error: msg })
      return `获取 URL 失败： ${msg}`
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
