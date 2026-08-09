/**
 * 右坞命令控制台（非交互式 PTY）
 */

import { useEffect, useRef, useState } from 'react'
import { Square } from 'lucide-react'

interface TerminalPanelProps {
  projectPath: string | null
}

export function TerminalPanel({ projectPath }: TerminalPanelProps) {
  const [lines, setLines] = useState<string[]>([
    '命令控制台（非完整终端）。在当前工作区执行命令；受对话页审批/沙箱约束。',
  ])
  const [cmd, setCmd] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  useEffect(() => {
    const api = window.electronAPI?.terminal
    if (!api) return
    const offOut = api.onStdout((ev) => {
      if (runId && ev.runId !== runId) return
      setLines((prev) => [...prev, ...ev.chunk.replace(/\r\n/g, '\n').split('\n')])
    })
    const offErr = api.onStderr((ev) => {
      if (runId && ev.runId !== runId) return
      const parts = ev.chunk.replace(/\r\n/g, '\n').split('\n').map((l) => (l ? `[err] ${l}` : ''))
      setLines((prev) => [...prev, ...parts])
    })
    const offExit = api.onExit((ev) => {
      if (runId && ev.runId !== runId) return
      setLines((prev) => [...prev, `[exit ${ev.code}]`])
      setBusy(false)
      setRunId(null)
    })
    return () => {
      offOut()
      offErr()
      offExit()
    }
  }, [runId])

  const run = async () => {
    const command = cmd.trim()
    if (!command || busy) return
    setLines((prev) => [...prev, `$ ${command}`])
    setCmd('')
    setBusy(true)
    const result = await window.electronAPI?.terminal.run({
      command,
      cwd: projectPath || undefined,
    })
    if (!result) {
      setLines((prev) => [...prev, '[无法调用终端 IPC]'])
      setBusy(false)
      return
    }
    if (!result.ok) {
      setLines((prev) => [...prev, result.error, '[exit -1]'])
      setBusy(false)
      return
    }
    setRunId(result.runId)
  }

  const kill = async () => {
    if (!runId) return
    await window.electronAPI?.terminal.kill(runId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: 'var(--bg-primary)' }}>
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
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] outline-none"
          style={{ color: 'var(--text-primary)' }}
          value={cmd}
          disabled={busy}
          placeholder={projectPath ? '输入命令…' : '未打开项目时在进程 cwd 执行'}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void run()
            }
          }}
        />
        {busy ? (
          <button type="button" className="rounded p-1" style={{ color: 'var(--danger)' }} title="终止" onClick={() => { void kill() }}>
            <Square size={12} />
          </button>
        ) : (
          <button
            type="button"
            className="rounded px-2 py-0.5 text-[10px]"
            style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
            onClick={() => { void run() }}
          >
            运行
          </button>
        )}
      </div>
    </div>
  )
}
