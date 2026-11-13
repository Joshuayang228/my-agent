import { describe, expect, it } from 'vitest'
import { createCompanionAgentManifest, createCompanionCoreDomain } from '../../electron/main/agent-host/builtin-domains'

describe('Agent Host 内置 Domain', () => {
  it('以通用 Manifest 工厂创建人物 Agent，不绑定单一角色', () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    expect(manifest.id).toBe('lin')
    expect(manifest.personaKey).toBe('role:lin')
    expect(manifest.domainKeys).toEqual(['companion'])
  })

  it('Companion Domain 暴露运行态查询和 Context Provider', () => {
    const domain = createCompanionCoreDomain()
    expect(domain.key).toBe('companion')
    expect(domain.capabilities.map(item => item.key)).toEqual(['companion.runtime.read'])
    expect(domain.contextProviders.map(item => item.key)).toEqual(['companion.runtime-context'])
  })
})
