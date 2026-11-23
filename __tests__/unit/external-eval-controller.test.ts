import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseExternalEvalRequest } from '../../electron/main/debug/external-controller'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-agent-ext-eval-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('parseExternalEvalRequest', () => {
  it('accepts legacy minimal payload with id and prompt', () => {
    const parsed = parseExternalEvalRequest({ id: 'tau3-0', prompt: 'hello' })
    expect(parsed).toEqual({
      id: 'tau3-0',
      prompt: 'hello',
      sessionId: undefined,
      workspaceRoot: undefined,
      allowWorkspaceWrites: false,
      mcpServers: undefined,
    })
  })

  it('rejects missing id or prompt', () => {
    expect(() => parseExternalEvalRequest({ id: '', prompt: 'hello' })).toThrow('id and prompt are required')
    expect(() => parseExternalEvalRequest({ id: 't1', prompt: '   ' })).toThrow('id and prompt are required')
  })

  it('rejects allowWorkspaceWrites without workspaceRoot', () => {
    expect(() => parseExternalEvalRequest({
      id: 'acb-1',
      prompt: 'edit file',
      allowWorkspaceWrites: true,
    })).toThrow('allowWorkspaceWrites requires workspaceRoot')
  })

  it('rejects relative or non-existent workspaceRoot', () => {
    expect(() => parseExternalEvalRequest({
      id: 'acb-1',
      prompt: 'edit file',
      workspaceRoot: './relative-dir',
    })).toThrow('workspaceRoot must be an absolute directory path')

    const missing = path.join(os.tmpdir(), `my-agent-missing-${Date.now()}`)
    expect(() => parseExternalEvalRequest({
      id: 'acb-1',
      prompt: 'edit file',
      workspaceRoot: missing,
    })).toThrow('workspaceRoot does not exist or is not a directory')
  })

  it('accepts valid isolated workspaceRoot, sessionId, and allowWorkspaceWrites', () => {
    const dir = makeTempDir()
    const parsed = parseExternalEvalRequest({
      id: 'acb-session-resume-t2',
      prompt: 'Implement that fix now.',
      sessionId: 'sess-123',
      workspaceRoot: dir,
      allowWorkspaceWrites: true,
    })
    expect(parsed).toEqual({
      id: 'acb-session-resume-t2',
      prompt: 'Implement that fix now.',
      sessionId: 'sess-123',
      workspaceRoot: path.resolve(dir),
      allowWorkspaceWrites: true,
      mcpServers: undefined,
    })
  })

  it('validates mcpServers require workspaceRoot and valid command/args', () => {
    expect(() => parseExternalEvalRequest({
      id: 'acb-mcp',
      prompt: 'call mcp',
      mcpServers: [{ id: 'relay', command: 'node', args: ['server.mjs'] }],
    })).toThrow('mcpServers requires workspaceRoot')

    const dir = makeTempDir()
    const parsed = parseExternalEvalRequest({
      id: 'acb-mcp',
      prompt: 'call mcp',
      workspaceRoot: dir,
      mcpServers: [{ id: 'relay', command: 'node', args: ['server.mjs'], cwd: dir }],
    })
    expect(parsed.mcpServers).toEqual([
      { id: 'relay', command: 'node', args: ['server.mjs'], cwd: path.resolve(dir), env: undefined },
    ])
  })
})
