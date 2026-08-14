import { describe, expect, it, vi } from 'vitest'
import {
  PROFILE_EXTRACTION_CATEGORIES,
  PROFILE_EXTRACTION_MAX_RECENT_MESSAGES,
  PROFILE_EXTRACTION_MIN_USER_MESSAGES,
} from '../../electron/main/agent/profile-extractor'
import { MEMORY_SEMANTIC_DEDUP_THRESHOLD } from '../../electron/main/storage/memory-store'

vi.mock('electron', () => ({
  app: { getPath: () => 'C:/tmp/my-agent-test' },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}))

const { getMemoryStrategyAssetCatalog } = await import('../../electron/main/memory/strategy-registry')

describe('记忆策略生产资产目录', () => {
  it('登记稳定 key、来源、依赖和指纹，不读取用户记忆正文', () => {
    const assets = getMemoryStrategyAssetCatalog()
    const keys = assets.map((asset) => asset.key)

    expect(keys).toEqual([
      'memory-strategy:profile-extraction',
      'memory-strategy:semantic-deduplication',
      'memory-strategy:feedback-bucket',
      'memory-strategy:vector-recall',
      'memory-strategy:vector-lifecycle',
      'memory-strategy:citation-correction',
    ])
    expect(new Set(keys).size).toBe(keys.length)
    for (const asset of assets) {
      expect(asset.category).toBe('memory')
      expect(asset.assetType).toBe('memory-strategy')
      expect(asset.ownership).toBe('builtin')
      expect(asset.status).toBe('active')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(asset.content).not.toContain('用户最近换工作')
    }
  })

  it('策略参数来自记忆生产模块事实源', () => {
    const assets = getMemoryStrategyAssetCatalog()
    const extraction = JSON.parse(assets.find((asset) => asset.key === 'memory-strategy:profile-extraction')!.content!) as Record<string, unknown>
    const dedupe = JSON.parse(assets.find((asset) => asset.key === 'memory-strategy:semantic-deduplication')!.content!) as Record<string, unknown>

    expect(extraction.minUserMessages).toBe(PROFILE_EXTRACTION_MIN_USER_MESSAGES)
    expect(extraction.maxRecentMessages).toBe(PROFILE_EXTRACTION_MAX_RECENT_MESSAGES)
    expect(extraction.validCategories).toEqual([...PROFILE_EXTRACTION_CATEGORIES])
    expect(dedupe.similarityThreshold).toBe(MEMORY_SEMANTIC_DEDUP_THRESHOLD)
  })

  it('统一生产目录包含记忆策略但不混入记忆正文', async () => {
    const { buildModelContextAssets } = await import('../../electron/main/debug/model-context-assets')
    const assets = buildModelContextAssets({ promptAssets: [], tools: [], skills: [], systemPrompt: '' })
    const recall = assets.find((asset) => asset.key === 'memory-strategy:vector-recall')

    expect(recall).toMatchObject({ category: 'memory', assetType: 'memory-strategy' })
    expect(recall?.dependencies).toEqual(['memory-recall-context', 'embedding-input'])
    expect(assets.some((asset) => asset.content?.includes('用户最近换工作'))).toBe(false)
  })
})
