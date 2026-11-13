import { AgentHostApplicationOrchestrator, AgentHostCapabilityRegistry, AgentHostDomainRegistry } from './domain-catalog'
import { createCompanionCoreDomain } from './builtin-domains'

export const agentHostDomainRegistry = new AgentHostDomainRegistry()
export const agentHostCapabilityRegistry = new AgentHostCapabilityRegistry(agentHostDomainRegistry)
export const agentHostApplication = new AgentHostApplicationOrchestrator(agentHostCapabilityRegistry)

let initialized = false

/** 注册内置 Domain 一次，入口由主进程启动阶段调用。 */
export function initializeAgentHost(): void {
  if (initialized) return
  agentHostDomainRegistry.register(createCompanionCoreDomain())
  initialized = true
}
