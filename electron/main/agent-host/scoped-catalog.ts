import type { AgentHostManifest } from '../../../src/shared/agent-host'
import type { ToolDefinition } from '../../../src/shared/types'
import { getAgentHostToolNamesForRole } from './host'

/**
 * 会话级 Tool 目录。
 *
 * 背景：全局 ToolRegistry 需要同时服务多个会话，但模型只能看到当前 Agent 被授权的能力。
 * 设计意图：把 Manifest 授权筛选从 Runtime 字符串判断提取成可测试目录，保留全局实现注册，逐步迁移到真正的会话作用域。
 * 关键约束：目录只返回当前 Manifest 允许的 `capability_*` Tool，不修改全局 Registry，也不放宽既有 Skill 白名单。
 */
export class AgentHostScopedToolCatalog {
  constructor(private readonly manifest: AgentHostManifest) {}

  filter(tools: readonly ToolDefinition[]): ToolDefinition[] {
    const available = getAgentHostToolNamesForRole(this.manifest.id)
    return tools.filter(tool => !tool.name.startsWith('capability_') && tool.name !== 'companion_post_moment'
      || available.has(tool.name))
  }
}
