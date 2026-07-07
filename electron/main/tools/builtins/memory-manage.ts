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

const VALID_CATEGORIES = ['identity', 'preference', 'fact', 'workflow', 'voice', 'feedback'] as const

export const rememberTool = buildTool({
  name: 'remember',
  description: 'Store important information about the user or their preferences into long-term memory. Use this when the user explicitly asks you to remember something, or when you notice significant facts worth preserving.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Category: identity (who they are), workflow (how they work), voice (communication style), preference (likes/dislikes), fact (specific facts), feedback (their corrections AND confirmations about how you should work — both what to change and what to keep doing)',
        enum: [...VALID_CATEGORIES],
      },
      content: {
        type: 'string',
        description: 'A concise statement to remember (one sentence)',
      },
    },
    required: ['category', 'content'],
  },
  metadata: {
    isConcurrencySafe: true,
  },
  execute: async (args) => {
    const category = args.category as string
    const content = args.content as string

    if (!VALID_CATEGORIES.includes(category as MemoryCategory)) {
      return `Error: invalid category "${category}". Use one of: ${VALID_CATEGORIES.join(', ')}`
    }
    if (!content || content.length < 2) {
      return 'Error: content is too short'
    }

    const existing = await listMemories(category as MemoryCategory)
    const isDuplicate = existing.some(m => m.content.toLowerCase() === content.toLowerCase())
    if (isDuplicate) {
      return `Already remembered: "${content}"`
    }

    const entry = await addMemory(category as MemoryCategory, content)
    return `Remembered [${category}]: "${content}" (id: ${entry.id})`
  },
})

export const recallTool = buildTool({
  name: 'recall',
  description: 'Search long-term memory for previously stored information about the user. Use this when you need to check what you know about the user before answering.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional: filter by category (identity, workflow, voice, preference, fact, feedback). Omit to search all.',
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
      return validCat ? `No memories in category "${validCat}".` : 'No memories stored yet.'
    }

    const lines = memories.map(m => `- [${m.category}] ${m.content} (id: ${m.id})`)
    return `Found ${memories.length} memories:\n${lines.join('\n')}`
  },
})

export const forgetTool = buildTool({
  name: 'forget',
  description: 'Remove a specific memory by ID. Use when the user asks you to forget something, or when information is outdated.',
  parameters: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The memory ID to delete (get it from recall results)',
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
    if (!id) return 'Error: memory id is required'

    await deleteMemory(id)
    return `Memory ${id} has been forgotten.`
  },
})
