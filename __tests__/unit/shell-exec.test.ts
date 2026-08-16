import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false } }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { resolveShellCwd } from '../../electron/main/tools/builtins/shell-exec'

describe('shell_exec 工作目录', () => {
  it('没有显式 cwd 时仍绑定 ToolContext 工作区', () => {
    const workdir = path.resolve('tmp', 'child-worktree')
    expect(resolveShellCwd(undefined, workdir)).toBe(workdir)
  })

  it('相对 cwd 基于 ToolContext 工作区，绝对 cwd 保持绝对', () => {
    const workdir = path.resolve('tmp', 'child-worktree')
    expect(resolveShellCwd('packages/core', workdir)).toBe(path.join(workdir, 'packages/core'))
    const absolute = path.resolve('tmp', 'another-worktree')
    expect(resolveShellCwd(absolute, workdir)).toBe(absolute)
  })
})
