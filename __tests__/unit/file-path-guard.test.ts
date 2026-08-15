import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkFileReadSandbox,
  checkFileWriteSandbox,
  isPathInsideRoot,
  resolveToolFilePath,
  resolveToolReadPath,
} from '../../electron/main/sandbox/file-path-guard'

describe('file-path-guard', () => {
  const root = path.resolve('/tmp/ws-root')

  it('resolveToolFilePath：相对路径基于工作区', () => {
    expect(resolveToolFilePath('notes/a.md', root)).toBe(path.resolve(root, 'notes/a.md'))
  })

  it('resolveToolFilePath：绝对路径保持绝对', () => {
    const abs = path.resolve('/elsewhere/x.md')
    expect(resolveToolFilePath(abs, root)).toBe(abs)
  })

  it('isPathInsideRoot：子路径允许，越界拒绝', () => {
    expect(isPathInsideRoot(path.join(root, 'a.ts'), root)).toBe(true)
    expect(isPathInsideRoot(root, root)).toBe(true)
    expect(isPathInsideRoot(path.resolve(root, '..', 'other', 'a.ts'), root)).toBe(false)
  })

  it('读取路径会解析 symlink；不存在路径 fail-closed', () => {
    expect(resolveToolReadPath(path.join(root, 'missing.txt'))).toBeNull()
  })

  it('非 full-access 的读取限制在工作区并保护凭据文件', () => {
    expect(checkFileReadSandbox(path.join(root, 'src/a.ts'), 'read-only', root)).toBeNull()
    expect(checkFileReadSandbox(path.resolve(root, '..', 'outside.txt'), 'workspace-write', root)).toContain('超出工作区')
    expect(checkFileReadSandbox(path.join(root, '.env.local'), 'workspace-write', root)).toContain('受保护')
    expect(checkFileReadSandbox(path.join(root, '.git/config'), 'workspace-write', root)).toContain('受保护')
    expect(checkFileReadSandbox(path.resolve('/etc/passwd'), 'full-access', root)).toBeNull()
  })

  it('没有打开项目时读取 fail-closed', () => {
    expect(checkFileReadSandbox(path.join(root, 'a.ts'), 'workspace-write')).toContain('尚未打开项目')
  })

  it('read-only 一律拦截，并提示确认≠绕过', () => {
    const msg = checkFileWriteSandbox(path.join(root, 'a.ts'), 'read-only', root)
    expect(msg).toContain('SANDBOX BLOCKED')
    expect(msg).toContain('只读')
    expect(msg).toContain('不会绕过沙箱')
    expect(msg).toContain('对话页')
  })

  it('workspace-write 越界拦截', () => {
    const outside = path.resolve(root, '..', 'outside.ts')
    const msg = checkFileWriteSandbox(outside, 'workspace-write', root)
    expect(msg).toContain('超出工作区')
    expect(msg).toContain('允许')
    expect(msg).toContain('完全访问')
  })

  it('workspace-write 工作区内允许', () => {
    expect(checkFileWriteSandbox(path.join(root, 'src/a.ts'), 'workspace-write', root)).toBeNull()
  })

  it('full-access 不拦', () => {
    expect(checkFileWriteSandbox(path.resolve('/etc/passwd'), 'full-access', root)).toBeNull()
  })

  it('受保护段拦截', () => {
    const msg = checkFileWriteSandbox(path.join(root, '.env'), 'workspace-write', root)
    expect(msg).toContain('受保护')
  })
})
