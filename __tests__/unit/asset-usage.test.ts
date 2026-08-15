import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentAssetUsageEvidence, ModelContextAsset } from '../../src/shared/types'
import {
  recordAssetUsage,
  sanitizeAssetUsageMetadata,
  setAssetUsageResolver,
  setAssetUsageSink,
} from '../../electron/main/utils/asset-usage'
import { runWithTraceContext } from '../../electron/main/utils/trace-context'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

const asset: ModelContextAsset = {
  key: 'provider-policy:vision-fallback',
  id: 'provider-policy:vision-fallback',
  name: 'Provider 策略 · Vision 降级',
  category: 'provider',
  purpose: '测试',
  role: 'provider-policy',
  desc: '测试',
  source: 'vision.ts',
  sourcePath: 'vision.ts',
  version: '1.0.0',
  fingerprint: '0123456789abcdef',
  fingerprintKind: 'content',
  assetType: 'provider-policy',
  ownership: 'builtin',
  contentKind: 'data',
  mode: 'static',
  locale: 'zh-CN',
  locales: { 'zh-CN': { template: '{}' } },
  slots: [],
}

afterEach(() => {
  setAssetUsageResolver()
  setAssetUsageSink()
})

describe('生产资产使用证据', () => {
  it('继承 Trace identity，并只保存扁平 allowlist 元数据', async () => {
    const records: AgentAssetUsageEvidence[] = []
    setAssetUsageResolver((key) => key === asset.key ? asset : undefined)
    setAssetUsageSink({ record: (item) => { records.push(item) } })

    await runWithTraceContext({ sessionId: 'session-1', interactionSpanId: 'interaction-1' }, () =>
      recordAssetUsage({
        assetKey: asset.key,
        relation: 'triggered',
        usageKind: 'provider-policy',
        spanId: 'span-1',
        status: 'success',
        metadata: {
          model: 'test-model',
          count: 2,
          enabled: true,
          tags: ['vision', 'retry'],
          rawArgs: { secret: '不得进入' },
          response: ['合法字符串', 1],
        },
      }),
    )

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      assetKey: asset.key,
      assetVersion: '1.0.0',
      assetFingerprint: '0123456789abcdef',
      sessionId: 'session-1',
      interactionSpanId: 'interaction-1',
      spanId: 'span-1',
      metadata: { model: 'test-model', count: 2, enabled: true, tags: ['vision', 'retry'] },
    })
    expect(records[0].metadata).not.toHaveProperty('rawArgs')
    expect(records[0].metadata).not.toHaveProperty('response')
  })

  it('未知资产 key 不写入 Sink', async () => {
    const record = vi.fn()
    setAssetUsageResolver(() => undefined)
    setAssetUsageSink({ record })
    await recordAssetUsage({
      assetKey: 'missing:key', relation: 'used', usageKind: 'llm-input', spanId: 'span', status: 'success',
    })
    expect(record).not.toHaveBeenCalled()
  })

  it('限制元数据字符串与数组长度', () => {
    const metadata = sanitizeAssetUsageMetadata({ long: 'x'.repeat(500), list: Array.from({ length: 50 }, (_, i) => String(i)) })
    expect(String(metadata.long)).toHaveLength(240)
    expect(metadata.list).toHaveLength(32)
  })
})
