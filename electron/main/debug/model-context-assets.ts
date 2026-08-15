/**
 * Debug 生产资产统一目录。
 *
 * 背景：Prompt、伙伴资产、Tool schema、Skill 与外部 MCP 描述共同影响 Agent 行为，分散查看会漏审。
 * 设计意图：在 IPC 高层聚合各模块生产事实，不让 Prompt 注册表反向依赖伙伴、Tool、Skill 或 MCP。
 * 关键约束：目录只读；外部/用户资产明确标源；运行时世界、用户记忆与最终模型输入仍去对应 Debug 视图查看。
 */

import type { ModelContextAsset, PromptAsset, SkillDefinition, ToolDefinition } from '../../../src/shared/types'
import { getPromptAssets } from '../prompts/registry'
import { modelContextFingerprint } from '../prompts/fingerprint'
import { appendExamplesToDescription } from '../llm/index'
import { getBuiltinToolSource } from '../tools/builtins'
import type { ToolRegistry } from '../tools/registry'
import { getLoadedSkills, getSkillToolName } from '../skills/registry'
import { isMcpTool, parseMcpToolName } from '../mcp/bridge'
import { getAllSettings } from '../storage/settings-store'
import { PROMPT_KEYS } from '../prompts/keys'
import { getCompanionAssetCatalog } from '../companion/asset-registry'
import { getMemoryStrategyAssetCatalog } from '../memory/strategy-registry'
import { getPermissionSandboxAssetCatalog } from '../sandbox/asset-registry'

function toolSchemaContent(tool: ToolDefinition): string {
  return JSON.stringify({
    name: tool.name,
    description: appendExamplesToDescription(tool),
    parameters: tool.parameters,
  }, null, 2)
}

function toolAsset(tool: ToolDefinition, skills: SkillDefinition[]): ModelContextAsset {
  const skill = skills.find((item) => getSkillToolName(item) === tool.name)
  const mcp = isMcpTool(tool.name) ? parseMcpToolName(tool.name) : null
  const builtinSource = getBuiltinToolSource(tool.name)
  const content = toolSchemaContent(tool)
  const ownership = mcp ? 'external' : skill?.source === 'user' ? 'user' : 'builtin'
  const category = mcp ? 'external' : skill ? 'skill' : 'tool'
  const source = mcp
    ? `mcp://${mcp.serverId}/${mcp.toolName}`
    : skill?.filePath ?? builtinSource ?? `ToolRegistry:${tool.name}`
  const locale = mcp || skill?.source === 'user' ? 'und' : 'zh-CN'
  const version = skill?.meta.version ?? (mcp ? 'runtime' : '1.0.0')

  return {
    key: `tool:${tool.name}`,
    id: `tool:${tool.name}`,
    name: `工具 · ${tool.name}`,
    category,
    purpose: skill ? 'Skill 激活工具 schema' : mcp ? 'MCP 外部工具 schema' : '内置工具 schema',
    role: 'tool-runtime',
    desc: tool.description,
    source,
    sourcePath: source,
    version,
    fingerprint: modelContextFingerprint(content),
    fingerprintKind: 'content',
    assetType: 'tool-schema',
    ownership,
    contentKind: 'schema',
    mode: mcp || skill ? 'dynamic' : 'static',
    locale,
    locales: { [locale]: { template: content } },
    slots: [],
    preview: tool.description,
    content,
    dynamic: Boolean(mcp || skill),
  }
}

function skillAsset(skill: SkillDefinition): ModelContextAsset {
  const content = [
    `# ${skill.meta.name}`,
    '',
    skill.meta.description,
    skill.meta.when_to_use ? `
## 触发时机
${skill.meta.when_to_use}` : '',
    skill.meta.allowed_tools?.length ? `
## 允许工具
${skill.meta.allowed_tools.join(', ')}` : '',
    '',
    skill.body,
  ].filter(Boolean).join('\n')
  const locale = skill.source === 'builtin' ? 'zh-CN' : 'und'
  return {
    key: `skill:${skill.meta.name}`,
    id: `skill:${skill.meta.name}`,
    name: `Skill · ${skill.meta.name}`,
    category: 'skill',
    purpose: 'Skill 摘要、触发条件与激活正文',
    role: 'skill-runtime',
    desc: skill.meta.description,
    source: skill.filePath,
    sourcePath: skill.filePath,
    version: skill.meta.version ?? 'unversioned',
    fingerprint: modelContextFingerprint(content),
    fingerprintKind: 'content',
    assetType: 'skill',
    ownership: skill.source,
    contentKind: 'static',
    mode: 'dynamic',
    locale,
    locales: { [locale]: { template: content } },
    slots: [{ name: 'activationState', source: 'skills/registry', lifecycle: '激活时注入正文' }],
    preview: skill.meta.when_to_use || skill.meta.description,
    content,
    dynamic: true,
  }
}

function withCurrentUserPrompt(assets: PromptAsset[], systemPrompt: string): PromptAsset[] {
  if (!systemPrompt.trim()) return assets
  return assets.map((asset) => {
    if (asset.key !== PROMPT_KEYS.settingsSystemPrompt) return asset
    const content = systemPrompt.trim()
    return {
      ...asset,
      ownership: 'user',
      contentKind: 'runtime',
      fingerprint: modelContextFingerprint(content),
      fingerprintKind: 'content',
      locales: { [asset.locale]: { template: content } },
      content,
      preview: content.length > 420 ? `${content.slice(0, 419)}…` : content,
    }
  })
}

/**
 * 聚合当前进程实际可用的生产 Agent 资产。
 *
 * 背景：MCP 与用户 Skill 会热加载，不能在静态 Prompt 注册表中伪造目录项。
 * 设计意图：每次 Debug 刷新都读取伙伴注册表、ToolRegistry、Skill Registry 和当前 L3 设置，再与生产 Prompt 合并。
 * 关键约束：key 跨类型使用前缀避免冲突；同一工具的 schema 内容与 LLM Provider 实际序列化保持一致。
 */
export function buildModelContextAssets(input: {
  promptAssets: PromptAsset[]
  tools: ToolDefinition[]
  skills: SkillDefinition[]
  systemPrompt: string
}): ModelContextAsset[] {
  const promptAssets = withCurrentUserPrompt(input.promptAssets, input.systemPrompt)
  const toolAssets = input.tools.map((tool) => toolAsset(tool, input.skills))
  const skillAssets = input.skills.map(skillAsset)
  const companionAssets = getCompanionAssetCatalog()
  const memoryStrategyAssets = getMemoryStrategyAssetCatalog()
  const permissionSandboxAssets = getPermissionSandboxAssetCatalog()
  return [...promptAssets, ...toolAssets, ...skillAssets, ...companionAssets, ...memoryStrategyAssets, ...permissionSandboxAssets]
}

export async function getModelContextAssets(toolRegistry: ToolRegistry): Promise<ModelContextAsset[]> {
  const settings = await getAllSettings()
  return buildModelContextAssets({
    promptAssets: getPromptAssets(),
    tools: toolRegistry.getAll(),
    skills: getLoadedSkills(),
    systemPrompt: settings.systemPrompt || '',
  })
}
