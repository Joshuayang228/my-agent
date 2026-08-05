/**
 * 对话试验 — 会话级 System 覆盖 + 单轮试跑（原 PromptLabTab）。
 */

import { useState } from 'react'

interface PromptInfo {
  full: string
  layers: { l1: string; l2: string; l3: string; l4: string }
  persona: { id: string; name: string }
  charCount: number
  estimatedTokens: number
}

export function PromptLabPanel({
  onLoadedProduction,
}: {
  onLoadedProduction?: (info: PromptInfo) => void
}) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('用一句话解释什么是 KV Cache。')
  const [running, setRunning] = useState(false)
  const [loadingProd, setLoadingProd] = useState(false)
  const [result, setResult] = useState<{ text: string; ms: number; model: string } | null>(null)
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
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const r = await window.electronAPI.debug.playgroundRun({
        systemPrompt: systemPrompt.trim() || undefined,
        userPrompt,
      })
      if (r.ok) setResult({ text: r.text, ms: r.ms, model: r.model })
      else setError(r.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3" data-testid="prompt-lab">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          对话试验
        </h2>
        <p className="mt-1 rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          隔离迷你对话：下方 System 仅本次试跑，
          <strong style={{ color: 'var(--text-primary)' }}>不会写入设置</strong>。可先「载入当前实装」再改。
        </p>
      </div>
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
      </div>
      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        System（会话覆盖）
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
          placeholder="空 = 使用默认 playground 指令；不写全局 settings"
        />
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        User
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={3}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
        />
      </label>
      <button
        type="button"
        disabled={running || !userPrompt.trim()}
        onClick={() => void run()}
        className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {running ? '运行中…' : '试跑（单轮 · 无工具）'}
      </button>
      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          {error}
        </p>
      )}
      {result && (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {result.model} · {result.ms}ms
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
            {result.text}
          </pre>
        </div>
      )}
    </div>
  )
}
