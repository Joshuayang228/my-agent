/** Agent Host 的共享契约。业务实现位于主进程，Renderer 只读取经过筛选的结果。 */

export type AgentHostCapabilityKind = 'query' | 'command' | 'workflow' | 'context' | 'lifecycle'

export interface AgentHostExecutionContext {
  agentId: string
  sessionId?: string
  roleId?: string
  traceId: string
  workspaceRoot?: string
  workspaceTranscript?: string
  workspaceFocus?: { kind: string; path: string; content: string }
}

export interface AgentHostCapability {
  key: string
  domainKey: string
  kind: AgentHostCapabilityKind
  description: string
  toolName?: string
  exposeToTool?: boolean
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  requiredPermissions: readonly string[]
  invoke(input: unknown, context: AgentHostExecutionContext): Promise<unknown>
}

export interface AgentHostContextProvider {
  key: string
  domainKey: string
  scope: 'agent' | 'session' | 'turn' | 'task'
  priority: number
  maxChars: number
  requires: readonly string[]
  provide(context: AgentHostExecutionContext): Promise<string | null>
}

export interface AgentHostDomainDefinition {
  key: string
  version: number
  dependencies: readonly string[]
  capabilities: readonly AgentHostCapability[]
  contextProviders: readonly AgentHostContextProvider[]
}

export interface AgentHostCapabilityPolicy {
  allow: readonly string[]
  deny: readonly string[]
}

export interface AgentHostManifest {
  id: string
  version: number
  personaKey: string
  domainKeys: readonly string[]
  capabilityPolicy: AgentHostCapabilityPolicy
  skillKeys: readonly string[]
  modelPolicyKey: string
  permissionPolicyKey: string
  lifecyclePolicyKey?: string
}

export interface AgentHostExecutionEnvironment {
  manifest: AgentHostManifest
  capabilities: readonly AgentHostCapability[]
  contextProviders: readonly AgentHostContextProvider[]
}
