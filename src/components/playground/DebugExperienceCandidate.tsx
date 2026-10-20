import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Activity, ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock3, FileText, FlaskConical, Heart, Search, Server, ShieldCheck, CalendarDays, History, MapPin, House, Footprints, UserRound, Users, MessageCircle, Shirt, BookOpen, Link, Brain, ListTree, Radio, Wrench, ScanText, Contact, Sprout } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { TextField } from '../foundation/TextField'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { ProductExperienceDependencies } from './ProductExperienceDependencies'
import { PlaygroundPageHeader } from './PlaygroundLayout'
import { TabStrip } from '../foundation/TabStrip'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_CAPABILITY_GAPS, DEBUG_GROUPS, DEBUG_PERSPECTIVES, DEBUG_RECORD_FIXTURES, type DebugPerspective, type DebugRecordFixture, type DebugScenario } from './debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES } from './debug-asset-fixtures'
import { DebugPromptCandidate, type PromptPreviewState } from './DebugPromptCandidate'
import { DebugEvidenceCandidate, type EvidencePreviewState } from './DebugEvidenceCandidate'
import { DebugScheduleCandidate, type SchedulePreviewState } from './DebugScheduleCandidate'
import { DebugNowCandidate, type NowPreviewState } from './DebugNowCandidate'
import { DebugCharacterCandidate, type CharacterPreviewState } from './DebugCharacterCandidate'
import { DebugLocationCandidate, type LocationPreviewState } from './DebugLocationCandidate'
import { DebugResidenceCandidate, type ResidencePreviewState } from './DebugResidenceCandidate'
import { DebugFootprintsCandidate, type FootprintsPreviewState } from './DebugFootprintsCandidate'
import { DebugGrowthCandidate, type GrowthPreviewState } from './DebugGrowthCandidate'
import { DebugMomentsCandidate, type MomentsPreviewState } from './DebugMomentsCandidate'
import { DebugRelationsCandidate, type RelationsPreviewState } from './DebugRelationsCandidate'
import { DebugProactiveCandidate, type ProactivePreviewState } from './DebugProactiveCandidate'
import { DebugWardrobeCandidate, type WardrobePreviewState } from './DebugWardrobeCandidate'
import { getDebugEvidencePage, type DebugEvidencePageId } from './debug-evidence-fixtures'
import './debug-experience.css'

const STATUS_LABELS = { success: '已完成', error: '失败', pending: '运行中' } as const
const ICONS: Record<DebugPerspective, typeof FileText> = { assets: FileText, schedule: CalendarDays, recent: History, activity: Activity, now: Heart, character: UserRound, location: MapPin, residence: House, footprints: Footprints, growth: Sprout, moments: MessageCircle, relations: Users, proactive: MessageCircle, wardrobe: Shirt, items: BookOpen, links: Link, context: ScanText, profile: Contact, memories: Brain, runs: Clock3, traces: ListTree, events: Radio, tools: Wrench, system: Server, quality: FlaskConical, persona: ShieldCheck }
const SCENARIOS: readonly { id: DebugScenario; label: string }[] = [
  { id: 'normal', label: '默认记录' }, { id: 'unread', label: '未读取' }, { id: 'truncated', label: '历史截断' }, { id: 'running', label: '运行中' }, { id: 'empty', label: '无记录' }, { id: 'refresh-error', label: '刷新失败' },
]

function Facts({ items }: { items: readonly [string, ReactNode][] }) {
  return <dl className="debug-candidate-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="debug-candidate-section"><h3>{title}</h3>{note && <p className="debug-candidate-muted mb-3">{note}</p>}{children}</section>
}

function Status({ status }: { status: DebugRecordFixture['status'] }) {
  return <Badge tone={status === 'error' ? 'danger' : status === 'success' ? 'success' : 'accent'}>{STATUS_LABELS[status]}</Badge>
}

/**
 * 背景：旧 Debug 把记录、Span 与资产分开浏览，无法在同一处解释一次请求。
 * 设计意图：候选采用单一工作区和主从浏览，通过显式 id 关联；复用 Foundation 控件而不修改正式默认。
 * 关键约束：本组件只读隔离样张，不使用 electronAPI、不保存设置、不调用模型；返回按钮只能返回 Playground。
 */
export function DebugExperienceCandidate({ onBack }: { onBack: () => void }) {
  const [perspective, setPerspective] = useState<DebugPerspective>('assets')
  const [scenario, setScenario] = useState<DebugScenario>('normal')
  const [snapshotScenario, setSnapshotScenario] = useState<Exclude<DebugScenario, 'refresh-error'>>('normal')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [recordId, setRecordId] = useState(DEBUG_RECORD_FIXTURES[0].id)
  const [assetKey, setAssetKey] = useState<string | null>(null)
  const [promptEdge, setPromptEdge] = useState<PromptPreviewState>('ready')
  const [hasPromptSnapshot, setHasPromptSnapshot] = useState(true)
  const [scheduleEdge, setScheduleEdge] = useState<SchedulePreviewState>('ready')
  const [hasScheduleSnapshot, setHasScheduleSnapshot] = useState(true)
  const [recentEdge, setRecentEdge] = useState<EvidencePreviewState>('ready')
  const [recentSnapshot, setRecentSnapshot] = useState<EvidencePreviewState>('ready')
  const [hasRecentSnapshot, setHasRecentSnapshot] = useState(true)
  const [nowEdge, setNowEdge] = useState<NowPreviewState>('ready')
  const [nowSnapshot, setNowSnapshot] = useState<NowPreviewState>('ready')
  const [hasNowSnapshot, setHasNowSnapshot] = useState(true)
  const [characterEdge, setCharacterEdge] = useState<CharacterPreviewState>('ready')
  const [characterSnapshot, setCharacterSnapshot] = useState<CharacterPreviewState>('ready')
  const [hasCharacterSnapshot, setHasCharacterSnapshot] = useState(true)
  const [locationEdge, setLocationEdge] = useState<LocationPreviewState>('ready')
  const [locationSnapshot, setLocationSnapshot] = useState<LocationPreviewState>('ready')
  const [hasLocationSnapshot, setHasLocationSnapshot] = useState(true)
  const [residenceEdge, setResidenceEdge] = useState<ResidencePreviewState>('ready')
  const [residenceSnapshot, setResidenceSnapshot] = useState<ResidencePreviewState>('ready')
  const [hasResidenceSnapshot, setHasResidenceSnapshot] = useState(true)
  const [footprintsEdge, setFootprintsEdge] = useState<FootprintsPreviewState>('ready')
  const [footprintsSnapshot, setFootprintsSnapshot] = useState<FootprintsPreviewState>('ready')
  const [hasFootprintsSnapshot, setHasFootprintsSnapshot] = useState(true)
  const [growthEdge, setGrowthEdge] = useState<GrowthPreviewState>('ready')
  const [growthSnapshot, setGrowthSnapshot] = useState<GrowthPreviewState>('ready')
  const [hasGrowthSnapshot, setHasGrowthSnapshot] = useState(true)
  const [momentsEdge, setMomentsEdge] = useState<MomentsPreviewState>('ready')
  const [momentsSnapshot, setMomentsSnapshot] = useState<MomentsPreviewState>('ready')
  const [hasMomentsSnapshot, setHasMomentsSnapshot] = useState(true)
  const [relationsEdge, setRelationsEdge] = useState<RelationsPreviewState>('ready')
  const [relationsSnapshot, setRelationsSnapshot] = useState<RelationsPreviewState>('ready')
  const [hasRelationsSnapshot, setHasRelationsSnapshot] = useState(true)
  const [proactiveEdge, setProactiveEdge] = useState<ProactivePreviewState>('ready')
  const [hasProactiveSnapshot, setHasProactiveSnapshot] = useState(true)
  const [wardrobeEdge, setWardrobeEdge] = useState<WardrobePreviewState>('ready')
  const [wardrobeSnapshot, setWardrobeSnapshot] = useState<WardrobePreviewState>('ready')
  const [hasWardrobeSnapshot, setHasWardrobeSnapshot] = useState(true)
  const [evidenceTarget, setEvidenceTarget] = useState<string | undefined>()
  const mainRef = useRef<HTMLElement>(null)
  const [detail, setDetail] = useState('request')
  const qualityId = perspective === 'persona' ? 'persona' : 'skill'
  const view = DEBUG_PERSPECTIVES.find(item => item.id === perspective)!
  const promptState = promptEdge !== 'ready' ? promptEdge : scenario === 'refresh-error' ? hasPromptSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const scheduleState = scheduleEdge !== 'ready' ? scheduleEdge : scenario === 'refresh-error' ? hasScheduleSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const recentState = recentEdge !== 'ready' ? recentEdge : scenario === 'refresh-error' ? hasRecentSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const nowState = nowEdge !== 'ready' ? nowEdge : scenario === 'refresh-error' ? hasNowSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const characterState = characterEdge !== 'ready' ? characterEdge : scenario === 'refresh-error' ? hasCharacterSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const locationState = locationEdge !== 'ready' ? locationEdge : scenario === 'refresh-error' ? hasLocationSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const residenceState = residenceEdge !== 'ready' ? residenceEdge : scenario === 'refresh-error' ? hasResidenceSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const footprintsState = footprintsEdge !== 'ready' ? footprintsEdge : scenario === 'refresh-error' ? hasFootprintsSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const growthState = growthEdge !== 'ready' ? growthEdge : scenario === 'refresh-error' ? hasGrowthSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const momentsState = momentsEdge !== 'ready' ? momentsEdge : scenario === 'refresh-error' ? hasMomentsSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const relationsState = relationsEdge !== 'ready' ? relationsEdge : scenario === 'refresh-error' ? hasRelationsSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const proactiveState = proactiveEdge !== 'ready' ? proactiveEdge : scenario === 'refresh-error' ? hasProactiveSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const wardrobeState = wardrobeEdge !== 'ready' ? wardrobeEdge : scenario === 'refresh-error' ? hasWardrobeSnapshot ? 'refresh-error' : 'error' : snapshotScenario === 'unread' ? 'unread' : snapshotScenario === 'running' ? 'loading' : 'ready'
  const records = snapshotScenario === 'empty' ? [] : DEBUG_RECORD_FIXTURES.map((record, index) => snapshotScenario === 'running' && index === 0
    ? { ...record, status: 'pending' as const, durationMs: undefined, outputTokens: undefined, error: undefined, stages: record.stages.slice(0, 1) } : record)
  const match = (text: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const filteredRecords = records.filter(record => (filter === 'all' || record.status === filter) && match(`${record.title} ${record.id} ${record.caller} ${record.sessionId} ${record.model}`))
  const record = filteredRecords.find(item => item.id === recordId) ?? filteredRecords[0]
  const navigate = (id: DebugPerspective) => {
    setPerspective(id); setQuery(''); setFilter('all'); setEvidenceTarget(undefined)
    if (id === 'assets') setAssetKey(null)
    mainRef.current?.scrollTo({ top: 0 })
  }
  const openEvidence = (id: DebugEvidencePageId, target: string) => { navigate(id); setEvidenceTarget(target) }
  const openAsset = (key: string) => { navigate('assets'); setAssetKey(key) }
  const openRecord = (id: string) => { navigate('runs'); setRecordId(id); setDetail('sources') }
  // 背景：刷新失败不能变造已有证据；设计意图：独立保留最后样张快照；约束：错误状态不重置选中项、筛选或执行结果。
  const changeScenario = (id: DebugScenario) => {
    setScenario(id)
    setPromptEdge('ready')
    setScheduleEdge('ready')
    setRecentEdge('ready')
    setNowEdge('ready')
    setCharacterEdge('ready')
    setLocationEdge('ready')
    setResidenceEdge('ready')
    setFootprintsEdge('ready')
    setGrowthEdge('ready')
    setMomentsEdge('ready')
    setRelationsEdge('ready')
    setProactiveEdge('ready')
    setWardrobeEdge('ready')
    if (id !== 'refresh-error') {
      setHasPromptSnapshot(!['unread', 'running'].includes(id))
      setHasScheduleSnapshot(!['unread', 'running'].includes(id))
      setHasRecentSnapshot(!['unread', 'running'].includes(id)); setRecentSnapshot('ready')
      setHasNowSnapshot(!['unread', 'running'].includes(id)); setNowSnapshot('ready')
      setHasCharacterSnapshot(!['unread', 'running'].includes(id)); setCharacterSnapshot('ready')
      setHasLocationSnapshot(!['unread', 'running'].includes(id)); setLocationSnapshot('ready')
      setHasResidenceSnapshot(!['unread', 'running'].includes(id)); setResidenceSnapshot('ready')
      setHasFootprintsSnapshot(!['unread', 'running'].includes(id)); setFootprintsSnapshot('ready')
      setHasGrowthSnapshot(!['unread', 'running'].includes(id)); setGrowthSnapshot('ready')
      setHasMomentsSnapshot(!['unread', 'running'].includes(id)); setMomentsSnapshot('ready')
      setHasRelationsSnapshot(!['unread', 'running'].includes(id)); setRelationsSnapshot('ready')
      setHasProactiveSnapshot(!['unread', 'running'].includes(id))
      setHasWardrobeSnapshot(!['unread', 'running'].includes(id)); setWardrobeSnapshot('ready')
      setSnapshotScenario(id); setRecordId(DEBUG_RECORD_FIXTURES[0].id); setDetail('request'); setQuery(''); setFilter('all')
    }
  }

  return <div className="debug-candidate debug-refined debug-focused playground-shape-scope" data-testid="debug-candidate" data-perspective={perspective}>
    <div className="debug-candidate-preview">
      <ActionButton variant="plain" onClick={onBack}><ArrowLeft size={14} /> 返回 Playground</ActionButton>
      <span>Debug 重设计 · 隔离样张</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Debug 样张状态" data-playground-switcher>
        {SCENARIOS.map(item => <ActionButton key={item.id} variant="plain" aria-pressed={scenario === item.id} onClick={() => changeScenario(item.id)}>{item.label}</ActionButton>)}
        {perspective === 'assets' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>提示词状态<SelectField aria-label="提示词边缘样张" value={promptEdge} onChange={event => { changeScenario('normal'); setPromptEdge(event.target.value as PromptPreviewState); setHasPromptSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认目录</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="usage-error">关联读取失败</option><option value="missing">引用资产缺失</option><option value="long">长名称与长正文</option></SelectField></label></details>}
        {perspective === 'schedule' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>日程状态<SelectField aria-label="日程边缘样张" value={scheduleEdge} onChange={event => { changeScenario('normal'); setScheduleEdge(event.target.value as SchedulePreviewState); setHasScheduleSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认计划</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="invalid">无有效时段</option><option value="missing">引用时段缺失</option><option value="long">长活动与地点</option></SelectField></label></details>}
        {['recent', 'activity'].includes(perspective) && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>事项状态<SelectField aria-label={perspective === 'activity' ? '行为证据边缘样张' : '事项边缘样张'} value={recentEdge} onChange={event => { changeScenario('normal'); setRecentEdge(event.target.value as EvidencePreviewState); setRecentSnapshot(event.target.value as EvidencePreviewState); setHasRecentSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认事项</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="missing">引用事项缺失</option><option value="unknown-time">时间未记录</option><option value="long">长标题与长正文</option><option value="paged">有下一页</option></SelectField></label></details>}
        {perspective === 'now' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>快照状态<SelectField aria-label="当前状态边缘样张" value={nowEdge} onChange={event => { changeScenario('normal'); setNowEdge(event.target.value as NowPreviewState); setNowSnapshot(event.target.value as NowPreviewState); setHasNowSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认快照</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="paused">生活暂停</option><option value="fallback">存储世界回退</option><option value="unset">未设定与时间缺失</option><option value="long">长活动与补叙</option><option value="missing">引用状态缺失</option></SelectField></label></details>}
        {perspective === 'character' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>资料状态<SelectField aria-label="人物资料边缘样张" value={characterEdge} onChange={event => { changeScenario('normal'); setCharacterEdge(event.target.value as CharacterPreviewState); setCharacterSnapshot(event.target.value as CharacterPreviewState); setHasCharacterSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认资料</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="empty-profile">空资料结构</option><option value="partial">部分字段缺失</option><option value="long">长简介与完整资料</option><option value="missing">引用资料缺失</option></SelectField></label></details>}
        {perspective === 'location' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>位置状态<SelectField aria-label="位置边缘样张" value={locationEdge} onChange={event => { changeScenario('normal'); setLocationEdge(event.target.value as LocationPreviewState); setLocationSnapshot(event.target.value as LocationPreviewState); setHasLocationSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认位置</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="unset">未设定与时间缺失</option><option value="fallback">存储世界回退</option><option value="long">长地点与细节</option><option value="missing">引用位置缺失</option></SelectField></label></details>}
        {perspective === 'residence' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>家居状态<SelectField aria-label="家居边缘样张" value={residenceEdge} onChange={event => { changeScenario('normal'); setResidenceEdge(event.target.value as ResidencePreviewState); setResidenceSnapshot(event.target.value as ResidencePreviewState); setHasResidenceSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认家居</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="orphan">父级不在已读范围</option><option value="unknown-display">陈列标记缺失</option><option value="paged">有下一页</option><option value="long">长名称与描述</option><option value="missing">引用家居缺失</option></SelectField></label></details>}
        {perspective === 'footprints' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>足迹状态<SelectField aria-label="足迹边缘样张" value={footprintsEdge} onChange={event => { changeScenario('normal'); setFootprintsEdge(event.target.value as FootprintsPreviewState); setFootprintsSnapshot(event.target.value as FootprintsPreviewState); setHasFootprintsSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认足迹</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="unknown">未知旅行状态</option><option value="undated">未提供日期</option><option value="paged">有下一页</option><option value="long">长名称与经历</option><option value="missing">引用足迹缺失</option></SelectField></label></details>}
        {perspective === 'growth' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>成长状态<SelectField aria-label="成长边缘样张" value={growthEdge} onChange={event => { changeScenario('normal'); setGrowthEdge(event.target.value as GrowthPreviewState); setGrowthSnapshot(event.target.value as GrowthPreviewState); setHasGrowthSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认成长</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="empty-body">覆盖正文为空</option><option value="unknown-time">时间未记录</option><option value="reflection-error">反思记录局部异常</option><option value="paged">有下一页历史</option><option value="long">长成长正文</option><option value="missing">引用成长记录缺失</option></SelectField></label></details>}
        {perspective === 'moments' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>动态状态<SelectField aria-label="动态边缘样张" value={momentsEdge} onChange={event => { changeScenario('normal'); setMomentsEdge(event.target.value as MomentsPreviewState); setMomentsSnapshot(event.target.value as MomentsPreviewState); setHasMomentsSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认动态</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="empty-body">动态正文为空</option><option value="unknown-time">发布时间缺失</option><option value="partial">部分记录不可读取</option><option value="truncated">记录读取截断</option><option value="paged">有下一页动态</option><option value="long">长正文与长评论</option><option value="missing">引用动态缺失</option></SelectField></label></details>}
        {perspective === 'relations' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>关系状态<SelectField aria-label="关系边缘样张" value={relationsEdge} onChange={event => { changeScenario('normal'); setRelationsEdge(event.target.value as RelationsPreviewState); setRelationsSnapshot(event.target.value as RelationsPreviewState); setHasRelationsSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认关系</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="missing-note">关系说明缺失</option><option value="unknown-time">事件时间未记录</option><option value="experience-error">部分经历不可读取</option><option value="no-experience-source">经历源未提供</option><option value="limited">人物返回限量</option><option value="unregistered">姓名未登记</option><option value="same-name">同名人物</option><option value="truncated">关系记录截断</option><option value="long">长关系与经历</option><option value="missing">引用人物缺失</option></SelectField></label></details>}
        {perspective === 'proactive' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>查询状态<SelectField aria-label="投递查询边缘样张" value={proactiveEdge} onChange={event => { changeScenario('normal'); setProactiveEdge(event.target.value as ProactivePreviewState); setHasProactiveSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">已读不支持</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option></SelectField></label></details>}
        {perspective === 'wardrobe' && <details className="debug-prompt-preview-options"><summary>更多样张</summary><label>衣柜状态<SelectField aria-label="衣柜边缘样张" value={wardrobeEdge} onChange={event => { changeScenario('normal'); setWardrobeEdge(event.target.value as WardrobePreviewState); setWardrobeSnapshot(event.target.value as WardrobePreviewState); setHasWardrobeSnapshot(!['unavailable', 'error'].includes(event.target.value)) }}><option value="ready">默认衣柜</option><option value="unavailable">接口不可用</option><option value="error">首次读取失败</option><option value="unknown-time">收录时间未记录</option><option value="unread-reference">槽位引用未读</option><option value="mismatch">槽位分类不匹配</option><option value="invalid">槽位结构无效</option><option value="unknown">记录类型未识别</option><option value="conflict">穿搭状态冲突</option><option value="truncated">记录读取截断</option><option value="paged">有下一页衣柜</option><option value="long">长名称与描述</option><option value="missing">引用衣柜记录缺失</option></SelectField></label></details>}
      </div>
    </div>
    <div className="debug-candidate-workspace">
      <nav className="debug-candidate-nav" aria-label="Debug 候选导航">
        <div className="debug-candidate-brand"><Activity size={18} /><strong>Debug</strong><span>诊断工作区</span></div>
        <div className="debug-candidate-nav-groups">{DEBUG_GROUPS.map(group => <section key={group} aria-label={`${group}分区`}><p className="debug-candidate-nav-label">{group}</p>{DEBUG_PERSPECTIVES.filter(item => item.group === group).map(item => { const Icon = ICONS[item.id]; return <ActionButton key={item.id} variant="plain" onClick={() => navigate(item.id)} aria-current={perspective === item.id ? 'page' : undefined}><Icon size={14} />{item.label}</ActionButton> })}</section>)}</div>
        <div className="debug-candidate-nav-footer"><ShieldCheck size={14} /><span>生产信息只读<br />编辑与实验分开进行</span></div>
      </nav>
      <main ref={mainRef} className={`debug-candidate-main${perspective === 'assets' ? ' debug-candidate-main-prompt' : ''}`}>
        <PlaygroundPageHeader title={view.label} description={perspective === 'assets' ? (['unread', 'unavailable', 'loading', 'error'].includes(promptState) ? '目录未读取' : `${snapshotScenario === 'empty' ? 0 : DEBUG_ASSET_FIXTURES.length} 项演示资产`) : ''} />
        {['assets', 'schedule', 'recent', 'activity', 'now'].includes(perspective) && snapshotScenario === 'truncated' && <p className="debug-candidate-notice" role="status">仅展示有界样张范围，历史已截断；全量总数未知。当前结果不能证明更早记录不存在。</p>}
        {!['assets', 'schedule', 'recent', 'activity', 'now', 'character', 'location', 'residence', 'footprints', 'growth', 'moments', 'relations', 'proactive', 'wardrobe'].includes(perspective) && scenario === 'refresh-error' && <ErrorState title="刷新失败，保留上次证据" description="暂时无法读取新的诊断数据。下方是刷新前的样张，不代表最新状态。" action={<ActionButton onClick={() => setScenario(snapshotScenario)}>重试读取样张</ActionButton>} />}
        {perspective === 'assets' ? <DebugPromptCandidate empty={snapshotScenario === 'empty'} selectedKey={assetKey} onSelect={setAssetKey} records={records} onRecord={openRecord} previewState={promptState} onRetry={() => changeScenario('normal')} /> : perspective === 'schedule' ? <DebugScheduleCandidate key={evidenceTarget ?? 'schedule'} empty={snapshotScenario === 'empty'} previewState={scheduleState} initialSelectedId={evidenceTarget} onRetry={() => changeScenario('normal')} onEvidence={openEvidence} /> : ['recent', 'activity'].includes(perspective) ? <DebugEvidenceCandidate key={`${perspective}:${evidenceTarget ?? ''}`} id={perspective as DebugEvidencePageId} records={records} empty={snapshotScenario === 'empty'} previewState={recentState} snapshotState={recentSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasRecentSnapshot) { setRecentEdge(recentSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onAsset={openAsset} onRecord={openRecord} onPage={navigate} onEvidence={openEvidence} /> : perspective === 'now' ? <DebugNowCandidate key={`now:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={nowState} snapshotState={nowSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasNowSnapshot) { setNowEdge(nowSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} /> : perspective === 'character' ? <DebugCharacterCandidate key={`character:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={characterState} snapshotState={characterSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasCharacterSnapshot) { setCharacterEdge(characterSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onAsset={openAsset} /> : perspective === 'location' ? <DebugLocationCandidate key={`location:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={locationState} snapshotState={locationSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasLocationSnapshot) { setLocationEdge(locationSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onAsset={openAsset} /> : perspective === 'residence' ? <DebugResidenceCandidate key={`residence:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={residenceState} snapshotState={residenceSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasResidenceSnapshot) { setResidenceEdge(residenceSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onAsset={openAsset} onEvidence={openEvidence} /> : perspective === 'footprints' ? <DebugFootprintsCandidate key={`footprints:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={footprintsState} snapshotState={footprintsSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasFootprintsSnapshot) { setFootprintsEdge(footprintsSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onAsset={openAsset} /> : perspective === 'growth' ? <DebugGrowthCandidate key={`growth:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={growthState} snapshotState={growthSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasGrowthSnapshot) { setGrowthEdge(growthSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onAsset={openAsset} /> : perspective === 'moments' ? <DebugMomentsCandidate key={`moments:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={momentsState} snapshotState={momentsSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasMomentsSnapshot) { setMomentsEdge(momentsSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onEvidence={openEvidence} /> : perspective === 'relations' ? <DebugRelationsCandidate key={`relations:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={relationsState} snapshotState={relationsSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasRelationsSnapshot) { setRelationsEdge(relationsSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onPage={navigate} onEvidence={openEvidence} /> : perspective === 'proactive' ? <DebugProactiveCandidate previewState={proactiveState} onRetry={() => changeScenario('normal')} onPage={navigate} /> : perspective === 'wardrobe' ? <DebugWardrobeCandidate key={`wardrobe:${evidenceTarget ?? ''}`} empty={snapshotScenario === 'empty'} previewState={wardrobeState} snapshotState={wardrobeSnapshot} initialSelectedId={evidenceTarget} onRetry={() => { if (hasWardrobeSnapshot) { setWardrobeEdge(wardrobeSnapshot); setScenario(snapshotScenario) } else changeScenario('normal') }} onEvidence={openEvidence} /> : snapshotScenario === 'unread' ? <EmptyState title="尚未读取诊断数据" description="选择默认记录样张查看读取后的布局；未读取不能当作零条记录。" /> : <>
        {snapshotScenario === 'truncated' && <p className="debug-candidate-notice" role="status">仅展示有界样张范围，历史已截断；全量总数未知。当前结果不能证明更早记录不存在。</p>}
        {perspective === 'runs' && <>
          <div className="debug-candidate-summary" aria-label="记录摘要">
            <div><span>调用记录</span><strong>{records.length}</strong><small>当前样张范围</small></div>
            <div><span>失败</span><strong className={records.some(item => item.status === 'error') ? 'debug-candidate-danger' : ''}>{records.filter(item => item.status === 'error').length}</strong><small>优先查看异常</small></div>
            <div><span>运行中</span><strong>{records.filter(item => item.status === 'pending').length}</strong><small>尚未收到完整结果</small></div>
          </div>
          <div className="debug-candidate-toolbar"><label className="debug-candidate-search"><Search size={14} /><TextField aria-label="搜索运行记录" placeholder="搜索调用、会话或模型" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} /></label><div role="group" aria-label="调用状态筛选" className="flex gap-1 flex-wrap">{[['all', '全部'], ['error', '失败'], ['pending', '运行中'], ['success', '已完成']].map(([id, label]) => <ActionButton key={id} variant="plain" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</ActionButton>)}</div></div>
          {filteredRecords.length === 0 ? <EmptyState title={records.length ? '没有匹配的记录' : '还没有运行记录'} description={records.length ? '调整搜索或状态筛选后继续查看。' : '实际请求出现后，记录会按时间显示；没有数据不等于系统异常。'} action={records.length ? <ActionButton onClick={() => { setQuery(''); setFilter('all') }}>清除筛选</ActionButton> : undefined} /> : <div className="debug-candidate-split">
            <div className="debug-candidate-list" aria-label="调用记录列表"><div className="debug-candidate-list-heading">最新调用优先 <span>{filteredRecords.length} 条</span></div>{filteredRecords.map(item => <ActionButton key={item.id} variant="plain" className="debug-candidate-record" aria-pressed={record?.id === item.id} onClick={() => { setRecordId(item.id); setDetail('request') }}>
              <span className="debug-candidate-record-top"><span>{item.time} · {item.caller}</span><Status status={item.status} /></span><strong>{item.title}</strong><span>{item.model}</span><span className="debug-candidate-record-bottom"><code>{item.id}</code><span>{item.durationMs == null ? '耗时待定' : `${(item.durationMs / 1000).toFixed(2)} s`}</span></span>
            </ActionButton>)}</div>
            {record && <article className="debug-candidate-detail" aria-label="调用详情" data-testid="debug-call-detail">
              <div className="debug-candidate-detail-heading"><div><h3>{record.title}</h3><code>{record.id}</code></div><Status status={record.status} /></div>
              <div className="debug-candidate-detail-metrics"><span><Clock3 size={13} />{record.durationMs == null ? '进行中 · 最终耗时待定' : `${(record.durationMs / 1000).toFixed(2)} s`}</span><span>输入 {record.inputTokens?.toLocaleString() ?? '未计量'}</span><span>输出 {record.outputTokens?.toLocaleString() ?? '未计量'}</span></div>
              {record.error && <div className="debug-candidate-call-error" role="status"><strong>失败原因</strong><p>{record.error}</p><span>未记录响应正文；不将失败请求的输出记作 0。</span></div>}
              {record.status === 'pending' && <p className="debug-candidate-notice" role="status">正在等待模型结果。最终耗时与输出计量将在请求结束后确定。</p>}
              <TabStrip label="调用证据视角" variant="underline" items={[{ id: 'request', label: '模型输入' }, { id: 'execution', label: '执行过程' }, { id: 'sources', label: '资产来源' }]} activeId={detail} onSelect={id => setDetail(id as typeof detail)} />
              {detail === 'request' && <>
                <details className="debug-prompt-provenance"><summary>请求结构</summary><Facts items={[[ '调用用途', record.caller ], ['实际模型', record.model], ['会话', record.sessionId], ['Span', record.spanId ?? '未关联']]} /></details>
                <Section title="输入与正文" note="请求元数据与正文保存状态分开表达。"><div className="debug-candidate-notice"><FileText size={16} /><div><strong>历史正文未保存</strong><p>仅有结构元数据与资产关联。不能使用当前 Prompt 装配预览还原这次请求。</p></div></div></Section>
                <Section title="继续定位"><ActionButton variant="plain" onClick={() => setDetail('sources')}>查看实际来源 <ArrowUpRight size={13} /></ActionButton><ActionButton variant="plain" onClick={() => setDetail('execution')}>查看执行证据 <ArrowUpRight size={13} /></ActionButton></Section>
              </>}
              {detail === 'execution' && <Section title="执行证据" note="仅按明确关联的 Span 展示；阶段不是模型思维过程。">{record.stages.length ? <ol className="debug-candidate-timeline">{record.stages.map((stage, index) => <li key={stage.title}><span className="debug-candidate-step">{index + 1}</span><div><strong>{stage.title}</strong><p>{stage.detail}</p></div><code>{stage.duration}</code></li>)}</ol> : <EmptyState title="没有关联的执行证据" description="此记录未关联 Span，不能根据时间相近把其他事件拼接过来。" />}</Section>}
              {detail === 'sources' && <Section title="本次调用的资产来源" note="按此次调用保存的 key 关联当前目录；当前版本可能与调用时版本不同。">{record.assetKeys.map(key => { const related = DEBUG_ASSET_FIXTURES.find(item => item.key === key); return <ActionButton key={key} className="debug-candidate-asset-link" variant="plain" onClick={() => openAsset(key)}><div><strong>{related?.label ?? key}</strong><code>{key}</code></div><ChevronRight size={14} /></ActionButton> })}</Section>}
              <details className="debug-candidate-raw"><summary>结构化记录 · 脱敏样张</summary><pre>{JSON.stringify({ id: record.id, sessionId: record.sessionId, spanId: record.spanId, status: record.status, assetKeys: record.assetKeys }, null, 2)}</pre></details>
            </article>}
          </div>}
        </>}
        {!['assets', 'schedule', 'recent', 'activity', 'now', 'character', 'location', 'residence', 'footprints', 'growth', 'moments', 'relations', 'proactive', 'wardrobe', 'runs', 'quality', 'persona', 'system'].includes(perspective) && <DebugEvidenceCandidate key={`${perspective}:${snapshotScenario}:${evidenceTarget ?? ''}`} id={perspective as DebugEvidencePageId} initialSelectedId={evidenceTarget} records={records} empty={snapshotScenario === 'empty'} onAsset={openAsset} onRecord={openRecord} onEvidence={openEvidence} />}
        {snapshotScenario === 'empty' && ['quality', 'persona', 'system'].includes(perspective) && <EmptyState title="此范围没有记录" description="已读取但无报告或快照，不展示默认结论。" />}
        {snapshotScenario !== 'empty' && (perspective === 'quality' || perspective === 'persona') && <div className="debug-candidate-reading"><article className="debug-candidate-detail"><div className="debug-candidate-detail-heading"><h3>{qualityId === 'skill' ? 'Skill 边界检查' : '人格一致性验收'}</h3><Badge tone={qualityId === 'skill' ? 'danger' : 'neutral'}>{qualityId === 'skill' ? '未通过' : '待审阅'}</Badge></div><Section title="验收结论"><p>{qualityId === 'skill' ? '工具边界检查未通过。优先查看具体检查证据，再判断行为是否符合预期。' : '自动判定与人工体验判断分开保存。当前样张尚无人工结论。'}</p></Section><Section title="检查证据">{qualityId === 'skill' ? <><Facts items={[[ '应触发行为', '通过' ], ['指南注入', '通过'], ['工具边界', '失败 · 样张调用超出 allowed_tools'], ['回复约束', '通过']]} /><details className="debug-candidate-raw"><summary>查看失败检查证据</summary><p>样张期望：仅可读取；样张实际：报告记录了写入工具。此信息属于 Eval 样张，不是生产运行故障。</p></details></> : <Facts items={[[ '人格表达', '自动检查通过 · 样张' ], ['关系连续性', '需人工判断'], ['审阅记录', '无'], ['报告正文', '只读']]} />}</Section></article></div>}
        {snapshotScenario !== 'empty' && perspective === 'system' && <div className="debug-candidate-reading"><Section title="实际运行环境" note="展示实际值，区别于默认配置；样张不包含端点或凭据。"><Facts items={[[ '应用版本', '开发版 · 样张' ], ['平台', 'Windows'], ['运行时', 'Electron / Node.js'], ['当前模型', '示例对话模型'], ['凭据状态', '已配置 · 不展示值']]} /></Section><Section title="工具与连接"><Facts items={[[ '内置工具', '8 个 · 样张' ], ['MCP', '1 项连接失败 · 样张'], ['沙箱', '读取实际策略 · 样张'], ['权限规则', '生产来源只读展示']]} /><div className="debug-candidate-call-error"><strong>MCP 连接失败</strong><p>工具清单尚未取得，数量未知。连接编辑与重试归设置管理。</p></div></Section><Section title="只读诊断边界"><p>这里用于确认系统实际状态。不会在浏览过程中发起模型调用、改写配置或自动清理日志。</p></Section></div>}
        </>}
        <footer className="debug-candidate-footer"><details className="debug-candidate-gaps"><summary>来源与诊断说明 · 隔离样张</summary><p>数据来源：{view.source}。{perspective === 'relations' ? '查看已保存的关系定义与有界共同在场事件；忙闲和里程碑未在本查询提供。' : view.description}</p>{!['assets', 'runs', 'quality', 'persona', 'system'].includes(perspective) && <p>{getDebugEvidencePage(perspective as DebugEvidencePageId, records).boundary}</p>}<dl className="debug-candidate-facts">{DEBUG_CAPABILITY_GAPS.map(([label, description]) => <div key={label}><dt>{label}</dt><dd>{description}</dd></div>)}</dl><p><Check size={12} />示例标识均以 demo 标记；此候选不读写真实会话。中文正文仅为隔离演示。</p><ProductExperienceDependencies tabId="debug" showSource /></details></footer>
      </main>
    </div>
  </div>
}
