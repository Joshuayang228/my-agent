import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEBUG_ASSET_FIXTURES, DEBUG_RECORD_FIXTURES } from '../../src/components/playground/debug-experience-fixtures'

describe('Debug 候选隔离边界', () => {
  it('样张身份不冒充生产资产，关联不悬空', () => {
    const keys = new Set(DEBUG_ASSET_FIXTURES.map(asset => asset.key))
    expect(keys.size).toBe(DEBUG_ASSET_FIXTURES.length)
    for (const asset of DEBUG_ASSET_FIXTURES) {
      expect(asset.key).toMatch(/^demo\./)
      expect(asset.fingerprint).toMatch(/^demo:/)
      expect(asset).not.toHaveProperty('text')
    }
    for (const record of DEBUG_RECORD_FIXTURES) {
      expect(record.id).toMatch(/^demo-/)
      expect(record.sessionId).toMatch(/^demo-/)
      for (const key of record.assetKeys) expect(keys.has(key)).toBe(true)
      expect(record).not.toHaveProperty('messages')
    }
  })

  it('候选与样张不访问生产桥接、模型或持久化', () => {
    for (const path of ['DebugExperienceCandidate.tsx', 'debug-experience-fixtures.ts']) {
      const code = readFileSync(`src/components/playground/${path}`, 'utf8')
      expect(code).not.toMatch(/window\.electronAPI|localStorage|fetch\s*\(|streamChat\s*\(|chatComplete\s*\(/)
      expect(code).not.toMatch(/from\s+['"][^'"]*(?:electron\/main|\/prompts\/|\/llm\/)/)
    }
  })
})
