/**
 * 右坞命令控制台（非交互式 PTY）
 */

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { Play, Square } from 'lucide-react'
import { IconButton } from '../../foundation/IconButton'
import { TextField } from '../../foundation/TextField'

interface TerminalPanelProps {
  projectPath: string | null
}

interface RunAttempt {
  runId: string | null
  cancelRequested: boolean
  stopping: boolean
  disposed: boolean
}

export function TerminalPanel({ projectPath }: TerminalPanelProps) {
  const [lines, setLines] = useState<string[]>([
    '命令控制台（非完整终端）。在当前工作区执行命令；受对话页审批/沙箱约束。',
    '',
  ])
  const [cmd, setCmd] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const attemptRef = useRef<RunAttempt | null>(null)
  const [busy, setBusy] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [status, setStatus] = useState<'idle' | 'running' | 'stopping' | 'success' | 'error'>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    const api = window.electronAPI?.terminal
    if (!api) return
    const offOut = api.onStdout((ev) => {
      if (!attemptRef.current?.runId || ev.runId !== attemptRef.current.runId) return
      setLines((prev) => appendTerminalOutput(prev, ev.chunk))
    })
    const offErr = api.onStderr((ev) => {
      if (!attemptRef.current?.runId || ev.runId !== attemptRef.current.runId) return
      setLines((prev) => appendTerminalOutput(prev, ev.chunk))
    })
    const offExit = api.onExit((ev) => {
      if (!attemptRef.current?.runId || ev.runId !== attemptRef.current.runId) return
      setLines((prev) => [...prev, ev.code === 0 ? '[命令已完成]' : `[命令失败，退出码 ${ev.code}]`])
      setStatus(ev.code === 0 ? 'success' : 'error')
      setBusy(false)
      attemptRef.current = null
      setStopping(false)
    })
    return () => {
      offOut()
      offErr()
      offExit()
    }
  }, [])

  // 关闭面板和手动终止共用请求，但仅当前仍挂载的运行可更新 UI；迟到的旧响应不得清空新运行。
  const stopAttempt = async (attempt: RunAttempt) => {
    if (!attempt.runId || attempt.stopping) return
    attempt.stopping = true
    try {
      const result = await window.electronAPI?.terminal.kill(attempt.runId)
      if (!result?.ok) throw new Error('Terminal stop was not acknowledged')
      if (!attempt.disposed && attemptRef.current === attempt) {
        attemptRef.current = null
        setBusy(false)
        setStopping(false)
        setStatus('idle')
        setLines((prev) => [...prev, '[已发送终止请求]'])
      }
    } catch {
      if (attempt.disposed) {
        console.warn('[TerminalPanel] 关闭后的命令清理未获确认')
      } else if (attemptRef.current === attempt) {
        attempt.cancelRequested = false
        setStopping(false)
        setStatus('error')
        setLines((prev) => [...prev, '[终止失败，请重试；命令可能仍在运行]'])
      }
    } finally {
      attempt.stopping = false
    }
  }

  const run = async () => {
    const command = cmd.trim()
    if (!command || attemptRef.current) return
    const attempt: RunAttempt = { runId: null, cancelRequested: false, stopping: false, disposed: false }
    attemptRef.current = attempt
    setLines((prev) => [...prev, `$ ${command}`, ''])
    setCommandHistory((prev) => prev[prev.length - 1] === command ? prev : [...prev, command])
    setHistoryIndex(-1)
    setCmd('')
    setBusy(true)
    setStatus('running')
    try {
      const result = await window.electronAPI?.terminal.run({ command, cwd: projectPath || undefined })
      if (result?.ok) {
        attempt.runId = result.runId
        void window.electronAPI?.terminal.ready(result.runId)
        // 启动 IPC 无取消句柄；不能在 pending 时忘记本次运行，拿到 ID 后仍须清理。
        if (attempt.cancelRequested || attempt.disposed) await stopAttempt(attempt)
        return
      }
      if (!attempt.disposed && attemptRef.current === attempt) {
        setLines((prev) => [...prev, result ? result.error : '[无法连接命令服务，请重试]'])
        setStatus('error')
      }
    } catch {
      if (!attempt.disposed && attemptRef.current === attempt) {
        setLines((prev) => [...prev, '[启动失败，请重试]'])
        setStatus('error')
      }
    }
    if (!attempt.disposed && attemptRef.current === attempt) {
      attemptRef.current = null
      setBusy(false)
      setStopping(false)
      setCmd(command)
    }
  }

  useEffect(() => () => {
    const attempt = attemptRef.current
    if (!attempt) return
    attempt.disposed = true
    attempt.cancelRequested = true
    attemptRef.current = null
    void stopAttempt(attempt)
  }, [])

  const kill = () => {
    const attempt = attemptRef.current
    if (!attempt || attempt.cancelRequested) return
    attempt.cancelRequested = true
    setStopping(true)
    setStatus('stopping')
    void stopAttempt(attempt)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex shrink-0 items-center justify-between border-b px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
        <span className="truncate" title={projectPath || undefined}>{projectPath || '当前进程工作目录'}</span>
        <span data-testid="workspace-terminal-status" className="ml-2 shrink-0" style={{ color: status === 'error' ? 'var(--danger)' : status === 'success' ? 'var(--success)' : status === 'running' || status === 'stopping' ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{status === 'running' ? '运行中' : status === 'stopping' ? '正在停止' : status === 'success' ? '已完成' : status === 'error' ? '失败' : '待命'}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto scrollbar-hover p-2 font-mono text-[11px] leading-relaxed select-text" style={{ color: 'var(--text-secondary)' }}>
        {lines.map((l, i) => (
          <div key={`${i}-${l.slice(0, 12)}`} className="whitespace-pre-wrap break-all">{l || ' '}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div
        className="flex shrink-0 items-center gap-1 border-t px-2 py-1.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>$</span>
        <TextField
          className="flex-1 font-mono text-[11px]"
          value={cmd}
          disabled={busy}
          placeholder={projectPath ? '输入命令…' : '未打开项目时在进程 cwd 执行'}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setCmd(e.target.value)
            setHistoryIndex(-1)
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !busy && commandHistory.length > 0) {
              e.preventDefault()
              if (e.key === 'ArrowUp') {
                const nextIndex = historyIndex < 0 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
                setHistoryIndex(nextIndex)
                setCmd(commandHistory[nextIndex])
              } else if (historyIndex >= 0) {
                const nextIndex = historyIndex + 1
                if (nextIndex >= commandHistory.length) {
                  setHistoryIndex(-1)
                  setCmd('')
                } else {
                  setHistoryIndex(nextIndex)
                  setCmd(commandHistory[nextIndex])
                }
              }
              return
            }
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void run()
            }
          }}
        />
        <IconButton type="button" size={24} className="disabled:opacity-50"
          style={{ color: busy ? 'var(--danger)' : 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
          title={stopping ? '正在终止' : busy ? '终止' : '运行'}
          label={stopping ? '正在终止' : busy ? '终止' : '运行'}
          disabled={stopping || (!busy && !cmd.trim())}
          onClick={() => { if (busy) kill(); else void run() }}>
          {busy ? <Square size={12} /> : <Play size={12} />}
        </IconButton>
      </div>
    </div>
  )
}

/** 输出块边界不代表换行；保留未完成行，避免 IPC 分片改变命令的真实输出。 */
export function appendTerminalOutput(lines: string[], chunk: string): string[] {
  const text = (lines[lines.length - 1] ?? '') + chunk
  return [...lines.slice(0, -1), ...text.replace(/\r\n/g, '\n').split('\n')]
}
