import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Search } from 'lucide-react'
import type { DebugEvidenceRecord, DebugEvidenceResult, DebugEvidenceQuery, DebugEvidenceScope } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'

const LABELS: Record<string, string> = { description: '描述', interior: '室内', surroundings: '周边', layout: '布局', view: '窗景', background: '经历', education: '教育', careerHistory: '职业经历', skills: '技能', dailyRhythm: '日常节奏', dislikes: '不喜欢', flaws: '缺点', socialStyle: '社交方式', valuesInPractice: '价值选择', selfAwareness: '自我认知', birthday: '生日', pronouns: '称谓', author: '作者', artist: '音乐人', director: '导演', detail: '记录详情', note: '笔记', readingStatus: '阅读状态', watchStatus: '观看状态', listeningStatus: '聆听状态', workStatus: '作品状态', currentPage: '当前页', totalPages: '总页数', albumTitle: '专辑', locationName: '拍摄地点', depictedAt: '画面时间', home: '住所', currentActivity: '当前活动', currentLocation: '当前位置', locationDetail: '地点细节', mood: '情绪', energy: '能量', socialNeed: '社交需要', statusTags: '状态标签', timezone: '时区', updatedAt: '更新时间', occupation: '职业', agePresentation: '年龄呈现', origin: '来处', interests: '兴趣', hobbies: '爱好', habits: '习惯', status: '状态', recordType: '记录类型', residenceId: '所属住所', spaceId: '所属空间', displayInHome: '家居展示', displayReason: '展示依据', destination: '目的地', start: '开始日期', end: '结束日期', story: '经历', category: '分类', notes: '笔记', date: '日期', theme: '主题', activity: '活动', location: '地点', summary: '摘要', role_id: '人物范围', catchup_summary: '补叙', paused_at: '暂停时间', last_tick_at: '最近推进时间' }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const valueText = (value: unknown): string => typeof value === 'string' ? value || '未记录' : Array.isArray(value) ? value.filter(item => typeof item === 'string').join('、') : value === null || value === undefined ? '未记录' : String(value)
function Facts({ data }: { data: Record<string, unknown> }) { return <dl className="debug-candidate-facts">{Object.entries(data).filter(([key, value]) => key in LABELS && (typeof value !== 'object' || value === null || Array.isArray(value) && value.every(item => typeof item === 'string'))).map(([key, value]) => <div key={key}><dt>{LABELS[key]}</dt><dd>{valueText(value)}</dd></div>)}</dl> }

// 背景：目录自动展开全部字段曾淹没事实；意图：按阅读任务显式声明首屏字段。
// 约束：没有映射的字段只进完整详情；这里不推断记录类型，不改变生产数据。
const READING_FIELDS: Partial<Record<DebugEvidenceQuery['view'], readonly string[]>> = {
  now: ['currentActivity', 'currentLocation'], location: ['currentLocation', 'locationDetail'],
  character: ['occupation', 'agePresentation'], residence: ['layout'], footprints: ['destination', 'start', 'end'],
  items: ['author', 'artist', 'director', 'readingStatus', 'watchStatus', 'listeningStatus'],
  recent: ['location'], activity: ['location'], moments: ['location'], relations: ['socialStyle'],
}
const ROUTINE_STATUS = new Set(['published', 'completed', 'active', 'stored', 'ready'])
function ReadingFacts({ record, view }: { record: DebugEvidenceRecord; view: DebugEvidenceQuery['view'] }) {
  const source = view === 'character' ? object(record.data.profile) : ['now', 'location'].includes(view) ? object(record.data.world) : object(record.data.payload)
  return <Facts data={Object.fromEntries((READING_FIELDS[view] ?? []).filter(key => key in source).map(key => [key, source[key]]))} />
}

/** 背景：领域事实默认需要直接阅读，原始结构和标识不应占据第一屏。
 * 意图：时段、世界、资料、家居及旅行按各自结构显示，完整脱敏记录在详情保留。
 * 约束：只调用有界只读接口；迟到响应不越过人物/日期范围，刷新失败保留旧证据，分页不清空已有页。
 */
export function CompanionEvidencePanel({ view, roleId, revision, targetId, onEvidence, scope, onRoleChange }: { view: DebugEvidenceQuery['view']; roleId: string; scope?: DebugEvidenceScope | null; onRoleChange?: (id: string) => void; revision: number; targetId?: string; onEvidence: (view: DebugEvidenceQuery['view'], id: string) => void }) {
  const [date, setDate] = useState(view === 'schedule' && !targetId ? new Date().toLocaleDateString('sv-SE') : '')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DebugEvidenceResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [reload, setReload] = useState(0)
  const recordsRef = useRef<DebugEvidenceRecord[]>([])
  useEffect(() => { setCursor(undefined) }, [revision])
  useEffect(() => {
    let current = true
    setLoading(true); setError('')
    if (!window.electronAPI?.debug?.companionEvidenceQuery) { setLoading(false); setError('此页面需要桌面应用的诊断接口'); return }
    window.electronAPI.debug.companionEvidenceQuery({ view, roleId, date: date || undefined, cursor, recordId: targetId }).then(next => {
      if (!current) return
      const records = cursor ? [...recordsRef.current, ...next.records].filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id && other.source === entry.source) === index) : next.records
      recordsRef.current = records; setResult({ ...next, records })
    }).catch(() => { if (current) setError('证据读取失败；刷新时保留上次成功结果') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [view, roleId, date, cursor, revision, reload, targetId])
  const changeDate = (value: string) => { setDate(value); setCursor(undefined); setResult(null); recordsRef.current = [] }
  const filtered = (result?.records ?? []).filter(record => `${record.title} ${record.body} ${JSON.stringify(record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const assets = (record: DebugEvidenceRecord) => object(record.data.payload)
  const card = (record: DebugEvidenceRecord) => <article className="debug-reading-entry" key={`${record.source}:${record.id}`} data-record-id={record.id}>
    {view !== 'schedule' && <div className="debug-candidate-detail-heading"><h3>{['now', 'location', 'character'].includes(view) ? '当前记录' : record.title || '未命名记录'}</h3>{record.status && !ROUTINE_STATUS.has(record.status) && <Badge>{record.status}</Badge>}</div>}
    {view === 'schedule' && record.status && !ROUTINE_STATUS.has(record.status) && <p role="status">{record.status}</p>}
    {view === 'schedule' && (!Array.isArray(assets(record).slots) || !(assets(record).slots as unknown[]).length) && <p role="status">没有可读取的计划时段。</p>}
    {record.time !== null && !['profile', 'schedule', 'now', 'location', 'character'].includes(view) && <p className="debug-reading-subtitle">{new Date(record.time).toLocaleString('zh-CN', { timeZone: result?.timezone })}</p>}
    {view === 'schedule' ? <>{Array.isArray(assets(record).slots) && (assets(record).slots as unknown[]).map((slot, index) => {
      const row = object(slot); const minute = row.minute ?? 0
      const time = typeof row.hour === 'number' && Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23 && typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute <= 59 ? `${String(row.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '时间未记录'
      return <section key={index} className="debug-reading-entry"><h4>{time} · {valueText(row.activity)}</h4><Facts data={{ location: row.location }} /></section>
    })}</> : <>{record.body && <p className="debug-reading-body">{record.body}</p>}<ReadingFacts view={view} record={record} /></>}
    {record.truncated && <p role="status">正文或结构已截断。</p>}
    {Boolean(record.data.paused_at || record.data.storedWorld && typeof record.data.storedWorld === 'string') && <p role="status">{record.data.paused_at ? '人物推进已暂停。' : String(record.data.storedWorld)}</p>}
    <details open={targetId === record.id} className="debug-prompt-provenance"><summary>查看详情</summary>
    <p>{record.status || '状态未记录'} · {record.roleId || '显式共享'}</p>
    <Facts data={assets(record)} />
    {record.body && <p className="debug-reading-body">{record.body}</p>}
    {view === 'schedule' && Array.isArray(assets(record).slots) && <div>{(assets(record).slots as unknown[]).map((slot, index) => { const row = object(slot); const minute = row.minute ?? 0; const time = typeof row.hour === 'number' && Number.isInteger(row.hour) && row.hour >= 0 && row.hour <= 23 && typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute <= 59 ? `${String(row.hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : '时间未记录'; return <section key={index} className="debug-reading-entry"><h4>{time} · {valueText(row.activity)}</h4><Facts data={row} /><small>计划时段；执行结果以明确事件证据为准。</small></section> })}</div>}
    {(view === 'now' || view === 'location') && <><Facts data={object(record.data.world)} /><Facts data={record.data} /></>}
    {view === 'character' && <Facts data={object(record.data.profile)} />}
    {view === 'items' && Array.isArray(assets(record).readingNotes) && (assets(record).readingNotes as unknown[]).map((note, index) => { const row = object(note); return <section key={index} className="debug-reading-stop"><h4>{row.page ? `第 ${row.page} 页 · ` : ''}{typeof row.chapter === 'string' ? row.chapter : '阅读笔记'}</h4><p>{valueText(row.text)}</p></section> })}
    {view === 'footprints' && <>
      {assets(record).recordType !== 'trip' && <p className="debug-reading-warning">地点资料，未作为实际旅行。</p>}
      {assets(record).status === 'planned' && <p className="debug-reading-warning">旅行计划 · 尚未出发，不计入实际旅行。</p>}
      {assets(record).status === 'cancelled' && <p className="debug-reading-warning">计划已取消。</p>}
      {Array.isArray(assets(record).stops) && (assets(record).stops as unknown[]).map((stop, index) => { const row = object(stop); return <section className="debug-reading-stop" key={index}><h4>{valueText(row.date)} · {valueText(row.name)}</h4><p>{valueText(row.story)}</p></section> })}
    </>}
    {Array.isArray(record.data.runs) && record.data.runs.map((run, index) => { const row = object(run); return <section key={index}><h4>{typeof row.at === 'number' ? new Date(row.at).toLocaleString() : '时间未记录'}</h4><p>{valueText(row.summary)}</p><small>{row.changed === true ? '覆盖已变更' : '覆盖未变更'}</small></section> })}
    {Array.isArray(record.data.userInteractions) && record.data.userInteractions.map((interaction, index) => { const row = object(interaction); return <p key={index}>{valueText(row.actor_id)} · {row.kind === 'like' ? '点赞' : valueText(row.text)}</p> })}
    {Array.isArray(record.data.experiences) && record.data.experiences.map((experience, index) => { const row = object(experience); const payload = object(row.payload); return <section key={index}><h4>{valueText(payload.activity)}</h4><p>{valueText(payload.story)}</p><ActionButton variant="plain" onClick={() => onEvidence('recent', String(row.id))}>查看共同经历来源事件</ActionButton></section> })}
    {record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}</ActionButton>)}
    {record.truncated && <p role="status">正文或结构已截断。</p>}
    <details open={targetId === record.id} className="debug-prompt-provenance"><summary>来源与完整记录</summary><p>{record.source} · {record.id}</p><pre className="debug-candidate-body">{JSON.stringify(record.data, null, 2)}</pre></details>
    </details>
  </article>
  const home = () => {
    const nested = new Set<string>()
    const roots = filtered.filter(record => assets(record).recordType === 'residence')
    return <>{roots.map(root => { nested.add(root.id); return <section className="debug-reading-home" key={root.id}>{card(root)}{filtered.filter(record => assets(record).recordType === 'space' && assets(record).residenceId === root.id).map(space => { nested.add(space.id); return <section className="debug-reading-space" key={space.id}>{card(space)}<div className="debug-reading-object-grid">{filtered.filter(record => record.kind === 'furniture' && assets(record).spaceId === space.id).map(item => { nested.add(item.id); return card(item) })}</div></section> })}</section> })}<section><h3 className="debug-reading-group-title">未归置或当前页的独立记录</h3>{filtered.filter(record => !nested.has(record.id)).map(card)}</section></>
  }
  const profile = () => <div className="debug-reading-summaries">{[{ title: '身份', categories: ['identity', 'fact'] }, { title: '协作方式', categories: ['workflow', 'feedback'] }, { title: '表达偏好', categories: ['voice', 'preference'] }].map(section => <section key={section.title}><h3>{section.title}</h3>{filtered.filter(record => section.categories.includes(record.kind)).map(record => <p key={record.id}>{record.body}</p>)}</section>)}</div>
  return <section className="debug-evidence-workbench" data-testid={`debug-evidence-${view}`}>
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence(view, '')}>返回当前领域列表</ActionButton>}
    <div className="debug-candidate-toolbar">{scope && onRoleChange && <div className="debug-focused-scope" role="group" aria-label="诊断人物范围"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}{!['now', 'location', 'character', 'profile', 'context', 'proactive'].includes(view) && <label className="debug-candidate-search"><Search size={14} /><TextField appearance="outlined" className="h-8 px-3" aria-label="搜索当前页证据" placeholder="搜索当前已读取记录" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} /></label>}{!targetId && ['schedule', 'recent', 'activity', 'moments', 'growth', 'links'].includes(view) && <label className="debug-evidence-date">{view === 'schedule' ? '计划日期' : '日期'}<TextField appearance="outlined" className="h-8 px-2" type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => changeDate(event.target.value)} /></label>}</div>
    {error && <ErrorState title="读取异常" description={error} action={<ActionButton onClick={() => setReload(value => value + 1)}>重试</ActionButton>} />}
    {loading && <p role="status">正在读取诊断证据…</p>}
    {view === 'profile' && <p className="debug-reading-subtitle">全局资料与当前人物的协作反馈</p>}
    {result && query && <p className="debug-reading-subtitle">{filtered.length} / {result.records.length} 条已读取</p>}
    {result?.issues.map((issue, index) => <p role="status" key={index}>{issue}</p>)}
    {result?.state === 'unsupported' || result?.state === 'unavailable' ? <EmptyState title={result.state === 'unsupported' ? '此类证据尚无独立读取源' : '诊断源暂不可用'} description={result.boundary} /> : result && !filtered.length ? <EmptyState title={targetId ? '引用目标未在该人物范围找到' : result.records.length ? '没有匹配的证据' : '此范围没有记录'} description="空记录不等于引擎不存在，不补造默认事实。" /> : <div className={`debug-reading debug-reading-${view === 'schedule' ? 'schedule' : ['recent', 'activity', 'moments', 'growth'].includes(view) ? 'timeline' : 'catalog'}`}>
      {view === 'profile' ? <>{profile()}<details className="debug-prompt-provenance" open={Boolean(targetId)}><summary>查看画像来源记录</summary>{filtered.map(card)}</details></> : view === 'residence' ? home() : view === 'items' ? (['reading', 'music', 'film', 'photography'] as const).map(type => { const records = filtered.filter(record => assets(record).type === type || type === 'reading' && record.kind === 'bookshelf' && !assets(record).type); return records.length ? <section key={type}><h3 className="debug-reading-group-title">{{ reading: '阅读', music: '音乐', film: '影视', photography: '摄影' }[type]}</h3>{records.map(card)}</section> : null }) : view === 'footprints' ? [{ label: '实际旅行', match: (r: DebugEvidenceRecord) => assets(r).recordType === 'trip' && ['active', 'completed'].includes(String(assets(r).status)) }, { label: '旅行计划', match: (r: DebugEvidenceRecord) => assets(r).recordType === 'trip' && assets(r).status === 'planned' }, { label: '已取消计划', match: (r: DebugEvidenceRecord) => assets(r).recordType === 'trip' && assets(r).status === 'cancelled' }, { label: '地点与其他记录', match: (r: DebugEvidenceRecord) => assets(r).recordType !== 'trip' || !['active', 'completed', 'planned', 'cancelled'].includes(String(assets(r).status)) }].map(group => { const rows = filtered.filter(group.match); return rows.length ? <section key={group.label}><h3 className="debug-reading-group-title">{group.label}</h3>{rows.map(card)}</section> : null }) : filtered.map(card)}
    </div>}
    {view === 'items' && filtered.filter(record => !['reading', 'music', 'film', 'photography'].includes(String(assets(record).type)) && !(record.kind === 'bookshelf' && !assets(record).type)).map(card)}
    {result?.hasMore && <ActionButton disabled={loading} onClick={() => setCursor(result.nextCursor)}>读取下一页</ActionButton>}
    {result && <details className="debug-prompt-provenance"><summary>来源与诊断说明</summary><p>{result.boundary}</p><p>{result.records.length} 条已读取 · 全量总数未计量 · {result.timezone}</p><p>{result.source} · {new Date(result.generatedAt).toLocaleString()}</p></details>}
  </section>
}
