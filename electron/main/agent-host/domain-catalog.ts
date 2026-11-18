import type {
  AgentHostCapability,
  AgentHostContextProvider,
  AgentHostDomainDefinition,
  AgentHostExecutionEnvironment,
  AgentHostExecutionContext,
  AgentHostManifest,
} from '../../../src/shared/agent-host'

/**
 * 背景：目录与执行曾分别创建默认授权，收紧策略因此失效。
 * 设计意图：同一纯判定复用于完整 Manifest 的发现与实际调用。
 * 关键约束：deny 优先，Domain 必须显式拥有；所需权限由执行边界再次检查。
 */
export function isCapabilityInManifest(manifest: AgentHostManifest, capability: AgentHostCapability): boolean {
  const { allow, deny } = manifest.capabilityPolicy
  return manifest.domainKeys.includes(capability.domainKey)
    && !deny.includes(capability.key) && !deny.includes(capability.domainKey)
    && (allow.includes('*') || allow.includes(capability.key) || allow.includes(capability.domainKey))
}

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
    return this.getRegisteredCapabilities().filter(capability => isCapabilityInManifest(manifest, capability))
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
        if (provider.requires.some(permission => !manifest.grantedPermissions.includes(permission))) return false
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
    this.assertExecutionContext(environment.manifest, context)
    this.assertPermissions(environment.manifest.grantedPermissions, capability.requiredPermissions, capability.key)
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
    this.assertExecutionContext(environment.manifest, context)
    this.assertPermissions(environment.manifest.grantedPermissions, workflow.requiredPermissions, workflow.key)
    this.capabilities.markActivated(workflow.key, context.agentId)
    return workflow.invoke(input, context)
  }

  /**
   * 通过 Host 权限边界提供动态上下文。
   *
   * 背景：Context Provider 会把领域数据送入 Prompt，若只在环境创建时筛选而直接调用 provider，权限策略就会出现旁路。
   * 设计意图：让上下文读取和 Capability、Workflow 共享 Agent 身份与 required permissions 校验，放弃调用方直接持有 provider 实现。
   * 关键约束：provider 必须属于当前环境，context.agentId 必须匹配 Manifest，缺权限时不得执行 provider。
   */
  async provideContext(
    environment: AgentHostExecutionEnvironment,
    providerKey: string,
    context: AgentHostExecutionContext,
  ): Promise<string | null> {
    const provider = environment.contextProviders.find(item => item.key === providerKey)
    if (!provider) throw new Error(`Context provider "${providerKey}" is unavailable for agent "${environment.manifest.id}"`)
    this.assertExecutionContext(environment.manifest, context)
    this.assertPermissions(environment.manifest.grantedPermissions, provider.requires, provider.key)
    return provider.provide(context)
  }

  private assertExecutionContext(manifest: AgentHostManifest, context: AgentHostExecutionContext): void {
    if (context.agentId !== manifest.id) throw new Error('Agent execution context does not match manifest')
    if (context.roleId && manifest.personaKey.startsWith('role:') && manifest.personaKey !== `role:${context.roleId}`) {
      throw new Error('Agent execution role does not match manifest')
    }
    context.signal?.throwIfAborted()
    if (context.deadlineAt !== undefined && context.deadlineAt <= Date.now()) throw new Error('Agent 执行期限已到。')
  }

  private assertPermissions(granted: readonly string[], required: readonly string[], capabilityKey: string): void {
    const allowed = new Set(granted)
    const missing = required.filter(permission => !allowed.has(permission))
    if (missing.length > 0) throw new Error(`Capability "${capabilityKey}" lacks required permissions: ${missing.join(', ')}`)
  }
}
