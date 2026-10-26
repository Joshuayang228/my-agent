import { useState } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { EventReading } from './EventReading'
import { createRuntimeEventProjector, type RuntimeEventSummary } from './runtime-events'

/** 背景：正式事件页是 App 传入的当前摘要缓存，不能伪装为独立历史接口。
 * 意图：共享候选时间线与详情，局部身份在追加 / 裁剪中保持，空与筛选空分别说明。
 * 约束：不修改缓存、不启动 IPC / 模型 / 工具，不推导会话 / Span；状态只解释收到或错误事件。
 */
export function EventsEvidenceContent({ events, onPage }: { events: readonly RuntimeEventSummary[]; onPage: (page: 'traces' | 'runs') => void }) {
  const [project] = useState(createRuntimeEventProjector), [selectedId, setSelectedId] = useState<string | undefined>(), [status, setStatus] = useState('all')
  const records = project(events), matches = records.filter(event => status === 'all' || event.status === status)
  const missing = Boolean(selectedId && !records.some(event => event.id === selectedId))
  return <section className="debug-events-workbench" data-testid="debug-evidence-events">
    <div className="debug-events-toolbar"><span>当前窗口事件 · {records.length} 条缓存 · 历史总数未知</span><label>状态<SelectField aria-label="事件状态筛选" value={status} onChange={event => { setStatus(event.target.value); setSelectedId(undefined) }}><option value="all">全部</option><option value="已收到">已收到</option><option value="失败">失败</option></SelectField></label></div>
    {missing && <p className="debug-events-state" role="status">选中事件已离开当前缓存，未选择其他事件代替。</p>}
    {!matches.length && <p className="debug-events-state" role="status">{records.length ? '当前缓存没有匹配的事件。' : '当前查询没有已读事件，不代表运行时没有发生事件。'}</p>}
    <EventReading events={matches} allEvents={records} selectedId={selectedId} onSelect={setSelectedId} identityLabel="窗口内标识（本次浏览）" />
    <details className="debug-events-source"><summary>来源与诊断边界</summary><p>来源：App 当前会话的接收摘要缓存，切换会话清空，最多保留 501 条。时间为窗口接收时间，标识仅在本次浏览有效；当前缓存不提供会话或 Span 关联，不按时间或摘要猜测。</p><p>文本 / 思考片段仅保存前 80 字符，工具开始参数摘要最多 60 字符；其他类型也可能没有摘要。本页只显示已保存摘要，不补完整事件或更早历史。事件不等于行动完成、永久账本或模型隐藏思维。</p><ActionButton variant="plain" onClick={() => onPage('traces')}>浏览当前调用链</ActionButton><ActionButton variant="plain" onClick={() => onPage('runs')}>查看调用记录</ActionButton></details>
  </section>
}
