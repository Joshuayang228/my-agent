import { describe, expect, it } from 'vitest'
import { buildDebugOverviewSnapshot } from '../../src/components/debug/DebugOverview'

describe('debug overview snapshot', () => {
  it('保留成功来源，并标记失败的运行证据', () => {
    const snapshot = buildDebugOverviewSnapshot({
      system: { settings: { model: 'test-model', hasApiKey: true } },
      world: { role: { name: '测试伙伴' } },
      eventCount: 4,
      unavailable: ['traces'],
    })

    expect(snapshot).toMatchObject({
      model: 'test-model',
      credentialStatus: '凭据已配置',
      roleName: '测试伙伴',
      eventCount: 4,
      unavailable: ['traces'],
    })
    expect(snapshot.traceCount).toBeUndefined()
  })

  it('统计 Trace 错误，并保留未配置凭据状态', () => {
    const snapshot = buildDebugOverviewSnapshot({
      system: { settings: { model: 'test-model', hasApiKey: false } },
      traces: { spans: [{ status: 'ok' }, { status: 'error' }, { status: 'error' }] },
      eventCount: 0,
      unavailable: [],
    })

    expect(snapshot).toMatchObject({
      credentialStatus: '未配置凭据',
      traceCount: 3,
      traceErrorCount: 2,
      unavailable: [],
    })
  })

  it('所有运行证据不可用时保留可区分的空值和事件计数', () => {
    const snapshot = buildDebugOverviewSnapshot({
      eventCount: 7,
      unavailable: ['system', 'traces', 'world'],
    })

    expect(snapshot).toEqual({
      eventCount: 7,
      unavailable: ['system', 'traces', 'world'],
    })
    expect(snapshot.model).toBeUndefined()
    expect(snapshot.roleName).toBeUndefined()
    expect(snapshot.traceCount).toBeUndefined()
    expect(snapshot.traceErrorCount).toBeUndefined()
  })

  it('没有 Trace 列表时不把缺失数据误报为错误', () => {
    const snapshot = buildDebugOverviewSnapshot({
      system: { settings: { model: 'test-model', hasApiKey: true } },
      traces: {},
      world: { role: { name: '测试伙伴' } },
      eventCount: 0,
      unavailable: [],
    })

    expect(snapshot.traceCount).toBeUndefined()
    expect(snapshot.traceErrorCount).toBeUndefined()
    expect(snapshot.unavailable).toEqual([])
  })

  it('只统计明确标记为 error 的 Trace 状态', () => {
    const snapshot = buildDebugOverviewSnapshot({
      traces: { spans: [
        { status: 'ok' },
        { status: 'cancelled' },
        { status: 'failed' },
        { status: 'error' },
      ] },
      eventCount: 1,
      unavailable: [],
    })

    expect(snapshot.traceCount).toBe(4)
    expect(snapshot.traceErrorCount).toBe(1)
  })
})
