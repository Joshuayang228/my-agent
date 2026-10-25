import { useEffect, useState } from 'react'
import type { DebugTracesSnapshot } from '../../shared/debug-traces'
import { ActionButton } from '../foundation/ActionButton'
import { TraceReading } from './TraceReading'

/** 背景：真实链路原先首屏堆统计且无法独立核对单 Span。
 * 意图：有界快照驱动候选树和详情，原统计完整折叠，失败保留旧证据。
 * 约束：此处只读，不补历史、不推算后台耗时；资产和请求只按保存标识定位。
 */
export function TracesEvidenceContent({ snapshot, loading, error, focusId, onRetry, onRecord, onAsset }: {
  snapshot: DebugTracesSnapshot | null; loading: boolean; error: string; focusId?: string; onRetry: () => void; onRecord: (id: string) => void; onAsset: (key: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(focusId || undefined)
  useEffect(() => { if (focusId) setSelectedId(focusId) }, [focusId])
  const missing = Boolean(selectedId && snapshot && !snapshot.spans.some(span => span.id === selectedId))
  return <section className="debug-traces-workbench" data-testid="debug-evidence-traces">
    {error && <div className="debug-trace-state" role="alert"><p>{snapshot ? '刷新失败，保留原调用树与选中 Span；下方不是最新链路。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-trace-state" role="status">正在读取调用链…</p>}
    {!snapshot && !loading && !error && <p className="debug-trace-state" role="status">调用链尚未读取；需要桌面应用的诊断接口。</p>}
    {snapshot && <>
      {missing && <p className="debug-trace-state" role="status">引用 Span 未返回，未选择其他 Span 代替。目标可能已离开当前内存窗口：<code>{selectedId}</code></p>}
      {!snapshot.spans.length && <p className="debug-trace-state" role="status">当前查询没有 Span，不代表运行时没有调用。</p>}
      <TraceReading spans={snapshot.spans} selectedId={selectedId} onSelect={setSelectedId} onRecord={onRecord} renderActions={span => {
        const raw = span.attributes.assetKeys, keys = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : typeof raw === 'string' ? [raw] : []
        return [...new Set(keys)].map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看资产 {key}</ActionButton>)
      }} />
      <details className="debug-trace-source"><summary>统计与使用量</summary><dl><dt>今日 Token</dt><dd>{snapshot.dailyTokenUsage ?? '未记录'}</dd><dt>前台输入 / 输出</dt><dd>{snapshot.tokenLanes ? `${snapshot.tokenLanes.foreground.inputTokens} / ${snapshot.tokenLanes.foreground.outputTokens}` : '未记录'}</dd><dt>后台输入 / 输出</dt><dd>{snapshot.tokenLanes ? `${snapshot.tokenLanes.background.inputTokens} / ${snapshot.tokenLanes.background.outputTokens}` : '未记录'}</dd></dl><pre>{JSON.stringify(snapshot.callerStats, null, 2)}</pre></details>
      <details className="debug-trace-source"><summary>来源与诊断边界</summary><p>来源：tracer 最近最多 100 条内存 Span 快照。父级可能已离开当前窗口，不表示完整历史或完整请求链；统计范围与当前 Span 窗口不同，不按可见行求和替代。</p><p>Span 阶段不是模型隐藏思维；等待确认与工具执行的时长只按实际 Span 展示，后台 links 不计入父子耗时。请求详情可能尚未持久化或已删除。</p><pre>{JSON.stringify(snapshot, null, 2)}</pre></details>
    </>}
  </section>
}
