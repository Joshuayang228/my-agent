/**
 * Command Guard — 命令执行前的安全拦截层
 *
 * 结合 SandboxPolicy + ExecPolicy 决定命令是否允许执行。
 * 在 shell_exec 工具执行前调用，替代原来简单的 isDestructive 标记。
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import type { SandboxPolicy } from './policy'
import { assessCommand, type CommandAssessment } from './exec-policy'
import { createLogger, hashForLog } from '../utils/logger'

const log = createLogger('CommandGuard')

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: string }
  | { allowed: 'needs_approval'; reason: string; assessment: CommandAssessment }

/**
 * 命令权限的不可绕过边界。
 *
 * 背景：shell 是通过系统解释器执行的复合输入，单看首个命令名无法证明参数、管道和
 * 工作目录安全；此前把 node/npm/git 等命令按首词自动放行，会让 `node -e`、生命周期
 * 脚本或绝对路径读取绕过沙箱。
 * 设计意图：先拦截危险命令、外部 cwd、Shell 控制符和显式越界路径，再把剩余未知命令
 * 交给审批链。这样自定义 allow 和历史审批不能绕过硬边界。
 * 关键约束：full-access 仍允许用户明确承担风险的普通命令；危险命令始终 bypass-immune。
 */
export function guardCommand(
  command: string,
  cwd: string | undefined,
  policy: SandboxPolicy,
): GuardDecision {
  const assessment = assessCommand(command)

  if (assessment.risk === 'dangerous') {
    log.warn('Dangerous command blocked (bypass-immune)', { commandHash: hashForLog(command), commandLength: command.length, reasonCode: assessment.risk })
    return { allowed: false, reason: `危险命令被拦截: ${assessment.reason}` }
  }

  if (policy.mode !== 'full-access') {
    const cwdBoundary = checkCwdBoundary(cwd, policy.workspaceRoot)
    if (cwdBoundary) return { allowed: false, reason: cwdBoundary }

    if (hasShellControlOperator(command)) {
      return {
        allowed: false,
        reason: '非“完全访问”模式禁止带管道、重定向或串联的 Shell 命令，请拆成明确的单条命令后重试。',
      }
    }

    if (hasProtectedPathAccess(command, policy)) {
      return { allowed: false, reason: '命令可能访问受保护路径' }
    }

    if (hasExplicitOutsideWorkspacePath(command, policy.workspaceRoot)) {
      return { allowed: false, reason: '命令包含工作区外的显式路径' }
    }
  }

  if (policy.mode === 'full-access') {
    return { allowed: true }
  }

  if (policy.mode === 'read-only') {
    if (assessment.risk === 'safe') return { allowed: true }
    return { allowed: false, reason: `只读模式禁止非安全命令: ${assessment.reason}` }
  }

  if (assessment.risk === 'safe') {
    return { allowed: true }
  }

  return { allowed: 'needs_approval', reason: `命令需要审批: ${assessment.reason}`, assessment }
}

function checkCwdBoundary(cwd: string | undefined, workspaceRoot: string | undefined): string | null {
  if (!cwd) return null
  if (!workspaceRoot) return '非“完全访问”模式下，未打开项目时不能指定命令工作目录'

  const resolvedRoot = realpathOrResolve(workspaceRoot)
  const resolvedCwd = realpathOrResolve(cwd, path.isAbsolute(cwd) ? undefined : workspaceRoot)
  if (!resolvedCwd || !resolvedRoot || !isInside(resolvedCwd, resolvedRoot)) {
    return '命令工作目录超出当前工作区'
  }
  try {
    if (!fs.statSync(resolvedCwd).isDirectory()) return '命令工作目录不是目录'
  } catch {
    return '命令工作目录不存在或无法访问'
  }
  return null
}

function realpathOrResolve(candidate: string, base?: string): string | null {
  const resolved = path.resolve(base || process.cwd(), candidate)
  try {
    return fs.realpathSync(resolved)
  } catch {
    return path.resolve(resolved)
  }
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child))
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function hasShellControlOperator(command: string): boolean {
  return /[;&|<>`]/.test(command)
}

function hasExplicitOutsideWorkspacePath(command: string, workspaceRoot?: string): boolean {
  if (!workspaceRoot) {
    return /(?:[A-Za-z]:[\\/]|\\\\|(?:^|[\s"'=])\/)/.test(command) || hasRelativeParentPath(command)
  }

  const root = realpathOrResolve(workspaceRoot)
  if (!root) return true

  const candidates = command.match(/(?:[A-Za-z]:[\\/][^\s"';&|<>]+|\\\\[^\s"';&|<>]+|(?:^|[\s"'=])\/[^\s"';&|<>]+)/g) || []
  for (const raw of candidates) {
    const token = raw.trim().replace(/^['"]|['"]$/g, '').replace(/[),.:]+$/, '')
    if (!token) continue
    const resolved = realpathOrResolve(token)
    if (resolved && !isInside(resolved, root)) return true
  }
  return hasRelativeParentPath(command)
}

function hasRelativeParentPath(command: string): boolean {
  return /(?:^|[\s"'=])(?:\.\.[\\/]|[^\s"';&|<>]+[\\/]\.\.(?:[\\/]|$))/.test(command)
}

function hasProtectedPathAccess(command: string, policy: SandboxPolicy): boolean {
  const normalized = command.toLowerCase()
  for (const protPath of policy.protectedPaths) {
    const lower = protPath.toLowerCase()
    const patterns = [
      lower,
      `/${lower}`,
      `\\${lower}`,
      `./${lower}`,
      `.\\${lower}`,
    ]
    for (const p of patterns) {
      if (normalized.includes(p)) return true
    }
  }
  return false
}
