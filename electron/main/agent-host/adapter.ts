import type { ToolDefinition, ToolOutput } from '../../../src/shared/types'
import type { AgentHostCapability } from '../../../src/shared/agent-host'

/** 将已授权 Capability 转为 LLM 可见 Tool，不让 Tool 反向依赖 Domain 实现。 */
export function capabilityToTool(capability: AgentHostCapability, input: {
  agentId: string
  roleId?: string
  onActivated?: (capabilityKey: string) => void
}): ToolDefinition {
  return {
    name: capability.toolName ?? `capability_${capability.key.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    description: capability.description,
    parameters: capability.parameters,
    metadata: {
      isReadOnly: capability.kind === 'query' || capability.kind === 'context',
      isDestructive: capability.kind === 'command',
      isConcurrencySafe: capability.kind === 'query' || capability.kind === 'context',
    },
    execute: async (args, context): Promise<ToolOutput> => {
      input.onActivated?.(capability.key)
      const result = await capability.invoke(args, {
        agentId: input.agentId,
        roleId: input.roleId ?? context?.roleId,
        sessionId: context?.sessionId,
        traceId: context?.parentSpanId ?? `tool:${capability.key}`,
      })
      return { content: typeof result === 'string' ? result : JSON.stringify(result) }
    },
  }
}
