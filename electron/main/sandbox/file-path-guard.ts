/**
 * 文件工具路径解析与变更沙箱检查（file_write / file_edit / file_delete / apply_patch 共用）
 *
 * 注意：聊天里的「允许」只过审批层；本模块的路径/模式检查仍会执行，二者不是一回事。
 */

import path from 'node:path'
import { buildPolicy, type SandboxMode } from './policy'

export function resolveToolFilePath(filePath: string, workspaceRoot?: string): string {
  const trimmed = filePath.trim()
  if (path.isAbsolute(trimmed)) return path.resolve(trimmed)
  const base = workspaceRoot?.trim() ? workspaceRoot : process.cwd()
  return path.resolve(base, trimmed)
}

/** 判断 child 是否在 parent 目录树内（含自身） */
export function isPathInsideRoot(child: string, parent: string): boolean {
  const resolvedChild = path.resolve(child)
  const resolvedParent = path.resolve(parent)
  const rel = path.relative(resolvedParent, resolvedChild)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * @returns 拦截原因字符串；null 表示允许写入
 */
export function checkFileWriteSandbox(
  resolved: string,
  mode: SandboxMode,
  workspaceRoot?: string,
  opts?: { action?: '写入' | '编辑' | '删除' },
): string | null {
  const action = opts?.action ?? '写入'
  if (mode === 'full-access') return null

  if (mode === 'read-only') {
    return (
      `[SANDBOX BLOCKED] 只读模式下禁止${action}文件。当前沙箱模式为 "read-only"。\n` +
      `说明：聊天确认只过审批层，不会绕过沙箱。请到对话页输入区将审批改为「替我审批」或「完全访问」（完全访问会放开路径限制）。`
    )
  }

  const wsRoot = workspaceRoot?.trim() || undefined
  const policy = buildPolicy(mode, wsRoot)

  if (wsRoot && !isPathInsideRoot(resolved, wsRoot)) {
    return (
      `[SANDBOX BLOCKED] 目标路径超出工作区，禁止${action}。\n` +
      `- 目标: ${resolved}\n` +
      `- 工作区: ${wsRoot}\n` +
      `说明：你点的「允许」只表示同意调用工具；工作区写入仍要求路径落在已打开的项目内。` +
      `请改用工作区内路径，或在对话页将审批改为「完全访问」。`
    )
  }

  // workspace-write 但尚未打开项目：相对路径已落到 process.cwd()；给出可操作提示但不硬拦
  // （伴侣场景可能无项目；硬拦会误伤）

  for (const protPath of policy.protectedPaths) {
    const segments = path.resolve(resolved).split(path.sep)
    if (segments.some((s) => s === protPath)) {
      return (
        `[SANDBOX BLOCKED] 目标路径包含受保护段 "${protPath}"，禁止${action}。\n` +
        `受保护: ${policy.protectedPaths.join(', ')}`
      )
    }
  }

  return null
}
