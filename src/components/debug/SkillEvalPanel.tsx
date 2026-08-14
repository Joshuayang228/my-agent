import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { DebugSkillEvalIndex, DebugSkillEvalReport, SkillEvalCaseReport } from '../../shared/types'

const graderLabels: Record<string, string> = {
  SkillActivation: '触发',
  SkillInjection: '指南注入',
  SkillToolBoundary: '工具边界',
  SkillResponse: '回复约束',
}

/**
 * 展示 Skill Eval 的真实落盘证据。
 *
 * 背景：开发者需要看到 Agent 收到了什么、Skill 是否触发以及工具边界为何通过或失败。
 * 设计意图：直接读取主进程校验过的 CLI 报告，不在渲染层重新判分。
 * 关键约束：Vite 展厅没有 Electron IPC 时只显示空态；报告不包含 Skill 正文或密钥。
 */
export function SkillEvalPanel() {
  const [index, setIndex] = useState<DebugSkillEvalIndex | null>(null)
  const [report, setReport] = useState<DebugSkillEvalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadIndex = useCallback(async (preferredFile?: string) => {
    const debug = window.electronAPI?.debug
    if (!debug?.skillEvalReports) {
      setIndex({ reportDir: 'eval-reports', reports: [], latest: null, skippedFiles: 0 })
      setReport(null)
      setLoading(false)
      return
    }
    try {
      setError('')
      const nextIndex = await debug.skillEvalReports()
      setIndex(nextIndex)
      const selected = preferredFile
        ? await debug.skillEvalReportGet(preferredFile)
        : nextIndex.latest
      setReport(selected || nextIndex.latest)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取 Skill Eval 报告失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIndex()
    const debug = window.electronAPI?.debug
    if (!debug?.onEvalRunEvent) return
    return debug.onEvalRunEvent((event) => {
      if (event.status.suite === 'skill' && event.status.state !== 'running') {
        void loadIndex(event.status.latestReportFile)
      }
    })
  }, [loadIndex])

  const selectReport = async (fileName: string) => {
    const debug = window.electronAPI?.debug
    if (!debug?.skillEvalReportGet) return
    setLoading(true)
    try {
      setError('')
      setReport(await debug.skillEvalReportGet(fileName))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取 Skill Eval 报告失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="theme-card rounded-xl border p-4" data-testid="skill-eval-panel" style={{ borderColor: 'var(--border-color)' }}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Skill Eval</h2>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>验证 Skill 的触发、指南注入、工具边界和回复约束，并保留逐项证据。</p>
        </div>
        <div className="flex items-center gap-2">
          {index && index.reports.length > 0 && (
            <select
              aria-label="Skill Eval 历史报告"
              className="theme-input h-8 max-w-64 rounded border px-2 text-xs"
              value={report?.fileName || ''}
              onChange={(event) => void selectReport(event.target.value)}
            >
              {index.reports.map((item) => (
                <option key={item.fileName} value={item.fileName}>{new Date(item.timestamp).toLocaleString('zh-CN')} · {item.passedCases}/{item.totalCases}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={() => void loadIndex(report?.fileName)} className="rounded border p-1.5" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} title="刷新 Skill Eval 报告">
            <RefreshCw size={13} />
          </button>
        </div>
      </header>

      {error && <p className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading && <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>正在读取报告…</p>}
      {!loading && !report && (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-5 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>还没有 Skill Eval 报告</p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>使用下方“运行 Eval”中的 Skill Eval，或执行 npm run eval:skill。</p>
        </div>
      )}
      {!loading && report && <SkillEvalReportView report={report} />}
    </section>
  )
}

function SkillEvalReportView({ report }: { report: DebugSkillEvalReport }) {
  return (
    <div className="mt-4 space-y-3" data-testid="skill-eval-report">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        <ResultMark pass={report.pass} />
        <span>{report.passedCases}/{report.totalCases} Case 通过</span>
        <span>模式：{report.mode === 'mock' ? 'Mock' : 'Real'}</span>
        <span>模型：{report.model}</span>
        <span>{new Date(report.timestamp).toLocaleString('zh-CN')}</span>
      </div>
      <div className="space-y-2">
        {report.cases.map((testCase) => <SkillEvalCaseView key={testCase.id} testCase={testCase} />)}
      </div>
    </div>
  )
}

function SkillEvalCaseView({ testCase }: { testCase: SkillEvalCaseReport }) {
  return (
    <details className="rounded-lg border" data-testid={`skill-eval-case-${testCase.id}`} style={{ borderColor: testCase.pass ? 'var(--border-subtle)' : 'var(--danger)' }}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs">
        <ResultMark pass={testCase.pass} />
        <strong style={{ color: 'var(--text-primary)' }}>{testCase.id}</strong>
        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{testCase.description}</span>
        <span style={{ color: 'var(--text-muted)' }}>{testCase.durationMs}ms</span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3 text-xs" style={{ borderColor: 'var(--border-subtle)' }}>
        <EvidenceBlock title="实际输入">
          <p><strong>用户输入：</strong>{testCase.input.userPrompt}</p>
          <p><strong>Skill：</strong>{testCase.input.skill.name} · {testCase.input.skill.version} · {testCase.input.skill.source}</p>
          <p className="break-all"><strong>指纹：</strong>{testCase.input.skill.fingerprint}</p>
          <p><strong>预期触发：</strong>{testCase.input.expectedActivation ? '是' : '否'}　<strong>激活工具：</strong>{testCase.input.skill.toolName}</p>
          <p><strong>允许工具：</strong>{testCase.input.allowedTools.join(', ') || '无'}</p>
        </EvidenceBlock>
        <EvidenceBlock title="运行证据">
          <p><strong>指南注入：</strong>{testCase.evidence.injectionObserved ? '已观察到' : '未观察到'}</p>
          <p><strong>工具调用：</strong>{testCase.evidence.toolCalls.join(', ') || '无'}</p>
          <p><strong>激活 Trace：</strong>{testCase.evidence.activations.length === 0 ? '无' : testCase.evidence.activations.map((item) => `${item.name}（${item.reason || '无原因'}）`).join('；')}</p>
        </EvidenceBlock>
        <EvidenceBlock title="Agent 回复">
          <p className="whitespace-pre-wrap">{testCase.evidence.agentText || '（空）'}</p>
        </EvidenceBlock>
        <div className="grid gap-2 sm:grid-cols-2">
          {testCase.graderResults.map((grader) => (
            <div key={grader.graderName} className="rounded border p-2.5" style={{ borderColor: grader.result.pass ? 'var(--border-subtle)' : 'var(--danger)' }}>
              <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}><ResultMark pass={grader.result.pass} />{graderLabels[grader.graderName] || grader.graderName}</div>
              <p className="mt-1.5" style={{ color: grader.result.violations.length ? 'var(--danger)' : 'var(--text-muted)' }}>{grader.result.violations.join('；') || '无违规'}</p>
              {grader.result.evidence.map((item, index) => <p key={`${grader.graderName}-${index}`} className="mt-1 break-words" style={{ color: 'var(--text-muted)' }}>{item}</p>)}
            </div>
          ))}
        </div>
        {testCase.error && <p style={{ color: 'var(--danger)' }}>{testCase.error}</p>}
      </div>
    </details>
  )
}

function EvidenceBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-1 rounded border p-2.5" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}><h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h3>{children}</div>
}

function ResultMark({ pass }: { pass: boolean }) {
  return pass
    ? <CheckCircle2 size={14} style={{ color: 'var(--success)' }} aria-label="通过" />
    : <XCircle size={14} style={{ color: 'var(--danger)' }} aria-label="失败" />
}
