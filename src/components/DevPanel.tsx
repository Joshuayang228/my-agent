import { useState, useEffect } from 'react'
import { FileText, CalendarDays, History, Activity, Heart, UserRound, MapPin, House, Footprints, Sprout, MessageCircle, Users, Shirt, BookOpen, Link, ScanText, Contact, Brain, Clock3, ListTree, Radio, Wrench, Server, FlaskConical, ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugEvidenceScope, DebugTracesSnapshot } from '../shared/types'
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
  const navigate = (next: DebugPage) => { setPage(next); setAssetKey(''); setCallId(''); setSpanId(''); setEvidenceTarget(null) }
  const openUsage = (item: AgentAssetUsageEvidence) => {
    const llm = ['llm-input', 'provider-route', 'provider-policy', 'tool-available', 'skill-activation'].includes(item.usageKind)
    navigate(llm ? 'runs' : 'traces')
    if (llm) setCallId(item.spanId); else setSpanId(item.spanId)
  }
  const domain = page !== 'context' && DEBUG_EVIDENCE_VIEWS.includes(page as DebugEvidenceView)
  return <div className="debug-workspace debug-refined debug-focused playground-shape-scope" data-testid="dev-panel" data-surface="debug" data-perspective={page}>
    <header className="debug-candidate-preview"><ActionButton variant="plain" title="返回聊天" onClick={onClose}><ArrowLeft size={14} /> 返回聊天</ActionButton><span>Debug · 生产诊断</span><ActionButton variant="plain" title="刷新当前调试分区" onClick={() => setRevision(value => value + 1)}><RotateCcw size={14} /> 刷新当前分区</ActionButton></header>
    <div className="debug-candidate-workspace">
      <nav className="debug-candidate-nav" aria-label="调试分区"><div className="debug-candidate-brand"><Activity size={20} /><strong>Debug</strong><span>诊断工作区</span></div><div className="debug-candidate-nav-groups">{DEBUG_GROUPS.map(group => <section key={group} aria-label={`${group}分区`}><p className="debug-candidate-nav-label">{group}</p>{DEBUG_PERSPECTIVES.filter(item => item.group === group).map(item => { const Icon = ICONS[item.id]; return <ActionButton key={item.id} variant="plain" aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={14} />{item.label}</ActionButton> })}</section>)}</div><div className="debug-candidate-nav-footer"><ShieldCheck size={14} /><span>生产资产只读<br />受控诊断单独确认</span></div></nav>
      <main className={`debug-candidate-main ${page === 'assets' ? 'debug-candidate-main-prompt' : ''}`}>
        <PageHeader title={entry.label} description={page === 'assets' && assetTotal !== null ? `${assetTotal} 项生产资产` : ''} />
        {scopeError && (domain || page === 'assets') && <p role="alert" className="debug-prompt-state">{scopeError}</p>}
        {page === 'assets' && <RegisteredAssetWorkbench scope={scope} revision={revision} focusKey={assetKey} onUsage={openUsage} onTotal={setAssetTotal} />}
        {domain && <>{roleId ? <CompanionEvidencePanel key={`${page}:${roleId}:${evidenceTarget?.id ?? ''}`} scope={scope} onRoleChange={setRoleId} onOpenTraces={() => navigate('traces')} onAsset={key => { navigate('assets'); setAssetKey(key) }} targetId={evidenceTarget?.id} onEvidence={(view, id) => { navigate(view); setEvidenceTarget(id ? { view, id } : null) }} view={page as DebugEvidenceView} roleId={roleId} revision={revision} /> : <EmptyState title="尚未取得人物范围" description="未确定人物时不生成默认状态。" />}</>}
        {page === 'context' && <ContextInspectorPanel revision={revision} onRecord={id => { navigate('runs'); setCallId(id) }} />}
        {page === 'traces' && <TracesEvidenceContent snapshot={traces} loading={tracesLoading} error={tracesError} focusId={spanId} onRetry={() => setRevision(value => value + 1)} onRecord={id => { navigate('runs'); setCallId(id) }} onAsset={key => { navigate('assets'); setAssetKey(key) }} />}
        {['runs', 'events'].includes(page) && <RequestRuntimePanel view={page === 'runs' ? 'llm' : 'events'} events={eventLog} focusedLLMCallId={callId} revision={revision} onAsset={key => { navigate('assets'); setAssetKey(key) }} />}
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
function RequestRuntimePanel({ view, events, focusedLLMCallId, onAsset, revision }: {
  view: RequestRuntimeView
  events: Array<{ time: number; type: string; detail: string }>
  focusedLLMCallId: string
  onAsset: (key: string) => void
  revision: number
}) {
  return <div className="debug-runtime-workbench space-y-4" data-testid="request-runtime-panel">
    {view === 'llm' && <LLMCallsPanel showHeading={false} focusId={focusedLLMCallId} revision={revision} onAsset={onAsset} />}
    {view === 'events' && <EventsTab events={events} />}
  </div>
}

function EventsTab({ events }: { events: Array<{ time: number; type: string; detail: string }> }) {
  if (events.length === 0) {
    return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无事件。发送消息后会在这里看到实时事件流。</div>
  }

  const typeColor: Record<string, string> = {
    text: 'text-cyan-400',
    thinking: 'text-indigo-400',
    tool_start: 'text-amber-400',
    tool_end: 'text-emerald-400',
    usage: 'text-slate-500',
    error: 'text-red-400',
    done: 'text-slate-600',
    tool_confirm: 'text-amber-300',
    compact: 'text-violet-400',
    execution_mode_changed: 'text-orange-400',
  }

  return (
    <div className="debug-runtime-events">
      <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>共 {events.length} 条事件</div>
      <div className="space-y-0.5 font-mono text-[11px]">
        {events.map((ev, i) => (
          <div
            key={i}
            className={`flex gap-3 rounded px-2 py-1 ${ev.type === 'compact' ? 'event-row-emphasis' : ''}`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {new Date(ev.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`w-24 shrink-0 ${typeColor[ev.type] || ''}`} style={!typeColor[ev.type] ? { color: 'var(--text-muted)' } : undefined}>
              {ev.type}
            </span>
            <span className="min-w-0 whitespace-pre-wrap break-words" style={{ color: ev.type === 'compact' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{ev.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
