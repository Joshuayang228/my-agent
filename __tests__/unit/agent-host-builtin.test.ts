import { describe, expect, it, vi } from 'vitest'
import { createCompanionAgentManifest, createCompanionCoreDomain } from '../../electron/main/agent-host/builtin-domains'
import { capabilityToTool } from '../../electron/main/agent-host/adapter'

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

  it('Capability Adapter 只把已授权能力转换为 Tool 协议', async () => {
    const capability = {
      ...createCompanionCoreDomain().capabilities[0],
      invoke: vi.fn(async () => ({ currentLocation: '甲板' })),
    }
    const tool = capabilityToTool(capability, { agentId: 'lin', roleId: 'lin' })
    expect(tool.name).toBe('capability_companion_runtime_read')
    expect(tool.metadata.isReadOnly).toBe(true)
    await expect(tool.execute({}, { workdir: '.', sessionId: 'session-1', roleId: 'lin' })).resolves.toMatchObject({ content: expect.stringContaining('甲板') })
  })
})
