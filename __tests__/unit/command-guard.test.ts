import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { guardCommand } from '../../electron/main/sandbox/command-guard'
import { buildPolicy } from '../../electron/main/sandbox/policy'

const root = path.join(os.tmpdir(), 'my-agent-command-guard-test')
const outside = path.join(os.tmpdir(), 'my-agent-command-guard-outside')
fs.mkdirSync(root, { recursive: true })
fs.mkdirSync(outside, { recursive: true })

function guard(command: string, mode: 'read-only' | 'workspace-write' | 'full-access' = 'workspace-write', cwd = root) {
  return guardCommand(command, cwd, buildPolicy(mode, root))
}

describe('command-guard', () => {
  it('不会把 node -e / npm 等可执行入口当作安全命令自动放行', () => {
    expect(guard('node -e "require(\\\'fs\\\').readFileSync(\\\'secret\\\')"').allowed).toBe('needs_approval')
    expect(guard('npm test').allowed).toBe('needs_approval')
  })

  it('禁止通过 Shell 控制符、换行或命令替换拼接安全命令', () => {
    for (const command of [
      'cat package.json && type C:\\outside\\secret.txt',
      'echo safe\nrm local-file.txt',
      'echo $(touch local-file.txt)',
    ]) {
      const result = guard(command)
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Shell')
    }
  })

  it('禁止环境变量和 home 展开绕过工作区路径边界', () => {
    expect(guard('cat $HOME/notes.txt').allowed).toBe(false)
    expect(guard('type %USERPROFILE%\\notes.txt').allowed).toBe(false)
    expect(guard('cat ~/notes.txt').allowed).toBe(false)
  })

  it('禁止安全命令显式读取工作区外绝对路径', () => {
    const result = guard(`cat ${path.join(outside, 'secret.txt')}`)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('工作区外')
  })

  it('禁止指定工作区外 cwd', () => {
    const result = guard('pwd', 'workspace-write', outside)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('工作目录')
  })

  it('危险命令在 full-access 仍然 bypass-immune', () => {
    expect(guard('rm -rf /', 'full-access').allowed).toBe(false)
  })

  it('危险命令大小写不敏感', () => {
    expect(guard('RM -RF C:\\', 'full-access').allowed).toBe(false)
    expect(guard('PowerShell -EncodedCommand ZQ==', 'full-access').allowed).toBe(false)
    expect(guard('SHUTDOWN /S', 'full-access').allowed).toBe(false)
    expect(guard('Remove-Item -Recurse -Force C:\\temp', 'full-access').allowed).toBe(false)
  })

  it('不会把带写入或任意执行能力的工具链命令误判为只读', () => {
    expect(guard('find . -delete').allowed).toBe('needs_approval')
    expect(guard('rg --pre dangerous pattern .').allowed).toBe('needs_approval')
    expect(guard('prettier --write src').allowed).toBe('needs_approval')
    expect(guard('eslint --fix src').allowed).toBe('needs_approval')
    expect(guard('npm audit fix').allowed).toBe('needs_approval')
    expect(guard('git branch -D old').allowed).toBe('needs_approval')
    expect(guard('git diff --output=diff.txt').allowed).toBe('needs_approval')
  })

  it('普通工作区内严格只读命令仍可自动执行', () => {
    expect(guard('git status --short').allowed).toBe(true)
    expect(guard('pwd').allowed).toBe(true)
    expect(guard('cat package.json').allowed).toBe(true)
  })
})
