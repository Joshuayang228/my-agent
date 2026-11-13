import { getCompanionRuntimeReadModel } from '../companion/core/read-models/runtime-read-model'
import type { AgentHostDomainDefinition, AgentHostManifest } from '../../../src/shared/agent-host'

export function createCompanionCoreDomain(): AgentHostDomainDefinition {
  return {
    key: 'companion',
    version: 1,
    dependencies: [],
    capabilities: [{
      key: 'companion.runtime.read',
      domainKey: 'companion',
      kind: 'query',
      description: '读取当前人物世界运行态',
      parameters: { type: 'object', properties: {} },
      requiredPermissions: ['companion.read'],
      invoke: async (_input, context) => {
        if (!context.roleId) throw new Error('Companion capability requires roleId')
        return getCompanionRuntimeReadModel(context.roleId)
      },
    }],
    contextProviders: [{
      key: 'companion.runtime-context',
      domainKey: 'companion',
      scope: 'turn',
      priority: 30,
      maxChars: 2_000,
      requires: ['companion.read'],
      provide: async context => {
        if (!context.roleId) return null
        const state = await getCompanionRuntimeReadModel(context.roleId)
        return `当前位置：${state.currentLocation || '未设定'}；当前活动：${state.currentActivity || '未设定'}；状态：${state.situation || '未设定'}`.slice(0, 2_000)
      },
    }],
  }
}

export function createCompanionAgentManifest(input: {
  id: string
  personaKey: string
  domainKeys?: readonly string[]
  allowCapabilities?: readonly string[]
}): AgentHostManifest {
  return {
    id: input.id,
    version: 1,
    personaKey: input.personaKey,
    domainKeys: input.domainKeys ?? ['companion'],
    capabilityPolicy: { allow: input.allowCapabilities ?? ['companion'], deny: [] },
    skillKeys: [],
    modelPolicyKey: 'main',
    permissionPolicyKey: 'companion-default',
  }
}
