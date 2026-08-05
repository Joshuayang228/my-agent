/**
 * 工具手测 — 真 Registry + 权限路径（原 ToolRunTab）。
 */

import { useEffect, useState } from 'react'

export interface PlaygroundToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
  metadata: { isReadOnly: boolean; isDestructive: boolean; isConcurrencySafe: boolean }
}

function exampleArgs(tool: PlaygroundToolInfo): Record<string, unknown> {
  const props = (tool.parameters?.properties ?? {}) as Record<string, { type?: string }>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v?.type === 'string') out[k] = ''
    else if (v?.type === 'number' || v?.type === 'integer') out[k] = 0
    else if (v?.type === 'boolean') out[k] = false
    else if (v?.type === 'array') out[k] = []
    else if (v?.type === 'object') out[k] = {}
    else out[k] = null
  }
  return out
}

export function ToolRunPanel({ tools }: { tools: PlaygroundToolInfo[] }) {
  const [name, setName] = useState('')
  const [argsJson, setArgsJson] = useState('{\n  \n}')
  const [confirmRisk, setConfirmRisk] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [meta, setMeta] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!name && tools.length > 0) {
      const first = tools.find((t) => !t.name.startsWith('mcp:')) ?? tools[0]
      setName(first.name)
      setArgsJson(`${JSON.stringify(exampleArgs(first), null, 2)}\n`)
    }
  }, [tools, name])

  const selected = tools.find((t) => t.name === name)

  const onPick = (n: string) => {
    setName(n)
    const t = tools.find((x) => x.name === n)
    if (t) setArgsJson(`${JSON.stringify(exampleArgs(t), null, 2)}\n`)
    setConfirmRisk(false)
    setError('')
    setOutput('')
    setMeta('')
  }

  const run = async () => {
    if (!window.electronAPI?.debug?.toolRun) {
      setError('需要 Electron 环境')
      return
    }
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(argsJson || '{}') as Record<string, unknown>
    } catch {
      setError('参数不是合法 JSON')
      return
    }
    setRunning(true)
    setError('')
    setOutput('')
    setMeta('')
    try {
      const r = await window.electronAPI.debug.toolRun({
        name,
        args,
        confirmRisk,
      })
      if (r.ok) {
        setOutput(r.content)
        setMeta(`${r.ms}ms · chain=${r.permission.chain} · ${r.permission.reason}${r.isError ? ' · tool reported error' : ''}`)
      } else if (r.needsConfirmation) {
        setError(`需要确认风险：${r.error}（勾选下方确认后再执行）`)
        setMeta(r.permission ? `chain=${r.permission.chain}` : '')
      } else {
        setError(r.error)
        setMeta(r.permission ? `chain=${r.permission.chain}` : '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3" data-testid="tool-run">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>工具手测</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          真实走 Registry + 权限引擎。硬拒绝不可绕过；破坏性 / 需审批工具必须勾选确认。
        </p>
      </div>
      {tools.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载工具列表中…</div>
      ) : (
        <>
          <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            工具
            <select
              value={name}
              onChange={(e) => onPick(e.target.value)}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
            >
              {tools.map((t) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {selected.description}
              {selected.metadata.isDestructive && (
                <span className="ml-2 text-red-400">破坏性</span>
              )}
            </p>
          )}
          <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            参数 JSON
            <textarea
              value={argsJson}
              onChange={(e) => setArgsJson(e.target.value)}
              rows={8}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={confirmRisk}
              onChange={(e) => setConfirmRisk(e.target.checked)}
            />
            我了解风险，确认执行（破坏性 / 需审批时必选）
          </label>
          <button
            type="button"
            disabled={running || !name}
            onClick={() => void run()}
            className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {running ? '执行中…' : '执行工具'}
          </button>
        </>
      )}
      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          {error}
        </p>
      )}
      {meta && (
        <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{meta}</p>
      )}
      {output && (
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          {output}
        </pre>
      )}
    </div>
  )
}
