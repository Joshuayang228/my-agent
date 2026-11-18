import type { ToolDefinition, ToolOutput } from '../../../src/shared/types'
import type { AgentHostCapability, AgentHostManifest } from '../../../src/shared/agent-host'
import { isCapabilityInManifest } from './domain-catalog'
import { runWithExecutionSignal } from '../utils/execution-cancellation'

export function getCapabilityToolName(capability: AgentHostCapability): string {
  return capability.toolName ?? `capability_${capability.key.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * 背景：全局注册的工具不能把注册时的宽权限带进不同会话。
 * 设计意图：转换只保留协议，调用时读取本次完整 Manifest 并复核身份与授权。
 * 关键约束：全局工具必须装配执行环境；显式绑定的适配器禁止跨实例与跨人物替换。
 */
export function capabilityToTool(capability: AgentHostCapability, input: {
  manifest?: AgentHostManifest
  onActivated?: (capabilityKey: string, context: { agentId: string; roleId?: string; sessionId?: string; traceId: string }) => void
}): ToolDefinition {
  return {
    name: getCapabilityToolName(capability),
    description: capability.description,
    parameters: capability.parameters,
    metadata: {
      isReadOnly: capability.kind === 'query' || capability.kind === 'context',
      isDestructive: capability.kind === 'command',
      isConcurrencySafe: capability.kind === 'query' || capability.kind === 'context',
    },
    execute: async (args, context): Promise<ToolOutput> => {
      // 全局 Registry 只登记实现，实际权限必须来自本次执行；绑定适配器还需拒绝跨实例替换。
      const manifest = context?.agentManifest ?? input.manifest
      if (!manifest) throw new Error('Agent 执行环境尚未装配，无法执行宿主能力。')
      context?.signal?.throwIfAborted()
      if (context?.deadlineAt !== undefined && context.deadlineAt <= Date.now()) throw new Error('Agent 执行期限已到。')
      if (input.manifest && manifest.id !== input.manifest.id) throw new Error('Agent 执行环境与绑定实例不匹配。')
      if (!isCapabilityInManifest(manifest, capability)) throw new Error(`Capability "${capability.key}" is unavailable for agent "${manifest.id}"`)
      const roleId = manifest.personaKey.startsWith('role:') ? manifest.personaKey.slice(5) : context?.roleId
      if (roleId && context?.roleId && roleId !== context.roleId) throw new Error('Agent 执行人物与身份定义不匹配。')
      const executionContext = {
        agentId: manifest.id,
        roleId,
        sessionId: context?.sessionId,
        traceId: context?.parentSpanId ?? `tool:${capability.key}`,
        runId: context?.runId,
        deadlineAt: context?.deadlineAt,
        signal: context?.signal,
        operationKey: context?.sessionId && context.toolCallId
          ? JSON.stringify([context.sessionId, context.toolCallId])
          : undefined,
      }
      const missingPermissions = capability.requiredPermissions.filter(permission => !manifest.grantedPermissions.includes(permission))
      if (missingPermissions.length > 0) throw new Error(`Capability "${capability.key}" lacks required permissions: ${missingPermissions.join(', ')}`)
      input.onActivated?.(capability.key, executionContext)
      const invoke = () => capability.invoke(args, executionContext)
      const result = await (executionContext.signal ? runWithExecutionSignal(executionContext.signal, invoke) : invoke())
      return { content: typeof result === 'string' ? result : JSON.stringify(result) }
    },
  }
}
