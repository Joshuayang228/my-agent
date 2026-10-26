import { useEffect, useState, type ChangeEvent } from 'react'
import type { DebugEvidenceScope } from '../../shared/types'
import type { DiagnosticHistoryRecord, DiagnosticHistoryResult } from '../../shared/debug-history'
import type { ProactiveEvidenceResult } from '../../shared/proactive-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { HistoryEvidenceReading, ProactiveDeliveryReading } from './HistoryEvidenceReading'

type SavedResult = DiagnosticHistoryResult | ProactiveEvidenceResult

/** 背景：刷新已加载的历史时，旧游标可能因新增记录而跳过整段证据。
 * 意图：每次刷新从首屏重新沿新游标读取相同页数，全部成功后原子替换快照。
 * 约束：异步响应只属于发起时的范围；失败保留原快照，不把未读取解释为零条。
 */
function useSavedPages(key: string, revision: number, read: (cursor?: string) => Promise<SavedResult>) {
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({})
  const pages = pageCounts[key] ?? 1
  const [retry, setRetry] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; result: SavedResult }>()
  const [status, setStatus] = useState<{ key: string; loading: boolean; failed: boolean }>({ key, loading: true, failed: false })
  useEffect(() => {
    let current = true
    setStatus({ key, loading: true, failed: false })
    async function load() {
      let merged: SavedResult | undefined
      let cursor: string | undefined
      for (let index = 0; index < pages; index++) {
        const next = await read(cursor)
        if (!current) return
        if (!merged || next.state !== 'ready') merged = next
        else {
          const records = [...merged.records, ...next.records]
          const unique = [...new Map(records.map(record => [record.id, record])).values()]
          merged = { ...next, records: unique } as SavedResult
        }
        if (!next.hasMore || !next.nextCursor || next.state !== 'ready') break
        cursor = next.nextCursor
      }
      if (current && merged) setSnapshot({ key, result: merged })
    }
    void load().then(() => { if (current) setStatus({ key, loading: false, failed: false }) }).catch(() => { if (current) setStatus({ key, loading: false, failed: true }) })
    return () => { current = false }
    // 查询函数捕获的范围完整包含在 key 中；函数引用变化不应重复请求。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, pages, retry])
  const result = snapshot?.key === key ? snapshot.result : undefined
  const loading = status.key !== key || status.loading
  const failed = status.key === key && status.failed
  return { result, loading, state: failed ? result ? 'refresh-error' as const : 'error' as const : result ? 'ready' as const : 'loading' as const, retry: () => setRetry(value => value + 1), more: () => setPageCounts(values => ({ ...values, [key]: pages + 1 })) }
}

export function SavedEvidencePanel({ view, roleId, scope, onRoleChange, revision, onCall, targetId, onEvidence, onClearTarget }: {
  view: 'activity' | 'proactive' | 'traces' | 'events'; roleId?: string; scope?: DebugEvidenceScope | null
  onRoleChange?: (id: string) => void; revision: number; onCall?: (id: string, record?: DiagnosticHistoryRecord) => void; targetId?: string; onClearTarget?: () => void; onEvidence?: (view: 'recent' | 'moments', id: string, roleId: string, originId?: string) => void
}) {
  const [spanTrail, setSpanTrail] = useState<string[]>([])
  const focusId = spanTrail.at(-1) ?? targetId
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<{ key: string; id?: string }>()
  const key = JSON.stringify([view, roleId, date, focusId])
  const source = useSavedPages(key, revision, async cursor => {
    if (view === 'proactive') {
      if (!roleId || !window.electronAPI?.companion?.proactiveEvidenceQuery) throw new Error('query unavailable')
      return window.electronAPI.companion.proactiveEvidenceQuery({ roleId, date: targetId ? undefined : date || undefined, recordId: targetId, cursor })
    }
    if (!window.electronAPI?.debug?.historyQuery) throw new Error('query unavailable')
    const from = date && !focusId ? new Date(`${date}T00:00:00`).getTime() : undefined
    const end = from === undefined ? undefined : new Date(from)
    if (end) end.setDate(end.getDate() + 1)
    return window.electronAPI.debug.historyQuery({ kind: spanTrail.length ? 'span' : view === 'events' ? 'event' : 'span', roleId, from, to: end ? end.getTime() - 1 : undefined, recordId: focusId, cursor })
  })
  return <section className="debug-history-reading" data-testid={`saved-evidence-${view}`}>
    {targetId && !spanTrail.length && onClearTarget && <ActionButton variant="plain" onClick={onClearTarget}>返回全部记录</ActionButton>}
    {spanTrail.length > 0 && <ActionButton variant="plain" onClick={() => setSpanTrail(trail => trail.slice(0, -1))}>返回上一记录范围</ActionButton>}
    <div className="debug-candidate-toolbar">
      {scope && onRoleChange && <label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => { setSpanTrail([]); onRoleChange(event.target.value) }}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label>}
      {!focusId && <label>本机日期<TextField appearance="outlined" type="date" aria-label="保存记录日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)} /></label>}
    </div>
    {source.loading && source.result && <p role="status">正在刷新；下方保留上次记录。</p>}
    {view === 'proactive' ? <ProactiveDeliveryReading key={key} result={source.result as ProactiveEvidenceResult | undefined} state={source.state} onRetry={source.retry} targetId={targetId} onEvidence={onEvidence} /> : <HistoryEvidenceReading result={source.result as DiagnosticHistoryResult | undefined} state={source.state} selectedId={selected?.key === key ? selected.id : focusId} onSelect={id => setSelected({ key, id })} onRetry={source.retry} onCall={onCall} onEvidence={onEvidence} onSpan={(record, spanId) => setSpanTrail(trail => [...trail, `${record.processRunId}:span:${spanId}`])} />}
    {source.result?.state === 'ready' && source.result.hasMore && <ActionButton disabled={source.loading} onClick={source.more}>读取更早记录</ActionButton>}
  </section>
}
