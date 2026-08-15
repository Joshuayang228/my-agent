import { beforeEach, describe, expect, it, vi } from 'vitest'
import initSqlJs from 'sql.js'
import type { AgentAssetUsageEvidence } from '../../src/shared/types'

let db: import('sql.js').Database
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))
vi.mock('../../electron/main/storage/database', () => ({ getDatabase: async () => db, persist: vi.fn() }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  sanitizeLogData: (value: unknown) => value,
}))
const { assetUsageStore } = await import('../../electron/main/storage/asset-usage-store')

beforeEach(async () => {
  const SQL = await initSqlJs()
  db = new SQL.Database()
  db.run(`CREATE TABLE agent_asset_usage (
    id TEXT PRIMARY KEY, asset_key TEXT NOT NULL, asset_name TEXT NOT NULL, asset_type TEXT NOT NULL,
    relation TEXT NOT NULL, usage_kind TEXT NOT NULL, session_id TEXT, interaction_span_id TEXT,
    span_id TEXT NOT NULL, parent_span_id TEXT, occurred_at INTEGER NOT NULL, status TEXT NOT NULL,
    asset_version TEXT NOT NULL, asset_fingerprint TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}'
  )`)
})

function evidence(id: string, assetKey: string, spanId: string): AgentAssetUsageEvidence {
  return {
    id, assetKey, assetName: assetKey, assetType: 'provider-policy', assetVersion: '1.0.0',
    assetFingerprint: '0123456789abcdef', relation: 'used', usageKind: 'provider-policy',
    sessionId: 'session-1', interactionSpanId: 'interaction-1', spanId, occurredAt: Date.now(),
    status: 'success', metadata: { provider: 'openai' },
  }
}

describe('生产资产使用关联索引', () => {
  it('按 asset / span / session 查询，并随会话清空', async () => {
    await assetUsageStore.record(evidence('e1', 'provider-policy:auto-detection', 'span-1'))
    await assetUsageStore.record(evidence('e2', 'provider-policy:vision-fallback', 'span-2'))
    expect((await assetUsageStore.query({ assetKey: 'provider-policy:auto-detection' })).records).toHaveLength(1)
    expect((await assetUsageStore.query({ spanId: 'span-2' })).records[0].assetKey).toBe('provider-policy:vision-fallback')
    expect((await assetUsageStore.query({ sessionId: 'session-1' })).total).toBe(2)
    await assetUsageStore.clear('session-1')
    expect((await assetUsageStore.query({ sessionId: 'session-1' })).total).toBe(0)
  })

  it('超过文本大小上限时持续裁剪，直到低于边界', async () => {
    const largeMetadata = JSON.stringify('x'.repeat(7000))
    const stmt = db.prepare(`INSERT INTO agent_asset_usage
      (id, asset_key, asset_name, asset_type, relation, usage_kind, session_id, interaction_span_id,
       span_id, parent_span_id, occurred_at, status, asset_version, asset_fingerprint, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    for (let i = 0; i < 5000; i++) {
      stmt.run([
        `large-${i}`, 'provider-policy:large', 'large', 'provider-policy', 'used', 'provider-policy',
        'session-large', 'interaction-large', `span-large-${i}`, null, i, 'success', '1.0.0', 'fingerprint', largeMetadata,
      ])
    }
    stmt.free()

    await assetUsageStore.record(evidence('trigger-prune', 'provider-policy:trigger', 'span-trigger'))

    const result = await assetUsageStore.query({ sessionId: 'session-large', limit: 1 })
    expect(result.total).toBeGreaterThan(0)
    expect(result.total).toBeLessThan(5000)
  })
})
