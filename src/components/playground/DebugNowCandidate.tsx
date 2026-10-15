import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugNowFields, debugNowTime, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type NowPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'paused' | 'fallback' | 'unset' | 'long' | 'missing'
interface Props {
  empty: boolean
  previewState: NowPreviewState
  snapshotState: NowPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
}

/** 背景：当前快照不是事件列表，所有数值和补叙默认展开会淹没活动与位置。
 * 意图：主层只读活动 / 地点，暂停及回退保持可见，诊断数值和来源按需展开。
 * 约束：只用明确人物的隔离记录；无行不补默认人物世界，时间 0 不补当前时刻，未暂停不等于健康运行。
 */
export function DebugNowCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.now.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [expanded, setExpanded] = useState(Boolean(initialSelectedId))
  const entry = empty ? undefined : fixtures.find(value => value.role === role)
  const state = entry?.now ? { ...entry.now } : undefined
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && entry?.id !== initialSelectedId)
  if (state && dataState === 'paused') state.pausedAt = Date.parse('2026-10-13T14:31:00+08:00')
  if (state && dataState === 'fallback') {
    state.activity = ''; state.location = '未设定'; state.updatedAt = 0; state.catchupSummary = ''
    state.storedWorldIssue = '存储世界 JSON 不可解析；当前展示默认解析样张，不代表已存世界。'
  }
  if (state && dataState === 'unset') {
    state.activity = ''; state.location = '未设定'; state.updatedAt = 0; state.lastTickAt = 0; state.catchupSummary = ''
  }
  if (state && dataState === 'long') {
    state.activity = '整理旅途中拍摄的照片，并逐一核对地点和日期。'.repeat(5).slice(0, 80)
    state.location = '虚构住所内靠窗的资料整理区。'.repeat(4).slice(0, 40)
    state.catchupSummary = '【补叙长文样张】午后慢慢整理旅行材料，记录可供下次讨论的线索；这是虚构摘要，不是独立日记。\n\n'.repeat(30)
  }
  return <section className="debug-now-workbench" data-testid="debug-evidence-now">
    <div className="debug-now-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setExpanded(false) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-now-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '状态尚未读取' : previewState === 'loading' ? '正在读取状态…' : previewState === 'unavailable' ? '状态接口不可用；需要桌面诊断连接。' : '状态读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取状态样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-now-state" role="alert"><p>刷新失败，保留上次快照；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing ? <p className="debug-now-state" role="status">引用状态未在该人物范围找到，未选择替代快照。</p> : state && entry ? <>
        {state.storedWorldIssue && <p className="debug-now-state debug-now-warning" role="status">{state.storedWorldIssue}</p>}
        {state.pausedAt !== null && <p className="debug-now-state debug-now-warning" role="status">生活推进已暂停 · {debugNowTime(state.pausedAt, state.timezone)}</p>}
        <div className="debug-now-summary" data-record-id={entry.id}>
          <dl><div><dt>当前活动</dt><dd className="debug-now-activity">{state.activity || '未记录'}</dd></div><div><dt>当前位置</dt><dd>{state.location || '未设定'}</dd></div></dl>
          <p className="debug-now-meta">运行时解析快照 · {state.updatedAt ? `更新于 ${debugNowTime(state.updatedAt, state.timezone)}` : '更新时间未记录'} · {state.timezone}</p>
          <ActionButton variant="plain" aria-label={`${entry.title} · 完整状态`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>完整状态</ActionButton>
        </div>
        {expanded && <article className="debug-now-detail" aria-label="领域证据详情">
          <h3>诊断字段</h3><dl className="debug-candidate-facts">{debugNowFields(state).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {state.catchupSummary && <section><h3>生活补叙</h3><p className="debug-now-body">{state.catchupSummary}</p></section>}
          <h3>相关诊断</h3>{entry.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}
          <details className="debug-prompt-provenance"><summary>记录标识与原始样张</summary><code>companion_role_state · {entry.id}</code><pre>{JSON.stringify({ role, state }, null, 2)}</pre></details>
        </article>}
      </> : <p className="debug-now-state" role="status">该人物没有状态记录；未补造默认世界。</p>}
    </>}
  </section>
}
