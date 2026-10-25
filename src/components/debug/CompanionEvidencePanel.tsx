import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Search } from 'lucide-react'
import type { DebugEvidenceRecord, DebugEvidenceResult, DebugEvidenceQuery, DebugEvidenceScope } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { EmptyState } from '../foundation/EmptyState'
import { EvidenceSummary, PROFILE_GROUPS } from './EvidenceSummary'
import { ScheduleEvidenceContent } from './ScheduleEvidenceContent'
import { LifeEventEvidenceContent } from './LifeEventEvidenceContent'
import { NowEvidenceContent } from './NowEvidenceContent'
import { CharacterEvidenceContent } from './CharacterEvidenceContent'
import { LocationEvidenceContent } from './LocationEvidenceContent'
import { RelationsEvidenceContent } from './RelationsEvidenceContent'
import { MomentsEvidenceContent } from './MomentsEvidenceContent'
import { GrowthEvidenceContent } from './GrowthEvidenceContent'
import { FootprintsEvidenceContent } from './FootprintsEvidenceContent'
import { ResidenceEvidenceContent } from './ResidenceEvidenceContent'

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
export function CompanionEvidencePanel({ view, roleId, revision, targetId, onEvidence, scope, onRoleChange, onOpenTraces, onAsset }: { onAsset: (key: string) => void; onOpenTraces: () => void; view: DebugEvidenceQuery['view']; roleId: string; scope?: DebugEvidenceScope | null; onRoleChange?: (id: string) => void; revision: number; targetId?: string; onEvidence: (view: DebugEvidenceQuery['view'], id: string) => void }) {
  const [date, setDate] = useState(view === 'schedule' && !targetId ? new Date().toLocaleDateString('sv-SE') : '')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<DebugEvidenceResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [reload, setReload] = useState(0)
  const recordsRef = useRef<DebugEvidenceRecord[]>([])
  const pageCursors = useRef<Array<string | undefined>>([])
  const lastRevision = useRef({ revision, reload })
  useEffect(() => {
    let current = true
    setLoading(true); setError('')
    if (view === 'schedule' && !date && !targetId) { setLoading(false); return }
    if (!window.electronAPI?.debug?.companionEvidenceQuery) { setLoading(false); setError('此页面需要桌面应用的诊断接口'); return }
    const refreshing = lastRevision.current.revision !== revision || lastRevision.current.reload !== reload
    const requestedCursors = refreshing && pageCursors.current.length ? pageCursors.current : [cursor]
    // 背景：刷新第二页曾先清游标，失败后混入旧页；意图：整份快照读取成功才替换。
    // 约束：分页游标只沿用当前范围；任意页失败均保留原结果，不提交半份刷新。
    const read = async () => {
      let next: DebugEvidenceResult | null = null
      const records: DebugEvidenceRecord[] = []
      for (const pageCursor of requestedCursors) {
        const response = await window.electronAPI.debug.companionEvidenceQuery({ view, roleId, date: date || undefined, cursor: pageCursor, recordId: targetId })
        next = response; records.push(...response.records)
      }
      return { ...next!, records }
    }
    read().then(next => {
      if (!current) return
      const records = (!refreshing && cursor ? [...recordsRef.current, ...next.records] : next.records).filter((entry, index, entries) => entries.findIndex(other => other.id === entry.id && other.source === entry.source) === index)
      pageCursors.current = refreshing ? [...requestedCursors] : [...new Set([...pageCursors.current, cursor])]
      lastRevision.current = { revision, reload }
      recordsRef.current = records; setResult({ ...next, records })
    }).catch(() => { if (current) setError('证据读取失败；刷新时保留上次成功结果') }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [view, roleId, date, cursor, revision, reload, targetId])
  const changeDate = (value: string) => { setDate(value); setCursor(undefined); setResult(null); recordsRef.current = []; pageCursors.current = [] }
  if (view === 'schedule') return <ScheduleEvidenceContent key={`${roleId}:${date}:${targetId ?? ''}`} result={result} loading={loading} error={error} date={date} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onDateChange={changeDate} onQueryChange={setQuery} onRetry={() => setReload(value => value + 1)} onEvidence={onEvidence} />
  if (view === 'residence') return <ResidenceEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onQueryChange={setQuery} onRetry={() => setReload(value => value + 1)} onNext={() => setCursor(result?.nextCursor)} onEvidence={onEvidence} />
  if (view === 'relations') return <RelationsEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onQueryChange={setQuery} onRetry={() => setReload(value => value + 1)} onEvidence={onEvidence} />
  if (view === 'moments') return <MomentsEvidenceContent key={`${roleId}:${date}:${targetId ?? ''}`} result={result} loading={loading} error={error} date={date} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onQueryChange={setQuery} onDateChange={changeDate} onRetry={() => setReload(value => value + 1)} onNext={() => setCursor(result?.nextCursor)} onEvidence={onEvidence} />
  if (view === 'growth') return <GrowthEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onRetry={() => setReload(value => value + 1)} onNext={() => setCursor(result?.nextCursor)} onEvidence={onEvidence} />
  if (view === 'footprints') return <FootprintsEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onQueryChange={setQuery} onRetry={() => setReload(value => value + 1)} onNext={() => setCursor(result?.nextCursor)} onEvidence={onEvidence} />
  if (view === 'location') return <LocationEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} roleId={roleId} scope={scope} targetId={targetId} revision={revision} onRoleChange={onRoleChange} onRetry={() => setReload(value => value + 1)} onEvidence={onEvidence} onAsset={onAsset} />
  if (view === 'character') return <CharacterEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} roleId={roleId} scope={scope} targetId={targetId} revision={revision} onRoleChange={onRoleChange} onRetry={() => setReload(value => value + 1)} onEvidence={onEvidence} onAsset={onAsset} />
  if (view === 'now') return <NowEvidenceContent key={`${roleId}:${targetId ?? ''}`} result={result} loading={loading} error={error} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onRetry={() => setReload(value => value + 1)} onEvidence={onEvidence} />
  if (view === 'recent' || view === 'activity') return <LifeEventEvidenceContent view={view} onPage={page => page === 'traces' ? onOpenTraces() : onEvidence('growth', '')} key={`${roleId}:${date}:${targetId ?? ''}`} result={result} loading={loading} error={error} date={date} query={query} roleId={roleId} scope={scope} targetId={targetId} onRoleChange={onRoleChange} onDateChange={changeDate} onQueryChange={setQuery} onRetry={() => setReload(value => value + 1)} onNext={() => setCursor(result?.nextCursor)} onEvidence={onEvidence} />
  const filtered = (result?.records ?? []).filter(record => `${record.title} ${record.body} ${JSON.stringify(record.data)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const assets = (record: DebugEvidenceRecord) => object(record.data.payload)
  const card = (record: DebugEvidenceRecord) => <article className="debug-reading-entry" key={`${record.source}:${record.id}`} data-record-id={record.id}>
    {record.truncated && <p role="status">正文或结构已截断。</p>}
    {Boolean(record.data.paused_at || typeof record.data.storedWorld === 'string') && <p role="status">{record.data.paused_at ? '人物推进已暂停。' : String(record.data.storedWorld)}</p>}
    <details className="debug-production-record" open={targetId === record.id}>
      <summary aria-label={record.title || '查看记录详情'}><EvidenceSummary record={record} view={view} timezone={result?.timezone ?? 'Asia/Shanghai'} />{record.status && !ROUTINE_STATUS.has(record.status) && <Badge>{record.status}</Badge>}</summary>
      <div className="debug-production-detail">
    <p>{record.status || '状态未记录'} · {record.roleId || '显式共享'}</p>
    <Facts data={assets(record)} />
    {record.body && <p className="debug-reading-body">{record.body}</p>}
    {view === 'items' && Array.isArray(assets(record).readingNotes) && (assets(record).readingNotes as unknown[]).map((note, index) => { const row = object(note); return <section key={index} className="debug-reading-stop"><h4>{row.page ? `第 ${row.page} 页 · ` : ''}{typeof row.chapter === 'string' ? row.chapter : '阅读笔记'}</h4><p>{valueText(row.text)}</p></section> })}
    {Array.isArray(record.data.runs) && record.data.runs.map((run, index) => { const row = object(run); return <section key={index}><h4>{typeof row.at === 'number' ? new Date(row.at).toLocaleString() : '时间未记录'}</h4><p>{valueText(row.summary)}</p><small>{row.changed === true ? '覆盖已变更' : '覆盖未变更'}</small></section> })}
    {Array.isArray(record.data.userInteractions) && record.data.userInteractions.map((interaction, index) => { const row = object(interaction); return <p key={index}>{valueText(row.actor_id)} · {row.kind === 'like' ? '点赞' : valueText(row.text)}</p> })}
    {Array.isArray(record.data.experiences) && record.data.experiences.map((experience, index) => { const row = object(experience); const payload = object(row.payload); return <section key={index}><h4>{valueText(payload.activity)}</h4><p>{valueText(payload.story)}</p><ActionButton variant="plain" onClick={() => onEvidence('recent', String(row.id))}>查看共同经历来源事件</ActionButton></section> })}
    {record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}</ActionButton>)}
    {record.truncated && <p role="status">正文或结构已截断。</p>}
    <details open={targetId === record.id} className="debug-prompt-provenance"><summary>来源与完整记录</summary><p>{record.source} · {record.id}</p><pre className="debug-candidate-body" data-content-kind="structured">{JSON.stringify(record.data, null, 2)}</pre></details>
    </div></details>
  </article>
  const profile = () => <><p className="debug-reading-subtitle">以下仅整理已读来源，不是全量画像，也不证明某次请求已注入。</p><div className="debug-reading-summaries">{PROFILE_GROUPS.map(section => {
    const records = filtered.filter(record => (section.categories as readonly string[]).includes(record.kind))
    return <section key={section.title}><h3>{section.title}</h3>{records.length ? records.map(record => <p key={`${record.source}:${record.id}`}>{record.body || '已读来源未返回正文。'}</p>) : <p className="debug-reading-subtitle">当前已读来源未含此类资料。</p>}</section>
  })}</div><details className="debug-prompt-provenance"><summary>查看画像来源记录</summary>{filtered.map(card)}</details></>
  return <section className="debug-evidence-workbench" data-testid={`debug-evidence-${view}`}>
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence(view, '')}>返回当前领域列表</ActionButton>}
    <div className="debug-candidate-toolbar">{view !== 'proactive' && scope && onRoleChange && <div className="debug-focused-scope" role="group" aria-label="诊断人物范围"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}{!['now', 'location', 'character', 'profile', 'context', 'proactive'].includes(view) && <label className="debug-candidate-search"><Search size={14} /><TextField appearance="outlined" className="h-8 px-3" aria-label="搜索当前页证据" placeholder="搜索当前已读取记录" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} /></label>}{!targetId && ['recent', 'activity', 'moments', 'growth', 'links'].includes(view) && <label className="debug-evidence-date">日期<TextField appearance="outlined" className="h-8 px-2" type="date" aria-label="证据日期" value={date} onChange={(event: ChangeEvent<HTMLInputElement>) => changeDate(event.target.value)} /></label>}</div>
    {error && <p role="alert" className="debug-production-state">{result ? '刷新失败，保留原范围及全部已读页；下方不是最新结果。' : error}<ActionButton variant="plain" onClick={() => setReload(value => value + 1)}>重试</ActionButton></p>}
    {loading && <p role="status">正在读取诊断证据…</p>}
    {view === 'profile' && <p className="debug-reading-subtitle">全局资料与当前人物的协作反馈</p>}
    {result && query && <p className="debug-reading-subtitle">{filtered.length} / {result.records.length} 条已读取</p>}
    {result?.issues.map((issue, index) => <p role="status" key={index}>{issue}</p>)}
    {result?.state === 'unsupported' || result?.state === 'unavailable' ? <EmptyState title={result.state === 'unsupported' ? '此类证据尚无独立读取源' : '诊断源暂不可用'} description={result.boundary} /> : result && !filtered.length ? <EmptyState title={targetId ? '引用目标未在该人物范围找到' : result.records.length ? '没有匹配的证据' : '此范围没有记录'} description="空记录不等于引擎不存在，不补造默认事实。" /> : <div className={`debug-reading debug-reading-${['recent', 'activity', 'moments', 'growth'].includes(view) ? 'timeline' : 'catalog'}`}>
      {view === 'profile' ? profile() : view === 'items' ? (['reading', 'music', 'film', 'photography'] as const).map(type => { const records = filtered.filter(record => assets(record).type === type || type === 'reading' && record.kind === 'bookshelf' && !assets(record).type); return records.length ? <section key={type}><h3 className="debug-reading-group-title">{{ reading: '阅读', music: '音乐', film: '影视', photography: '摄影' }[type]}</h3>{records.map(card)}</section> : null }) : filtered.map(card)}
    </div>}
    {view === 'items' && filtered.filter(record => !['reading', 'music', 'film', 'photography'].includes(String(assets(record).type)) && !(record.kind === 'bookshelf' && !assets(record).type)).map(card)}
    {result?.hasMore && <ActionButton disabled={loading || Boolean(error)} onClick={() => setCursor(result.nextCursor)}>读取下一页</ActionButton>}
    {result && <details className="debug-prompt-provenance"><summary>来源与诊断说明</summary><p>{result.boundary}</p><p>{result.records.length} 条已读取 · 全量总数未计量 · {result.timezone}</p><p>{result.source} · {new Date(result.generatedAt).toLocaleString()}</p></details>}
  </section>
}
