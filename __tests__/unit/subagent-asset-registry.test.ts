import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import {
  AGENT_ROLES,
  getSubAgentRoleAsset,
  getSubAgentRoleAssetCatalog,
  getSubAgentRoleIds,
} from '../../electron/main/agent/subagent-asset-registry'

describe('SubAgent 角色资产注册表', () => {
  it('登记三个内置角色并保持 stable key', () => {
    const assets = getSubAgentRoleAssetCatalog()
    expect(getSubAgentRoleIds()).toEqual(['researcher', 'coder', 'analyst'])
    expect(assets.map((asset) => asset.key)).toEqual([
      'subagent-role:researcher',
      'subagent-role:coder',
      'subagent-role:analyst',
    ])
    expect(new Set(assets.map((asset) => asset.key)).size).toBe(assets.length)
    for (const asset of assets) {
      expect(asset.assetType).toBe('subagent-role')
      expect(asset.content).toContain('systemPromptAddon')
      expect(asset.fingerprint).toMatch(/^[a-f0-9]{16}$/)
      expect(existsSync(asset.sourcePath)).toBe(true)
      expect(asset.dependencies?.length).toBeGreaterThan(0)
    }
  })

  it('执行器与注册表消费同一角色定义，不把自由字符串伪造为资产', () => {
    expect(getSubAgentRoleAsset('researcher')?.role).toBe('researcher')
    expect(getSubAgentRoleAsset('coder')?.role).toBe('coder')
    expect(getSubAgentRoleAsset('custom role')).toBeUndefined()
    expect(AGENT_ROLES.researcher.defaultReadOnly).toBe(true)
    expect(AGENT_ROLES.coder.defaultReadOnly).toBe(false)
  })
})
