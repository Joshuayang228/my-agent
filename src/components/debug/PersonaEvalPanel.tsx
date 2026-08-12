import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Copy, FileJson2, RotateCcw, XCircle } from 'lucide-react'
import type {
  DebugPersonaEvalIndex,
  DebugPersonaEvalReport,
  PersonaEvalScenarioReport,
} from '../../shared/types'

function formatDate(value: string): string {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toLocaleString('zh-CN') : value
}

function copyText(value: string): void {
  void navigator.clipboard?.writeText(value)
}

/**
 * Debug Persona Eval 真实报告查看器。
 *
 * 背景：Playground 只维护人格设计基线，真实 LLM 的 pass^k 结果由 CLI 写入报告。
 * 设计意图：面板读取同一 JSON 真相，支持历史切换与逐 trial 追证，不复制 Eval 判定逻辑。
 * 关键约束：只读；不在打开 Debug 时自动触发真实模型调用或产生费用。
 */
export function PersonaEvalPanel() {
  const [index, setIndex] = useState<DebugPersonaEvalIndex | null>(null)
  const [report, setReport] = useState<DebugPersonaEvalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadIndex = useCallback(async () => {
    if (!window.electronAPI?.debug?.personaEvalReports) return
    setLoading(true)
    setError('')
    try {
      const next = await window.electronAPI.debug.personaEvalReports()
      setIndex(next)
      setReport(next.latest)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadIndex() }, [loadIndex])

  const selectReport = async (fileName: string) => {
    if (!window.electronAPI?.debug?.personaEvalReportGet) return
    setLoading(true)
    setError('')
    try {
      const next = await window.electronAPI.debug.personaEvalReportGet(fileName)
      if (!next) throw new Error('报告不存在或格式无法识别')
      setReport(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }

  if (loading && !index) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>正在读取 Eval 报告…</p>
  }

  if (error && !report) {
    return <EmptyState title="读取失败" detail={error} reportDir={index?.reportDir} />
  }

  if (!report) {
    return <EmptyState title="还没有 Persona Eval 报告" detail="先在项目终端运行 npm run eval:persona，完成后回到这里刷新。" reportDir={index?.reportDir} />
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="persona-eval-panel">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {report.pass
              ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
              : <XCircle size={18} style={{ color: 'var(--danger)' }} />}
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Persona Eval</h2>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ borderColor: report.pass ? 'var(--success)' : 'var(--danger)', color: report.pass ? 'var(--success)' : 'var(--danger)' }}>
              {report.pass ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
            这里展示 CLI 生成的真实模型报告；Playground「人格验收」仍是设计基线，不代表最近实测结果。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(index?.reports.length ?? 0) > 1 && (
            <select
              value={report.fileName}
              onChange={(event) => void selectReport(event.target.value)}
              className="h-8 max-w-[260px] rounded border bg-transparent px-2 text-xs"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              aria-label="选择 Eval 历史报告"
            >
              {index?.reports.map((item) => (
                <option key={item.fileName} value={item.fileName}>
                  {formatDate(item.timestamp)} · {item.pass ? 'PASS' : 'FAIL'}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => void loadIndex()} disabled={loading} className="inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs disabled:opacity-50" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            <RotateCcw size={12} className={loading ? 'animate-spin' : ''} />刷新报告
          </button>
          <button type="button" onClick={() => copyText(JSON.stringify(report, null, 2))} className="inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            <Copy size={12} />复制 JSON
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="稳定性" value={`pass^${report.k}`} />
        <Metric label="场景" value={`${report.passedScenarios}/${report.totalScenarios}`} />
        <Metric label="模型" value={report.model} compact />
        <Metric label="运行时间" value={formatDate(report.timestamp)} compact />
      </div>

      <div className="theme-card rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Base URL：<code style={{ color: 'var(--text-secondary)' }}>{report.baseUrl}</code></span>
          <span>报告：<code style={{ color: 'var(--text-secondary)' }}>{report.fileName}</code></span>
          {index && index.skippedFiles > 0 && <span style={{ color: 'var(--warning)' }}>跳过 {index.skippedFiles} 个损坏报告</span>}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {report.scenarios.map((scenario) => <ScenarioCard key={scenario.id} scenario={scenario} />)}
      </div>

      <details className="theme-card rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
        <summary className="cursor-pointer text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>在哪里重新运行？</summary>
        <div className="mt-2 space-y-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
          <p>在项目终端运行 <code className="rounded px-1 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>npm run eval:persona</code>，完成后点击本页“刷新报告”。</p>
          <p>报告目录：<code className="break-all" style={{ color: 'var(--text-secondary)' }}>{index?.reportDir || 'eval-reports'}</code></p>
        </div>
      </details>
    </div>
  )
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="theme-card min-w-0 rounded-lg border p-3 text-center" style={{ borderColor: 'var(--border-color)' }}>
      <div className={`${compact ? 'truncate text-xs' : 'text-lg font-bold'}`} style={{ color: 'var(--text-primary)' }} title={value}>{value}</div>
      <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function ScenarioCard({ scenario }: { scenario: PersonaEvalScenarioReport }) {
  return (
    <details className="theme-card rounded-lg border" style={{ borderColor: scenario.pass ? 'var(--border-color)' : 'var(--danger)' }}>
      <summary className="cursor-pointer list-none px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {scenario.pass ? <CheckCircle2 size={13} style={{ color: 'var(--success)' }} /> : <XCircle size={13} style={{ color: 'var(--danger)' }} />}
              {scenario.id}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4" style={{ color: 'var(--text-secondary)' }}>{scenario.description}</p>
          </div>
          <span className="shrink-0 font-mono text-xs" style={{ color: scenario.pass ? 'var(--success)' : 'var(--danger)' }}>{scenario.passes}/{scenario.k}</span>
        </div>
      </summary>
      <div className="space-y-2 border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {scenario.trials.map((trial, index) => (
          <details key={`${scenario.id}-${index}`} className="rounded border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-[11px]">
              <span style={{ color: 'var(--text-secondary)' }}>Trial {index + 1} · {Math.round(trial.durationMs / 1000)}s</span>
              <span style={{ color: trial.pass ? 'var(--success)' : 'var(--danger)' }}>{trial.pass ? 'PASS' : 'FAIL'}</span>
            </summary>
            <div className="mt-2 space-y-3 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
              {trial.error && <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{trial.error}</p>}
              <section>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Agent 回复</div>
                {trial.agentTexts.length > 0 ? trial.agentTexts.map((text, textIndex) => (
                  <div key={textIndex} className="mb-1 whitespace-pre-wrap rounded px-2 py-1.5 text-[11px] leading-5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{text}</div>
                )) : <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>无 text 事件</p>}
              </section>
              <section>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Grader</div>
                <div className="space-y-1.5">
                  {trial.graderResults.map((grader) => (
                    <details key={grader.graderName} className="rounded border px-2 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <summary className="cursor-pointer text-[11px]" style={{ color: grader.result.pass ? 'var(--text-secondary)' : 'var(--danger)' }}>
                        {grader.graderName} · {grader.result.pass ? 'PASS' : 'FAIL'}
                      </summary>
                      <div className="mt-1 space-y-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>
                        {grader.result.violations.map((item) => <p key={`v-${item}`}>Violation：{item}</p>)}
                        {grader.result.evidence.map((item) => <p key={`e-${item}`}>Evidence：{item}</p>)}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}

function EmptyState({ title, detail, reportDir }: { title: string; detail: string; reportDir?: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border px-6 py-10 text-center" style={{ borderColor: 'var(--border-color)' }}>
      <FileJson2 className="mx-auto" size={28} style={{ color: 'var(--text-muted)' }} />
      <h2 className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p className="mt-2 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>{detail}</p>
      <code className="mt-3 block break-all text-[10px]" style={{ color: 'var(--text-secondary)' }}>{reportDir || 'eval-reports'}</code>
    </div>
  )
}

