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
})
