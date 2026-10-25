import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { DebugTraceSpan } from '../../shared/debug-traces'
import { ActionButton } from '../foundation/ActionButton'
import { snapshotTime } from './NowStateReading'
import { traceTree } from './trace-tree'

const KNOWN_TYPES = ['interaction', 'llm_request', 'tool', 'tool_blocked', 'tool_execution', 'compress', 'subagent']
const duration = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? `${value} ms` : '耗时未记录'

/** 背景：调用树与后台 links 是不同证据，密集行曾遮住正文和完整诊断属性。
 * 意图：正式与候选共用可扫描树及单 Span 详情，完整字段按需展开。
 * 约束：树只用 parentId，未知 / 孤立 / 循环来源保留；只允许 LLM Span 定位同 ID 请求，未知耗时不补零。
 */
export function TraceReading({ spans, selectedId, onSelect, onRecord, renderActions }: {
  spans: readonly DebugTraceSpan[]; selectedId?: string; onSelect: (id: string | undefined) => void; onRecord: (id: string) => void; renderActions?: (span: DebugTraceSpan) => ReactNode
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>()), detail = useRef<HTMLElement>(null)
  const tree = traceTree(spans), selected = spans.find(span => span.id === selectedId)
  useEffect(() => { if (selected) detail.current?.scrollIntoView({ block: 'start' }) }, [selectedId, Boolean(selected)])
  return <>
    {tree.orphans > 0 && <p className="debug-trace-state" role="status">父级未在当前返回范围找到的 Span 按独立根保留，不按时间补父级。</p>}
    {tree.cyclic && <p className="debug-trace-state" role="status">存在循环父级引用，已断开重复遍历并保留全部标识；不解释完整父子链。</p>}
    {tree.duplicates > 0 && <p className="debug-trace-state" role="status">存在重复 Span 标识；清单每个标识显示一次，完整快照保留原始条目。</p>}
    {spans.some(span => !KNOWN_TYPES.includes(span.type)) && <p className="debug-trace-state" role="status">存在未识别 Span 类型，原始类型保留。</p>}
    {spans.some(span => span.attributes.truncated === true) && <p className="debug-trace-state" role="status">属性读取有界，不能认定完整链路。</p>}
    {spans.length > 0 && <><p className="debug-trace-caption">{spans.length} 条已读 Span · 父子关系只由 parentId 确定，后台关联只由 links 确定。</p><div className="debug-trace-tree">{tree.nodes.map(({ span, depth }) => <div key={span.id} className="debug-trace-row" data-record-id={span.id} data-trace-span-id={span.id} style={{ paddingLeft: `${Math.min(depth, 6) * 18}px` }}><ActionButton ref={node => { if (node) buttons.current.set(span.id, node); else buttons.current.delete(span.id) }} variant="plain" className="debug-trace-text" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === span.id} onClick={() => onSelect(span.id)}><ChevronRight size={13} /><span>{span.name || '名称未记录'}</span><code>{span.type || '类型未记录'}</code><span className={span.status === 'error' ? 'debug-trace-error' : ''}>{duration(span.duration)}</span></ActionButton></div>)}</div></>}
    {selected && <article key={selected.id} ref={detail} className="debug-trace-detail" aria-label="Span 详情"><ActionButton variant="plain" onClick={() => { onSelect(undefined); requestAnimationFrame(() => buttons.current.get(selected.id)?.focus()) }}><ArrowLeft size={14} />返回调用链</ActionButton><h3>{selected.name || '名称未记录'}</h3><dl><dt>Span 标识</dt><dd><code>{selected.id}</code></dd><dt>类型</dt><dd>{selected.type || '未记录'}</dd><dt>调用者</dt><dd>{selected.caller || '未记录'}</dd><dt>父 Span</dt><dd><code>{selected.parentId || '未记录'}</code></dd><dt>关联 Span</dt><dd><code>{selected.links?.join('、') || '未记录'}</code></dd><dt>状态</dt><dd>{selected.status || '未记录'}</dd><dt>开始时间</dt><dd>{snapshotTime(selected.startTime, Intl.DateTimeFormat().resolvedOptions().timeZone)}</dd><dt>结束时间</dt><dd>{snapshotTime(selected.endTime, Intl.DateTimeFormat().resolvedOptions().timeZone)}</dd><dt>耗时</dt><dd>{duration(selected.duration)}</dd></dl>{selected.error && <p className="debug-trace-error">{selected.error}</p>}{selected.type === 'llm_request' && <ActionButton variant="plain" onClick={() => onRecord(selected.id)}>查看请求记录</ActionButton>}{renderActions?.(selected)}<details className="debug-trace-source"><summary>属性与原始结构</summary><pre>{JSON.stringify(selected, null, 2)}</pre></details></article>}
  </>
}
