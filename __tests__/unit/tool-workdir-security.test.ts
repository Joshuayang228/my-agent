import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-tool-workdir-'))
const globalRoot = path.join(baseDir, 'global')
const childRoot = path.join(baseDir, 'child')
fs.mkdirSync(globalRoot, { recursive: true })
fs.mkdirSync(childRoot, { recursive: true })

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('../../electron/main/sandbox/effective-sandbox', () => ({ loadEffectiveSandbox: async () => 'workspace-write' }))
vi.mock('../../electron/main/agent/project-memory', () => ({ getWorkspaceRoot: () => globalRoot }))
vi.mock('../../electron/main/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  hashForLog: (value: string) => `hash:${value.length}`,
}))

import { applyPatchTool } from '../../electron/main/tools/builtins/apply-patch'
import { sessionFileChangeMiddleware } from '../../electron/main/tools/session-file-change-middleware'
import { _resetSessionFileChangesForTests, listSessionFileChanges } from '../../electron/main/agent/session-file-changes'

describe('写工具 ToolContext.workdir 隔离', () => {
  beforeEach(() => {
    _resetSessionFileChangesForTests()
    fs.writeFileSync(path.join(globalRoot, 'note.txt'), 'global\n')
    fs.writeFileSync(path.join(childRoot, 'note.txt'), 'child-old\n')
  })

  afterAll(() => fs.rmSync(baseDir, { recursive: true, force: true }))

  it('apply_patch 修改子 Agent workdir，不退回全局项目', async () => {
    const result = await applyPatchTool.execute({
      path: 'note.txt',
      patch: '--- a/note.txt\n+++ b/note.txt\n@@ -1,1 +1,1 @@\n-child-old\n+child-new',
    }, { workdir: childRoot })

    expect(result).toContain('补丁应用成功')
    expect(fs.readFileSync(path.join(childRoot, 'note.txt'), 'utf-8')).toBe('child-new\n')
    expect(fs.readFileSync(path.join(globalRoot, 'note.txt'), 'utf-8')).toBe('global\n')
  })

  it('会话文件变更中间件从子 Agent workdir 读取 before 并记录真实路径', async () => {
    const ctx = {
      call: { id: 'c1', name: 'file_edit', arguments: '{}' },
      tool: applyPatchTool,
      args: { path: 'note.txt' },
      toolContext: { workdir: childRoot, sessionId: 'session-1' },
    }
    const result = await sessionFileChangeMiddleware(ctx, async () => {
      fs.writeFileSync(path.join(childRoot, 'note.txt'), 'child-after\n')
      return { callId: 'c1', name: 'file_edit', content: 'ok' }
    })

    expect(result.content).toBe('ok')
    const records = listSessionFileChanges('session-1')
    expect(records).toHaveLength(1)
    expect(records[0].path).toBe(path.join(childRoot, 'note.txt'))
    expect(records[0].before).toBe('child-old\n')
  })
})
