import { useCallback, useEffect, useRef, useState } from 'react'
import type { DebugEvalRunStatus, DebugSkillEvalIndex, DebugSkillEvalReport } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { QualityReportReading } from './QualityReportReading'
import { SkillReportEvidence, skillReportNotices } from './SkillReportEvidence'

const reportTime = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN') : value || '时间未记录'

/** 背景：报告切换的迟到响应和缺失文件回退曾把其他运行当作当前证据。
 * 意图：索引 / 选择 / 运行通知共用请求归属，候选阅读只消费实际保存结果。
 * 约束：不运行 Eval、不重新判分；首次失败不造空索引，刷新保留旧快照但明确来源，卸载后的响应不能提交。
 */
export function SkillEvalPanel({ revision = 0 }: { revision?: number } = {}) {
  const [index, setIndex] = useState<DebugSkillEvalIndex | null>(null)
  const [report, setReport] = useState<DebugSkillEvalReport | null>(null)
  const [selectedFile, setSelectedFile] = useState('')
  const [selectedCase, setSelectedCase] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unavailable, setUnavailable] = useState(false)
  const [missing, setMissing] = useState(false)
  const [runStatus, setRunStatus] = useState<DebugEvalRunStatus | null>(null)
  const [statusUnknown, setStatusUnknown] = useState(false)
  const request = useRef(0), statusRequest = useRef(0), desiredFile = useRef(''), displayedFile = useRef('')
  const commitReport = useCallback((next: DebugSkillEvalReport | null, target: string) => {
    if ((next?.fileName ?? '') !== displayedFile.current) setSelectedCase(undefined)
    displayedFile.current = next?.fileName ?? ''
    setReport(next); setMissing(Boolean(target && !next))
  }, [])
  const loadIndex = useCallback(async (preferredFile?: string) => {
    const own = ++request.current
    if (preferredFile) desiredFile.current = preferredFile
    setLoading(true); setError(''); setUnavailable(false)
    const debug = window.electronAPI?.debug
    if (!debug?.skillEvalReports || !debug.skillEvalReportGet) { setUnavailable(true); setLoading(false); return }
    try {
      const nextIndex = await debug.skillEvalReports()
      if (own !== request.current) return
      const target = desiredFile.current || nextIndex.latest?.fileName || ''
      const next = target && nextIndex.latest?.fileName === target ? nextIndex.latest : target ? await debug.skillEvalReportGet(target) : null
      if (own !== request.current) return
      if (next && next.fileName !== target) throw new Error('report identity mismatch')
      desiredFile.current = target; setSelectedFile(target); setIndex(nextIndex); commitReport(next, target)
    } catch {
      if (own === request.current) setError('Skill 报告读取失败；已有报告保留，未读取的数量未知。')
    } finally { if (own === request.current) setLoading(false) }
  }, [commitReport])
  const selectReport = async (fileName: string) => {
    const own = ++request.current
    desiredFile.current = fileName; setSelectedFile(fileName); setLoading(true); setError(''); setUnavailable(false)
    const debug = window.electronAPI?.debug
    if (!debug?.skillEvalReportGet) { setUnavailable(true); setLoading(false); return }
    try {
      const next = await debug.skillEvalReportGet(fileName)
      if (own !== request.current) return
      if (next && next.fileName !== fileName) throw new Error('report identity mismatch')
      commitReport(next, fileName)
    } catch {
      if (own === request.current) setError('所选 Skill 报告读取失败；上次成功报告保留。')
    } finally { if (own === request.current) setLoading(false) }
  }
  useEffect(() => {
    void loadIndex()
    const debug = window.electronAPI?.debug
    const unsubscribe = debug?.onEvalRunEvent?.(event => {
      statusRequest.current++; setRunStatus(event.status); setStatusUnknown(false)
      if (event.status.suite === 'skill' && event.status.state !== 'running') void loadIndex(event.status.latestReportFile)
    })
    const own = ++statusRequest.current
    if (debug?.evalRunStatus) void debug.evalRunStatus().then(next => { if (own === statusRequest.current) { setRunStatus(next); setStatusUnknown(false) } }).catch(() => { if (own === statusRequest.current) setStatusUnknown(true) })
    else setStatusUnknown(true)
    return () => { request.current++; statusRequest.current++; unsubscribe?.() }
  }, [loadIndex, revision])
  const running = !statusUnknown && runStatus?.suite === 'skill' && runStatus.state === 'running'
  const rows = report?.cases.map(item => ({ id: item.id, title: item.description, pass: item.pass, caption: `${item.graderResults.length} 项判定`, source: item })) ?? []
  return <section className="debug-quality-workbench" data-testid="skill-eval-panel">
    <p className="debug-quality-state">验证 Skill 的触发、指南注入、工具边界和回复约束，并保留逐项证据。</p>
    <div className="debug-quality-toolbar">
      {index && index.reports.length > 0 && <label><span>报告</span><SelectField aria-label="Skill Eval 历史报告" value={selectedFile} onChange={event => void selectReport(event.target.value)}>
        {selectedFile && !index.reports.some(item => item.fileName === selectedFile) && <option value={selectedFile}>{selectedFile}（未在当前索引）</option>}
        {index.reports.map(item => <option key={item.fileName} value={item.fileName}>{reportTime(item.timestamp)} · {item.passedCases}/{item.totalCases} · {item.mode === 'mock' ? '模拟' : '真实'} · {item.fileName}</option>)}
      </SelectField></label>}
      <ActionButton onClick={() => void loadIndex()} title="刷新 Skill Eval 报告">刷新报告</ActionButton>
    </div>
    {unavailable && <p className="debug-quality-state" role="status">Skill 报告接口不可用，未读取报告数量；已有内容不是最新结果。</p>}
    {error && <div className="debug-quality-state" role="alert"><p>{error}</p><ActionButton onClick={() => void loadIndex()}>重试</ActionButton></div>}
    {loading && <p className="debug-quality-state" role="status">正在读取报告；已保存内容不代表最新读取结果…</p>}
    {running && <p className="debug-quality-state" role="status">Skill Eval 正在运行；完成前不显示本轮通过结论。</p>}
    {runStatus?.suite === 'skill' && ['failed', 'cancelled'].includes(runStatus.state) && <p className="debug-quality-state" role="status">最近一次记录的 Skill 运行未成功；报告判定仍以所选保存文件为准。</p>}
    {missing && <p className="debug-quality-state" role="status">指定报告未返回，未用最新报告代替。<code>{selectedFile}</code></p>}
    {report && selectedFile !== report.fileName && <p className="debug-quality-state" role="status">尚未读到所选报告，下方仍为上次成功文件：<code>{report.fileName}</code></p>}
    {!running && !loading && !unavailable && !error && index && !report && !missing && <div className="debug-quality-state" role="status"><p>还没有 Skill Eval 报告</p><p>报告由固定 CLI 生成；本页只读，不自动运行模型。</p></div>}
    {index && index.skippedFiles > 0 && <p className="debug-quality-state">当前有界索引有 {index.skippedFiles} 个报告文件未能读取，不推断完整历史。</p>}
    {report && !running && <div data-testid="skill-eval-report">
      {skillReportNotices(report).map(notice => <p className="debug-quality-state" role="status" key={notice}>{notice}</p>)}
      <QualityReportReading title={`Skill Eval · ${report.mode === 'mock' ? '模拟' : '真实'}`} result={`${report.passedCases}/${report.totalCases} 通过`} resultNote={`报告标记：${report.pass ? '通过' : '未通过'}`} pass={report.pass} judgment="自动 Grader" cases={rows} selectedKey={selectedCase} onSelect={setSelectedCase} renderEvidence={item => <SkillReportEvidence item={item.source} />} />
      <details className="debug-quality-boundary"><summary>报告来源与字段</summary><dl><dt>文件</dt><dd><code>{report.fileName}</code></dd><dt>时间</dt><dd>{reportTime(report.timestamp)}</dd><dt>模型</dt><dd>{report.model || '未记录'}</dd><dt>模式</dt><dd>{report.mode === 'mock' ? '模拟' : '真实'}</dd></dl></details>
    </div>}
    <details className="debug-quality-boundary"><summary>来源与诊断边界</summary><p>来源为 Skill Eval CLI 的已保存 JSON 报告与 grader 证据，索引经主进程有界校验读取。历史选项不是全量目录，模拟结果不当作真实模型质量结论；本页不运行 Eval、不改报告、不重新评分。</p>{statusUnknown && <p>运行状态未读取，不能据此判断是否正在运行；已保存报告不是本轮执行状态。</p>}</details>
  </section>
}
