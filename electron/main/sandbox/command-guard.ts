/**
 * Command Guard — 命令执行前的安全拦截层
 *
 * 结合 SandboxPolicy + ExecPolicy 决定命令是否允许执行。
 * 在 shell_exec 工具执行前调用，替代原来简单的 isDestructive 标记。
 */

import * as path from 'node:path'
import type { SandboxPolicy } from './policy'
import { assessCommand, type CommandAssessment } from './exec-policy'
import { createLogger } from '../utils/logger'

const log = createLogger('CommandGuard')

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: string }
  | { allowed: 'needs_approval'; reason: string; assessment: CommandAssessment }

export function guardCommand(
  command: string,
  cwd: string | undefined,
  policy: SandboxPolicy,
): GuardDecision {
  const assessment = assessCommand(command)

  // Bypass-immune: 危险命令无论沙箱模式如何都要阻断（包括 full-access）
  // 原则：rm -rf /、fork bomb、磁盘格式化等绝对危险操作不受模式影响
  if (assessment.risk === 'dangerous') {
    log.warn('Dangerous command blocked (bypass-immune)', { command: command.slice(0, 100), reason: assessment.reason })
    return { allowed: false, reason: `危险命令被拦截: ${assessment.reason}` }
  }

  if (policy.mode === 'full-access') {
    return { allowed: true }
  }

  if (policy.mode === 'read-only') {
    if (assessment.risk === 'safe') {
      return { allowed: true }
    }
    return {
      allowed: 'needs_approval',
      reason: `只读模式下需要审批: ${assessment.reason}`,
      assessment,
    }
  }

  // workspace-write mode
  if (assessment.risk === 'safe') {
    return { allowed: true }
  }

  if (cwd && policy.workspaceRoot) {
    const resolvedCwd = path.resolve(cwd)
    const resolvedRoot = path.resolve(policy.workspaceRoot)
    if (!resolvedCwd.startsWith(resolvedRoot)) {
      return {
        allowed: 'needs_approval',
        reason: `命令工作目录超出工作区: ${resolvedCwd}`,
        assessment,
      }
    }
  }

  if (hasProtectedPathAccess(command, policy)) {
    return {
      allowed: 'needs_approval',
      reason: '命令可能访问受保护路径',
      assessment,
    }
  }

  return { allowed: true }
}

function hasProtectedPathAccess(command: string, policy: SandboxPolicy): boolean {
  for (const protPath of policy.protectedPaths) {
    const patterns = [
      protPath,
      `/${protPath}`,
      `\\${protPath}`,
      `./${protPath}`,
      `.\\${protPath}`,
    ]
    for (const p of patterns) {
      if (command.includes(p)) return true
    }
  }
  return false
}
