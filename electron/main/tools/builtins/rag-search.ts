import type { ToolDefinition } from '../../../../src/shared/types'
import { searchDocuments } from '../../rag/index'
import * as settings from '../../storage/settings-store'

export const ragSearchTool: ToolDefinition = {
  name: 'rag_search',
  description: '在用户导入的知识库文档中进行语义搜索，返回最相关的文本片段。适合查找用户上传的文档、笔记、技术资料中的信息。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索查询，自然语言描述你要查找的内容' },
      topK: { type: 'string', description: '返回结果数量（默认 5）' },
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
    const topK = parseInt(args.topK as string) || 5

    const allSettings = await settings.getAllSettings()
    const config = {
      apiKey: allSettings.apiKey || '',
      baseUrl: allSettings.baseUrl || 'https://api.openai.com/v1',
      model: allSettings.model || 'gpt-4o-mini',
    }

    if (!config.apiKey) return '❌ 未配置 API Key，无法执行向量搜索'

    const results = await searchDocuments(query, config, topK)

    if (results.length === 0) return '未找到相关文档片段。知识库可能为空或查询与已有文档不匹配。'

    return results.map((r, i) =>
      `[${i + 1}] 来源: ${r.docName} (相关度: ${(r.score * 100).toFixed(0)}%)\n${r.text}`
    ).join('\n\n---\n\n')
  },
}
