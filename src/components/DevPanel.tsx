import { useState, useEffect } from 'react'
import { FileText, CalendarDays, History, Activity, Heart, UserRound, MapPin, House, Footprints, Sprout, MessageCircle, Users, Shirt, BookOpen, Link, ScanText, Contact, Brain, Clock3, ListTree, Radio, Wrench, Server, FlaskConical, ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugEvidenceScope, DebugTracesSnapshot } from '../shared/types'
import type { DiagnosticHistoryRecord } from '../shared/debug-history'
import { DEBUG_EVIDENCE_VIEWS, type DebugEvidenceView } from '../shared/debug-evidence'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES, type DebugPage } from '../shared/debug-navigation'
import { RegisteredAssetWorkbench } from './debug/RegisteredAssetWorkbench'
import { CompanionEvidencePanel } from './debug/CompanionEvidencePanel'
import { DebugSystemContent, type DebugSystemSnapshot } from './debug/DebugSystemContent'
import { DebugCapabilitiesContent, capabilityRecords, type DebugToolDefinition } from './debug/DebugCapabilitiesContent'
import { ContextInspectorPanel } from './debug/ContextInspectorPanel'
import { LLMCallsPanel } from './debug/LLMCallsPanel'
import { PersonaEvalPanel } from './debug/PersonaEvalPanel'
import { SkillEvalPanel } from './debug/SkillEvalPanel'
import { ActionButton } from './foundation/ActionButton'
import { TracesEvidenceContent } from './debug/TracesEvidenceContent'
import { EventsEvidenceContent } from './debug/EventsEvidenceContent'
import { SavedEvidencePanel } from './debug/SavedEvidencePanel'
import { PageHeader } from './layout/PageHeader'
import { EmptyState } from './foundation/EmptyState'
import { DebugOverview, buildDebugOverviewSnapshot } from './debug/DebugOverview'
import './debug/debug-workspace.css'
import './debug/debug-experience.css'

type RequestRuntimeView = 'llm' | 'events'
export const DEBUG_TABS = DEBUG_PERSPECTIVES
const ICONS: Record<DebugPage, typeof FileText> = { assets: FileText, schedule: CalendarDays, recent: History, activity: Activity, now: Heart, character: UserRound, location: MapPin, residence: House, footprints: Footprints, growth: Sprout, moments: MessageCircle, relations: Users, proactive: MessageCircle, wardrobe: Shirt, items: BookOpen, links: Link, context: ScanText, profile: Contact, memories: Brain, runs: Clock3, traces: ListTree, events: Radio, tools: Wrench, system: Server, quality: FlaskConical, persona: ShieldCheck }
type SystemInfo = DebugSystemSnapshot
type DebugToolInfo = DebugToolDefinition

interface DevPanelProps {
  onClose: () => void
  eventLog: Array<{ time: number; type: string; detail: string }>
}

/** 背景：六入口把人物世界和生产资产压成摘要，难以按实际阅读任务诊断。
 * 意图：沿用候选七组导航，领域证据、生产目录、调用与质量分别从真实接口读取。
 * 关键约束：正式页面不依赖样张；诊断选角不切换主角；屏幕权限缺失不伪装成视觉验收通过。
 */
export function DevPanel({ onClose, eventLog }: DevPanelProps) {
  const [page, setPage] = useState<DebugPage>('assets')
  const [savedOrigin, setSavedOrigin] = useState<{ page: DebugPage; roleId: string; savedView: boolean; recordId: string }>()
  const [historyTarget, setHistoryTarget] = useState<string>()
  const [savedView, setSavedView] = useState(false)
  const [lifeView, setLifeView] = useState(false)
  const [revision, setRevision] = useState(0)
  const [scope, setScope] = useState<DebugEvidenceScope | null>(null)
  const [roleId, setRoleId] = useState('')
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [tools, setTools] = useState<DebugToolInfo[] | null>(null)
  const [systemError, setSystemError] = useState('')
  const [toolsError, setToolsError] = useState('')
  const [systemLoading, setSystemLoading] = useState(false)
  const [toolsLoading, setToolsLoading] = useState(false)
  const [traces, setTraces] = useState<DebugTracesSnapshot | null>(null)
  const [overviewError, setOverviewError] = useState('')
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [tracesError, setTracesError] = useState('')
  const [tracesLoading, setTracesLoading] = useState(false)
  const [scopeError, setScopeError] = useState('')
  const [assetKey, setAssetKey] = useState('')
  const [assetTotal, setAssetTotal] = useState<number | null>(null)
  const [callId, setCallId] = useState('')
  const [spanId, setSpanId] = useState('')
  const [evidenceTarget, setEvidenceTarget] = useState<{ view: DebugEvidenceView; id: string } | null>(null)
  const entry = DEBUG_PERSPECTIVES.find(item => item.id === page)!
  useEffect(() => {
    let current = true
    if (!window.electronAPI?.debug?.companionEvidenceScope) { setScopeError('此页面需要桌面应用的诊断接口'); return }
    window.electronAPI.debug.companionEvidenceScope().then(next => { if (current) { setScope(next); setScopeError(''); setRoleId(previous => next.roles.some(role => role.id === previous) ? previous : next.activeRoleId ?? next.roles[0]?.id ?? '') } }).catch(() => { if (current) setScopeError('人物诊断范围读取失败；保留上次可用范围') })
    return () => { current = false }
  }, [revision])
  useEffect(() => {
    let current = true
    if (!window.electronAPI?.debug) return
    if (page === 'system' || page === 'tools') {
      setSystemLoading(true)
      window.electronAPI.debug.systemInfo().then(data => { if (current) { setSystemInfo(data); setSystemError('') } }).catch(() => { if (current) setSystemError('系统快照读取失败；已有来源保留，未读取部分不补零。') }).finally(() => { if (current) setSystemLoading(false) })
    }
    if (page === 'tools') {
      setToolsLoading(true)
      window.electronAPI.debug.tools().then(data => { if (current) { setTools(data); setToolsError('') } }).catch(() => { if (current) setToolsError('工具注册表读取失败；已读清单保留，不能推断没有工具。') }).finally(() => { if (current) setToolsLoading(false) })
    }
    if (page === 'system') {
      setOverviewLoading(true)
      window.electronAPI.debug.traces().then(data => { if (current) { setTraces(data); setOverviewError('') } }).catch(() => { if (current) setOverviewError('调用链概览读取失败；其他系统来源仍可阅读。') }).finally(() => { if (current) setOverviewLoading(false) })
    }
    if (page === 'traces') {
      setTracesLoading(true); setTracesError('')
      window.electronAPI.debug.traces().then(data => { if (current) setTraces(data) }).catch(() => { if (current) setTracesError('调用链读取失败；未读取的 Span 数量未知。') }).finally(() => { if (current) setTracesLoading(false) })
    }

    return () => { current = false }
  }, [page, revision])
  const navigate = (next: DebugPage) => { setPage(next); setSavedOrigin(undefined); setHistoryTarget(undefined); setSavedView(false); setLifeView(false); setAssetKey(''); setCallId(''); setSpanId(''); setEvidenceTarget(null) }
  const openUsage = (item: AgentAssetUsageEvidence) => {
    const llm = ['llm-input', 'provider-route', 'provider-policy', 'tool-available', 'skill-activation'].includes(item.usageKind)
    navigate(llm ? 'runs' : 'traces')
    if (llm) setCallId(item.spanId); else setSpanId(item.spanId)
  }
  const openEvidence = (view: 'recent' | 'moments', id: string, owner: string, originId?: string) => {
    const origin = originId ? { page, roleId, savedView, recordId: originId } : undefined
    navigate(view); setRoleId(owner); setEvidenceTarget({ view, id }); setSavedOrigin(origin)
  }
  const openSavedCall = (id: string, record?: DiagnosticHistoryRecord) => {
    const origin = record ? { page, roleId, savedView, recordId: record.id } : undefined
    navigate('runs'); setCallId(id); setSavedOrigin(origin)
  }
  const restoreSavedOrigin = () => {
    if (!savedOrigin) return
    const origin = savedOrigin
    navigate(origin.page); setRoleId(origin.roleId); setSavedView(origin.savedView); setHistoryTarget(origin.recordId)
  }

  const domain = page !== 'context' && DEBUG_EVIDENCE_VIEWS.includes(page as DebugEvidenceView)
  return <div className="debug-workspace debug-refined debug-focused playground-shape-scope" data-testid="dev-panel" data-surface="debug" data-perspective={page}>
    <header className="debug-candidate-preview"><ActionButton variant="plain" title="返回聊天" onClick={onClose}><ArrowLeft size={14} /> 返回聊天</ActionButton><span>Debug · 生产诊断</span><ActionButton variant="plain" title="刷新当前调试分区" onClick={() => setRevision(value => value + 1)}><RotateCcw size={14} /> 刷新当前分区</ActionButton></header>
    <div className="debug-candidate-workspace">
      <nav className="debug-candidate-nav" aria-label="调试分区"><div className="debug-candidate-brand"><Activity size={20} /><strong>Debug</strong><span>诊断工作区</span></div><div className="debug-candidate-nav-groups">{DEBUG_GROUPS.map(group => <section key={group} aria-label={`${group}分区`}><p className="debug-candidate-nav-label">{group}</p>{DEBUG_PERSPECTIVES.filter(item => item.group === group).map(item => { const Icon = ICONS[item.id]; return <ActionButton key={item.id} variant="plain" aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={14} />{item.label}</ActionButton> })}</section>)}</div><div className="debug-candidate-nav-footer"><ShieldCheck size={14} /><span>生产资产只读<br />受控诊断单独确认</span></div></nav>
      <main className={`debug-candidate-main ${page === 'assets' ? 'debug-candidate-main-prompt' : ''}`}>
        <PageHeader title={entry.label} description={page === 'assets' && assetTotal !== null ? `${assetTotal} 项生产资产` : ''} />
        {savedOrigin && <ActionButton variant="plain" onClick={restoreSavedOrigin}>返回运行证据</ActionButton>}
        {scopeError && (domain || page === 'assets') && <p role="alert" className="debug-prompt-state">{scopeError}</p>}
        {page === 'assets' && <RegisteredAssetWorkbench scope={scope} revision={revision} focusKey={assetKey} onUsage={openUsage} onTotal={setAssetTotal} />}
        {(page === 'activity' || page === 'proactive') && !roleId && <EmptyState title="尚未取得人物范围" description="未确定人物时不生成默认记录。" />}
        {page === 'activity' && <ActionButton variant="plain" onClick={() => { if (evidenceTarget) { setEvidenceTarget(null); setLifeView(false) } else setLifeView(value => !value) }}>{lifeView || evidenceTarget ? '查看运行行动' : '查看生活事件'}</ActionButton>}
        {page === 'activity' && !lifeView && !evidenceTarget && roleId && <SavedEvidencePanel view="activity" targetId={historyTarget} onClearTarget={() => setHistoryTarget(undefined)} onEvidence={openEvidence} roleId={roleId} scope={scope} onRoleChange={setRoleId} revision={revision} onCall={openSavedCall} />}
        {page === 'proactive' && roleId && <SavedEvidencePanel key={roleId} view="proactive" onEvidence={openEvidence} roleId={roleId} scope={scope} onRoleChange={setRoleId} revision={revision} targetId={historyTarget ?? evidenceTarget?.id} onClearTarget={() => { setHistoryTarget(undefined); setEvidenceTarget(null) }} />}
        {domain && page !== 'proactive' && (page !== 'activity' || lifeView || evidenceTarget) && <>{roleId ? <CompanionEvidencePanel key={`${page}:${roleId}:${evidenceTarget?.id ?? ''}`} scope={scope} onRoleChange={setRoleId} onOpenTraces={() => navigate('traces')} onAsset={key => { navigate('assets'); setAssetKey(key) }} targetId={evidenceTarget?.id} onEvidence={(view, id) => { navigate(view); setEvidenceTarget(id ? { view, id } : null) }} view={page as DebugEvidenceView} roleId={roleId} revision={revision} /> : <EmptyState title="尚未取得人物范围" description="未确定人物时不生成默认状态。" />}</>}
        {page === 'context' && <ContextInspectorPanel revision={revision} onRecord={id => { navigate('runs'); setCallId(id) }} />}
        {(page === 'traces' || page === 'events') && <ActionButton variant="plain" onClick={() => setSavedView(value => !value)}>{savedView ? '查看当前快照' : '查看保存历史'}</ActionButton>}
        {(page === 'traces' || page === 'events') && savedView && <SavedEvidencePanel key={page} view={page} targetId={historyTarget} onClearTarget={() => setHistoryTarget(undefined)} onEvidence={openEvidence} revision={revision} onCall={openSavedCall} />}
        {page === 'traces' && <div hidden={savedView}><TracesEvidenceContent snapshot={traces} loading={tracesLoading} error={tracesError} focusId={spanId} onRetry={() => setRevision(value => value + 1)} onRecord={id => { navigate('runs'); setCallId(id) }} onAsset={key => { navigate('assets'); setAssetKey(key) }} /></div>}
        {['runs', 'events'].includes(page) && <div hidden={page === 'events' && savedView}><RequestRuntimePanel view={page === 'runs' ? 'llm' : 'events'} events={eventLog} focusedLLMCallId={callId} onPage={navigate} revision={revision} onAsset={key => { navigate('assets'); setAssetKey(key) }} /></div>}
        {(page === 'system' || page === 'tools') && systemError && <p className="debug-system-state" role="alert">{systemError}</p>}
        {page === 'system' && <><DebugSystemContent info={systemInfo} />{systemLoading && <p role="status">正在读取系统快照…</p>}<details className="debug-system-boundary"><summary>运行概览与其他证据入口</summary><DebugOverview snapshot={buildDebugOverviewSnapshot({ system: systemInfo ?? undefined, traces: traces ?? undefined, world: scope?.activeRoleId ? { role: { name: scope.roles.find(role => role.id === scope.activeRoleId)?.name ?? scope.activeRoleId } } : undefined, eventCount: eventLog.length, unavailable: [...(!systemInfo ? ['system' as const] : []), ...(!traces ? ['traces' as const] : []), ...(!scope?.activeRoleId ? ['world' as const] : [])] })} loading={systemLoading || overviewLoading} error={overviewError} onOpen={tab => navigate(({ prompt: 'assets', 'request-runtime': 'runs', world: 'now', system: 'system' } as const)[tab])} /></details></>}
        {page === 'tools' && <section className="debug-tools-workbench" data-testid="debug-evidence-tools">
          {toolsError && <p className="debug-tools-state" role="alert">{toolsError}</p>}
          {(toolsLoading || systemLoading) && <p role="status">正在读取技能与工具…</p>}
          {!systemInfo && <p className="debug-tools-state">Skill 与 MCP 来源未读取，不能推断为空。</p>}
          {tools === null && <p className="debug-tools-state">工具注册表未读取，数量未知。</p>}
          {(tools !== null || systemInfo) && <DebugCapabilitiesContent records={capabilityRecords(tools, systemInfo)} />}
        </section>}
        {page === 'quality' && <SkillEvalPanel revision={revision} />}{page === 'persona' && <PersonaEvalPanel revision={revision} />}
      </main>
    </div>
  </div>
}
/** 背景：三种观察粒度已有各自侧栏入口；意图：保留真实面板而去掉重复导航。
 * 约束：关联调用与 Span 标识继续传递，刷新由统一分区控制器触发。
 */
function RequestRuntimePanel({ view, events, focusedLLMCallId, onPage, onAsset, revision }: {
  view: RequestRuntimeView
  events: Array<{ time: number; type: string; detail: string }>
  focusedLLMCallId: string
  onPage: (page: 'traces' | 'runs') => void
  onAsset: (key: string) => void
  revision: number
}) {
  return <div className="debug-runtime-workbench space-y-4" data-testid="request-runtime-panel">
    {view === 'llm' && <LLMCallsPanel showHeading={false} focusId={focusedLLMCallId} revision={revision} onAsset={onAsset} />}
    {view === 'events' && <EventsEvidenceContent events={events} onPage={onPage} />}
  </div>
}
