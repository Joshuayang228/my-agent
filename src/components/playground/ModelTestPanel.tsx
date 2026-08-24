/**
 * Playground「模型测试」：烟测 + Thinking 开关探测。
 */

import { useCallback, useEffect, useState } from 'react'

type Status = {
  model: string
  baseUrl: string
  heuristic: boolean
  capability: {
    thinkingDisable: 'supported' | 'unsupported' | 'unknown'
    probedAt?: number
    note?: string
  }
}

type ResultText = { kind: 'ok' | 'err' | 'info'; text: string }

export function ModelTestPanel() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ResultText | null>(null)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.debug?.modelTestStatus) {
      setLoadError('需要 Electron 环境')
      return
    }
    try {
      setStatus(await window.electronAPI.debug.modelTestStatus())
      setLoadError('')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runSmoke = async () => {
    if (!window.electronAPI?.debug?.modelSmoke) return
    setBusy(true)
    setResult(null)
    try {
      const r = await window.electronAPI.debug.modelSmoke()
      if (r.ok) {
        setResult({
          kind: 'ok',
          text: `[${r.model}] ${r.text}\n\n${r.ms}ms · content ${r.contentLen} · reasoning ${r.reasoningLen} · out ${r.completionTokens} tok${r.thinkingApplied ? ` · thinking=${r.thinkingApplied.type}` : ''}`,
        })
      } else {
        setResult({ kind: 'err', text: r.error })
      }
      await refresh()
    } catch (e) {
      setResult({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const runProbe = async () => {
    if (!window.electronAPI?.debug?.modelProbeThinking) return
    setBusy(true)
    setResult(null)
    try {
      const r = await window.electronAPI.debug.modelProbeThinking()
      if (r.ok) {
        setResult({
          kind: 'info',
          text: [
            `模型：${r.model}`,
            `结论：${r.support}${r.heuristic ? '（启发式亦建议关 thinking）' : ''}`,
            r.note,
            '',
            `默认：content ${r.default.contentLen} · reasoning ${r.default.reasoningLen} · ${r.default.completionTokens} tok · ${r.default.ms}ms`,
            `disabled：content ${r.disabled.contentLen} · reasoning ${r.disabled.reasoningLen} · ${r.disabled.completionTokens} tok · ${r.disabled.ms}ms${r.disabled.error ? ` · ${r.disabled.error}` : ''}`,
          ].join('\n'),
        })
      } else {
        setResult({ kind: 'err', text: r.error })
      }
      await refresh()
    } catch (e) {
      setResult({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const capLabel =
    status?.capability.thinkingDisable === 'supported'
      ? 'supported（辅助调用会关 thinking）'
      : status?.capability.thinkingDisable === 'unsupported'
        ? 'unsupported'
        : status?.heuristic
          ? '未探测（启发式：辅助调用会先关 thinking）'
          : '未探测'

  return (
    <div className="mx-auto flex max-w-3xl gap-4" data-testid="model-test-panel">
      <div className="min-w-0 flex-1 space-y-4">
        {loadError && (
          <p className="text-[12px]" style={{ color: 'var(--danger)' }}>{loadError}</p>
        )}

        <div
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            当前模型
          </h3>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {status?.model || '…'}
          </p>
          <p className="mt-0.5 break-all text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {status?.baseUrl || ''}
          </p>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Thinking disable：{capLabel}
          </p>
          {status?.capability.note && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {status.capability.note}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSmoke()}
              className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              烟测连通
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runProbe()}
              className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              探测 Thinking 开关
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              刷新状态
            </button>
          </div>
        </div>
      </div>

      <div className="w-80 shrink-0">
        <h2 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          测试结果
        </h2>
        <div
          className="min-h-[120px] rounded-xl border p-4"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          {busy && (
            <p className="animate-pulse text-[11px]" style={{ color: 'var(--text-muted)' }}>
              正在请求…
            </p>
          )}
          {!busy && result && (
            <p
              className="whitespace-pre-wrap break-words text-[12px] leading-relaxed"
              style={{
                color:
                  result.kind === 'err'
                    ? 'var(--danger)'
                    : result.kind === 'ok'
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
              }}
            >
              {result.text}
            </p>
          )}
          {!busy && !result && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              点击左侧按钮开始测试
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
