import type { ToolDefinition } from '../../../../src/shared/types'
import { createLogger } from '../../utils/logger'

const log = createLogger('WebSearch')

const TAVILY_API_URL = 'https://api.tavily.com/search'

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilyResponse {
  query: string
  answer?: string
  results: TavilyResult[]
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description:
    'Search the web for current information. Use this when you need up-to-date information, facts, news, or anything that requires internet access. Returns search results with titles, URLs, and content snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific for better results.',
      },
      max_results: {
        type: 'string',
        description: 'Maximum number of results to return (1-10). Default: 5.',
      },
    },
    required: ['query'],
  },
  metadata: {
    isReadOnly: true,
    isDestructive: false,
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const query = args.query as string
    const maxResults = Math.min(Math.max(parseInt(String(args.max_results || '5'), 10) || 5, 1), 10)

    if (!query?.trim()) {
      return 'Error: search query is required'
    }

    log.info('Searching', { query, maxResults })

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Tavily-Access-Mode': 'keyless',
      }

      const body = {
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: 'basic',
      }

      const response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error')
        log.error('Tavily API error', { status: response.status, error: errorText })
        return `Search failed (HTTP ${response.status}): ${errorText}`
      }

      const data = (await response.json()) as TavilyResponse
      log.info('Search completed', { query, resultCount: data.results?.length ?? 0 })

      const parts: string[] = []

      if (data.answer) {
        parts.push(`**AI Summary**: ${data.answer}`)
        parts.push('')
      }

      parts.push(`**Search results for "${query}"**:`)
      parts.push('')

      if (!data.results?.length) {
        parts.push('No results found.')
        return parts.join('\n')
      }

      for (let i = 0; i < data.results.length; i++) {
        const r = data.results[i]
        parts.push(`${i + 1}. **${r.title}**`)
        parts.push(`   URL: ${r.url}`)
        parts.push(`   ${r.content}`)
        parts.push('')
      }

      return parts.join('\n')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('Search failed', { query, error: message })
      return `Search failed: ${message}`
    }
  },
}
