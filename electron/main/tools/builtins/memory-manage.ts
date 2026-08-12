/**
 * Agent 记忆工具 — LLM 可调用的记忆管理接口。
 *
 * 服务层：storage/memory-store.ts（状态管理 + 双写同步）
 * 本文件：工具定义（薄包装层）
 *
 * remember: 将信息写入长期记忆
 * recall:   按类别列出记忆（服务层同时被 Runtime 用于自动注入）
 * forget:   删除指定记忆
 */
import { buildTool } from '../builder'
import { addMemory, listMemories, deleteMemory, type MemoryCategory } from '../../storage/memory-store'
import {
  detectSensitiveKinds,
  formatSensitiveRememberNote,
} from '../../../../src/shared/sensitive-memory'

const VALID_CATEGORIES = ['identity', 'preference', 'fact', 'workflow', 'voice', 'feedback'] as const

export const rememberTool = buildTool({
  name: 'remember',
  description: "把关于用户及其偏好的重要信息存入长期记忆。用户明确要求记住，或发现值得长期保留的重要事实时使用。",
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: "类别：identity（身份）、workflow（工作方式）、voice（沟通风格）、preference（偏好）、fact（事实）、feedback（用户对工作方式的纠正与确认）。",
        enum: [...VALID_CATEGORIES],
      },
      content: {
        type: 'string',
        description: "要记住的简洁陈述，最多一句话。",
      },
    },
    required: ['category', 'content'],
  },
  metadata: {
    isConcurrencySafe: true,
  },
  execute: async (args, ctx) => {
    const category = args.category as string
    const content = args.content as string

    if (!VALID_CATEGORIES.includes(category as MemoryCategory)) {
      return `错误：无效类别 "${category}". 可选值： ${VALID_CATEGORIES.join(', ')}`
    }
    if (!content || content.length < 2) {
      return '错误：内容过短'
    }

    const roleId = category === 'feedback' ? ctx?.roleId?.trim() : undefined
    const existing = await listMemories(category as MemoryCategory)
    const pool = category === 'feedback' && roleId
      ? existing.filter((m) => (m.roleId || '') === roleId)
      : existing
    const isDuplicate = pool.some(m => m.content.toLowerCase() === content.toLowerCase())
    if (isDuplicate) {
      return `已经记住： "${content}"`
    }

    const entry = await addMemory(category as MemoryCategory, content, { roleId })
    const sensitive = detectSensitiveKinds(content)
    const note = formatSensitiveRememberNote(sensitive)
    return `已记住 [${category}]: "${content}" (id: ${entry.id})${note}`
  },
})

export const recallTool = buildTool({
  name: 'recall',
  description: "搜索关于用户的长期记忆。回答前需要确认已知用户信息时使用。",
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: "可选：按 identity、workflow、voice、preference、fact、feedback 类别过滤；省略时搜索全部。",
      },
    },
    required: [],
  },
  metadata: {
    isReadOnly: true,
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const category = args.category as string | undefined
    const validCat = category && VALID_CATEGORIES.includes(category as MemoryCategory)
      ? category as MemoryCategory
      : undefined

    const memories = await listMemories(validCat)
    if (memories.length === 0) {
      return validCat ? `类别中没有记忆： "${validCat}".` : '尚未存储任何记忆。'
    }

    const lines = memories.map(m => `- [${m.category}] ${m.content} (id: ${m.id})`)
    return `找到 ${memories.length} 条记忆：\n${lines.join('\n')}`
  },
})

export const forgetTool = buildTool({
  name: 'forget',
  description: "按 ID 删除一条长期记忆。用户要求忘记某事或信息已经过时时使用。",
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: "要删除的记忆 ID，可从 recall 结果中获取。",
      },
    },
    required: ['id'],
  },
  metadata: {
    isDestructive: true,
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const id = args.id as string
    if (!id) return '错误：必须提供记忆 ID'

    await deleteMemory(id)
    return `已忘记记忆 ${id}。`
  },
})
