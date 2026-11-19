import { describe, expect, it, vi } from 'vitest'
import { createCompanionAgentManifest, createCompanionCoreDomain, createMemoryDomain, createPersonaDomain, createWorkspaceDomain, loadCompanionAgentManifest } from '../../electron/main/agent-host/builtin-domains'
import { capabilityToTool } from '../../electron/main/agent-host/adapter'
import { getAgentHostDebugRecords, getAgentHostToolNames, getAgentHostTools, syncAgentHostSkills, registerAgentHostTools, resolveAgentHostModel } from '../../electron/main/agent-host/host'
import { AgentHostScopedToolCatalog } from '../../electron/main/agent-host/scoped-catalog'
import { ToolRegistry } from '../../electron/main/tools/registry'
import { createSkillActivationTool } from '../../electron/main/skills/registry'
import * as modelConfig from '../../electron/main/llm/aux-config'

describe('Agent Host 内置 Domain', () => {
  it('以通用 Manifest 工厂创建人物 Agent，不绑定单一角色', () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    expect(manifest.id).toBe('lin')
    expect(manifest.personaKey).toBe('role:lin')
    expect(manifest.domainKeys).toEqual(['persona', 'memory', 'companion', 'workspace'])
  })

  it('生产入口通过版本化 loader 装配 Manifest', () => {
    const manifest = loadCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    expect(manifest.version).toBe(1)
    expect(manifest.modelPolicyKey).toBe('main')
  })

  it('从各实例的模型策略使用对应的正式配置工厂', async () => {
    const main = vi.spyOn(modelConfig, 'loadMainLLMConfig').mockResolvedValue({ apiKey: '', baseUrl: '', model: 'main-fixture' })
    const auxiliary = vi.spyOn(modelConfig, 'loadAuxLLMConfig').mockResolvedValue({ apiKey: '', baseUrl: '', model: 'aux-fixture' })
    try {
      const first = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
      const second = createCompanionAgentManifest({ id: 'luffy', personaKey: 'role:luffy', modelPolicyKey: 'auxiliary' })
      expect((await resolveAgentHostModel(first.modelPolicyKey)).model).toBe('main-fixture')
      expect((await resolveAgentHostModel(second.modelPolicyKey)).model).toBe('aux-fixture')
    } finally {
      main.mockRestore()
      auxiliary.mockRestore()
    }
  })

  it('Persona 和 Memory 通过独立 Capability 接入，不复制 Tool 实现', () => {
    expect(createPersonaDomain().capabilities.map(item => item.key)).toEqual(['persona.read'])
    expect(createMemoryDomain().capabilities.map(item => item.key)).toEqual(['memory.profile.read'])
    expect(createWorkspaceDomain().capabilities.map(item => item.key)).toEqual(['workspace.root.read'])
  })

  it('Companion Domain 暴露运行态查询和 Context Provider', () => {
    const domain = createCompanionCoreDomain()
    expect(domain.key).toBe('companion')
    expect(domain.capabilities.map(item => item.key)).toEqual(['companion.runtime.read', 'companion.moment.publish', 'companion.diary.generate', 'companion.life.tick'])
    expect(domain.contextProviders.map(item => item.key)).toEqual(['companion.runtime-context'])
  })

  it('Capability Adapter 只把已授权能力转换为 Tool 协议', async () => {
    const capability = {
      ...createCompanionCoreDomain().capabilities[0],
      invoke: vi.fn(async () => ({ currentLocation: '甲板' })),
    }
    const tool = capabilityToTool(capability, { manifest: createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' }) })
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
      'capability_companion_diary_generate',
    ])
    expect(getAgentHostTools().find(tool => tool.name === 'companion_post_moment')?.description).toContain('朋友圈')
    expect(getAgentHostTools().find(tool => tool.name === 'capability_companion_diary_generate')?.description).toContain('日记')
  })

  it('Host 按当前 Agent Manifest 计算会话级 Tool 可见性', () => {
    const names = getAgentHostToolNames(createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' }))
    expect(names.has('capability_companion_runtime_read')).toBe(true)
    expect(names.has('capability_memory_profile_read')).toBe(true)
  })

  it('Scoped Tool Catalog 只返回当前 Manifest 授权的 Host Tool', () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    const catalog = new AgentHostScopedToolCatalog(manifest)
    const tools = [
      ...getAgentHostTools(),
      { name: 'unrelated_tool', description: '', parameters: { type: 'object' as const, properties: {} }, metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true }, execute: async () => 'ok' },
    ]
    const visible = catalog.filter(tools)
    expect(visible.some(tool => tool.name === 'unrelated_tool')).toBe(true)
    expect(visible.some(tool => tool.name === 'companion_post_moment')).toBe(true)
  })

  it('Scoped Tool Catalog 在 Host 授权后继续应用 Skill allowlist', () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin', skillKeys: ['demo'] })
    const catalog = new AgentHostScopedToolCatalog(manifest)
    const tools = [
      ...getAgentHostTools(),
      { name: 'skill_invoke_demo', description: '', parameters: { type: 'object' as const, properties: {} }, metadata: { isReadOnly: true, isDestructive: false, isConcurrencySafe: true }, execute: async () => 'ok' },
    ]
    const visible = catalog.filter(tools, ['capability_persona_read'])
    expect(visible.map(tool => tool.name)).toEqual(['capability_persona_read', 'skill_invoke_demo'])
  })

  it('独立 Manifest 的 Skill 和只读策略均作用于目录和实际调用', async () => {
    const registry = new ToolRegistry()
    const activation = createSkillActivationTool({ meta: { name: 'demo', description: '测试' }, body: '指南', filePath: 'demo.md', source: 'builtin' })
    const write = vi.fn(async () => 'stored')
    const writer = { name: 'write_probe', metadata: { isReadOnly: false, isDestructive: false, isConcurrencySafe: true }, parameters: { type: 'object' as const, properties: {} }, description: '', execute: write }
    registry.register(activation)
    registry.register(writer)
    const interactive = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin', skillKeys: ['demo'] })
    const unattended = createCompanionAgentManifest({ id: 'luffy', personaKey: 'role:luffy', permissionPolicyKey: 'unattended-readonly' })
    const context = { workdir: '.', sessionId: 'session', agentManifest: unattended }
    expect(new AgentHostScopedToolCatalog(interactive).filter(registry.getAll()).map(tool => tool.name)).toEqual(['skill_invoke_demo', 'write_probe'])
    expect(new AgentHostScopedToolCatalog(unattended).filter(registry.getAll())).toEqual([])
    await expect(activation.execute({}, context)).rejects.toThrow('未授权')
    const [blocked] = await registry.executeAll([{ id: 'call', name: writer.name, arguments: '{}' }], context)
    expect(blocked).toMatchObject({ isError: true, content: expect.stringContaining('只读') })
    expect(write).not.toHaveBeenCalled()
  })

  it('空授权 Manifest 不因人物默认配置而重新获得 Host 能力', () => {
    const manifest = { ...createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin', domainKeys: [], allowCapabilities: [] }), grantedPermissions: [] }
    expect(new AgentHostScopedToolCatalog(manifest).filter(getAgentHostTools())).toEqual([])
  })

  it('同一人物的 Domain、deny 与权限收紧分别作用于目录', () => {
    const base = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    const tools = getAgentHostTools()
    const denied = { ...base, capabilityPolicy: { allow: ['*'], deny: ['companion'] } }
    expect(new AgentHostScopedToolCatalog(denied).filter(tools).some(tool => tool.name === 'companion_post_moment')).toBe(false)
    expect(new AgentHostScopedToolCatalog({ ...base, grantedPermissions: [] }).filter(tools)).toEqual([])
    expect(new AgentHostScopedToolCatalog({ ...base, domainKeys: ['persona'] }).filter(tools).map(tool => tool.name)).toEqual(['capability_persona_read'])
  })

  it('全局注册的 Host 工具在实际执行时要求本次 Manifest，并拒绝撤权', async () => {
    const tool = getAgentHostTools().find(item => item.name === 'capability_persona_read')!
    const context = { workdir: '.', sessionId: 'session-1', roleId: 'lin' }
    await expect(tool.execute({}, context)).rejects.toThrow('执行环境')
    const manifest = { ...createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' }), grantedPermissions: [] }
    await expect(tool.execute({}, { ...context, agentManifest: manifest })).rejects.toThrow('permissions')
  })

  it('同名内置朋友圈工具不能绕过实际执行授权', async () => {
    const registry = new ToolRegistry()
    const original = vi.fn(async () => ({ content: 'unexpected' }))
    registry.register({ ...getAgentHostTools().find(item => item.name === 'companion_post_moment')!, execute: original })
    registerAgentHostTools(registry)
    const manifest = { ...createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' }), grantedPermissions: [] }
    await expect(registry.get('companion_post_moment')!.execute({}, { workdir: '.', sessionId: 'session', roleId: 'lin', agentManifest: manifest })).rejects.toThrow('permissions')
    expect(original).not.toHaveBeenCalled()
  })

  it('绑定适配器拒绝跨人物、跨 Agent 和自定义 Tool 名称的撤权执行', async () => {
    const manifest = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    const invoke = vi.fn(async () => 'ok')
    const capability = { ...createCompanionCoreDomain().capabilities[0], toolName: 'custom_world_reader', invoke }
    const tool = capabilityToTool(capability, { manifest })
    const context = { workdir: '.', sessionId: 'session', roleId: 'lin' }
    await expect(tool.execute({}, { ...context, roleId: 'other' })).rejects.toThrow('人物')
    await expect(tool.execute({}, { ...context, agentManifest: { ...manifest, id: 'other-agent' } })).rejects.toThrow('实例')
    await expect(tool.execute({}, { ...context, agentManifest: { ...manifest, capabilityPolicy: { allow: ['*'], deny: [capability.key] } } })).rejects.toThrow('unavailable')
    expect(invoke).not.toHaveBeenCalled()
    await expect(tool.execute({}, context)).resolves.toEqual({ content: 'ok' })
    expect(tool.name).toBe('custom_world_reader')
  })

  it('Host Debug 记录 Skill 的版本、指纹和 Capability 关系', () => {
    syncAgentHostSkills([{
      meta: { name: 'demo-skill', description: 'demo', version: '1.0.0', allowed_tools: ['capability_persona_read'] },
      body: '指南',
      filePath: 'demo.md',
      source: 'builtin',
    }])
    const record = getAgentHostDebugRecords('lin').find(item => item.key === 'agent-skill:demo-skill')
    expect(record?.status).toBe('available')
    expect(record?.details).toMatchObject({ version: '1.0.0', source: 'builtin', capabilityKeys: ['capability_persona_read'] })
  })

  it('内置领域工具（companion_* / remember / recall / forget / rag_search）同样受 Manifest domainKeys、deny 与 grantedPermissions 双重约束（B02）', async () => {
    const base = createCompanionAgentManifest({ id: 'lin', personaKey: 'role:lin' })
    const registry = new ToolRegistry()
    const createProbe = (name: string, isReadOnly = true) => ({
      name,
      description: name,
      parameters: { type: 'object' as const, properties: {} },
      metadata: { isReadOnly, isDestructive: false, isConcurrencySafe: isReadOnly },
      execute: vi.fn(async () => 'executed'),
    })
    const readWorld = createProbe('companion_read_world', true)
    const createAsset = createProbe('companion_create_asset', false)
    const remember = createProbe('remember', false)
    const ragSearch = createProbe('rag_search', true)
    registry.register(readWorld)
    registry.register(createAsset)
    registry.register(remember)
    registry.register(ragSearch)

    const noCompanionManifest = { ...base, domainKeys: ['persona', 'memory'] }
    const visibleNoCompanion = new AgentHostScopedToolCatalog(noCompanionManifest).filter(registry.getAll())
    expect(visibleNoCompanion.map(t => t.name)).toEqual(['remember'])

    const readOnlyMemoryManifest = {
      ...base,
      grantedPermissions: ['persona.read', 'memory.read', 'companion.read', 'workspace.read'],
    }
    const visibleReadOnly = new AgentHostScopedToolCatalog(readOnlyMemoryManifest).filter(registry.getAll())
    expect(visibleReadOnly.map(t => t.name)).toEqual(['companion_read_world', 'rag_search'])

    const [blockedCreate, blockedRemember, allowedRead] = await registry.executeAll(
      [
        { id: 'c1', name: 'companion_create_asset', arguments: '{}' },
        { id: 'c2', name: 'remember', arguments: '{}' },
        { id: 'c3', name: 'companion_read_world', arguments: '{}' },
      ],
      { workdir: '.', sessionId: 's1', agentManifest: readOnlyMemoryManifest },
    )
    expect(blockedCreate.isError).toBe(true)
    expect(blockedCreate.content).toContain('companion.write')
    expect(blockedRemember.isError).toBe(true)
    expect(blockedRemember.content).toContain('memory.write')
    expect(allowedRead.isError).toBeUndefined()
    expect(createAsset.execute).not.toHaveBeenCalled()
    expect(remember.execute).not.toHaveBeenCalled()
    expect(readWorld.execute).toHaveBeenCalledTimes(1)
  })
})
