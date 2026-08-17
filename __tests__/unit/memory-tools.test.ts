import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../electron/main/storage/database', () => {
  const rows: Record<string, unknown>[] = []
  const mockDb = {
    run: vi.fn((sql: string, params?: unknown[]) => {
      if (sql.startsWith('CREATE')) return
      if (sql.startsWith('INSERT')) {
        rows.push({
          id: params?.[0],
          category: params?.[1],
          content: params?.[2],
          createdAt: params?.[3],
          updatedAt: params?.[4],
          role_id: params?.[5] ?? '',
        })
      }
      if (sql.startsWith('DELETE')) {
        const id = params?.[0]
        const idx = rows.findIndex(r => r.id === id)
        if (idx >= 0) rows.splice(idx, 1)
      }
    }),
    prepare: vi.fn((sql: string) => {
      const hasCat = sql.includes('WHERE category')
      let idx = 0
      let filterCat: string | undefined
      return {
        bind: vi.fn((params: unknown[]) => { filterCat = params[0] as string }),
        step: vi.fn(() => {
          const filtered = hasCat && filterCat
            ? rows.filter(r => r.category === filterCat)
            : rows
          return idx < filtered.length ? (idx++, true) : false
        }),
        getAsObject: vi.fn(() => {
          const filtered = hasCat && filterCat
            ? rows.filter(r => r.category === filterCat)
            : rows
          return filtered[idx - 1] || {}
        }),
        free: vi.fn(),
      }
    }),
  }
  return {
    getDatabase: vi.fn(async () => mockDb),
    persist: vi.fn(),
    _rows: rows,
    _mockDb: mockDb,
  }
})

vi.mock('../../electron/main/memory/vector-store', () => ({
  addToVectorStore: vi.fn(async () => {}),
  removeFromVectorStore: vi.fn(async () => {}),
}))

vi.mock('../../electron/main/storage/settings-store', () => ({
  getAllSettings: vi.fn(async () => ({
    llmApiKey: 'test-key',
    llmBaseUrl: 'http://localhost',
    llmModel: 'test',
  })),
}))

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { rememberTool, recallTool, forgetTool, resolveRememberMetadata } from '../../electron/main/tools/builtins/memory-manage'
import { taskPlanTool } from '../../electron/main/tools/builtins/task-plan'
import { drainMemoryBackgroundTasks } from '../../electron/main/storage/memory-store'
import { _rows } from '../../electron/main/storage/database'

describe('remember tool', () => {
  beforeEach(() => {
    (_rows as unknown[]).length = 0
  })

  afterEach(async () => {
    await drainMemoryBackgroundTasks()
  })

  it('stores a new memory', async () => {
    const result = await rememberTool.execute({ category: 'fact', content: 'User likes TypeScript' })
    expect(result).toContain('已记住 [fact]')
    expect(result).toContain('User likes TypeScript')
  })

  it('rejects invalid category', async () => {
    const result = await rememberTool.execute({ category: 'invalid', content: 'test' })
    expect(result).toContain('错误：无效类别')
  })

  it('G9: accepts feedback category (corrections & confirmations)', async () => {
    const result = await rememberTool.execute({ category: 'feedback', content: 'Prefers concise answers without preamble (said long explanations waste time)' })
    expect(result).toContain('已记住 [feedback]')
  })


  it('敏感记忆进入确认链，凭据原文即使确认也不会入库', async () => {
    expect(resolveRememberMetadata({ content: '我的年薪是五十万' })).toMatchObject({ isDestructive: true, isConcurrencySafe: false })
    expect(resolveRememberMetadata({ content: '喜欢深色主题' })).toMatchObject({ isDestructive: false, isConcurrencySafe: false })

    const result = await rememberTool.execute({ category: 'fact', content: 'api_key=sk-secret-value' })
    expect(result).toContain('凭据原文不会写入')
    expect(_rows).toHaveLength(0)
  })

  it('rejects empty content', async () => {
    const result = await rememberTool.execute({ category: 'fact', content: '' })
    expect(result).toContain('错误')
  })
})

describe('recall tool', () => {
  it('returns empty state', async () => {
    const result = await recallTool.execute({})
    expect(result).toContain('尚未存储任何记忆')
  })
})

describe('forget tool', () => {
  it('accepts an id', async () => {
    const result = await forgetTool.execute({ id: 'mem-123' })
    expect(result).toContain('已忘记')
  })

  it('rejects missing id', async () => {
    const result = await forgetTool.execute({ id: '' })
    expect(result).toContain('错误')
  })
})

describe('task_plan tool', () => {
  it('creates a plan', async () => {
    const result = await taskPlanTool.execute({
      action: 'create',
      goal: 'Build a feature',
      steps: '["Design", "Implement", "Test"]',
    })
    expect(result).toContain('Build a feature')
    expect(result).toContain('Design')
    expect(result).toContain('0/3')
  })

  it('shows status', async () => {
    await taskPlanTool.execute({
      action: 'create',
      goal: 'Test plan',
      steps: '["Step 1", "Step 2"]',
    })
    const result = await taskPlanTool.execute({ action: 'status' })
    expect(result).toContain('Test plan')
    expect(result).toContain('Step 1')
  })

  it('updates a step', async () => {
    await taskPlanTool.execute({
      action: 'create',
      goal: 'Update test',
      steps: '["A", "B"]',
    })
    const result = await taskPlanTool.execute({
      action: 'update',
      stepId: '1',
      stepStatus: 'done',
      stepResult: 'Completed successfully',
    })
    expect(result).toContain('1/2')
    expect(result).toContain('Completed successfully')
  })

  it('marks all done and shows celebration', async () => {
    await taskPlanTool.execute({
      action: 'create',
      goal: 'Full completion',
      steps: '["Only step"]',
    })
    const result = await taskPlanTool.execute({
      action: 'update',
      stepId: '1',
      stepStatus: 'done',
    })
    expect(result).toContain('所有步骤均已完成')
  })

  it('clears plan', async () => {
    await taskPlanTool.execute({
      action: 'create',
      goal: 'Clear test',
      steps: '["Step"]',
    })
    const result = await taskPlanTool.execute({ action: 'clear' })
    expect(result).toContain('已清除')

    const status = await taskPlanTool.execute({ action: 'status' })
    expect(status).toContain('当前没有活动计划')
  })

  it('rejects create without goal', async () => {
    const result = await taskPlanTool.execute({ action: 'create', steps: '["A"]' })
    expect(result).toContain('错误')
  })

  it('handles no plan gracefully', async () => {
    await taskPlanTool.execute({ action: 'clear' })
    const result = await taskPlanTool.execute({ action: 'update', stepId: '1', stepStatus: 'done' })
    expect(result).toContain('当前没有活动计划')
  })
})
