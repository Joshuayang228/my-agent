/**
 * 右坞命令控制台 IPC（非 PTY）
 *
 * 背景：Phase 1 不引入 node-pty；提供可跑命令、看输出、可 kill 的控制台。
 * 设计意图：权限与 shell_exec 同源（有效沙箱 + checkCommandPermission）。
 * 关键约束：事件推送到发起 run 的 webContents；超时 30s。
 */

import { ipcMain } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { checkCommandPermission } from '../sandbox/permission-engine'
import { loadEffectiveSandbox } from '../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../agent/project-memory'
import { createLogger } from '../utils/logger'

const log = createLogger('TerminalIPC')
const TIMEOUT_MS = 30_000
const MAX_CHUNK = 8_000

const runs = new Map<string, ChildProcessWithoutNullStreams>()

export function registerTerminalIPC(): void {
  ipcMain.handle(
    'terminal:run',
    async (
      event,
      input: { command: string; cwd?: string },
    ): Promise<{ ok: true; runId: string } | { ok: false; error: string }> => {
      const command = (input?.command || '').trim()
      if (!command) return { ok: false, error: '命令为空' }

      const mode = await loadEffectiveSandbox()
      const workspaceRoot = getWorkspaceRoot()
      const cwd = (input.cwd?.trim() || workspaceRoot || process.cwd())
      const decision = checkCommandPermission(command, cwd, mode, workspaceRoot)

      if (decision.allowed === false) {
        return { ok: false, error: `[SANDBOX BLOCKED] ${decision.reason}` }
      }
      if (decision.allowed === 'needs_approval') {
        return {
          ok: false,
          error: `[SANDBOX BLOCKED] ${decision.reason}\n请在对话中让 Agent 执行并确认，或改用更安全的命令。`,
        }
      }

      const runId = randomUUID()
      const sender = event.sender
      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/sh'
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command]

      const child = spawn(shell, shellArgs, {
        cwd,
        env: process.env,
        windowsHide: true,
      })
      runs.set(runId, child)

      const send = (channel: string, payload: Record<string, unknown>) => {
        if (!sender.isDestroyed()) sender.send(channel, payload)
      }

      child.stdout.on('data', (buf: Buffer) => {
        let text = buf.toString('utf-8')
        if (text.length > MAX_CHUNK) text = text.slice(0, MAX_CHUNK) + '\n…'
        send('terminal:stdout', { runId, chunk: text })
      })
      child.stderr.on('data', (buf: Buffer) => {
        let text = buf.toString('utf-8')
        if (text.length > MAX_CHUNK) text = text.slice(0, MAX_CHUNK) + '\n…'
        send('terminal:stderr', { runId, chunk: text })
      })

      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch { /* ignore */ }
        send('terminal:stderr', { runId, chunk: `\n[超时 ${TIMEOUT_MS / 1000}s，已终止]\n` })
      }, TIMEOUT_MS)

      child.on('close', (code) => {
        clearTimeout(timer)
        runs.delete(runId)
        send('terminal:exit', { runId, code: code ?? -1 })
      })
      child.on('error', (err) => {
        clearTimeout(timer)
        runs.delete(runId)
        send('terminal:stderr', { runId, chunk: err.message + '\n' })
        send('terminal:exit', { runId, code: -1 })
      })

      log.info('terminal run', { runId, command: command.slice(0, 80), cwd, mode })
      return { ok: true, runId }
    },
  )

  ipcMain.handle('terminal:kill', (_e, runId: string) => {
    const child = runs.get(runId)
    if (!child) return { ok: false }
    try {
      child.kill()
    } catch { /* ignore */ }
    runs.delete(runId)
    return { ok: true }
  })

  log.info('Terminal IPC registered')
}
