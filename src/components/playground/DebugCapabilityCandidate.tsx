import { useState } from 'react'
import type { DiagnosticHistoryRecord, DiagnosticHistoryResult } from '../../shared/debug-history'
import type { ProactiveEvidenceRecord, ProactiveEvidenceResult } from '../../shared/proactive-evidence'
import { HistoryEvidenceReading, ProactiveDeliveryReading, type HistoryReadingState } from '../debug/HistoryEvidenceReading'
import { ActionButton } from '../foundation/ActionButton'

export type DebugCapabilityPage = 'activity' | 'proactive' | 'traces' | 'events'
const NOW = new Date('2026-10-26T14:00:00+08:00').getTime()

function historyFixture(page: DebugCapabilityPage, empty: boolean, truncated: boolean): DiagnosticHistoryResult {
  const base: DiagnosticHistoryRecord = { id: 'demo-run:span:demo-root', processRunId: 'demo-run', kind: page === 'events' ? 'event' : 'span', occurredAt: NOW, updatedAt: NOW + 1000, phase: 'ended', status: 'ok', caller: 'main', spanType: 'interaction', spanId: 'demo-root', sessionId: 'demo-session', roleId: 'demo-role', durationMs: 1000, omittedFields: 2 }
  const records: DiagnosticHistoryRecord[] = [
    { ...base, id: 'demo-run:span:demo-call-01', spanId: 'demo-call-01', spanType: 'llm_request', parentId: 'demo-root', occurredAt: NOW + 1000, updatedAt: NOW + 2000 },
    { ...base, id: 'demo-run:span:demo-tool', spanId: 'demo-tool', spanType: 'tool_execution', caller: 'tool', parentId: 'demo-root', status: 'error', occurredAt: NOW + 500, updatedAt: NOW + 1500 },
    { ...base, id: 'demo-run:span:demo-background', spanId: 'demo-background', caller: 'memory', links: ['demo-root'], status: 'interrupted', durationMs: undefined },
  ]
  return {
    state: 'ready', generatedAt: NOW, hasMore: false,
    records: empty ? [] : page === 'events' ? records.map(row => ({ ...row, id: `demo-run:event:${row.spanId}:${row.status === 'interrupted' ? 'started' : 'ended'}`, ...(row.status === 'interrupted' ? { status: 'running' as const, phase: 'started' as const, occurredAt: row.occurredAt } : { occurredAt: row.updatedAt }) })) : records,
    coverage: { recordingSince: NOW - 86400000, retainedFrom: NOW - 7 * 86400000, processRunId: 'demo-current-run', pending: 0, dropped: truncated ? 3 : 0, pruned: truncated ? 20 : 0, writeFailures: 0, invalidStored: 0, diskPending: false },
    boundary: '隔离样张：仅保存关键阶段的元数据，最多 7 天 / 20000 条；没有保存模型正文、工具参数或完整实时文字流。',
  }
}

function proactiveFixture(empty: boolean): ProactiveEvidenceResult {
  const base: ProactiveEvidenceRecord = { id: 'demo-greeting-1', processRunId: 'demo-run', roleId: 'demo-role', localDay: '2026-10-26', occurredAt: NOW, updatedAt: NOW + 1000, status: 'presented', reason: 'ok', momentId: 'demo-moment', recipientCount: 1, sentCount: 1, failedCount: 0, checks: 1 }
  return { state: 'ready', hasMore: false, records: empty ? [] : [base,
    { ...base, id: 'demo-greeting-2', localDay: '2026-10-25', occurredAt: NOW - 86400000, updatedAt: NOW - 86400000 + 30000, status: 'unconfirmed', reason: 'receipt-timeout' },
    { ...base, id: 'demo-greeting-3', localDay: '2026-10-24', occurredAt: NOW - 2 * 86400000, updatedAt: NOW - 2 * 86400000 + 1000, status: 'skipped', reason: 'quiet-hours', momentId: undefined, recipientCount: 0, sentCount: 0, checks: 4 },
  ], boundary: '隔离样张：当前状态与原因来自独立问候记录；呈现不等于已读，缺回执不会自动重发。' }
}

/** 背景：新增来源需先确认展示密度，不能直接把历史与实时混在正式页。
 * 意图：在既有 Debug 页面组合中显式启用能力样张，复用生产纯阅读组件。
 * 约束：仅本地虚构记录，不调用桥接或模型；原候选与正式页默认行为保持独立。
 */
export function DebugCapabilityCandidate({ page, scenario, hasSnapshot, onRetry, onCurrent, onCall, onLife }: {
  page: DebugCapabilityPage; scenario: string; hasSnapshot: boolean; onRetry: () => void; onCurrent: () => void; onCall: (id: string) => void; onLife: () => void
}) {
  const [selectedId, setSelectedId] = useState<string>()
  const [firstError, setFirstError] = useState(false)
  const state: HistoryReadingState = firstError ? 'error' : scenario === 'refresh-error' ? hasSnapshot ? 'refresh-error' : 'error' : scenario === 'unread' ? 'unread' : scenario === 'running' ? 'loading' : 'ready'
  const retry = () => { setFirstError(false); onRetry() }
  return <div data-testid="debug-capability-candidate">
    <div className="flex flex-wrap gap-2 mb-4" data-playground-switcher>
      <ActionButton variant="plain" onClick={onCurrent}>{page === 'events' ? '查看现有实时窗口' : page === 'traces' ? '查看现有调用链快照' : '查看旧版对照'}</ActionButton>
      {page === 'activity' && <ActionButton variant="plain" onClick={onLife}>查看生活事件</ActionButton>}
      <ActionButton variant="plain" onClick={() => setFirstError(true)}>首次失败样张</ActionButton>
      {page !== 'proactive' && <ActionButton variant="plain" onClick={() => setSelectedId('demo-missing-source')}>来源缺失样张</ActionButton>}
    </div>
    {page === 'proactive' ? <ProactiveDeliveryReading state={state} result={proactiveFixture(scenario === 'empty')} onRetry={retry} /> :
      <HistoryEvidenceReading state={state} result={historyFixture(page, scenario === 'empty', scenario === 'truncated')} selectedId={selectedId} onSelect={setSelectedId} onRetry={retry} onCall={onCall} />}
  </div>
}
