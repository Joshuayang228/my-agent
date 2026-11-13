import type {
  AgentHostCapability,
  AgentHostContextProvider,
  AgentHostDomainDefinition,
  AgentHostExecutionEnvironment,
  AgentHostExecutionContext,
  AgentHostManifest,
} from '../../../src/shared/agent-host'

export class AgentHostDomainRegistry {
  private readonly definitions = new Map<string, AgentHostDomainDefinition>()

  register(definition: AgentHostDomainDefinition): void {
    if (this.definitions.has(definition.key)) throw new Error(`Domain "${definition.key}" is already registered`)
    if (!definition.key.trim() || definition.version < 1) throw new Error('Domain definition is invalid')
    const capabilityKeys = new Set<string>()
    for (const capability of definition.capabilities) {
      if (capability.domainKey !== definition.key) throw new Error(`Capability "${capability.key}" belongs to another domain`)
      if (capabilityKeys.has(capability.key)) throw new Error(`Capability "${capability.key}" is duplicated`)
      capabilityKeys.add(capability.key)
    }
    this.definitions.set(definition.key, definition)
  }

  get(key: string): AgentHostDomainDefinition | undefined {
    return this.definitions.get(key)
  }

  getAll(): readonly AgentHostDomainDefinition[] {
    return [...this.definitions.values()]
  }
}

export class AgentHostCapabilityRegistry {
  private readonly activated = new Set<string>()
  constructor(private readonly domains: AgentHostDomainRegistry) {}

  getRegisteredCapabilities(): readonly AgentHostCapability[] {
    return this.domains.getAll().flatMap(domain => domain.capabilities)
  }

  getAvailableCapabilities(manifest: AgentHostManifest): readonly AgentHostCapability[] {
    const allowedDomains = new Set(manifest.domainKeys)
    const allowed = new Set(manifest.capabilityPolicy.allow)
    const denied = new Set(manifest.capabilityPolicy.deny)
    return this.getRegisteredCapabilities().filter(capability => {
      if (!allowedDomains.has(capability.domainKey)) return false
      if (denied.has(capability.key) || denied.has(capability.domainKey)) return false
      return allowed.has('*') || allowed.has(capability.key) || allowed.has(capability.domainKey)
    })
  }

  getAvailableContextProviders(manifest: AgentHostManifest): readonly AgentHostContextProvider[] {
    const allowedDomains = new Set(manifest.domainKeys)
    const allowed = new Set(manifest.capabilityPolicy.allow)
    const denied = new Set(manifest.capabilityPolicy.deny)
    const seenSources = new Set<string>()
    return this.domains.getAll()
      .filter(domain => allowedDomains.has(domain.key))
      .flatMap(domain => domain.contextProviders)
      .filter(provider => {
        if (denied.has(provider.key) || denied.has(provider.domainKey)) return false
        return allowed.has('*') || allowed.has(provider.key) || allowed.has(provider.domainKey)
      })
      .sort((left, right) => right.priority - left.priority)
      .filter(provider => {
        const sourceKey = `${provider.scope}:${provider.source}`
        if (seenSources.has(sourceKey)) return false
        seenSources.add(sourceKey)
        return true
      })
  }

  markActivated(key: string, agentId = 'agent-host'): void {
    this.activated.add(`${agentId}:${key}`)
  }

  hasBeenActivated(key: string, agentId = 'agent-host'): boolean {
    return this.activated.has(`${agentId}:${key}`)
  }

  getActivatedKeys(agentId?: string): readonly string[] {
    const prefix = agentId ? `${agentId}:` : ''
    return [...this.activated]
      .filter(item => !prefix || item.startsWith(prefix))
      .map(item => prefix ? item.slice(prefix.length) : item)
  }
}

export class AgentHostApplicationOrchestrator {
  constructor(private readonly capabilities: AgentHostCapabilityRegistry) {}

  createEnvironment(manifest: AgentHostManifest): AgentHostExecutionEnvironment {
    return {
      manifest,
      capabilities: this.capabilities.getAvailableCapabilities(manifest),
      contextProviders: this.capabilities.getAvailableContextProviders(manifest),
    }
  }

  async invokeCapability(
    environment: AgentHostExecutionEnvironment,
    capabilityKey: string,
    input: unknown,
    context: AgentHostExecutionContext,
  ): Promise<unknown> {
    const capability = environment.capabilities.find(item => item.key === capabilityKey)
    if (!capability) throw new Error(`Capability "${capabilityKey}" is unavailable for agent "${environment.manifest.id}"`)
    if (context.agentId !== environment.manifest.id) throw new Error('Agent execution context does not match manifest')
    this.capabilities.markActivated(capability.key, context.agentId)
    return capability.invoke(input, context)
  }

  async runWorkflow(
    environment: AgentHostExecutionEnvironment,
    workflowKey: string,
    input: unknown,
    context: AgentHostExecutionContext,
  ): Promise<unknown> {
    const workflow = environment.capabilities.find(item => item.key === workflowKey && item.kind === 'workflow')
    if (!workflow) throw new Error(`Workflow "${workflowKey}" is unavailable for agent "${environment.manifest.id}"`)
    if (context.agentId !== environment.manifest.id) throw new Error('Agent execution context does not match manifest')
    this.capabilities.markActivated(workflow.key, context.agentId)
    return workflow.invoke(input, context)
  }
}
