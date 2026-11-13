import { describe, expect, it, vi } from 'vitest'
import { createCompanionAgentManifest, createCompanionCoreDomain, createMemoryDomain, createPersonaDomain, createWorkspaceDomain } from '../../electron/main/agent-host/builtin-domains'
import { capabilityToTool } from '../../electron/main/agent-host/adapter'
import { getAgentHostToolNamesForRole, getAgentHostTools } from '../../electron/main/agent-host/host'

describe('Agent Host 内置 Domain', () => {
  it('以通用 Manifest 工厂创建人物 Agent，不绑定单一角色', () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    expect(manifest.id).toBe('lin')
    expect(manifest.personaKey).toBe('role:lin')
    expect(manifest.domainKeys).toEqual(['persona', 'memory', 'companion', 'workspace'])
  })

  it('Persona 和 Memory 通过独立 Capability 接入，不复制 Tool 实现', () => {
    expect(createPersonaDomain().capabilities.map(item => item.key)).toEqual(['persona.read'])
    expect(createMemoryDomain().capabilities.map(item => item.key)).toEqual(['memory.profile.read'])
    expect(createWorkspaceDomain().capabilities.map(item => item.key)).toEqual(['workspace.root.read'])
  })

  it('Companion Domain 暴露运行态查询和 Context Provider', () => {
    const domain = createCompanionCoreDomain()
    expect(domain.key).toBe('companion')
    expect(domain.capabilities.map(item => item.key)).toEqual(['companion.runtime.read', 'companion.moment.publish'])
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

  it('Host 将首批查询 Capability 转成稳定的 capability Tool 名称', () => {
    expect(getAgentHostTools().map(tool => tool.name)).toEqual([
      'capability_persona_read',
      'capability_memory_profile_read',
      'capability_workspace_root_read',
      'capability_companion_runtime_read',
      'companion_post_moment',
    ])
    expect(getAgentHostTools().find(tool => tool.name === 'companion_post_moment')?.description).toContain('朋友圈')
  })

  it('Host 按当前 Agent Manifest 计算会话级 Tool 可见性', () => {
    const names = getAgentHostToolNamesForRole('lin')
    expect(names.has('capability_companion_runtime_read')).toBe(true)
    expect(names.has('capability_memory_profile_read')).toBe(true)
  })
})
