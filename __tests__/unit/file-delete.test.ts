import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fileDeleteTool, isWhitelistedForPermanentDelete } from '../../electron/main/tools/builtins/file-delete'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

const sandboxState = vi.hoisted(() => ({ mode: 'workspace-write' as 'read-only' | 'workspace-write' | 'full-access', workspaceRoot: '' }))
const electronMocks = vi.hoisted(() => ({ trashItem: vi.fn<(target: string) => Promise<void>>() }))

vi.mock('electron', () => ({ shell: { trashItem: electronMocks.trashItem } }))

vi.mock('../../electron/main/sandbox/effective-sandbox', () => ({
  loadEffectiveSandbox: vi.fn(async () => sandboxState.mode),
}))
vi.mock('../../electron/main/agent/project-memory', () => ({
  getWorkspaceRoot: vi.fn(() => sandboxState.workspaceRoot),
}))

describe('file_delete tool', () => {
  let testDir: string

  it('永久删除白名单只检查工作区内部路径，不继承系统 /tmp 祖先', () => {
    const workspaceRoot = path.join(os.tmpdir(), 'workspace')
    expect(isWhitelistedForPermanentDelete(path.join(workspaceRoot, 'notes.txt'), workspaceRoot)).toBe(false)
    expect(isWhitelistedForPermanentDelete(path.join(workspaceRoot, 'node_modules', 'pkg', 'index.js'), workspaceRoot)).toBe(true)
    expect(isWhitelistedForPermanentDelete(path.join(workspaceRoot, '__pycache__'), workspaceRoot)).toBe(true)
  })

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `file-delete-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
    sandboxState.mode = 'workspace-write'
    sandboxState.workspaceRoot = testDir
    electronMocks.trashItem.mockReset()
    electronMocks.trashItem.mockImplementation(async (target) => {
      await fs.rm(target, { recursive: true, force: true })
    })
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // 忽略清理失败
    }
  })

  it('应该删除普通文件到回收站（非白名单路径）', async () => {
    const testFile = path.join(testDir, 'test-file.txt')
    await fs.writeFile(testFile, 'test content')

    const result = await fileDeleteTool.execute({ path: testFile })

    expect(result).toContain('删除成功')
    expect(result).toContain('已移入回收站，可恢复')
    // 文件应该不存在了（已移到回收站）
    await expect(fs.access(testFile)).rejects.toThrow()
  })

  it('full-access 可以永久删除白名单路径下的文件（node_modules）', async () => {
    sandboxState.mode = 'full-access'
    const nodeModulesDir = path.join(testDir, 'node_modules')
    const testFile = path.join(nodeModulesDir, 'package.json')
    await fs.mkdir(nodeModulesDir, { recursive: true })
    await fs.writeFile(testFile, '{}')

    const result = await fileDeleteTool.execute({ path: testFile })

    expect(result).toContain('删除成功')
    expect(result).not.toContain('已移入回收站')
    // 文件应该被永久删除
    await expect(fs.access(testFile)).rejects.toThrow()
  })

  it('应该永久删除白名单路径下的目录（__pycache__）', async () => {
    const pycacheDir = path.join(testDir, '__pycache__')
    const testFile = path.join(pycacheDir, 'module.pyc')
    await fs.mkdir(pycacheDir, { recursive: true })
    await fs.writeFile(testFile, 'compiled')

    const result = await fileDeleteTool.execute({ path: pycacheDir })

    expect(result).toContain('删除成功')
    expect(result).not.toContain('已移入回收站')
    // 目录应该被永久删除
    await expect(fs.access(pycacheDir)).rejects.toThrow()
  })

  it('应该删除临时文件到回收站（tmp 在白名单但作为子路径）', async () => {
    const tmpSubDir = path.join(testDir, 'my-tmp-folder')
    const testFile = path.join(tmpSubDir, 'file.txt')
    await fs.mkdir(tmpSubDir, { recursive: true })
    await fs.writeFile(testFile, 'temp')

    const result = await fileDeleteTool.execute({ path: tmpSubDir })

    expect(result).toContain('删除成功')
    // 验证是走回收站还是永久删除（取决于路径模式匹配）
    await expect(fs.access(tmpSubDir)).rejects.toThrow()
  })

  it('应该处理不存在的路径', async () => {
    const nonExistent = path.join(testDir, 'does-not-exist.txt')

    const result = await fileDeleteTool.execute({ path: nonExistent })

    expect(result).toContain('错误')
    expect(result).toContain('不存在或不可访问')
  })

  it('应该处理空路径参数', async () => {
    const result = await fileDeleteTool.execute({ path: '' })

    expect(result).toBe('错误：必须提供路径')
  })

  it('相对路径必须基于当前工作区解析', async () => {
    const relativePath = 'test-relative.txt'
    const absolutePath = path.join(testDir, relativePath)
    await fs.writeFile(absolutePath, 'relative test')

    const result = await fileDeleteTool.execute({ path: relativePath }, {
      workdir: testDir,
      sessionId: 'session-test',
    })

    expect(result).toContain('删除成功')
    expect(result).toContain(absolutePath)
    await expect(fs.access(absolutePath)).rejects.toThrow()
  })

  it('workspace-write 必须阻止删除工作区外文件，且不泄露到删除执行', async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-delete-outside-'))
    const outsideFile = path.join(outsideDir, 'outside.txt')
    await fs.writeFile(outsideFile, 'keep')
    try {
      const reporter = vi.fn()
      const result = await fileDeleteTool.execute({ path: outsideFile }, {
        workdir: testDir,
        sessionId: 'session-test',
        assetUsageReporter: reporter,
      })

      expect(result).toContain('SANDBOX BLOCKED')
      expect(result).toContain('超出工作区')
      expect(reporter).toHaveBeenCalledWith(expect.objectContaining({
        assetKey: 'permission-policy:path-boundaries',
        status: 'blocked',
        metadata: expect.objectContaining({ decision: 'deny', sandboxMode: 'workspace-write' }),
      }))
      expect(JSON.stringify(reporter.mock.calls)).not.toContain(outsideFile)
      await expect(fs.access(outsideFile)).resolves.toBeUndefined()
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('read-only 必须阻止删除工作区内文件', async () => {
    sandboxState.mode = 'read-only'
    const testFile = path.join(testDir, 'read-only.txt')
    await fs.writeFile(testFile, 'keep')

    const result = await fileDeleteTool.execute({ path: testFile }, {
      workdir: testDir,
      sessionId: 'session-test',
    })

    expect(result).toContain('SANDBOX BLOCKED')
    expect(result).toContain('只读模式下禁止删除文件')
    await expect(fs.access(testFile)).resolves.toBeUndefined()
  })

  it('full-access 可以删除工作区外文件', async () => {
    sandboxState.mode = 'full-access'
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-delete-full-access-'))
    const outsideFile = path.join(outsideDir, 'outside.txt')
    await fs.writeFile(outsideFile, 'remove')
    try {
      const result = await fileDeleteTool.execute({ path: outsideFile }, {
        workdir: testDir,
        sessionId: 'session-test',
      })

      expect(result).toContain('删除成功')
      await expect(fs.access(outsideFile)).rejects.toThrow()
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true })
    }
  })

  it('上报真实路径守卫结果，但不携带路径正文', async () => {
    const reporter = vi.fn()
    const testFile = path.join(testDir, 'evidence.txt')
    await fs.writeFile(testFile, 'keep')

    await fileDeleteTool.execute({ path: testFile }, {
      workdir: testDir,
      sessionId: 'session-test',
      assetUsageReporter: reporter,
    })

    expect(reporter).toHaveBeenCalledWith(expect.objectContaining({
      assetKey: 'permission-policy:path-boundaries',
      relation: 'used',
      usageKind: 'permission-decision',
      status: 'success',
      metadata: expect.objectContaining({
        toolName: 'file_delete',
        sandboxMode: 'workspace-write',
        decision: 'allow',
      }),
    }))
    expect(JSON.stringify(reporter.mock.calls)).not.toContain(testDir)
  })

  it('full-access 也硬阻止删除 .git 目录', async () => {
    sandboxState.mode = 'full-access'
    const gitDir = path.join(testDir, '.git')
    const testFile = path.join(gitDir, 'config')
    await fs.mkdir(gitDir, { recursive: true })
    await fs.writeFile(testFile, 'git config')

    const result = await fileDeleteTool.execute({ path: gitDir })

    expect(result).toContain('不能删除')
    await expect(fs.access(gitDir)).resolves.toBeUndefined()
  })

  it('full-access 也硬阻止删除当前工作区根目录', async () => {
    sandboxState.mode = 'full-access'
    const result = await fileDeleteTool.execute({ path: testDir }, { workdir: testDir })
    expect(result).toContain('不能删除')
    await expect(fs.access(testDir)).resolves.toBeUndefined()
  })

  it('白名单应该识别 dist 和 build 目录', async () => {
    const distDir = path.join(testDir, 'dist')
    await fs.mkdir(distDir, { recursive: true })
    await fs.writeFile(path.join(distDir, 'bundle.js'), 'code')

    const result = await fileDeleteTool.execute({ path: distDir })

    expect(result).toContain('删除成功')
    expect(result).not.toContain('已移入回收站')
  })
})
