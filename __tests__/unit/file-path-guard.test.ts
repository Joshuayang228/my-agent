import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkFileWriteSandbox,
  isPathInsideRoot,
  resolveToolFilePath,
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
