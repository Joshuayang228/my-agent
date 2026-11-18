import { createHash } from 'node:crypto'
import { AgentHostApplicationOrchestrator, AgentHostCapabilityRegistry, AgentHostDomainRegistry } from './domain-catalog'
import { createCompanionCoreDomain, createMemoryDomain, createPersonaDomain, createWorkspaceDomain, loadCompanionAgentManifest } from './builtin-domains'
import type { AgentHostExecutionContext, AgentHostSkillMetadata, AgentHostManifest, AgentHostModelPolicy } from '../../../src/shared/agent-host'
import { capabilityToTool, getCapabilityToolName } from './adapter'
import type { SkillDefinition, ToolDefinition } from '../../../src/shared/types'
import type { ToolRegistry } from '../tools/registry'
import { getLoadedSkills, isSkillEnabled, toSkillToolName } from '../skills/registry'

export const agentHostDomainRegistry = new AgentHostDomainRegistry()
export const agentHostCapabilityRegistry = new AgentHostCapabilityRegistry(agentHostDomainRegistry)
export const agentHostApplication = new AgentHostApplicationOrchestrator(agentHostCapabilityRegistry)

let initialized = false
let registeredSkills: AgentHostSkillMetadata[] = []

type HostConversationPolicy = Pick<AgentHostManifest, 'modelPolicyKey' | 'permissionPolicyKey'>

export function getHostConversationPolicy(unattended: boolean): HostConversationPolicy {
  return { modelPolicyKey: 'main', permissionPolicyKey: unattended ? 'unattended-readonly' : 'companion-default' }
}

export function loadHostConversationManifest(roleId: string, policy: HostConversationPolicy): AgentHostManifest {
  const skillKeys = policy.permissionPolicyKey === 'unattended-readonly' ? []
    : getLoadedSkills().filter(skill => isSkillEnabled(skill.meta.name)).map(skill => skill.meta.name)
  return loadCompanionAgentManifest({ id: roleId, personaKey: `role:${roleId}`, ...policy, skillKeys })
}

export async function resolveAgentHostModel(policy: AgentHostModelPolicy) {
  const { loadMainLLMConfig, loadAuxLLMConfig } = await import('../llm/aux-config')
  return policy === 'auxiliary' ? loadAuxLLMConfig() : loadMainLLMConfig()
}

/** 注册内置 Domain 一次，入口由主进程启动阶段调用。 */
export function initializeAgentHost(): void {
  if (initialized) return
  agentHostDomainRegistry.register(createPersonaDomain())
  agentHostDomainRegistry.register(createMemoryDomain())
  agentHostDomainRegistry.register(createWorkspaceDomain())
  agentHostDomainRegistry.register(createCompanionCoreDomain())
  initialized = true
}

export async function getAgentHostContext(manifest: AgentHostManifest, input: Omit<AgentHostExecutionContext, 'agentId'> & { roleId: string; domainKeys?: readonly string[] }): Promise<string[]> {
  initializeAgentHost()
  const requestedDomains = input.domainKeys
  const domainKeys = requestedDomains ? manifest.domainKeys.filter(key => requestedDomains.includes(key)) : manifest.domainKeys
  const environment = agentHostApplication.createEnvironment({ ...manifest, domainKeys })
  const blocks = await Promise.all(environment.contextProviders.map(provider => agentHostApplication.provideContext(environment, provider.key, { ...input, agentId: manifest.id })))
  return blocks.filter((block): block is string => Boolean(block?.trim()))
}

export function getAgentHostTools(): ToolDefinition[] {
  initializeAgentHost()
  return agentHostCapabilityRegistry.getRegisteredCapabilities().filter(capability => capability.exposeToTool !== false).map(capability => capabilityToTool(capability, {
    onActivated: (capabilityKey, context) => agentHostCapabilityRegistry.markActivated(capabilityKey, context.agentId),
  }))
}

/**
 * 背景：相同人物可具有不同权限组合，仅使用 roleId 会重建宽权限默认值。
 * 设计意图：目录消费调用方的完整 Manifest，统一名称由协议适配器生成。
 * 关键约束：缺少 requiredPermissions 的能力不对模型可见，执行时仍需再次授权。
 */
export function getAgentHostToolNames(manifest: AgentHostManifest): ReadonlySet<string> {
  initializeAgentHost()
  const environment = agentHostApplication.createEnvironment(manifest)
  return new Set(environment.capabilities.filter(capability => capability.exposeToTool !== false
    && capability.requiredPermissions.every(permission => manifest.grantedPermissions.includes(permission))).map(getCapabilityToolName))
}

export function getRegisteredAgentHostToolNames(): ReadonlySet<string> {
  initializeAgentHost()
  return new Set(agentHostCapabilityRegistry.getRegisteredCapabilities().map(getCapabilityToolName))
}

export interface AgentHostDebugRecord {
  key: string
  kind: 'manifest' | 'capability' | 'skill'
  status: 'registered' | 'available' | 'activated'
  domainKey?: string
  details: Record<string, unknown>
}

export function getAgentHostDebugRecords(roleId: string): AgentHostDebugRecord[] {
  initializeAgentHost()
  const manifest = { ...loadCompanionAgentManifest({ id: roleId, personaKey: `role:${roleId}` }), skillKeys: registeredSkills.map(skill => skill.key) }
  const environment = agentHostApplication.createEnvironment(manifest)
  const records: AgentHostDebugRecord[] = [{
    key: `agent-manifest:${manifest.id}`,
    kind: 'manifest',
    status: 'registered',
    details: { version: manifest.version, domains: manifest.domainKeys, allow: manifest.capabilityPolicy.allow, deny: manifest.capabilityPolicy.deny, grantedPermissions: manifest.grantedPermissions },
  }]
  const available = new Set(environment.capabilities.map(capability => capability.key))
  for (const capability of agentHostCapabilityRegistry.getRegisteredCapabilities()) {
    const activated = agentHostCapabilityRegistry.hasBeenActivated(capability.key, roleId)
    records.push({
      key: `agent-capability:${capability.key}`,
      kind: 'capability',
      status: activated ? 'activated' : available.has(capability.key) ? 'available' : 'registered',
      domainKey: capability.domainKey,
      details: { capabilityKey: capability.key, capabilityKind: capability.kind, requiredPermissions: capability.requiredPermissions },
    })
  }
  for (const skill of registeredSkills) {
    records.push({
      key: `agent-skill:${skill.key}`,
      kind: 'skill',
      status: skill.enabled ? 'available' : 'registered',
      details: {
        skillKey: skill.key,
        version: skill.version,
        fingerprint: skill.fingerprint,
        source: skill.source,
        allowedTools: skill.allowedTools,
        capabilityKeys: skill.capabilityKeys,
        activationTool: toSkillToolName(skill.key),
      },
    })
  }
  return records
}

export function registerAgentHostTools(toolRegistry: ToolRegistry): void {
  for (const tool of getAgentHostTools()) {
    // 朋友圈同时是内置 Tool，必须替换为宿主授权适配器，否则已有名称会跳过真实执行门禁。
    toolRegistry.unregister(tool.name)
    toolRegistry.register(tool)
  }
}

export function syncAgentHostSkills(skills: readonly SkillDefinition[]): void {
  const seen = new Set<string>()
  registeredSkills = skills.flatMap(skill => {
    const key = skill.meta.name.trim()
    if (!key || seen.has(key)) return []
    seen.add(key)
    const allowedTools = skill.meta.allowed_tools ?? []
    return [{
      key,
      version: skill.meta.version ?? 'unversioned',
      fingerprint: createHash('sha256').update(skill.body).digest('hex').slice(0, 16),
      source: skill.source,
      enabled: isSkillEnabled(skill.meta.name),
      allowedTools,
      capabilityKeys: allowedTools.filter(toolName => toolName.startsWith('capability_') || toolName === 'companion_post_moment'),
    }]
  })
}

export async function runCompanionLifeTickWorkflow(now: number, context: { roleId: string; universeId: string; traceId: string; signal: AbortSignal }): Promise<unknown> {
  initializeAgentHost()
  const manifest = loadCompanionAgentManifest({ id: 'scheduler', personaKey: 'scheduler' })
  const environment = agentHostApplication.createEnvironment(manifest)
  return agentHostApplication.runWorkflow(environment, 'companion.life.tick', { now, universeId: context.universeId }, {
    agentId: 'scheduler',
    roleId: context.roleId,
    traceId: context.traceId,
    signal: context.signal,
  })
}
