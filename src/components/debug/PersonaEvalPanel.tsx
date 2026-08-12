import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Copy, FileJson2, Play, RotateCcw, Square, X, XCircle } from 'lucide-react'
import type {
  DebugPersonaEvalIndex,
  DebugPersonaEvalReport,
  DebugEvalRunPlan,
  DebugEvalRunStatus,
  DebugEvalSuite,
  PersonaEvalScenarioReport,
  PersonaEvalTrialReport,
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
  const [plans, setPlans] = useState<DebugEvalRunPlan[]>([])
  const [runStatus, setRunStatus] = useState<DebugEvalRunStatus>({ state: 'idle', output: '' })
  const [confirmPlan, setConfirmPlan] = useState<DebugEvalRunPlan | null>(null)
  const [runError, setRunError] = useState('')
  const [, setClockTick] = useState(0)

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

  useEffect(() => {
    if (runStatus.state !== 'running') return
    const timer = window.setInterval(() => setClockTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [runStatus.state])

  useEffect(() => {
    const debug = window.electronAPI?.debug
    if (!debug?.evalRunPlans || !debug.evalRunStatus) return
    void Promise.all([debug.evalRunPlans(), debug.evalRunStatus()]).then(([nextPlans, nextStatus]) => {
      setPlans(nextPlans)
      setRunStatus(nextStatus)
    }).catch((cause) => setRunError(cause instanceof Error ? cause.message : String(cause)))
    return debug.onEvalRunEvent?.((event) => {
      setRunStatus((previous) => {
        if (previous.state === 'running' && event.status.state !== 'running' && event.status.suite === 'persona-real') {
          setTimeout(() => { void loadIndex() }, 250)
        }
        return event.status
      })
    })
  }, [loadIndex])

  const requestRun = (plan: DebugEvalRunPlan) => {
    setRunError('')
    if (!plan.available) {
      setRunError(plan.unavailableReason || '当前 Eval 不可运行')
      return
    }
    if (plan.requiresConfirmation) {
      setConfirmPlan(plan)
      return
    }
    void startRun(plan.suite)
  }

  const startRun = async (suite: DebugEvalSuite) => {
    const debug = window.electronAPI?.debug
    if (!debug?.evalRunStart) return
    setConfirmPlan(null)
    setRunError('')
    const result = await debug.evalRunStart(suite)
    if (!result.ok) {
      setRunError(result.error)
      return
    }
    setRunStatus(result.status)
  }

  const cancelRun = async () => {
    const runId = runStatus.runId
    if (!runId || !window.electronAPI?.debug?.evalRunCancel) return
    const result = await window.electronAPI.debug.evalRunCancel(runId)
    if (!result.ok) setRunError(result.error || '停止 Eval 失败')
  }

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

  return (
    <div className="mx-auto max-w-5xl space-y-4" data-testid="persona-eval-panel">
      <EvalRunnerCard
        plans={plans}
        status={runStatus}
        error={runError}
        onRun={requestRun}
        onCancel={() => void cancelRun()}
      />
      {loading && !index ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>正在读取 Eval 报告…</p>
      ) : error && !report ? (
        <EmptyState title="读取失败" detail={error} reportDir={index?.reportDir} />
      ) : !report ? (
        <EmptyState title="还没有 Persona Eval 报告" detail="可以在上方运行真实 Persona Eval；完成后报告会自动载入。" reportDir={index?.reportDir} />
      ) : (<>
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
        <summary className="cursor-pointer text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>报告位置与 CLI</summary>
        <div className="mt-2 space-y-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
          <p>同一套入口也可在项目终端运行 <code className="rounded px-1 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>npm run eval:persona</code>。</p>
          <p>报告目录：<code className="break-all" style={{ color: 'var(--text-secondary)' }}>{index?.reportDir || 'eval-reports'}</code></p>
        </div>
      </details>
      </>)}
      {confirmPlan && (
        <EvalRunConfirmDialog
          plan={confirmPlan}
          onCancel={() => setConfirmPlan(null)}
          onConfirm={() => void startRun(confirmPlan.suite)}
        />
      )}
    </div>
  )
}

function EvalRunnerCard({
  plans,
  status,
  error,
  onRun,
  onCancel,
}: {
  plans: DebugEvalRunPlan[]
  status: DebugEvalRunStatus
  error: string
  onRun: (plan: DebugEvalRunPlan) => void
  onCancel: () => void
}) {
  const running = status.state === 'running'
  const elapsed = status.startedAt
    ? Math.max(0, Math.round(((status.endedAt || Date.now()) - status.startedAt) / 1000))
    : 0
  const stateLabel: Record<DebugEvalRunStatus['state'], string> = {
    idle: '未运行', running: '运行中', succeeded: '通过', failed: '失败', cancelled: '已停止',
  }
  return (
    <section className="theme-card rounded-xl border p-4" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>运行 Eval</h2>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>固定白名单套件，不接受任意命令；真实验收会消耗模型调用。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => (
            <button
              key={plan.suite}
              type="button"
              onClick={() => onRun(plan)}
              disabled={running || !plan.available}
              className="inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: 'var(--border-color)', color: plan.suite === 'persona-real' ? 'var(--accent-fg)' : 'var(--text-secondary)' }}
              title={plan.unavailableReason}
            >
              <Play size={12} />{plan.label}
            </button>
          ))}
          {running && (
            <button type="button" onClick={onCancel} className="inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <Square size={11} />停止
            </button>
          )}
        </div>
      </div>

      {(status.state !== 'idle' || error) && (
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>状态：<strong style={{ color: status.state === 'failed' ? 'var(--danger)' : status.state === 'succeeded' ? 'var(--success)' : 'var(--text-primary)' }}>{stateLabel[status.state]}</strong></span>
            {status.suite && <span>套件：{status.suite === 'mock' ? 'Mock Eval' : '真实 Persona Eval'}</span>}
            {status.startedAt && <span>用时：{elapsed}s</span>}
            {typeof status.completedTrials === 'number' && typeof status.totalTrials === 'number' && <span>进度：{status.completedTrials}/{status.totalTrials}</span>}
            {status.cancelRequested && <span style={{ color: 'var(--warning)' }}>正在停止进程树…</span>}
          </div>
          {status.scenarios && (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {status.scenarios.map((scenario) => (
                <div key={scenario.id} className="rounded border px-2 py-1.5 text-center text-[10px]" style={{ borderColor: scenario.state === 'failed' ? 'var(--danger)' : 'var(--border-subtle)', color: scenario.state === 'passed' ? 'var(--success)' : scenario.state === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }}>
                  <div className="font-semibold">{scenario.id}</div>
                  <div>{scenario.completedTrials}/{scenario.totalTrials}</div>
                </div>
              ))}
            </div>
          )}
          {(error || status.error) && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error || status.error}</p>}
          {status.output && (
            <details open={running} className="rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
              <summary className="cursor-pointer px-2.5 py-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>运行输出</summary>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t px-2.5 py-2 font-mono text-[10px] leading-4" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{status.output}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  )
}

function EvalRunConfirmDialog({ plan, onCancel, onConfirm }: { plan: DebugEvalRunPlan; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="确认真实 Persona Eval">
      <div className="theme-card w-full max-w-md rounded-xl border p-5 shadow-2xl" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>开始真实 Persona Eval？</h3>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>这会调用真实模型并产生 API 消耗，运行期间可停止。</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded p-1" style={{ color: 'var(--text-muted)' }} aria-label="关闭确认"><X size={15} /></button>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            ['模型', plan.model || '—'],
            ['Base URL', plan.baseUrl || '—'],
            ['场景', `B02–B07（${plan.scenarioCount || 0} 个）`],
            ['稳定性', `pass^${plan.passK || 0}`],
            ['预计 Agent 调用', String(plan.estimatedAgentCalls || 0)],
            ['预计 Judge 调用', String(plan.estimatedJudgeCalls || 0)],
          ].map(([label, value], index, items) => (
            <div key={label} className="flex justify-between gap-3 px-3 py-2" style={index < items.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : undefined}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="max-w-[250px] truncate font-mono" style={{ color: 'var(--text-primary)' }} title={value}>{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-8 rounded border px-3 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>取消</button>
          <button type="button" onClick={onConfirm} className="h-8 rounded px-3 text-xs font-medium" style={{ background: 'var(--accent)', color: 'white' }}>开始真实验收</button>
        </div>
      </div>
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
          <TrialCard key={`${scenario.id}-${index}`} trial={trial} index={index} />
        ))}
      </div>
    </details>
  )
}

function TrialCard({ trial, index }: { trial: PersonaEvalTrialReport; index: number }) {
  return (
    <details className="rounded border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-[11px]">
        <span style={{ color: 'var(--text-secondary)' }}>Trial {index + 1} · {Math.round(trial.durationMs / 1000)}s</span>
        <span style={{ color: trial.pass ? 'var(--success)' : 'var(--danger)' }}>{trial.pass ? 'PASS' : 'FAIL'}</span>
      </summary>
      <div className="mt-2 space-y-3 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
        {trial.error && <p className="text-[11px]" style={{ color: 'var(--danger)' }}>{trial.error}</p>}
        <AgentInputSection trial={trial} />
        <JudgePlanSection trial={trial} />
        <section>
          <SectionLabel>Agent 回复</SectionLabel>
          {trial.agentTexts.length > 0 ? trial.agentTexts.map((text, textIndex) => (
            <div key={textIndex} className="mb-1 whitespace-pre-wrap rounded px-2 py-1.5 text-[11px] leading-5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{text}</div>
          )) : <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>无 text 事件</p>}
        </section>
        <section>
          <SectionLabel>Grader 结果</SectionLabel>
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
  )
}

function AgentInputSection({ trial }: { trial: PersonaEvalTrialReport }) {
  const input = trial.agentInput
  return (
    <section>
      <SectionLabel>Agent 实际输入</SectionLabel>
      {!input ? (
        <p className="rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>历史报告未记录输入快照；重新运行 Eval 后可查看。</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded border px-2 py-1.5 font-mono text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>模型：{input.model}</span>
            <span>模式：{input.executionMode}</span>
            <span>工具：{input.toolNames.length > 0 ? input.toolNames.join(', ') : '无'}</span>
          </div>
          <div className="space-y-1">
            {input.messages.map((message, messageIndex) => (
              <div key={`${message.role}-${messageIndex}`} className="rounded border px-2 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="mb-1 font-mono text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>{message.role}</div>
                <div className="whitespace-pre-wrap text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>{message.content}</div>
              </div>
            ))}
          </div>
          <details className="rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
            <summary className="cursor-pointer px-2 py-1.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>实际 System Prompt 快照</summary>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t px-2 py-2 font-mono text-[10px] leading-4" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{input.systemPrompt}</pre>
          </details>
        </div>
      )}
    </section>
  )
}

function JudgePlanSection({ trial }: { trial: PersonaEvalTrialReport }) {
  const judge = trial.judge
  return (
    <section>
      <SectionLabel>Judge 评分标准</SectionLabel>
      {!judge ? (
        <p className="rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>本 Trial 没有 Model Judge，或历史报告未记录评分计划。</p>
      ) : (
        <div className="rounded border px-2 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>Agent 回复完成后，以下 {judge.checks.length} 个维度会在一次 Judge AI 调用中逐项判断；这些标准不会发送给被测 Agent。</p>
          <p className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-secondary)' }}>{judge.systemContext}</p>
          <ol className="mt-2 space-y-1.5 pl-4 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>
            {judge.checks.map((check) => (
              <li key={check.id} className="list-decimal">
                <code style={{ color: 'var(--text-secondary)' }}>{check.id}</code>
                <span> — {check.question}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{children}</div>
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

