/**
 * Debug「系统」聚合只读快照（M32 Phase 5）。
 *
 * 背景：DevPanel 系统 tab 原先只有进程/LLM/MCP，排障时最常问的是
 * 「沙箱/审批模式/权限规则/Skills 现在怎样」——这些数据主进程已有，缺聚合。
 *
 * 约束：只读；不返回 API Key；规则与 Skills 截断以免面板爆炸。
 */

import type { ToolRegistry } from '../tools/registry'
import { getAllSettings } from '../storage/settings-store'
import { getRules } from '../sandbox/permission-engine'
import { resolveEffectiveSandbox } from '../sandbox/effective-sandbox'
import { getLoadedSkills } from '../skills/registry'
import { mcpManager } from '../mcp/client'
import { app } from 'electron'

const MAX_RULES = 40
const MAX_SKILLS = 40

export interface DebugSystemInfo {
  electron: string
  node: string
  chrome: string
  platform: string
  arch: string
  appVersion: string
  uptime: number
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number }
  settings: {
    model: string
    baseUrl: string
    activeRoleId: string
    hasApiKey: boolean
    hasCustomPrompt: boolean
    sandboxMode: string
    executionMode: string
    sessionTokenBudget: number
    dailyTokenBudget: number
  }
  mcp: Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>
  toolCount: number
  permissionRules: {
    total: number
    enabled: number
    items: Array<{
      id: string
      type: string
      pattern: string
      action: string
      enabled: boolean
      description?: string
    }>
    truncated: boolean
  }
  skills: {
    total: number
    items: Array<{ name: string; source: string; description: string }>
    truncated: boolean
  }
}

export async function buildDebugSystemInfo(toolRegistry: ToolRegistry): Promise<DebugSystemInfo> {
  const settings = await getAllSettings()
  const rules = getRules()
  const skills = getLoadedSkills()
  const mcpStatuses = mcpManager.getStatus()

  const ruleItems = rules.slice(0, MAX_RULES).map((r) => ({
    id: r.id,
    type: r.type,
    pattern: r.pattern.length > 80 ? `${r.pattern.slice(0, 80)}…` : r.pattern,
    action: r.action,
    enabled: r.enabled,
    description: r.description,
  }))

  const skillItems = skills.slice(0, MAX_SKILLS).map((s) => ({
    name: s.meta.name,
    source: s.source,
    description: (s.meta.description || '').slice(0, 120),
  }))

  return {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    uptime: Math.round(process.uptime()),
    memoryUsage: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
    },
    settings: {
      model: settings.llmModel,
      baseUrl: settings.llmBaseUrl,
      activeRoleId: settings.activeRoleId,
      hasApiKey: !!settings.llmApiKey,
      hasCustomPrompt: !!settings.systemPrompt,
      /** 由对话页 executionMode 推导的有效沙箱（非独立设置项） */
      sandboxMode: resolveEffectiveSandbox(settings.executionMode),
      executionMode: settings.executionMode || 'auto',
      sessionTokenBudget: Number.parseInt(settings.sessionTokenBudget || '0', 10) || 0,
      dailyTokenBudget: Number.parseInt(settings.dailyTokenBudget || '0', 10) || 0,
    },
    mcp: mcpStatuses.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      toolCount: s.toolCount,
      error: s.error,
    })),
    toolCount: toolRegistry.getAll().length,
    permissionRules: {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      items: ruleItems,
      truncated: rules.length > MAX_RULES,
    },
    skills: {
      total: skills.length,
      items: skillItems,
      truncated: skills.length > MAX_SKILLS,
    },
  }
}
