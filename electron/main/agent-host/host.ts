import { createHash } from 'node:crypto'
import { AgentHostApplicationOrchestrator, AgentHostCapabilityRegistry, AgentHostDomainRegistry } from './domain-catalog'
import { createCompanionCoreDomain, createMemoryDomain, createPersonaDomain, createWorkspaceDomain, loadCompanionAgentManifest } from './builtin-domains'
import type { AgentHostExecutionContext, AgentHostSkillMetadata } from '../../../src/shared/agent-host'
import { capabilityToTool } from './adapter'
import type { SkillDefinition, ToolDefinition } from '../../../src/shared/types'
import type { ToolRegistry } from '../tools/registry'
import { isSkillEnabled } from '../skills/registry'

export const agentHostDomainRegistry = new AgentHostDomainRegistry()
export const agentHostCapabilityRegistry = new AgentHostCapabilityRegistry(agentHostDomainRegistry)
export const agentHostApplication = new AgentHostApplicationOrchestrator(agentHostCapabilityRegistry)

let initialized = false
let registeredSkills: AgentHostSkillMetadata[] = []

/** 注册内置 Domain 一次，入口由主进程启动阶段调用。 */
export function initializeAgentHost(): void {
  if (initialized) return
  agentHostDomainRegistry.register(createPersonaDomain())
  agentHostDomainRegistry.register(createMemoryDomain())
  agentHostDomainRegistry.register(createWorkspaceDomain())
  agentHostDomainRegistry.register(createCompanionCoreDomain())
  initialized = true
}

export async function getAgentHostContext(input: Omit<AgentHostExecutionContext, 'agentId'> & { roleId: string; domainKeys?: readonly string[] }): Promise<string[]> {
  initializeAgentHost()
  const manifest = loadCompanionAgentManifest({ id: input.roleId, personaKey: `role:${input.roleId}`, domainKeys: input.domainKeys })
  const environment = agentHostApplication.createEnvironment(manifest)
  const blocks = await Promise.all(environment.contextProviders.map(async provider => provider.provide({ ...input, agentId: manifest.id })))
  return blocks.filter((block): block is string => Boolean(block?.trim()))
}

export function getAgentHostTools(): ToolDefinition[] {
  initializeAgentHost()
  const manifest = loadCompanionAgentManifest({ id: 'agent-host', personaKey: 'agent-host' })
  const environment = agentHostApplication.createEnvironment(manifest)
  return environment.capabilities.filter(capability => capability.exposeToTool !== false).map(capability => capabilityToTool(capability, {
    agentId: manifest.id,
    onActivated: (capabilityKey, context) => agentHostCapabilityRegistry.markActivated(capabilityKey, context.roleId ?? context.agentId),
  }))
}

export function getAgentHostToolNamesForRole(roleId: string): ReadonlySet<string> {
  initializeAgentHost()
  const manifest = loadCompanionAgentManifest({ id: roleId, personaKey: `role:${roleId}` })
  const environment = agentHostApplication.createEnvironment(manifest)
  return new Set(environment.capabilities.filter(capability => capability.exposeToTool !== false).map(capability => capabilityToTool(capability, { agentId: 'agent-host' }).name))
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
    details: { version: manifest.version, domains: manifest.domainKeys, allow: manifest.capabilityPolicy.allow, deny: manifest.capabilityPolicy.deny },
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
        activationTool: `skill_invoke_${skill.key.replace(/[^a-z0-9]/g, '_')}`,
      },
    })
  }
  return records
}

export function registerAgentHostTools(toolRegistry: ToolRegistry): void {
  for (const tool of getAgentHostTools()) {
    if (!toolRegistry.has(tool.name)) toolRegistry.register(tool)
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

export async function runCompanionLifeTickWorkflow(now: number): Promise<unknown> {
  initializeAgentHost()
  const manifest = loadCompanionAgentManifest({ id: 'scheduler', personaKey: 'scheduler' })
  const environment = agentHostApplication.createEnvironment(manifest)
  return agentHostApplication.runWorkflow(environment, 'companion.life.tick', {}, {
    agentId: 'scheduler',
    traceId: `companion-life-tick:${now}`,
  })
}
