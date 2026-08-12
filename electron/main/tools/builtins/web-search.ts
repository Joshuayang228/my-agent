import { buildTool } from '../builder'
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

export const webSearchTool = buildTool({
  name: 'web_search',
  description:
    "搜索互联网中的当前信息。需要最新资料、事实、新闻或其他必须联网获取的内容时使用；返回标题、URL 和内容摘要。",
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: "搜索查询；描述越具体，结果越准确。",
      },
      max_results: {
        type: 'string',
        description: "最多返回的结果数量，范围 1–10，默认 5。",
      },
    },
    required: ['query'],
  },
  inputExamples: [
    { query: 'TypeScript 5.5 release notes' },
    { query: 'electron sandbox best practices', max_results: '3' },
  ],
  metadata: { isReadOnly: true, isConcurrencySafe: true },
  execute: async (args) => {
    const query = args.query as string
    const maxResults = Math.min(Math.max(parseInt(String(args.max_results || '5'), 10) || 5, 1), 10)

    if (!query?.trim()) {
      return '错误：必须提供搜索查询'
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
        const errorText = await response.text().catch(() => '未知错误')
        log.error('Tavily API error', { status: response.status, error: errorText })
        return `搜索失败（HTTP ${response.status}）：${errorText}`
      }

      const data = (await response.json()) as TavilyResponse
      log.info('Search completed', { query, resultCount: data.results?.length ?? 0 })

      const parts: string[] = []

      if (data.answer) {
        parts.push(`**AI 摘要**：${data.answer}`)
        parts.push('')
      }

      parts.push(`**“${query}”的搜索结果**：`)
      parts.push('')

      if (!data.results?.length) {
        parts.push('未找到结果。')
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
      return `搜索失败：${message}`
    }
  },
})
