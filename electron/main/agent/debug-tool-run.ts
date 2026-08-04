/**
 * DevPanel 工具手测
 *
 * 背景：M32-G2 / 施工合同 experience-debug-playground — 要走真实 Registry + 权限，不能只展示 schema。
 * 意图：deny 不可绕过；needs_approval / 破坏性工具必须显式 confirmRisk；不弹主聊天确认框。
 * 约束：sessionId 固定为 debug-playground，不写入真会话历史。
 */

import type { ToolRegistry } from '../tools/registry'
import type { ToolCall } from '../../../src/shared/types'
import {
  checkToolPermission,
  checkCommandPermission,
  type PermissionCheckResult,
} from '../sandbox/permission-engine'
import type { SandboxMode } from '../sandbox/policy'
import { getWorkspaceRoot } from './project-memory'
import { getAllSettings } from '../storage/settings-store'
import { createLogger } from '../utils/logger'
import { startLinkedAsyncSpan } from '../utils/tracer'

const log = createLogger('DebugToolRun')

export const DEBUG_TOOL_SESSION_ID = 'debug-playground'

export type DebugToolRunInput = {
  name: string
  args?: Record<string, unknown>
  /** 破坏性或 needs_approval 时必须为 true */
  confirmRisk?: boolean
}

export type DebugToolRunResult =
  | {
      ok: true
      content: string
      isError?: boolean
      ms: number
      permission: PermissionCheckResult
    }
  | {
      ok: false
      error: string
      needsConfirmation?: boolean
      permission?: PermissionCheckResult
    }

function resolveSandboxMode(raw: unknown): SandboxMode {
  if (raw === 'read-only' || raw === 'workspace-write' || raw === 'full-access') return raw
  return 'workspace-write'
}

/**
 * 预检：工具级 +（shell_exec 时）命令级权限。
 * 返回合并后的「最严」决策，供 UI 展示 chain。
 */
export async function preflightDebugTool(
  registry: ToolRegistry,
  input: { name: string; args?: Record<string, unknown> },
): Promise<{
  toolName: string
  permission: PermissionCheckResult
  needsConfirmation: boolean
  unknown: boolean
}> {
  const name = (input.name || '').trim()
  const tool = registry.get(name)
  if (!tool) {
    return {
      toolName: name,
      unknown: true,
      needsConfirmation: false,
      permission: {
        allowed: false,
        reason: `未知工具 "${name}"`,
        decisionType: 'default-allow',
        chain: 'unknown-tool',
      },
    }
  }

  const canonical = tool.name
  let permission = checkToolPermission(canonical)
  let needsConfirmation =
    permission.allowed === 'needs_approval' || tool.metadata.isDestructive === true

  if (canonical === 'shell_exec') {
    const command = typeof input.args?.command === 'string' ? input.args.command : ''
    if (command.trim()) {
      const settings = await getAllSettings()
      const mode = resolveSandboxMode(settings.sandboxMode)
      const cwd = getWorkspaceRoot() || process.cwd()
      const cmdPerm = checkCommandPermission(command, cwd, mode, getWorkspaceRoot())
      // 取更严：false > needs_approval > true
      if (cmdPerm.allowed === false) {
        permission = cmdPerm
        needsConfirmation = false
      } else if (cmdPerm.allowed === 'needs_approval') {
        if (permission.allowed !== false) permission = cmdPerm
        needsConfirmation = true
      }
    }
  }

  if (permission.allowed === false) needsConfirmation = false

  return { toolName: canonical, permission, needsConfirmation, unknown: false }
}

/**
 * 执行手测工具调用。
 */
export async function runDebugTool(
  registry: ToolRegistry,
  input: DebugToolRunInput,
): Promise<DebugToolRunResult> {
  const name = (input.name || '').trim()
  if (!name) return { ok: false, error: '请指定工具名' }

  const args = input.args && typeof input.args === 'object' ? input.args : {}
  const pre = await preflightDebugTool(registry, { name, args })
  if (pre.unknown) {
    return { ok: false, error: pre.permission.reason, permission: pre.permission }
  }
  if (pre.permission.allowed === false) {
    return {
      ok: false,
      error: `[Permission Denied] ${pre.permission.reason}`,
      permission: pre.permission,
    }
  }
  if (pre.needsConfirmation && !input.confirmRisk) {
    return {
      ok: false,
      error: pre.permission.reason || '该工具需要确认风险后才能执行',
      needsConfirmation: true,
      permission: pre.permission,
    }
  }

  const call: ToolCall = {
    id: `debug-tool-${Date.now()}`,
    name: pre.toolName,
    arguments: JSON.stringify(args),
  }
  const workdir = getWorkspaceRoot() || process.cwd()
  const span = startLinkedAsyncSpan(`debug:tool:${pre.toolName}`, 'tool', {
    type: 'tool_execution',
    attributes: { toolName: pre.toolName, debugPlayground: true },
  })
  const t0 = Date.now()
  try {
    const [result] = await registry.executeAll([call], {
      workdir,
      sessionId: DEBUG_TOOL_SESSION_ID,
      registry,
    })
    const ms = Date.now() - t0
    span.end(result?.isError ? 'error' : 'ok', result?.isError ? result.content.slice(0, 200) : undefined)
    log.info('Debug tool run', { name: pre.toolName, ms, isError: !!result?.isError })
    return {
      ok: true,
      content: result?.content ?? '(empty)',
      isError: result?.isError,
      ms,
      permission: pre.permission,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    span.end('error', message)
    log.warn('Debug tool run failed', { name: pre.toolName, error: message })
    return { ok: false, error: message, permission: pre.permission }
  }
}

export const __test = { resolveSandboxMode, DEBUG_TOOL_SESSION_ID }
