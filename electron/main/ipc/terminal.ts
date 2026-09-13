/**
 * 右坞命令控制台 IPC（非 PTY）
 *
 * 背景：Phase 1 不引入 node-pty；提供可跑命令、看输出、可 kill 的控制台。
 * 设计意图：权限与 shell_exec 同源（有效沙箱 + checkCommandPermission）。
 * 关键约束：事件推送到发起 run 的 webContents；超时 30s。
 */

import { ipcMain } from 'electron'
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { checkCommandPermission } from '../sandbox/permission-engine'
import { loadEffectiveSandbox } from '../sandbox/effective-sandbox'
import { getWorkspaceRoot } from '../agent/project-memory'
import { createLogger, hashForLog } from '../utils/logger'
import { buildSafeChildProcessEnv } from '../utils/safe-process-env'

const log = createLogger('TerminalIPC')
const TIMEOUT_MS = 30_000
const MAX_CHUNK = 8_000
export const MAX_TERMINAL_OUTPUT_CHARS = 2 * 1024 * 1024
const MAX_COMMAND_LENGTH = 100_000
const MAX_CWD_LENGTH = 4_096

type TerminalRun = {
  child: ChildProcessWithoutNullStreams
  senderId: number
}

const runs = new Map<string, TerminalRun>()

/**
 * 背景：右坞“终止”面对的可能是 shell 再派生出来的编译器、脚本或包管理器进程树，单独 kill shell 会留下后台子进程。
 * 设计意图：Windows 使用 taskkill 的树终止能力，类 Unix 保留进程组信号；不把 Renderer 的即时应答当成退出事实。
 * 关键约束：调用方必须是发起该 run 的 webContents，runs 只在 close/error 事件中回收，否则旧进程的迟到事件和新 run 会混淆。
 */
function terminateProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (!child.pid) return Promise.resolve()
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true }, () => resolve())
    })
  }
  try { process.kill(-child.pid, 'SIGTERM') } catch { try { child.kill('SIGTERM') } catch { /* already exited */ } }
  return Promise.resolve()
}


export function limitTerminalOutput(text: string, emittedChars: number): {
  chunk: string
  nextEmittedChars: number
  limitReached: boolean
} {
  const remaining = Math.max(0, MAX_TERMINAL_OUTPUT_CHARS - emittedChars)
  const accepted = text.slice(0, Math.min(MAX_CHUNK, remaining))
  const nextEmittedChars = emittedChars + accepted.length
  return {
    chunk: accepted,
    nextEmittedChars,
    limitReached: text.length > accepted.length || nextEmittedChars >= MAX_TERMINAL_OUTPUT_CHARS,
  }
}

export function registerTerminalIPC(): void {
  ipcMain.handle(
    'terminal:run',
    async (
      event,
      input: { command: string; cwd?: string },
    ): Promise<{ ok: true; runId: string } | { ok: false; error: string }> => {
      if (!input || typeof input !== 'object' || typeof input.command !== 'string') {
        return { ok: false, error: '命令参数无效' }
      }
      if (input.cwd !== undefined && typeof input.cwd !== 'string') {
        return { ok: false, error: '工作目录参数无效' }
      }
      const command = input.command.trim()
      if (!command) return { ok: false, error: '命令为空' }
      if (command.length > MAX_COMMAND_LENGTH) return { ok: false, error: '命令过长' }

      const mode = await loadEffectiveSandbox()
      const workspaceRoot = getWorkspaceRoot()
      const requestedCwd = input.cwd?.trim() || ''
      if (requestedCwd.length > MAX_CWD_LENGTH) return { ok: false, error: '工作目录路径过长' }
      const cwd = requestedCwd
        ? (path.isAbsolute(requestedCwd) ? path.resolve(requestedCwd) : path.resolve(workspaceRoot || process.cwd(), requestedCwd))
        : (workspaceRoot || process.cwd())
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
        env: buildSafeChildProcessEnv(),
        windowsHide: true,
      })
      runs.set(runId, { child, senderId: sender.id })

      const send = (channel: string, payload: Record<string, unknown>) => {
        if (!sender.isDestroyed()) sender.send(channel, payload)
      }
      let emittedChars = 0
      let outputLimitHit = false
      const sendOutput = (channel: 'terminal:stdout' | 'terminal:stderr', text: string) => {
        if (outputLimitHit) return
        const limited = limitTerminalOutput(text, emittedChars)
        emittedChars = limited.nextEmittedChars
        if (limited.chunk) send(channel, { runId, chunk: limited.chunk })
        if (limited.limitReached) {
          outputLimitHit = true
          send('terminal:stderr', { runId, chunk: `\n[输出超过 ${MAX_TERMINAL_OUTPUT_CHARS} 个字符，已终止进程]\n` })
          void terminateProcessTree(child)
        }
      }

      child.stdout.on('data', (buf: Buffer) => sendOutput('terminal:stdout', buf.toString('utf-8')))
      child.stderr.on('data', (buf: Buffer) => sendOutput('terminal:stderr', buf.toString('utf-8')))

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
        log.warn('Terminal process failed', { runId, errorType: err.name, errorLength: err.message.length })
        send('terminal:stderr', { runId, chunk: '命令进程启动或执行失败。\n' })
        send('terminal:exit', { runId, code: -1 })
      })

      log.info('terminal run', { runId, commandHash: hashForLog(command), commandLength: command.length, cwdHash: hashForLog(cwd), mode })
      return { ok: true, runId }
    },
  )

  ipcMain.handle('terminal:kill', async (event, runId: unknown) => {
    if (typeof runId !== 'string' || runId.length === 0 || runId.length > 200) return { ok: false }
    const run = runs.get(runId)
    if (!run || run.senderId !== event.sender.id) return { ok: false }
    await terminateProcessTree(run.child)
    return { ok: true }
  })

  log.info('Terminal IPC registered')
}
