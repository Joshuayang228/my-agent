import { buildTool } from '../builder'
import { createLogger } from '../../utils/logger'

const log = createLogger('UrlFetch')

const MAX_CONTENT_LENGTH = 50_000
const TIMEOUT_MS = 15_000

export const urlFetchTool = buildTool({
  name: 'url_fetch',
  description:
    'Fetch the content of a web page URL and return it as text. Useful for reading articles, documentation, or any web content. Returns the text content with HTML tags stripped.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch (must start with http:// or https://).',
      },
    },
    required: ['url'],
  },
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args) => {
    const url = args.url as string
    if (!url?.trim()) return 'Error: URL is required'
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'Error: URL must start with http:// or https://'
    }

    log.info('Fetching URL', { url })

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
        return `Error: HTTP ${resp.status} ${resp.statusText}`
      }

      const contentType = resp.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const json = await resp.text()
        return json.length > MAX_CONTENT_LENGTH
          ? json.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... truncated]'
          : json
      }

      const html = await resp.text()
      const text = stripHtml(html)

      if (text.length > MAX_CONTENT_LENGTH) {
        return text.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... truncated]'
      }

      return text || '(empty page)'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('Fetch failed', { url, error: msg })
      return `Error fetching URL: ${msg}`
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
