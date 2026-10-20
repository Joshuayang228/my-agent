import { useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export type TracesPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'orphan' | 'unknown-type' | 'long' | 'truncated' | 'missing'
interface TraceRecord { id: string; name: string; type: string; caller: string; parentId?: string; links?: string[]; startTime?: number; duration?: number; status: string; attributes: Record<string, unknown>; error?: string }
interface Props { empty?: boolean; previewState: TracesPreviewState; snapshotState: TracesPreviewState; initialSelectedId?: string; onRetry: () => void; onRecord: (id: string) => void }

const TRACE_FIXTURES: readonly TraceRecord[] = [
  { id: 'demo-span-01', name: '主对话交互', type: 'interaction', caller: 'main', startTime: Date.parse('2026-10-13T14:31:52+08:00'), duration: 6000, status: 'ok', attributes: { sessionId: 'demo-session-01', purpose: '用户消息到回复的完整交互边界' } },
  { id: 'demo-span-02', name: '读取旅行记录', type: 'llm_request', caller: 'main', parentId: 'demo-span-01', startTime: Date.parse('2026-10-13T14:31:56+08:00'), duration: 3680, status: 'ok', attributes: { model: '示例对话模型', toolCallCount: 1 } },
  { id: 'demo-span-tool', name: '读取工具', type: 'tool', caller: 'tool', parentId: 'demo-span-02', startTime: Date.parse('2026-10-13T14:31:59+08:00'), duration: 184, status: 'ok', attributes: { toolName: 'demo_read', permission: 'read-only' } },
  { id: 'demo-span-03', name: '模型服务失败', type: 'llm_request', caller: 'main', parentId: 'demo-span-01', startTime: Date.parse('2026-10-13T14:32:08+08:00'), duration: 2410, status: 'error', attributes: { model: '示例对话模型' }, error: '模型服务暂时不可用，本次请求未获得回复。' },
  { id: 'demo-span-linked', name: '记忆提取', type: 'subagent', caller: 'memory', links: ['demo-span-01'], startTime: Date.parse('2026-10-13T14:30:12+08:00'), duration: 840, status: 'ok', attributes: { relation: '后台任务通过 links 指向主对话，不属于父子耗时' } },
]

/** 背景：调用链必须区分父子 Span 与后台关联，不能按相邻时间拼链。
 * 意图：先展示可扫描的树，再看单 Span 证据和 links。
 * 约束：仅使用显式 parentId / links；未知父级不隐藏，未知 type 不转为正常能力。
 */
export function DebugTracesCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onRecord }: Props) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [more, setMore] = useState(false)
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  let spans = empty ? [] : [...TRACE_FIXTURES]
  if (state === 'orphan') spans = spans.map(span => span.id === 'demo-span-03' ? { ...span, parentId: 'demo-missing-parent' } : span)
  if (state === 'unknown-type') spans = spans.map(span => span.id === 'demo-span-tool' ? { ...span, type: 'future_span_type' } : span)
  if (state === 'long') spans = spans.map(span => span.id === 'demo-span-01' ? { ...span, name: '【长 Span 名称样张】'.repeat(20), attributes: { ...span.attributes, note: '【长属性样张】'.repeat(100) } } : span)
  if (state === 'truncated') spans = spans.map(span => ({ ...span, attributes: { ...span.attributes, truncated: true } }))
  const selected = spans.find(span => span.id === selectedId)
  const roots = spans.filter(span => !span.parentId || !spans.some(parent => parent.id === span.parentId))
  const children = (id: string) => spans.filter(span => span.parentId === id)
  const missing = state === 'missing' || Boolean(initialSelectedId && !selected)
  const row = (span: TraceRecord, depth = 0): React.ReactNode => <div key={span.id} className="debug-trace-row" data-record-id={span.id} style={{ paddingLeft: `${depth * 18}px` }}><ActionButton variant="plain" className="debug-trace-text" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === span.id} onClick={() => setSelectedId(span.id)}><ChevronRight size={13} /> <span>{span.name}</span><code>{span.type}</code><span className={span.status === 'error' ? 'debug-trace-error' : ''}>{span.duration == null ? '耗时未记录' : `${span.duration} ms`}</span></ActionButton>{children(span.id).map(child => row(child, depth + 1))}</div>
  return <section className="debug-traces-workbench" data-testid="debug-evidence-traces">
    {!available ? <div className="debug-trace-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '调用链尚未读取' : previewState === 'loading' ? '正在读取调用链…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取 Span。' : '调用链读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取调用链样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-trace-state" role="alert"><p>刷新失败，保留原调用树与选中 Span；下方不是最新链路。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'orphan' && <p className="debug-trace-state" role="status">一条 Span 的父级未在当前返回范围找到，按独立根保留，不按时间补父级。</p>}
      {state === 'unknown-type' && <p className="debug-trace-state" role="status">存在未识别 Span 类型，原始类型保留。</p>}
      {state === 'truncated' && <p className="debug-trace-state" role="status">属性读取有界，不能认定完整链路。</p>}
      {missing && <p className="debug-trace-state" role="status">引用 Span 未返回，未选择其他 Span 代替。</p>}
      {!spans.length ? <p className="debug-trace-state" role="status">当前查询没有 Span，不代表运行时没有调用。</p> : <><p className="debug-trace-caption">{spans.length} 条已读 Span · 父子关系只由 parentId 确定，后台关联只由 links 确定。</p><div className="debug-trace-tree">{roots.map(root => row(root))}</div></>}
      {spans.length > 3 && <ActionButton variant="plain" onClick={() => setMore(!more)}>{more ? '收起链路说明' : '查看链路说明'}</ActionButton>}
      {selected && !missing && <article className="debug-trace-detail" aria-label="Span 详情"><ActionButton variant="plain" onClick={() => setSelectedId(undefined)}><ArrowLeft size={14} />返回调用链</ActionButton><h3>{selected.name}</h3><dl><dt>Span 标识</dt><dd><code>{selected.id}</code></dd><dt>类型</dt><dd>{selected.type}</dd><dt>调用者</dt><dd>{selected.caller}</dd><dt>父 Span</dt><dd><code>{selected.parentId ?? '未记录'}</code></dd><dt>关联 Span</dt><dd><code>{selected.links?.join('、') || '未记录'}</code></dd><dt>状态</dt><dd>{selected.status}</dd></dl>{selected.error && <p className="debug-trace-error">{selected.error}</p>}{more && <details open><summary>属性与原始结构</summary><pre>{JSON.stringify(selected, null, 2)}</pre></details>}<ActionButton variant="plain" onClick={() => onRecord(selected.id)}>查看请求记录</ActionButton></article>}
      <details className="debug-trace-source"><summary>来源与诊断边界</summary><p>来源：tracer 的有界 Span 快照。Span 阶段不是模型隐藏思维；blocked_on_user 与 tool_execution 的时长只在实际 Span 提供时展示。没有父级或 links 时不按时间相近拼接。</p></details>
    </>}
  </section>
}
