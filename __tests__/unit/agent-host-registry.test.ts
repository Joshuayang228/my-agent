import { describe, expect, it, vi } from 'vitest'
import { AgentHostApplicationOrchestrator, AgentHostCapabilityRegistry, AgentHostDomainRegistry } from '../../electron/main/agent-host/domain-catalog'

function createDomain() {
  return {
    key: 'memory',
    version: 1,
    dependencies: [],
    capabilities: [
      {
        key: 'memory.search',
        domainKey: 'memory',
        kind: 'query' as const,
        description: '检索长期记忆',
        requiredPermissions: ['memory.read'],
        invoke: vi.fn(async input => ({ input })),
      },
    ],
    contextProviders: [{
      key: 'memory.recall-context',
      domainKey: 'memory',
      source: 'memory.recall',
      scope: 'turn' as const,
      priority: 20,
      maxChars: 2_000,
      requires: ['memory.read'],
      provide: vi.fn(async () => 'memory context'),
    }],
  }
}

const manifest = {
  id: 'luffy',
  version: 1,
  personaKey: 'role:luffy',
  domainKeys: ['memory'],
  capabilityPolicy: { allow: ['memory'], deny: [] },
  skillKeys: [],
  modelPolicyKey: 'main',
  permissionPolicyKey: 'companion-default',
  grantedPermissions: ['memory.read', 'companion.write'],
}

describe('Agent Host Registry', () => {
  it('按 Agent Manifest 暴露 Domain Capability 和 Context Provider', () => {
    const domains = new AgentHostDomainRegistry()
    domains.register(createDomain())
    const registry = new AgentHostCapabilityRegistry(domains)
    const environment = new AgentHostApplicationOrchestrator(registry).createEnvironment(manifest)

    expect(environment.capabilities.map(item => item.key)).toEqual(['memory.search'])
    expect(environment.contextProviders.map(item => item.key)).toEqual(['memory.recall-context'])
  })

  it('拒绝未授权能力、跨 Agent 执行上下文和重复注册', async () => {
    const domains = new AgentHostDomainRegistry()
    domains.register(createDomain())
    expect(() => domains.register(createDomain())).toThrow('already registered')
    const registry = new AgentHostCapabilityRegistry(domains)
    const orchestrator = new AgentHostApplicationOrchestrator(registry)
    const environment = orchestrator.createEnvironment({ ...manifest, capabilityPolicy: { allow: [], deny: [] } })

    await expect(orchestrator.invokeCapability(environment, 'memory.search', {}, { agentId: 'luffy', traceId: 't1' })).rejects.toThrow('unavailable')
    const allowedEnvironment = orchestrator.createEnvironment(manifest)
    await expect(orchestrator.invokeCapability(allowedEnvironment, 'memory.search', {}, { agentId: 'zoro', traceId: 't2' })).rejects.toThrow('does not match')
  })

  it('固定 Workflow 只能由 Application 直接编排', async () => {
    const domains = new AgentHostDomainRegistry()
    domains.register({
      key: 'diary',
      version: 1,
      dependencies: [],
      capabilities: [{
        key: 'diary.generate',
        domainKey: 'diary',
        kind: 'workflow',
        description: '生成日记',
        parameters: { type: 'object', properties: {} },
        requiredPermissions: ['companion.write'],
        invoke: async () => ({ created: true }),
      }],
      contextProviders: [],
    })
    const registry = new AgentHostCapabilityRegistry(domains)
    const orchestrator = new AgentHostApplicationOrchestrator(registry)
    const environment = orchestrator.createEnvironment({ ...manifest, domainKeys: ['diary'], capabilityPolicy: { allow: ['diary'], deny: [] } })
    await expect(orchestrator.runWorkflow(environment, 'diary.generate', {}, { agentId: 'luffy', traceId: 'workflow-1' })).resolves.toEqual({ created: true })
    await expect(orchestrator.runWorkflow(environment, 'diary.missing', {}, { agentId: 'luffy', traceId: 'workflow-2' })).rejects.toThrow('unavailable')
  })

  it('记录真实 Capability 激活状态，供 Debug 读取', async () => {
    const domains = new AgentHostDomainRegistry()
    domains.register(createDomain())
    const registry = new AgentHostCapabilityRegistry(domains)
    const orchestrator = new AgentHostApplicationOrchestrator(registry)
    const environment = orchestrator.createEnvironment(manifest)
    expect(registry.hasBeenActivated('memory.search')).toBe(false)
    await orchestrator.invokeCapability(environment, 'memory.search', { query: '海' }, { agentId: 'luffy', traceId: 'activation-1' })
    expect(registry.hasBeenActivated('memory.search', 'luffy')).toBe(true)
    expect(registry.hasBeenActivated('memory.search', 'lin')).toBe(false)
  })

  it('固定 Capability 入口拒绝缺失 requiredPermissions 的 Agent', async () => {
    const domains = new AgentHostDomainRegistry()
    domains.register(createDomain())
    const registry = new AgentHostCapabilityRegistry(domains)
    const orchestrator = new AgentHostApplicationOrchestrator(registry)
    const environment = orchestrator.createEnvironment({ ...manifest, grantedPermissions: [] })
    await expect(orchestrator.invokeCapability(environment, 'memory.search', {}, { agentId: 'luffy', traceId: 'permission-1' })).rejects.toThrow('lacks required permissions')
  })

  it('同一 scope 和 source 的 Context Provider 只保留优先级最高的一份', () => {
    const domains = new AgentHostDomainRegistry()
    const provider = {
      key: 'memory.duplicate-context',
      domainKey: 'memory',
      source: 'memory.recall',
      scope: 'turn' as const,
      priority: 30,
      maxChars: 500,
      requires: [],
      provide: async () => 'duplicate',
    }
    domains.register({ ...createDomain(), contextProviders: [...createDomain().contextProviders, provider] })
    const registry = new AgentHostCapabilityRegistry(domains)
    expect(registry.getAvailableContextProviders(manifest).map(item => item.key)).toEqual(['memory.duplicate-context'])
  })
})
