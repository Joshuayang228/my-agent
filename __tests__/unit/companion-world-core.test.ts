import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
let memDb: InstanceType<typeof SQL.Database>

vi.mock('../../electron/main/storage/database', () => ({
  getDatabase: vi.fn(async () => memDb),
  persist: vi.fn(),
}))

vi.mock('../../electron/main/companion/life/store', () => ({
  getRoleState: vi.fn(async () => ({
    roleId: 'luffy',
    pausedAt: null,
    lastTickAt: 0,
    catchupSummary: '',
    world: {
      schemaVersion: 1,
      home: '千里阳光号',
      timezone: 'Asia/Shanghai',
      situation: '在甲板上看海',
      mood: 64,
      energy: 72,
      socialNeed: 48,
      currentLocation: '甲板',
      locationDetail: '',
      currentActivity: '看海',
      statusTags: [],
      updatedAt: 100,
    },
    updatedAt: 100,
  })),
  setWorldState: vi.fn(async () => undefined),
}))

const {
  getCompanionRuntimeState,
  applyCompanionRuntimeDelta,
  resetCompanionCoreSchemaForTesting,
} = await import('../../electron/main/companion/core/state/runtime-state')
const { appendCompanionDomainEvent } = await import('../../electron/main/companion/core/events/domain-events')
const { startCompanionExecution, finishCompanionExecution, linkCompanionExecutionEvent } = await import('../../electron/main/companion/core/execution/ledger')
const { enqueueCompanionOutbox } = await import('../../electron/main/companion/core/outbox/outbox')
const { dispatchCompanionOutbox } = await import('../../electron/main/companion/core/outbox/outbox')
const { executeCompanionCommand } = await import('../../electron/main/companion/core/commands/gateway')
const { recordCompanionProjection } = await import('../../electron/main/companion/core/projections/receipts')

describe('人物世界核心层', () => {
  beforeEach(() => {
    memDb = new SQL.Database()
    resetCompanionCoreSchemaForTesting()
  })

  it('从既有 world state 建立运行态快照，并按版本应用有界状态变化', async () => {
    const first = await getCompanionRuntimeState('luffy')
    expect(first.mood).toBe(64)
    expect(first.home).toBe('千里阳光号')
    expect(first.version).toBe(0)

    const next = await applyCompanionRuntimeDelta({
      roleId: 'luffy',
      eventId: 'event-1',
      delta: { mood: 60, energy: -90, socialNeed: 5 },
      updatedAt: 200,
    })
    expect(next.mood).toBe(100)
    expect(next.energy).toBe(0)
    expect(next.socialNeed).toBe(53)
    expect(next.version).toBe(1)
    expect(next.lastEventId).toBe('event-1')
    await expect(applyCompanionRuntimeDelta({ roleId: 'luffy', eventId: 'stale', expectedVersion: 0, delta: { mood: 1 } })).rejects.toThrow('版本冲突')
  })

  it('领域事件和 Outbox 使用幂等键，重复提交返回既有记录', async () => {
    const input = {
      roleId: 'luffy',
      universeId: 'default',
      type: 'culture_experience_completed',
      sourceType: 'chat_resonance',
      sourceId: 'resonance-1',
      causationId: 'resonance-1',
      correlationId: 'resonance-1',
      idempotencyKey: 'culture:resonance-1',
      occurredAt: 100,
      payload: { targetName: '海边的书' },
      schemaVersion: 1,
    } as const
    const first = await appendCompanionDomainEvent(input)
    const second = await appendCompanionDomainEvent(input)
    expect(second.id).toBe(first.id)

    const firstMessage = await enqueueCompanionOutbox({
      roleId: 'luffy',
      eventId: first.id,
      kind: 'resonance-completed',
      dedupeKey: 'resonance:resonance-1',
      payload: { targetName: '海边的书' },
    })
    const secondMessage = await enqueueCompanionOutbox({
      roleId: 'luffy',
      eventId: first.id,
      kind: 'resonance-completed',
      dedupeKey: 'resonance:resonance-1',
      payload: { targetName: '海边的书' },
    })
    expect(secondMessage.id).toBe(firstMessage.id)
  })

  it('执行账本记录完成状态和失败信息', async () => {
    const run = await startCompanionExecution({ roleId: 'luffy', eventId: 'event-1', actionType: 'culture-review' })
    expect(run.status).toBe('running')
    await linkCompanionExecutionEvent({ executionId: run.id, eventId: 'event-1' })
    await finishCompanionExecution({ executionId: run.id, status: 'retryable', errorCode: 'ASSET_WRITE_FAILED', errorMessage: '重试' })
    const row = memDb.exec('SELECT event_id, status, error_code, error_message FROM companion_execution_runs WHERE id = ?', [run.id])[0]?.values[0]
    expect(row).toEqual(['event-1', 'retryable', 'ASSET_WRITE_FAILED', '重试'])
  })

  it('命令网关在 handler 失败时记录 retryable，不伪造完成', async () => {
    await expect(executeCompanionCommand({
      roleId: 'luffy',
      actionType: 'core-test-failure',
      handler: async () => { throw new Error('核心失败') },
    })).rejects.toThrow('核心失败')
    const row = memDb.exec("SELECT status, error_message FROM companion_execution_runs WHERE action_type = 'core-test-failure'")[0]?.values[0]
    expect(row).toEqual(['retryable', '核心失败'])
  })

  it('Outbox 投递成功后标记 delivered，失败后保留 failed 供重试', async () => {
    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-success', dedupeKey: 'success-1', payload: { ok: true } })
    await enqueueCompanionOutbox({ roleId: 'luffy', kind: 'test-failure', dedupeKey: 'failure-1', payload: { ok: false } })
    const delivered: string[] = []
    const count = await dispatchCompanionOutbox({
      deliver: async (message) => {
        if (message.kind === 'test-failure') throw new Error('窗口暂不可用')
        delivered.push(message.kind)
      },
    })
    expect(count).toBe(1)
    expect(delivered).toEqual(['test-success'])
    const rows = memDb.exec("SELECT kind, status, attempt, last_error FROM companion_outbox ORDER BY kind")[0]?.values
    expect(rows).toEqual([
      ['test-failure', 'failed', 1, '窗口暂不可用'],
      ['test-success', 'delivered', 1, null],
    ])
  })

  it('投影回执按投影名和事件 ID 幂等', async () => {
    expect(await recordCompanionProjection({ projectionName: 'culture-read-model', eventId: 'event-1', appliedAt: 100 })).toBe(true)
    expect(await recordCompanionProjection({ projectionName: 'culture-read-model', eventId: 'event-1', appliedAt: 200 })).toBe(false)
    expect(await recordCompanionProjection({ projectionName: 'gift-read-model', eventId: 'event-1', appliedAt: 200 })).toBe(true)
  })
})
