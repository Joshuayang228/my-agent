import { getCompanionRuntimeReadModel } from '../companion/core/read-models/runtime-read-model'
import * as identity from '../companion/identity/loader'
import * as memory from '../storage/memory-store'
import { getWorkspaceRoot } from '../agent/project-memory'
import { companionPostMomentTool } from '../tools/builtins/companion-life'
import { triggerInnerThought } from '../companion/life/inner-thoughts'
import { tickActiveRole } from '../companion/life/engine'
import { buildWorkspaceContextPrompt } from '../prompts/runtime-context'
import { AGENT_HOST_MANIFEST_VERSION } from '../../../src/shared/agent-host'
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
    }, {
      key: 'companion.moment.publish',
      toolName: 'companion_post_moment',
      domainKey: 'companion',
      kind: 'workflow',
      description: companionPostMomentTool.description,
      parameters: companionPostMomentTool.parameters,
      requiredPermissions: ['companion.write'],
      invoke: async (input, context) => {
        if (!context.roleId) throw new Error('Moment workflow requires roleId')
        return companionPostMomentTool.execute(input as Record<string, unknown>, {
          workdir: process.cwd(),
          sessionId: context.sessionId ?? `agent-host-${context.roleId}`,
          roleId: context.roleId,
        })
      },
    }, {
      key: 'companion.diary.generate',
      domainKey: 'companion',
      kind: 'workflow',
      description: '根据当前人物生活状态生成一篇私密日记',
      parameters: {
        type: 'object',
        properties: { triggerReason: { type: 'string', description: '可选的写作触发原因。' } },
      },
      requiredPermissions: ['companion.write'],
      invoke: async (input, context) => {
        if (!context.roleId) throw new Error('Diary workflow requires roleId')
        const triggerReason = input && typeof input === 'object' && typeof (input as Record<string, unknown>).triggerReason === 'string'
          ? String((input as Record<string, unknown>).triggerReason).slice(0, 240)
          : undefined
        return triggerInnerThought(context.roleId, triggerReason)
      },
    }, {
      key: 'companion.life.tick',
      domainKey: 'companion',
      kind: 'workflow',
      exposeToTool: false,
      description: '推进当前人物的生活时钟和到期事件',
      parameters: { type: 'object', properties: {} },
      requiredPermissions: ['companion.lifecycle'],
      invoke: async (_input, context) => {
        if (!context.roleId) throw new Error('Life tick workflow requires roleId')
        return tickActiveRole(Date.now())
      },
    }],
    contextProviders: [{
      key: 'companion.runtime-context',
      domainKey: 'companion',
      source: 'companion.runtime-state',
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

export function createPersonaDomain(): AgentHostDomainDefinition {
  return {
    key: 'persona',
    version: 1,
    dependencies: [],
    capabilities: [{
      key: 'persona.read',
      domainKey: 'persona',
      kind: 'query',
      description: '读取当前 Agent 的稳定身份摘要',
      parameters: { type: 'object', properties: {} },
      requiredPermissions: ['persona.read'],
      invoke: async (_input, context) => {
        if (!context.roleId) throw new Error('Persona capability requires roleId')
        const pack = identity.loadRolePack(context.roleId)
        return { id: pack.id, name: pack.name, description: pack.description, summary: pack.summary }
      },
    }],
    contextProviders: [],
  }
}

export function createMemoryDomain(): AgentHostDomainDefinition {
  return {
    key: 'memory',
    version: 1,
    dependencies: [],
    capabilities: [{
      key: 'memory.profile.read',
      domainKey: 'memory',
      kind: 'query',
      description: '读取当前 Agent 作用域内的用户画像摘要',
      parameters: { type: 'object', properties: {} },
      requiredPermissions: ['memory.read'],
      invoke: async (_input, context) => memory.buildUserProfile(context.roleId),
    }],
    contextProviders: [],
  }
}

export function createWorkspaceDomain(): AgentHostDomainDefinition {
  return {
    key: 'workspace',
    version: 1,
    dependencies: [],
    capabilities: [{
      key: 'workspace.root.read',
      domainKey: 'workspace',
      kind: 'query',
      description: '读取当前受控工作区根目录',
      parameters: { type: 'object', properties: {} },
      requiredPermissions: ['workspace.read'],
      invoke: async () => ({ root: getWorkspaceRoot() ?? null }),
    }],
    contextProviders: [{
      key: 'workspace.context',
      domainKey: 'workspace',
      source: 'workspace.session-context',
      scope: 'session',
      priority: 40,
      maxChars: 12_000,
      requires: ['workspace.read'],
      provide: async context => context.workspaceRoot || context.workspaceTranscript || context.workspaceFocus
        ? buildWorkspaceContextPrompt({
            project: context.workspaceRoot,
            transcript: context.workspaceTranscript,
            focus: context.workspaceFocus,
          }).slice(0, 12_000)
        : null,
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
    version: AGENT_HOST_MANIFEST_VERSION,
    personaKey: input.personaKey,
    domainKeys: input.domainKeys ?? ['persona', 'memory', 'companion', 'workspace'],
    capabilityPolicy: { allow: input.allowCapabilities ?? ['persona', 'memory', 'companion', 'workspace'], deny: [] },
    skillKeys: [],
    modelPolicyKey: 'main',
    permissionPolicyKey: 'companion-default',
    grantedPermissions: ['persona.read', 'memory.read', 'workspace.read', 'companion.read', 'companion.write'],
  }
}

/** 生产 Manifest 的唯一 loader，调用方不直接拼装 Domain、Capability 和策略组合。 */
export function loadCompanionAgentManifest(input: Parameters<typeof createCompanionAgentManifest>[0]): AgentHostManifest {
  return createCompanionAgentManifest(input)
}
