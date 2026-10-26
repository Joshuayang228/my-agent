export interface RuntimeEventSummary { time: number; type: string; detail: string }
export interface RuntimeEventReading {
  id: string; time?: number; title: string; type: string; status: string; body: string; sessionId?: string; spanId?: string; raw?: unknown
}
const TITLES = [
  ['text', '文本片段'], ['thinking', '思考输出片段'], ['tool_start', '工具开始'], ['tool_end', '工具结束'], ['error', '运行错误'], ['usage', '用量更新'], ['done', '本轮结束'], ['tool_confirm', '等待确认'], ['compact', '上下文压缩'], ['execution_mode_changed', '执行方式变更'], ['memory_citations', '记忆引用'],
] as const

export function runtimeEventTime(value: unknown, timezone: string): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(value) : '时间未记录'
}

/** 背景：App 缓存没有持久事件 ID，按数组下标选中会在窗口裁剪后错指其他事件。
 * 意图：同一次浏览按实际对象身份分配局部标识，已保留对象在追加 / 裁剪后保持身份。
 * 约束：标识不当持久事件 ID；只消费现存摘要，不从时间、活动会话或摘要文本推导关联与执行结果。
 */
export function createRuntimeEventProjector() {
  const ids = new WeakMap<RuntimeEventSummary, string>()
  let sequence = 0
  return (events: readonly RuntimeEventSummary[]): RuntimeEventReading[] => events.map(event => {
    let id = ids.get(event)
    if (!id) { id = `window-event-${++sequence}`; ids.set(event, id) }
    const name = TITLES.find(([type]) => type === event.type)?.[1] ?? (event.type || '类型未记录')
    const title = event.detail ? `${name} · ${event.detail.slice(0, 80)}${event.detail.length > 80 ? '…' : ''}` : name
    return { id, time: event.time, type: event.type, title, status: event.type === 'error' ? '失败' : '已收到', body: event.detail, raw: { ...event } }
  })
}
