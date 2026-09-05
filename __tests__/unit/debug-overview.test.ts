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
})
