import { useState } from 'react'
import type { DiagnosticHistoryRecord, DiagnosticHistoryResult } from '../../shared/debug-history'
import type { ProactiveEvidenceRecord, ProactiveEvidenceResult } from '../../shared/proactive-evidence'
import { EventTimelineReading } from './EventTimelineReading'
import { ActionButton } from '../foundation/ActionButton'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import './history-evidence.css'

const SPAN_LABELS: Record<DiagnosticHistoryRecord['spanType'], string> = { interaction: '对话任务', llm_request: '模型调用', tool: '工具调用', tool_blocked: '等待确认', tool_execution: '工具执行', compress: '上下文压缩', subagent: '子任务' }
const STATUS_LABELS = { running: '进行中', ok: '已完成', error: '失败', interrupted: '运行中断' } as const
const GREETING_LABELS: Record<ProactiveEvidenceRecord['status'], string> = { skipped: '未发出', reserved: '已预留', dispatched: '已发出', presented: '界面已呈现', failed: '失败', unconfirmed: '未确认呈现' }
const REASON_LABELS: Record<ProactiveEvidenceRecord['reason'], string> = { ok: '条件允许', disabled: '主动问候已关闭', muted: '生活提醒已静音', 'quiet-hours': '处于勿扰时段', 'already-today': '今天已预留发送名额', 'no-fresh-moment': '没有近期新动态', 'no-window': '没有可接收的应用窗口', 'send-failed': '未能发到接收窗口', 'receipt-timeout': '未收到界面呈现回执', 'process-restarted': '上次运行结束前未确认', 'role-inactive': '人物已不是运行主角', 'reservation-save-failed': '发送预留未能可靠保存' }
function dateLabel(value: number) { return Number.isSafeInteger(value) && value >= 0 ? new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未记录' }
export type HistoryReadingState = 'ready' | 'unread' | 'loading' | 'error' | 'refresh-error'

function ReadingStatus({ state, onRetry }: { state: HistoryReadingState; onRetry: () => void }) {
  if (state === 'error' || state === 'refresh-error') return <ErrorState title={state === 'error' ? '记录读取失败' : '刷新失败，保留上次记录'} description={state === 'error' ? '尚未读到记录，不显示为零条。' : '下方仍是刷新前的范围。'} action={<ActionButton onClick={onRetry}>重试读取</ActionButton>} />
  if (state === 'unread' || state === 'loading') return <p role="status">{state === 'unread' ? '记录尚未读取' : '正在读取记录…'}</p>
  return null
}

/** 背景：运行行动 / 关键事件历史不能用生活事件或当前快照冒充。
 * 意图：复用既有时间线与单条详情；只消费明确保存的结构与来源 ID。
 * 约束：缺失选中项不换邻居；正文从未保存，不在 UI 重建；读取副作用由容器持有。
 */
export function HistoryEvidenceReading({ result, state, selectedId, onSelect, onRetry, onCall, onSpan, onEvidence }: {
  result?: DiagnosticHistoryResult; state: HistoryReadingState; selectedId?: string; onSelect: (id?: string) => void; onRetry: () => void; onCall?: (spanId: string, record?: DiagnosticHistoryRecord) => void; onSpan?: (record: DiagnosticHistoryRecord, spanId: string) => void; onEvidence?: (view: 'recent' | 'moments', id: string, roleId: string, originId?: string) => void
}) {
  const readable = state === 'ready' || state === 'refresh-error'
  const items = readable ? (result?.records ?? []).map(record => ({ ...record, savedRecord: record, title: record.operation === 'life_tick' ? '生活推进' : record.operation === 'life_projection' ? '生活事件发布' : SPAN_LABELS[record.spanType], time: dateLabel(record.occurredAt), statusText: STATUS_LABELS[record.status] })) : []
  return <section className="debug-history-reading" data-testid="debug-history-reading">
    <ReadingStatus state={state} onRetry={onRetry} />
    {readable && result?.state === 'unavailable' && <p role="status">{result.boundary}</p>}
    {readable && result?.state === 'ready' && <>
      <p className="debug-history-note">保存的关键运行记录；与当前窗口的实时摘要分别查看。</p>
      {(result.coverage.dropped > 0 || result.coverage.writeFailures > 0 || result.coverage.invalidStored > 0) && <p role="status">部分记录未保存或无法读取；当前范围不完整。</p>}
      {selectedId && !items.some(row => row.id === selectedId) && <p role="status">指定记录不在当前已读范围，未选择其他记录代替。</p>}
      {!items.length && <EmptyState title="此范围没有已保存记录" description="可能尚未产生、未采样或已超出保留范围，不代表从未执行。" />}
      <EventTimelineReading items={items.map(row => ({ ...row, status: row.statusText }))} selectedId={selectedId} onSelect={onSelect} renderDetail={item => <>
        <p>{item.phase === 'started' ? '此记录发生于执行开始。' : item.phase === 'ended' ? '此记录发生于执行结束。' : '此记录保存了执行期间的更新。'}{item.statusText === '运行中断' && '上次运行未确认结束，不据此判断用户取消或执行成功。'}</p>
        <dl className="debug-history-facts"><div><dt>发生时间</dt><dd>{dateLabel(item.occurredAt)}</dd></div><div><dt>耗时</dt><dd>{item.durationMs === undefined ? '未记录' : `${item.durationMs} ms`}</dd></div></dl>
        {item.spanType === 'llm_request' && onCall && <ActionButton variant="plain" onClick={() => onCall(item.spanId, item.savedRecord)}>查看这次模型调用</ActionButton>}
        {onSpan && <div>{item.kind === 'event' && <ActionButton variant="plain" onClick={() => onSpan(item.savedRecord, item.spanId)}>查看保存的 Span</ActionButton>}{item.parentId && <ActionButton variant="plain" onClick={() => onSpan(item.savedRecord, item.parentId!)}>查看父 Span</ActionButton>}{item.links?.map(id => <ActionButton key={id} variant="plain" onClick={() => onSpan(item.savedRecord, id)}>查看关联 Span</ActionButton>)}</div>}
        {onEvidence && item.roleId && <div>{item.sourceEventId && <ActionButton variant="plain" onClick={() => onEvidence('recent', item.sourceEventId!, item.roleId!, item.id)}>查看来源生活事件</ActionButton>}{item.momentId && <ActionButton variant="plain" onClick={() => onEvidence('moments', item.momentId!, item.roleId!, item.id)}>查看关联动态</ActionButton>}</div>}
        <details><summary>关联与保存字段</summary><p>这里只保留元数据；没有保存模型正文、工具参数或错误正文。</p><pre>{JSON.stringify(item.savedRecord, null, 2)}</pre></details>
      </>} />
      <details><summary>记录范围</summary><p>{result.boundary}</p><dl className="debug-history-facts"><div><dt>开始记录</dt><dd>{result.coverage.recordingSince === null ? '未知' : dateLabel(result.coverage.recordingSince)}</dd></div><div><dt>已裁剪</dt><dd>{result.coverage.pruned}</dd></div><div><dt>待保存</dt><dd>{result.coverage.pending}{result.coverage.diskPending ? ' · 磁盘保存待重试' : ''}</dd></div></dl><pre>{JSON.stringify(result.coverage, null, 2)}</pre></details>
    </>}
  </section>
}

/** 背景：发出 / 呈现 / 已读并不是同一事实，未提醒原因也需要可追查。
 * 意图：只展示单条当前状态和明确原因，技术计数 / ID 折叠，避免再堆仪表盘。
 * 约束：本组件无发送或重试提醒动作；重试只读查询，呈现不解释为用户已读。
 */
export function ProactiveDeliveryReading({ result, state, onRetry, targetId, onEvidence }: { result?: ProactiveEvidenceResult; state: HistoryReadingState; onRetry: () => void; targetId?: string; onEvidence?: (view: 'recent' | 'moments', id: string, roleId: string, originId?: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(targetId)
  const readable = state === 'ready' || state === 'refresh-error'
  const items = readable ? (result?.records ?? []).map(row => ({ ...row, savedRecord: row, title: row.status === 'skipped' ? REASON_LABELS[row.reason] : '生活动态提醒', time: dateLabel(row.occurredAt), status: GREETING_LABELS[row.status], savedStatus: row.status })) : []
  return <section className="debug-history-reading" data-testid="debug-proactive-delivery-reading">
    <ReadingStatus state={state} onRetry={onRetry} />
    {readable && result?.state === 'unavailable' && <p role="status">{result.boundary}</p>}
    {readable && result?.state === 'ready' && <>
      <p className="debug-history-note">界面已呈现不代表用户已读；没有回执不会自动重发。</p>
      {!items.length && <EmptyState title="此范围没有问候记录" description="这里只查询已保存证据，不触发提醒。" />}
      {selectedId && !items.some(row => row.id === selectedId) && <p role="status">原选中记录已不在当前范围，未选择其他提醒代替。</p>}
      <EventTimelineReading items={items} selectedId={selectedId} onSelect={setSelectedId} renderDetail={item => <>
        <p>{REASON_LABELS[item.reason]}。{item.savedStatus === 'presented' ? '应用内提示组件报告了呈现，不证明用户看见或阅读。' : item.savedStatus === 'unconfirmed' ? '只能确认缺少呈现回执，不能据此判断没有发送。' : ''}</p>
        <dl className="debug-history-facts"><div><dt>人物</dt><dd>{item.roleId}</dd></div><div><dt>日期</dt><dd>{item.localDay}</dd></div></dl>
        {onEvidence && item.momentId && <ActionButton variant="plain" onClick={() => onEvidence('moments', item.momentId!, item.roleId, item.id)}>查看来源动态</ActionButton>}
        <details><summary>投递依据与来源</summary><p>{result.boundary}</p><pre>{JSON.stringify(item.savedRecord, null, 2)}</pre></details>
      </>} />
    </>}
  </section>
}
