/**
 * SubAgent 角色生产资产注册表。
 *
 * 背景：researcher / coder / analyst 不只是字符串，它们同时决定角色 Prompt addon、默认工具集和只读边界。
 * 设计意图：把角色预设从执行器中的匿名常量提升为稳定可审计资产；执行器继续消费同一个对象，避免复制正文。
 * 关键约束：自由字符串角色保持向后兼容但不伪造为内置资产；注册表不保存任务正文、用户输入或运行态权限结果。
 */

import type { ModelContextAsset } from '../../../src/shared/types'
import { modelContextFingerprint } from '../prompts/fingerprint'
import { toolAssetKey } from '../tools/asset-keys'

import { AGENT_ROLES, type AgentRole } from '../prompts/subagent-roles'
export { AGENT_ROLES, type AgentRole } from '../prompts/subagent-roles'

const SUBAGENT_ROLE_ASSET_VERSION = '1.0.0'

function roleContent(roleId: string, role: AgentRole): string {
  return JSON.stringify({
    roleId,
    labelZh: role.labelZh,
    descriptionZh: role.descriptionZh,
    systemPromptAddon: role.systemPromptAddon,
    defaultAllowedTools: role.defaultAllowedTools,
    defaultReadOnly: role.defaultReadOnly,
  }, null, 2)
}

function roleAsset(roleId: string, role: AgentRole): ModelContextAsset {
  const content = roleContent(roleId, role)
  const key = `subagent-role:${roleId}`
  const source = 'electron/main/prompts/subagent-roles.ts'
  return {
    key,
    id: key,
    name: `SubAgent 角色 · ${role.labelZh}`,
    category: 'subagent',
    purpose: 'SubAgent 角色预设、默认工具集与权限边界',
    role: roleId,
    desc: role.descriptionZh,
    source,
    sourcePath: source,
    version: SUBAGENT_ROLE_ASSET_VERSION,
    fingerprint: modelContextFingerprint(content),
    fingerprintKind: 'content',
    assetType: 'subagent-role',
    ownership: 'builtin',
    contentKind: 'schema',
    mode: 'static',
    locale: 'zh-CN',
    locales: { 'zh-CN': { template: content } },
    slots: [],
    status: 'active',
    dependencies: role.defaultAllowedTools.map(toolAssetKey),
    preview: `${role.labelZh}：${role.descriptionZh}`,
    content,
    dynamic: false,
  }
}

export function getSubAgentRoleAssetCatalog(): ModelContextAsset[] {
  return Object.entries(AGENT_ROLES).map(([roleId, role]) => roleAsset(roleId, role))
}

export function getSubAgentRoleAsset(roleId: string): ModelContextAsset | undefined {
  const role = AGENT_ROLES[roleId]
  return role ? roleAsset(roleId, role) : undefined
}

export function getSubAgentRoleIds(): string[] {
  return Object.keys(AGENT_ROLES)
}
