import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn((...args: unknown[]) => {
    const callback = args.at(-1) as (error: Error | null, stdout: string, stderr: string) => void
    callback(null, '', '')
  }),
}))

vi.mock('node:child_process', () => ({ execFile: execFileMock }))
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false } }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))
vi.mock('../../electron/main/agent/project-memory', () => ({ getWorkspaceRoot: () => null }))

import {
  gitBranchTool,
  gitCommitTool,
  gitDiffTool,
  isSafeGitBranchName,
  isSafeGitRevision,
  resolveGitBranchMetadata,
  resolveGitWorkdir,
} from '../../electron/main/tools/builtins/git-tools'

describe('Git 工具安全边界', () => {
  beforeEach(() => vi.clearAllMocks())

  it('拒绝 ref / 分支 option injection 和非法 ref 形状', () => {
    expect(isSafeGitRevision('HEAD~1')).toBe(true)
    expect(isSafeGitRevision('--output=outside.txt')).toBe(false)
    expect(isSafeGitBranchName('feature/safe-name')).toBe(true)
    expect(isSafeGitBranchName('-D')).toBe(false)
    expect(isSafeGitBranchName('bad..name')).toBe(false)
    expect(isSafeGitBranchName('bad@{name')).toBe(false)
  })

  it('git_branch 只有 list 是只读，其它和未知 action 都 fail-closed', () => {
    expect(resolveGitBranchMetadata({ action: 'list' })).toMatchObject({ isReadOnly: true, isDestructive: false, isConcurrencySafe: true })
    expect(resolveGitBranchMetadata({ action: 'switch' })).toMatchObject({ isReadOnly: false, isDestructive: true, isConcurrencySafe: false })
    expect(resolveGitBranchMetadata({ action: 'unknown' })).toMatchObject({ isReadOnly: false, isDestructive: true, isConcurrencySafe: false })
    expect(gitBranchTool.metadata).toMatchObject({ isReadOnly: false, isDestructive: true, isConcurrencySafe: false })
  })

  it('所有 Git 执行绑定 ToolContext.workdir，缺少工作区不退回 process.cwd', async () => {
    expect(resolveGitWorkdir()).toBeNull()
    const workdir = path.resolve('tmp', 'git-child-worktree')
    expect(resolveGitWorkdir({ workdir })).toBe(workdir)
    await gitDiffTool.execute({}, { workdir })
    expect(execFileMock).toHaveBeenCalledWith(
      'git',
      ['diff'],
      expect.objectContaining({ cwd: workdir }),
      expect.any(Function),
    )
  })

  it('git_diff 在 execFile 前拒绝以 - 开头的 commit/ref', async () => {
    const result = await gitDiffTool.execute({ commit: '--output=outside.txt' }, { workdir: 'C:/repo' })
    expect(result).toContain('commit/ref 参数无效')
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('git add 使用 -- 终止 option 解析', async () => {
    await gitCommitTool.execute({ message: '安全提交', files: '-u src/file.ts' }, { workdir: 'C:/repo' })
    expect(execFileMock).toHaveBeenNthCalledWith(
      1,
      'git',
      ['add', '--', '-u', 'src/file.ts'],
      expect.objectContaining({ cwd: 'C:/repo' }),
      expect.any(Function),
    )
  })
})
