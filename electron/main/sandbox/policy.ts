/**
 * Sandbox Policy — 参考 Codex 的三级沙箱策略
 *
 * read-only:        默认模式，禁止写文件 + 禁止网络（最安全）
 * workspace-write:  允许工作区内写入，.git/.env 受保护
 * full-access:      不限制（仅在用户明确选择时使用）
 */

export const SANDBOX_MODES = ['read-only', 'workspace-write', 'full-access'] as const
export type SandboxMode = typeof SANDBOX_MODES[number]

export interface SandboxPolicy {
  mode: SandboxMode
  workspaceRoot?: string
  writableRoots: string[]
  protectedPaths: string[]
  networkAllowed: boolean
}

export const ALWAYS_PROTECTED_PATH_SEGMENTS = [
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  'node_modules',
] as const

export function buildPolicy(mode: SandboxMode, workspaceRoot?: string): SandboxPolicy {
  const protectedPaths = [...ALWAYS_PROTECTED_PATH_SEGMENTS]

  switch (mode) {
    case 'read-only':
      return {
        mode,
        workspaceRoot,
        writableRoots: [],
        protectedPaths,
        networkAllowed: false,
      }

    case 'workspace-write':
      return {
        mode,
        workspaceRoot,
        writableRoots: workspaceRoot ? [workspaceRoot] : [],
        protectedPaths,
        networkAllowed: true,
      }

    case 'full-access':
      return {
        mode,
        workspaceRoot,
        writableRoots: [],
        protectedPaths: [],
        networkAllowed: true,
      }
  }
}
