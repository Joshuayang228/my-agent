import { AgentHostApplicationOrchestrator, AgentHostCapabilityRegistry, AgentHostDomainRegistry } from './domain-catalog'
import { createCompanionAgentManifest, createCompanionCoreDomain, createMemoryDomain, createPersonaDomain } from './builtin-domains'
import type { AgentHostExecutionContext } from '../../../src/shared/agent-host'

export const agentHostDomainRegistry = new AgentHostDomainRegistry()
export const agentHostCapabilityRegistry = new AgentHostCapabilityRegistry(agentHostDomainRegistry)
export const agentHostApplication = new AgentHostApplicationOrchestrator(agentHostCapabilityRegistry)

let initialized = false

/** 注册内置 Domain 一次，入口由主进程启动阶段调用。 */
export function initializeAgentHost(): void {
  if (initialized) return
  agentHostDomainRegistry.register(createPersonaDomain())
  agentHostDomainRegistry.register(createMemoryDomain())
  agentHostDomainRegistry.register(createCompanionCoreDomain())
  initialized = true
}

export async function getAgentHostContext(input: Omit<AgentHostExecutionContext, 'agentId'> & { roleId: string }): Promise<string[]> {
  initializeAgentHost()
  const manifest = createCompanionAgentManifest({ id: input.roleId, personaKey: `role:${input.roleId}` })
  const environment = agentHostApplication.createEnvironment(manifest)
  const blocks = await Promise.all(environment.contextProviders.map(async provider => provider.provide({ ...input, agentId: manifest.id })))
  return blocks.filter((block): block is string => Boolean(block?.trim()))
}
