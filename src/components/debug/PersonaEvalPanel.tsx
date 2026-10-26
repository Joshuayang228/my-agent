import { useCallback, useEffect, useRef, useState } from 'react'
import type { DebugPersonaEvalIndex, DebugPersonaEvalReport, DebugEvalRunPlan, DebugEvalRunStatus, DebugEvalSuite, PersonaEvalHumanReview, PersonaEvalHumanReviewInput } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { QualityReportReading } from './QualityReportReading'
import { PersonaReportEvidence, personaReviewKey, personaTrialId, personaReportNotices } from './PersonaReportEvidence'
import { EvalRunnerCard, EvalRunConfirmDialog } from './PersonaEvalControls'

const formatDate = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN') : value || '时间未记录'

/** 背景：报告 / 审阅的迟到响应曾覆盖当前文件，刷新也会跳回最新报告。
 * 意图：保存目标与展示快照分离，报告及审阅各自拥有请求归属；写入仍只针对明确报告和历史轮次。
 * 约束：打开页面不运行 Eval；报告不重判分，审阅失败不能伪装未审阅，跨文件迟到写入不污染当前展示。
 */
export function PersonaEvalPanel({ revision = 0 }: { revision?: number } = {}) {
  const [index, setIndex] = useState<DebugPersonaEvalIndex | null>(null), [report, setReport] = useState<DebugPersonaEvalReport | null>(null)
  const [selectedFile, setSelectedFile] = useState(''), [selectedCase, setSelectedCase] = useState<string>()
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [unavailable, setUnavailable] = useState(false), [missing, setMissing] = useState(false)
  const [humanReviews, setHumanReviews] = useState<Record<string, PersonaEvalHumanReview>>({}), [reviewsReady, setReviewsReady] = useState(false), [reviewError, setReviewError] = useState('')
  const [reviewsLoading, setReviewsLoading] = useState(false), [reviewReadFailed, setReviewReadFailed] = useState(false)
  const [plans, setPlans] = useState<DebugEvalRunPlan[]>([]), [runStatus, setRunStatus] = useState<DebugEvalRunStatus>({ state: 'idle', output: '' })
  const [statusKnown, setStatusKnown] = useState(false), [runError, setRunError] = useState(''), [confirmPlan, setConfirmPlan] = useState<DebugEvalRunPlan | null>(null), [runBusy, setRunBusy] = useState(false)
  const [, setClockTick] = useState(0)
  const request = useRef(0), reviewRequest = useRef(0), statusRequest = useRef(0), planRequest = useRef(0), desired = useRef(''), displayed = useRef(''), live = useRef(true), runningAction = useRef(false)
  const currentReport = useRef<DebugPersonaEvalReport | null>(null)
  const readReviews = useCallback(async (file: string) => {
    const own = ++reviewRequest.current
    setReviewError(''); setReviewsLoading(true)
    try {
      const read = window.electronAPI?.debug?.personaEvalHumanReviewsList
      if (!read) throw new Error('unavailable')
      const reviews = await read(file)
      if (own !== reviewRequest.current || displayed.current !== file || !live.current) return
      setHumanReviews(Object.fromEntries(reviews.filter(item => item.reportFileName === file).map(item => [personaReviewKey(item.scenarioId, item.trialId), item])))
      setReviewsReady(true); setReviewReadFailed(false)
    } catch { if (own === reviewRequest.current && live.current) { setReviewReadFailed(true); setReviewError('人工审阅读取失败；已有审阅仅为上次成功快照，禁止覆盖未读取记录。') } }
    finally { if (own === reviewRequest.current && live.current) setReviewsLoading(false) }
  }, [])
  const commit = useCallback((next: DebugPersonaEvalReport | null, target: string) => {
    if ((next?.fileName ?? '') !== displayed.current) { setSelectedCase(undefined); setHumanReviews({}); setReviewsReady(false); reviewRequest.current++ }
    displayed.current = next?.fileName ?? ''; currentReport.current = next
    setReport(next); setMissing(Boolean(target && !next))
    if (next) void readReviews(next.fileName)
  }, [readReviews])
  const loadIndex = useCallback(async (preferred?: string) => {
    const own = ++request.current
    if (preferred) desired.current = preferred
    setLoading(true); setError(''); setUnavailable(false)
    const debug = window.electronAPI?.debug
    if (!debug?.personaEvalReports || !debug.personaEvalReportGet) { setUnavailable(true); setLoading(false); return }
    try {
      const nextIndex = await debug.personaEvalReports()
      if (own !== request.current || !live.current) return
      const target = desired.current || nextIndex.latest?.fileName || ''
      const next = target && nextIndex.latest?.fileName === target ? nextIndex.latest : target ? await debug.personaEvalReportGet(target) : null
      if (own !== request.current || !live.current) return
      if (next && next.fileName !== target) throw new Error('identity mismatch')
      desired.current = target; setSelectedFile(target); setIndex(nextIndex); commit(next, target)
    } catch { if (own === request.current && live.current) setError('人格报告读取失败；已有报告保留，未读取的数量未知。') }
    finally { if (own === request.current && live.current) setLoading(false) }
  }, [commit])
  const selectReport = async (file: string) => {
    const own = ++request.current; desired.current = file; setSelectedFile(file); setLoading(true); setError('')
    try {
      const read = window.electronAPI?.debug?.personaEvalReportGet
      if (!read) throw new Error('unavailable')
      const next = await read(file)
      if (own !== request.current || !live.current) return
      if (next && next.fileName !== file) throw new Error('identity mismatch')
      commit(next, file)
    } catch { if (own === request.current && live.current) setError('所选人格报告读取失败；上次成功报告保留。') }
    finally { if (own === request.current && live.current) setLoading(false) }
  }
  useEffect(() => { live.current = true; void loadIndex(); return () => { live.current = false; request.current++; reviewRequest.current++; statusRequest.current++ } }, [loadIndex, revision])
  useEffect(() => {
    const debug = window.electronAPI?.debug, own = ++statusRequest.current, planOwn = ++planRequest.current
    if (debug?.evalRunPlans) void debug.evalRunPlans().then(next => { if (live.current && planOwn === planRequest.current) setPlans(next) }).catch(() => { if (live.current && planOwn === planRequest.current) { setPlans([]); setRunError('运行计划读取失败，未提供可执行套件。') } })
    if (debug?.evalRunStatus) void debug.evalRunStatus().then(next => { if (own === statusRequest.current && live.current) { setRunStatus(next); setStatusKnown(true) } }).catch(() => { if (own === statusRequest.current && live.current) setStatusKnown(false) })
    const unsubscribe = debug?.onEvalRunEvent?.(event => {
      statusRequest.current++; setRunStatus(event.status); setStatusKnown(true)
      if (event.status.suite === 'persona-real' && event.status.state !== 'running') void loadIndex(event.status.latestReportFile)
    })
    return () => { statusRequest.current++; planRequest.current++; unsubscribe?.() }
  }, [loadIndex, revision])
  useEffect(() => { if (runStatus.state !== 'running') return; const timer = window.setInterval(() => setClockTick(value => value + 1), 1000); return () => window.clearInterval(timer) }, [runStatus.state])
  const startRun = async (suite: DebugEvalSuite) => {
    if (runningAction.current || runStatus.state === 'running' || !statusKnown) return
    const start = window.electronAPI?.debug?.evalRunStart
    if (!start) { setRunError('运行接口不可用。'); return }
    runningAction.current = true; setRunBusy(true); setConfirmPlan(null); setRunError('')
    const own = ++statusRequest.current
    try {
      const result = await start(suite)
      if (!live.current) return
      if (!result.ok) setRunError('启动验收失败，请检查运行环境后重试。')
      else if (own === statusRequest.current) { setRunStatus(result.status); setStatusKnown(true) }
    } catch { if (live.current) setRunError('启动验收失败，请检查运行环境后重试。') }
    finally { runningAction.current = false; if (live.current) setRunBusy(false) }
  }
  const cancelRun = async () => {
    if (runningAction.current || !runStatus.runId) return
    const cancel = window.electronAPI?.debug?.evalRunCancel
    if (!cancel) { setRunError('停止接口不可用。'); return }
    runningAction.current = true; setRunBusy(true); setRunError('')
    try { const result = await cancel(runStatus.runId); if (live.current && !result.ok) setRunError('停止验收失败，请重试。') }
    catch { if (live.current) setRunError('停止验收失败，请重试。') }
    finally { runningAction.current = false; if (live.current) setRunBusy(false) }
  }
  const reviewBelongs = (input: Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>) => {
    const current = currentReport.current, scenarios = current?.scenarios.filter(item => item.id === input.scenarioId) ?? []
    return reviewsReady && !reviewsLoading && !reviewReadFailed && !loading && input.reportFileName === selectedFile && input.reportFileName === displayed.current && scenarios.length === 1 && scenarios[0].trials.some((_, i) => personaTrialId(input.scenarioId, i) === input.trialId)
  }
  const saveHumanReview = async (input: PersonaEvalHumanReviewInput): Promise<boolean> => {
    if (!reviewBelongs(input)) return false
    setReviewError('')
    try {
      const save = window.electronAPI?.debug?.personaEvalHumanReviewSave
      if (!save) throw new Error('unavailable')
      const result = await save(input)
      if (!result.ok) throw new Error('save failed')
      if (live.current && displayed.current === input.reportFileName) await readReviews(input.reportFileName)
      return true
    } catch { if (live.current && displayed.current === input.reportFileName) setReviewError('保存人工审阅失败，草稿保留；自动报告未改变。'); return false }
  }
  const deleteHumanReview = async (input: Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>): Promise<boolean> => {
    if (!reviewBelongs(input)) return false
    setReviewError('')
    try {
      const remove = window.electronAPI?.debug?.personaEvalHumanReviewDelete
      if (!remove) throw new Error('unavailable')
      const result = await remove(input)
      if (!result.ok) throw new Error('delete failed')
      if (live.current && displayed.current === input.reportFileName) await readReviews(input.reportFileName)
      return true
    } catch { if (live.current && displayed.current === input.reportFileName) setReviewError('清空人工审阅失败，保存记录保留。'); return false }
  }
  const rows = report?.scenarios.map(source => ({ id: source.id, title: source.description, pass: source.pass, caption: `${source.passes}/${source.k} 轮通过`, source })) ?? []
  const ambiguousIds = new Set(rows.filter((item, i) => rows.some((other, j) => i !== j && other.id === item.id)).map(item => item.id))
  const trials = report?.scenarios.flatMap(item => item.trials) ?? []
  const reviewKeys = new Set(report?.scenarios.filter(item => !ambiguousIds.has(item.id)).flatMap(item => item.trials.map((_, i) => personaReviewKey(item.id, personaTrialId(item.id, i)))) ?? [])
  const reviews = Object.entries(humanReviews).filter(([key]) => reviewKeys.has(key)).map(([, review]) => review)
  const running = statusKnown && runStatus.suite === 'persona-real' && runStatus.state === 'running'

  return <section className="debug-quality-workbench" data-testid="persona-eval-panel">
    <p className="debug-quality-state">阅读已保存的人格一致性报告；自动判定与人工审阅分别保留。</p>
    <div className="debug-quality-toolbar">{index && index.reports.length > 0 && <label><span>报告</span><SelectField aria-label="选择 Eval 历史报告" value={selectedFile} onChange={event => void selectReport(event.target.value)}>{selectedFile && !index.reports.some(item => item.fileName === selectedFile) && <option value={selectedFile}>{selectedFile}（未在当前索引）</option>}{index.reports.map(item => <option key={item.fileName} value={item.fileName}>{formatDate(item.timestamp)} · {item.passedScenarios}/{item.totalScenarios} · {item.fileName}</option>)}</SelectField></label>}<ActionButton onClick={() => void loadIndex()}>刷新报告</ActionButton></div>
    {unavailable && <p className="debug-quality-state" role="status">人格报告接口不可用，未读取报告数量。</p>}
    {error && <div className="debug-quality-state" role="alert"><p>{error}</p><ActionButton onClick={() => void loadIndex()}>重试</ActionButton></div>}
    {loading && <p className="debug-quality-state" role="status">正在读取报告；已有内容不代表最新读取结果…</p>}
    {missing && <p className="debug-quality-state" role="status">指定人格报告未返回，未用最新报告代替。<code>{selectedFile}</code></p>}
    {report && selectedFile !== report.fileName && <p className="debug-quality-state" role="status">尚未读到所选报告，下方仍为上次成功文件：<code>{report.fileName}</code></p>}
    {running && <p className="debug-quality-state" role="status">Persona Eval 正在运行；完成前不显示本轮通过结论。</p>}
    {!report && !loading && !unavailable && !error && !missing && index && <p className="debug-quality-state">还没有 Persona Eval 报告；打开 Debug 不会自动运行模型。</p>}
    {index && index.skippedFiles > 0 && <p className="debug-quality-state">当前有界索引有 {index.skippedFiles} 个报告文件未能读取，不推断完整历史。</p>}
    {report && !running && <div data-testid="persona-eval-report">
      {personaReportNotices(report).map(notice => <p className="debug-quality-state" key={notice}>{notice}</p>)}
      <QualityReportReading title={`Persona Eval · pass^${report.k}`} result={`${report.passedScenarios}/${report.totalScenarios} 场景通过`} resultNote={`报告标记：${report.pass ? '通过' : '未通过'}`} pass={report.pass} judgment="自动 + 人工" cases={rows} selectedKey={selectedCase} onSelect={setSelectedCase} renderEvidence={item => <PersonaReportEvidence reportFileName={report.fileName} scenario={item.source} reviews={humanReviews} reviewsReady={reviewsReady} reviewWritable={!reviewsLoading && !reviewReadFailed && report.fileName === selectedFile && !loading} ambiguous={ambiguousIds.has(item.id)} onSave={saveHumanReview} onDelete={deleteHumanReview} />} />
      <p className="debug-quality-state">{reviewsReady ? `人工审阅 ${reviews.length}/${trials.length} 轮 · 通过 ${reviews.filter(item => item.verdict === 'pass').length} · 需修改 ${reviews.filter(item => item.verdict === 'revise').length} · 无法判断 ${reviews.filter(item => item.verdict === 'uncertain').length}` : '人工审阅尚未成功读取；不等同于未审阅。'}；不参与自动结果。</p>
      {reviewError && <div className="debug-quality-state" role="alert"><p>{reviewError}</p><ActionButton onClick={() => void readReviews(report.fileName)}>重试读取审阅</ActionButton></div>}
      <details className="debug-quality-boundary"><summary>报告来源与字段</summary><dl><dt>文件</dt><dd><code>{report.fileName}</code></dd><dt>时间</dt><dd>{formatDate(report.timestamp)}</dd><dt>模型</dt><dd>{report.model}</dd><dt>端点</dt><dd>{report.baseUrl}</dd><dt>目录</dt><dd>{index?.reportDir}</dd></dl><ActionButton onClick={() => { void navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).catch(() => setError('复制报告失败，请检查剪贴板权限。')) }}>复制 JSON</ActionButton></details>
    </div>}
    <details className="debug-quality-boundary"><summary>运行验收与诊断</summary><EvalRunnerCard plans={plans} known={statusKnown} status={runStatus} error={runError} busy={runBusy || !statusKnown} onRun={plan => { if (!plan.available || runBusy || !statusKnown || runStatus.state === 'running') return; if (plan.requiresConfirmation) setConfirmPlan(plan); else void startRun(plan.suite) }} onCancel={() => void cancelRun()} />{!statusKnown && <p>运行状态未读取，暂不提供启动操作。</p>}</details>
    <details className="debug-quality-boundary"><summary>来源与诊断边界</summary><p>来源为 Persona Eval CLI 已保存 JSON 与独立人工审阅；索引有界，自动结果不代表人工体验结论。报告只读，人工审阅可明确保存 / 清空；运行只接受既有白名单，真实模型需确认且可停止。CLI：npm run eval:persona。</p></details>
    {confirmPlan && <EvalRunConfirmDialog plan={confirmPlan} onCancel={() => setConfirmPlan(null)} onConfirm={() => void startRun(confirmPlan.suite)} />}
  </section>
}
