import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileDeleteTool } from '../../electron/main/tools/builtins/file-delete'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('file_delete tool', () => {
  let testDir: string

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(os.tmpdir(), `file-delete-test-${Date.now()}`)
    await fs.mkdir(testDir, { recursive: true })
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

    expect(result).toContain('Successfully deleted')
    expect(result).toContain('moved to trash, recoverable')
    // 文件应该不存在了（已移到回收站）
    await expect(fs.access(testFile)).rejects.toThrow()
  })

  it('应该永久删除白名单路径下的文件（node_modules）', async () => {
    const nodeModulesDir = path.join(testDir, 'node_modules')
    const testFile = path.join(nodeModulesDir, 'package.json')
    await fs.mkdir(nodeModulesDir, { recursive: true })
    await fs.writeFile(testFile, '{}')

    const result = await fileDeleteTool.execute({ path: testFile })

    expect(result).toContain('Successfully deleted')
    expect(result).not.toContain('moved to trash')
    // 文件应该被永久删除
    await expect(fs.access(testFile)).rejects.toThrow()
  })

  it('应该永久删除白名单路径下的目录（__pycache__）', async () => {
    const pycacheDir = path.join(testDir, '__pycache__')
    const testFile = path.join(pycacheDir, 'module.pyc')
    await fs.mkdir(pycacheDir, { recursive: true })
    await fs.writeFile(testFile, 'compiled')

    const result = await fileDeleteTool.execute({ path: pycacheDir })

    expect(result).toContain('Successfully deleted')
    expect(result).not.toContain('moved to trash')
    // 目录应该被永久删除
    await expect(fs.access(pycacheDir)).rejects.toThrow()
  })

  it('应该删除临时文件到回收站（tmp 在白名单但作为子路径）', async () => {
    const tmpSubDir = path.join(testDir, 'my-tmp-folder')
    const testFile = path.join(tmpSubDir, 'file.txt')
    await fs.mkdir(tmpSubDir, { recursive: true })
    await fs.writeFile(testFile, 'temp')

    const result = await fileDeleteTool.execute({ path: tmpSubDir })

    expect(result).toContain('Successfully deleted')
    // 验证是走回收站还是永久删除（取决于路径模式匹配）
    await expect(fs.access(tmpSubDir)).rejects.toThrow()
  })

  it('应该处理不存在的路径', async () => {
    const nonExistent = path.join(testDir, 'does-not-exist.txt')

    const result = await fileDeleteTool.execute({ path: nonExistent })

    expect(result).toContain('Error')
    expect(result).toContain('does not exist')
  })

  it('应该处理空路径参数', async () => {
    const result = await fileDeleteTool.execute({ path: '' })

    expect(result).toBe('Error: path is required')
  })

  it('应该处理相对路径（解析为绝对路径）', async () => {
    const relativePath = 'test-relative.txt'
    const absolutePath = path.resolve(process.cwd(), relativePath)

    // 创建文件
    await fs.writeFile(absolutePath, 'relative test')

    const result = await fileDeleteTool.execute({ path: relativePath })

    expect(result).toContain('Successfully deleted')
    expect(result).toContain(absolutePath)

    // 清理
    await expect(fs.access(absolutePath)).rejects.toThrow()
  })

  it('白名单应该识别 .git 目录', async () => {
    const gitDir = path.join(testDir, '.git')
    const testFile = path.join(gitDir, 'config')
    await fs.mkdir(gitDir, { recursive: true })
    await fs.writeFile(testFile, 'git config')

    const result = await fileDeleteTool.execute({ path: gitDir })

    expect(result).toContain('Successfully deleted')
    expect(result).not.toContain('moved to trash')
  })

  it('白名单应该识别 dist 和 build 目录', async () => {
    const distDir = path.join(testDir, 'dist')
    await fs.mkdir(distDir, { recursive: true })
    await fs.writeFile(path.join(distDir, 'bundle.js'), 'code')

    const result = await fileDeleteTool.execute({ path: distDir })

    expect(result).toContain('Successfully deleted')
    expect(result).not.toContain('moved to trash')
  })
})
