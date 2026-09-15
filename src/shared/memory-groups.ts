import type { MemoryCategory } from './types'

export const MEMORY_GROUPS = [
  { id: 'identity', label: '身份信息', category: 'identity' },
  { id: 'collaboration', label: '工作方式', category: 'workflow' },
  { id: 'communication', label: '沟通偏好', category: 'voice' },
  { id: 'relationship', label: '我们之间', category: 'feedback' },
] as const satisfies readonly { id: string; label: string; category: MemoryCategory }[]

export type MemoryGroup = typeof MEMORY_GROUPS[number]['id']

/**
 * 背景：页面四类与历史六种存储类别不同，直接过滤会丢失偏好和事实。
 * 意图：按既有画像分桶投影展示，不按文本猜类别、不改写历史数据。
 * 约束：每个存储类别必须唯一可达；feedback 单列但其角色归属和运行时注入不变。
 */
export const MEMORY_CATEGORY_GROUP: Record<MemoryCategory, MemoryGroup> = {
  identity: 'identity', fact: 'identity', workflow: 'collaboration',
  voice: 'communication', preference: 'communication', feedback: 'relationship',
}
