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
const HANDSHAKE_TIMEOUT_MS = 10_000
const STOP_TIMEOUT_MS = 5_000
export const MAX_TERMINAL_OUTPUT_CHARS = 2 * 1024 * 1024
const MAX_COMMAND_LENGTH = 100_000
const MAX_CWD_LENGTH = 4_096

type TerminalRun = {
  child: ChildProcessWithoutNullStreams
  senderId: number
  ready: boolean
  buffered: Array<{ channel: 'terminal:stdout' | 'terminal:stderr'; chunk: string }>
  bufferedExit?: number
  closed: boolean
  abandoned: boolean
  stopping?: Promise<boolean>
  release: () => void
  onReady: () => void
}

const runs = new Map<string, TerminalRun>()

/**
 * 背景：右坞“终止”面对的可能是 shell 再派生出来的编译器、脚本或包管理器进程树，单独 kill shell 会留下后台子进程。
 * 设计意图：Windows 使用 taskkill 的树终止能力，类 Unix 保留进程组信号；不把 Renderer 的即时应答当成退出事实。
 * 关键约束：调用方必须是发起该 run 的 webContents；成功以 close 为准，error 不能假定进程已退出。
 */
function terminateProcessTree(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (!child.pid) return Promise.resolve()
  if (process.platform === 'win32') {
    return new Promise((resolve, reject) => {
      execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, timeout: STOP_TIMEOUT_MS }, (error) => error ? reject(error) : resolve())
    })
  }
  process.kill(-child.pid, 'SIGTERM')
  return Promise.resolve()
}

function waitForClose(run: TerminalRun, timeoutMs: number): Promise<boolean> {
  if (run.closed) return Promise.resolve(true)
  return new Promise((resolve) => {
    const finish = (closed: boolean) => {
      clearTimeout(timer)
      run.child.removeListener('close', onClose)
      resolve(closed)
    }
    const onClose = () => finish(true)
    const timer = setTimeout(() => finish(false), timeoutMs)
    run.child.once('close', onClose)
  })
}

/** 关闭、超时和手动终止共享一次停止请求；失败保留运行记录，不能用信号回执提前恢复 UI。 */
function stopRun(run: TerminalRun): Promise<boolean> {
  if (run.closed) return Promise.resolve(true)
  if (run.stopping) return run.stopping
  run.stopping = (async () => {
    try {
      await terminateProcessTree(run.child)
      if (process.platform !== 'win32' && !(await waitForClose(run, 1_000)) && run.child.pid) {
        process.kill(-run.child.pid, 'SIGKILL')
      }
      return await waitForClose(run, STOP_TIMEOUT_MS)
    } catch (error) {
      if (run.closed) return true
      log.warn('Terminal termination failed', { errorType: error instanceof Error ? error.name : 'unknown' })
      return false
    }
  })().finally(() => { run.stopping = undefined })
  return run.stopping
}

export function limitTerminalOutput(text: string, emittedChars: number): {
  chunk: string
  nextEmittedChars: number
  limitReached: boolean
} {
  const remaining = Math.max(0, MAX_TERMINAL_OUTPUT_CHARS - emittedChars)
  const accepted = text.slice(0, remaining)
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
      if (sender.isDestroyed()) return { ok: false, error: '命令窗口已关闭' }
      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/sh'
      const shellArgs = isWin ? ['/d', '/s', '/c', command] : ['-c', command]

      const child = spawn(shell, shellArgs, {
        cwd,
        env: buildSafeChildProcessEnv(),
        windowsHide: true,
        detached: !isWin,
      })
      const run: TerminalRun = {
        child, senderId: sender.id, ready: false, buffered: [], closed: false, abandoned: false,
        onReady: () => clearTimeout(readyTimer),
        release: () => {
          clearTimeout(timer)
          clearTimeout(readyTimer)
          sender.removeListener('destroyed', abandon)
          sender.removeListener('render-process-gone', abandon)
          runs.delete(runId)
        },
      }
      runs.set(runId, run)

      const send = (channel: string, payload: Record<string, unknown>) => {
        if (!sender.isDestroyed()) sender.send(channel, payload)
      }
      const publishOutput = (channel: 'terminal:stdout' | 'terminal:stderr', text: string) => {
        if (run.abandoned) return
        for (let offset = 0; offset < text.length; offset += MAX_CHUNK) {
          const chunk = text.slice(offset, offset + MAX_CHUNK)
          if (run.ready) send(channel, { runId, chunk })
          else run.buffered.push({ channel, chunk })
        }
      }
      const stopAutomatically = (reason: string) => {
        publishOutput('terminal:stderr', `\n[${reason}，正在终止进程]\n`)
        void stopRun(run).then((stopped) => {
          if (!stopped) publishOutput('terminal:stderr', '\n[终止失败，命令可能仍在运行，请重试]\n')
        })
      }
      let emittedChars = 0
      let outputLimitHit = false
      const sendOutput = (channel: 'terminal:stdout' | 'terminal:stderr', text: string) => {
        if (outputLimitHit || run.abandoned) return
        const limited = limitTerminalOutput(text, emittedChars)
        emittedChars = limited.nextEmittedChars
        if (limited.chunk) publishOutput(channel, limited.chunk)
        if (limited.limitReached) {
          outputLimitHit = true
          stopAutomatically(`输出达到 ${MAX_TERMINAL_OUTPUT_CHARS} 个字符上限`)
        }
      }

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (text: string) => sendOutput('terminal:stdout', text))
      child.stderr.on('data', (text: string) => sendOutput('terminal:stderr', text))

      const timer = setTimeout(() => {
        stopAutomatically(`超时 ${TIMEOUT_MS / 1000}s`)
      }, TIMEOUT_MS)

      const abandon = () => {
        run.abandoned = true
        run.buffered = []
        clearTimeout(readyTimer)
        if (run.closed) run.release()
        else void stopRun(run).then((stopped) => {
          if (!stopped) log.warn('Abandoned terminal still running', { runId })
        })
      }
      const readyTimer = setTimeout(abandon, HANDSHAKE_TIMEOUT_MS)
      sender.once('destroyed', abandon)
      sender.once('render-process-gone', abandon)

      child.once('close', (code) => {
        run.closed = true
        clearTimeout(timer)
        const exitCode = code ?? -1
        if (run.ready || run.abandoned) {
          run.release()
          if (!run.abandoned) send('terminal:exit', { runId, code: exitCode })
        } else run.bufferedExit = exitCode
      })
      child.on('error', (err) => {
        log.warn('Terminal process failed', { runId, errorType: err.name, errorLength: err.message.length })
        sendOutput('terminal:stderr', '命令进程启动或执行失败。\n')
      })

      log.info('terminal run', { runId, commandHash: hashForLog(command), commandLength: command.length, cwdHash: hashForLog(cwd), mode })
      return { ok: true, runId }
    },
  )

  ipcMain.handle('terminal:ready', (event, runId: unknown) => {
    if (typeof runId !== 'string' || runId.length === 0 || runId.length > 200) return { ok: false }
    const run = runs.get(runId)
    if (!run || run.abandoned || run.senderId !== event.sender.id) return { ok: false }
    run.ready = true
    run.onReady()
    for (const output of run.buffered) {
      if (!event.sender.isDestroyed()) event.sender.send(output.channel, { runId, chunk: output.chunk })
    }
    run.buffered = []
    if (run.bufferedExit !== undefined) {
      if (!event.sender.isDestroyed()) event.sender.send('terminal:exit', { runId, code: run.bufferedExit })
      run.bufferedExit = undefined
      run.release()
    }
    return { ok: true }
  })

  ipcMain.handle('terminal:kill', async (event, runId: unknown) => {
    if (typeof runId !== 'string' || runId.length === 0 || runId.length > 200) return { ok: false }
    const run = runs.get(runId)
    if (!run || run.senderId !== event.sender.id) return { ok: false }
    return { ok: await stopRun(run) }
  })

  log.info('Terminal IPC registered')
}
