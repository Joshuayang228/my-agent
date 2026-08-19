/**
 * 对话试验 — 会话级 System 覆盖 + 可多轮隔离试跑（不写 settings）。
 */

import { useState } from 'react'

interface PromptInfo {
  full: string
  layers: { l1: string; l2: string; l3: string; l4: string }
  persona: { id: string; name: string }
  charCount: number
  estimatedTokens: number
}

type Turn = { role: 'user' | 'assistant'; content: string }

export function PromptLabPanel({
  onLoadedProduction,
}: {
  onLoadedProduction?: (info: PromptInfo) => void
}) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('用一句话解释什么是 KV Cache。')
  const [turns, setTurns] = useState<Turn[]>([])
  const [running, setRunning] = useState(false)
  const [loadingProd, setLoadingProd] = useState(false)
  const [lastMeta, setLastMeta] = useState('')
  const [error, setError] = useState('')

  const loadProduction = async () => {
    if (!window.electronAPI?.debug) {
      setError('需要 Electron 环境')
      return
    }
    setLoadingProd(true)
    setError('')
    try {
      const info = await window.electronAPI.debug.systemPrompt()
      onLoadedProduction?.(info)
      setSystemPrompt(info.full || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingProd(false)
    }
  }

  const run = async () => {
    if (!window.electronAPI?.debug?.playgroundRun) {
      setError('需要 Electron 环境')
      return
    }
    const user = userPrompt.trim()
    if (!user) return
    setRunning(true)
    setError('')
    try {
      const r = await window.electronAPI.debug.playgroundRun({
        systemPrompt: systemPrompt.trim() || undefined,
        userPrompt: user,
        history: turns,
      })
      if (r.ok) {
        setTurns((prev) => [...prev, { role: 'user', content: user }, { role: 'assistant', content: r.text }])
        setUserPrompt('')
        setLastMeta(`${r.model} · ${r.ms}ms · 已 ${turns.length / 2 + 1} 轮`)
      } else {
        setError(r.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const resetTurns = () => {
    setTurns([])
    setLastMeta('')
    setError('')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3" data-testid="prompt-lab">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loadingProd}
          onClick={() => void loadProduction()}
          className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {loadingProd ? '载入中…' : '载入当前实装'}
        </button>
        <button
          type="button"
          onClick={() => setSystemPrompt('')}
          className="settings-option px-3 py-1.5 text-xs"
        >
          清空 System（用默认试验指令）
        </button>
        <button
          type="button"
          onClick={resetTurns}
          className="settings-option px-3 py-1.5 text-xs"
          disabled={turns.length === 0}
        >
          清空对话轮次
        </button>
      </div>
      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        System（会话覆盖）
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={6}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
          placeholder="空 = 使用默认 playground 指令；不写全局 settings"
        />
      </label>

      {turns.length > 0 && (
        <div
          className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
          data-testid="prompt-lab-transcript"
        >
          {turns.map((t, i) => (
            <div key={`${t.role}-${i}`} className="text-[12px]">
              <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {t.role === 'user' ? 'User' : 'Assistant'}
              </span>
              <pre className="mt-0.5 whitespace-pre-wrap break-words font-sans" style={{ color: 'var(--text-primary)' }}>
                {t.content}
              </pre>
            </div>
          ))}
        </div>
      )}

      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        User（下一轮）
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={3}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void run()
            }
          }}
        />
      </label>
      <button
        type="button"
        disabled={running || !userPrompt.trim()}
        onClick={() => void run()}
        className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {running ? '运行中…' : turns.length > 0 ? '继续试跑（带历史）' : '试跑（无工具）'}
      </button>
      {lastMeta && (
        <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{lastMeta}</p>
      )}
      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
