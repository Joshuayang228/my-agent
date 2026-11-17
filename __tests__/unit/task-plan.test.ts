import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const fixture = vi.hoisted(() => ({ directory: '' }))
vi.mock('electron', () => ({ app: { getPath: () => fixture.directory } }))
import * as database from '../../electron/main/storage/database'
import { taskPlanTool } from '../../electron/main/tools/builtins/task-plan'

beforeEach(() => {
  fixture.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'task-plan-'))
})
afterEach(() => {
  vi.restoreAllMocks()
  database._resetDatabaseForTests()
  fs.rmSync(fixture.directory, { recursive: true, force: true })
})

describe('task_plan tool', () => {
  const execute = (args: Record<string, unknown>) => taskPlanTool.execute(args, { workdir: fixture.directory, sessionId: 'main' })
  it('creates a plan', async () => {
    const result = await execute({
      action: 'create',
      goal: 'Build a feature',
      steps: '["Design", "Implement", "Test"]',
    })
    expect(result).toContain('Build a feature')
    expect(result).toContain('Design')
    expect(result).toContain('0/3')
  })

  it('shows status', async () => {
    await execute({
      action: 'create',
      goal: 'Test plan',
      steps: '["Step 1", "Step 2"]',
    })
    const result = await execute({ action: 'status' })
    expect(result).toContain('Test plan')
    expect(result).toContain('Step 1')
  })

  it('updates a step', async () => {
    await execute({
      action: 'create',
      goal: 'Update test',
      steps: '["A", "B"]',
    })
    const result = await execute({
      action: 'update',
      stepId: '1',
      stepStatus: 'done',
      stepResult: 'Completed successfully',
    })
    expect(result).toContain('1/2')
    expect(result).toContain('Completed successfully')
  })

  it('marks all done and shows celebration', async () => {
    await execute({
      action: 'create',
      goal: 'Full completion',
      steps: '["Only step"]',
    })
    const result = await execute({
      action: 'update',
      stepId: '1',
      stepStatus: 'done',
    })
    expect(result).toContain('所有步骤均已完成')
  })

  it('clears plan', async () => {
    await execute({
      action: 'create',
      goal: 'Clear test',
      steps: '["Step"]',
    })
    const result = await execute({ action: 'clear' })
    expect(result).toContain('已清除')

    const status = await execute({ action: 'status' })
    expect(status).toContain('当前没有活动计划')
  })

  it('rejects create without goal', async () => {
    const result = await execute({ action: 'create', steps: '["A"]' })
    expect(result).toContain('错误')
  })

  it('handles no plan gracefully', async () => {
    await execute({ action: 'clear' })
    const result = await execute({ action: 'update', stepId: '1', stepStatus: 'done' })
    expect(result).toContain('当前没有活动计划')
  })
})

it('任务计划严格隔离会话，清除和重启不会读取其他会话', async () => {
  const first = { workdir: fixture.directory, sessionId: 'first' }
  const second = { workdir: fixture.directory, sessionId: 'second' }
  await Promise.all([
    taskPlanTool.execute({ action: 'create', goal: 'Alpha', steps: '["A"]' }, first),
    taskPlanTool.execute({ action: 'create', goal: 'Beta', steps: '["B"]' }, second),
  ])
  expect(await taskPlanTool.execute({ action: 'status' }, first)).toContain('Alpha')
  expect(await taskPlanTool.execute({ action: 'status' }, second)).toContain('Beta')
  await taskPlanTool.execute({ action: 'clear' }, first)
  database.closeDatabase()
  expect(await taskPlanTool.execute({ action: 'status' }, first)).toContain('当前没有活动计划')
  expect(await taskPlanTool.execute({ action: 'status' }, second)).toContain('Beta')
  expect(await taskPlanTool.execute({ action: 'status' })).toContain('错误')
})

it('计划持久化失败不会宣称创建成功，重启保留上次已提交计划', async () => {
  const context = { workdir: fixture.directory, sessionId: 'first' }
  await taskPlanTool.execute({ action: 'create', goal: 'Original', steps: '["A"]' }, context)
  vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => { throw new Error('disk-full') })
  expect(await taskPlanTool.execute({ action: 'create', goal: 'Failed', steps: '["B"]' }, context)).toContain('错误')
  database._resetDatabaseForTests()
  const result = await taskPlanTool.execute({ action: 'status' }, context)
  expect(result).toContain('Original')
  expect(result).not.toContain('Failed')
})

it('同一会话并发更新不同步骤保留两项结果', async () => {
  const context = { workdir: fixture.directory, sessionId: 'parallel' }
  await taskPlanTool.execute({ action: 'create', goal: 'Parallel', steps: '["A", "B"]' }, context)
  await Promise.all(['1', '2'].map(stepId => taskPlanTool.execute({ action: 'update', stepId, stepStatus: 'done' }, context)))
  expect(await taskPlanTool.execute({ action: 'status' }, context)).toContain('2/2')
})
