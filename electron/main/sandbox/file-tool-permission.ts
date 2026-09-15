import { createHash } from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import type { ToolContext } from '../../../src/shared/types'
import { resolvePatchTarget } from '../utils/patch-target'
import { checkFilePermission, getRules, type PermissionCheckResult } from './permission-engine'
import { checkFileReadSandbox, checkFileWriteSandbox, resolveToolFilePath, resolveToolReadPath, resolveToolWriteBoundaryPath } from './file-path-guard'
import type { SandboxMode } from './policy'

export const FILE_RULE_TOOL_OPERATIONS = {
  file_read: 'read', file_write: 'write', file_edit: 'write', apply_patch: 'write', file_delete: 'delete',
} as const
export { FILE_RULE_PRIORITY } from './permission-engine'
export const MAX_FILE_RULE_TARGETS = 1024
export interface FileToolPermission extends PermissionCheckResult { approvalKey?: string }
const approvals = new WeakMap<object, string>()

export function hasFilePermissionRules(): boolean {
  return getRules().some(rule => rule.enabled && ['path', 'file-write', 'file-delete'].includes(rule.type))
}

const blocked = (reason: string): FileToolPermission => ({ allowed: false, reason, decisionType: 'sandbox-policy', chain: 'file-rule-boundary' })

/**
 * 文件规则在确认前和实际执行前共用预检，避免别名、隐式补丁目标或路径变化绕过规则。
 * 先跑真实路径沙箱，再同时匹配逻辑与物理路径；没有文件规则时不改变既有工具行为。
 * 确认指纹绑定规则、参数、会话和真实路径，不能用上一条请求的确认覆盖下一条调用。
 */
export function checkFileToolPermission(
  canonical: string, args: Record<string, unknown>, context: Pick<ToolContext, 'workdir' | 'sessionId'> | undefined, mode: SandboxMode, callId = '',
): FileToolPermission | null {
  if (!Object.hasOwn(FILE_RULE_TOOL_OPERATIONS, canonical) || !hasFilePermissionRules()) return null
  if (!args || typeof args !== 'object' || Array.isArray(args)) return blocked('文件操作参数无效。')
  const operation = FILE_RULE_TOOL_OPERATIONS[canonical as keyof typeof FILE_RULE_TOOL_OPERATIONS]
  const raw = args.path || (canonical === 'apply_patch' && typeof args.patch === 'string' && args.patch.length <= 2 * 1024 * 1024
    ? resolvePatchTarget(args.patch) : undefined)
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 4096) return blocked('无法确认文件规则的目标，请检查文件路径。')
  const root = context?.workdir?.trim()
  if (!root) return blocked('文件规则需要明确的工作区，请先选择项目。')
  const resolved = resolveToolFilePath(raw, root)
  const real = operation === 'read' ? resolveToolReadPath(resolved) : resolveToolWriteBoundaryPath(resolved)
  if (!real) return blocked('无法确认文件规则的真实目标，已阻止操作。')
  const realRoot = resolveToolReadPath(root) ?? root
  const sandboxError = operation === 'read'
    ? checkFileReadSandbox(real, mode, realRoot) || checkFileReadSandbox(resolved, mode, root)
    : checkFileWriteSandbox(resolved, mode, root)
  if (sandboxError) return blocked('文件操作未通过工作区安全检查；自定义规则不能覆盖此限制。')
  const paths = [resolved, real]
  // 删除目录会影响子项；只匹配父目录可绕过对子文件的 deny。限制扫描规模，超限拒绝而非遗漏。
  if (operation === 'delete') {
    const pending = [resolved]
    try {
      while (pending.length) {
        const current = pending.pop()!
        const stat = fs.lstatSync(current)
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          const directory = fs.opendirSync(current)
          try {
            let entry: fs.Dirent | null
            while ((entry = directory.readSync())) {
              const child = path.join(current, entry.name)
              paths.push(child, fs.realpathSync(child))
              pending.push(child)
              if (paths.length > MAX_FILE_RULE_TARGETS * 2) return blocked('目录范围过大，无法完整检查文件规则，请缩小删除范围。')
            }
          } finally { directory.closeSync() }
        }
      }
    } catch { return blocked('无法完整检查待删除目录，已阻止操作。') }
  }
  const targets = paths.sort().flatMap(target => [target, path.relative(root, target), path.relative(realRoot, target)])
    .flatMap(target => [target, target.replace(/\\/g, '/')])
  const result = checkFilePermission(targets, operation)
  if (!result) return null
  const approvalKey = createHash('sha256').update(JSON.stringify([callId, canonical, args, root, context?.sessionId, mode, targets, getRules()])).digest('hex')
  return { ...result, approvalKey }
}

/** 确认后只签发不透明对象；执行端依 WeakMap 身份核验，IPC/JSON 不能仿造。 */
export function createFilePermissionApproval(result: FileToolPermission): object {
  const token = {}
  if (result.approvalKey) approvals.set(token, result.approvalKey)
  return token
}

export function consumeFilePermissionApproval(token: object | undefined, result: FileToolPermission): boolean {
  if (!token || !result.approvalKey) return false
  const expected = approvals.get(token)
  approvals.delete(token)
  return expected === result.approvalKey
}

export function combineFilePermission(tool: PermissionCheckResult, file: FileToolPermission | null): PermissionCheckResult {
  if (!file || tool.allowed === false) return tool
  if (file.allowed === false || file.allowed === 'needs_approval') return file
  return tool.allowed === 'needs_approval' ? tool : file
}
