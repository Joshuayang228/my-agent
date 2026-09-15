import { describe, expect, it } from 'vitest'
import { MEMORY_CATEGORY_GROUP, MEMORY_GROUPS } from '../../src/shared/memory-groups'
import type { MemoryCategory } from '../../src/shared/types'

describe('记忆页面分组', () => {
  it('六类旧记忆唯一归属四类导航，不丢失事实、偏好和反馈', () => {
    const categories: MemoryCategory[] = ['identity', 'workflow', 'voice', 'fact', 'preference', 'feedback']
    const ids = MEMORY_GROUPS.map((group) => group.id)
    expect(new Set(ids).size).toBe(4)
    for (const category of categories) expect(ids).toContain(MEMORY_CATEGORY_GROUP[category])
    expect(MEMORY_CATEGORY_GROUP).toEqual({
      identity: 'identity', fact: 'identity', workflow: 'collaboration',
      voice: 'communication', preference: 'communication', feedback: 'relationship',
    })
  })

  it('每类新增的存储类别在重新读取后仍归原导航', () => {
    for (const group of MEMORY_GROUPS) expect(MEMORY_CATEGORY_GROUP[group.category]).toBe(group.id)
  })
})
