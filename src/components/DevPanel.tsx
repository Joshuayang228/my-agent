import { useState, useEffect, type ReactNode } from 'react'
import { FileText, CalendarDays, History, Activity, Heart, UserRound, MapPin, House, Footprints, Sprout, MessageCircle, Users, Shirt, BookOpen, Link, ScanText, Contact, Brain, Clock3, ListTree, Radio, Wrench, Server, FlaskConical, ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react'
import type { AgentAssetUsageEvidence, DebugEvidenceScope } from '../shared/types'
import { DEBUG_EVIDENCE_VIEWS, type DebugEvidenceView } from '../shared/debug-evidence'
import { DEBUG_GROUPS, DEBUG_PERSPECTIVES, type DebugPage } from '../shared/debug-navigation'
import { RegisteredAssetWorkbench } from './debug/RegisteredAssetWorkbench'
import { CompanionEvidencePanel } from './debug/CompanionEvidencePanel'
import { LLMCallsPanel } from './debug/LLMCallsPanel'
import { PersonaEvalPanel } from './debug/PersonaEvalPanel'
import { SkillEvalPanel } from './debug/SkillEvalPanel'
import { ActionButton } from './foundation/ActionButton'
import { ErrorState } from './foundation/ErrorState'
import { PageHeader } from './layout/PageHeader'
import { EmptyState } from './foundation/EmptyState'
import { DebugOverview, buildDebugOverviewSnapshot } from './debug/DebugOverview'
import './debug/debug-workspace.css'
import './debug/debug-experience.css'

type RequestRuntimeView = 'llm' | 'traces' | 'events'
export const DEBUG_TABS = DEBUG_PERSPECTIVES
const ICONS: Record<DebugPage, typeof FileText> = { assets: FileText, schedule: CalendarDays, recent: History, activity: Activity, now: Heart, character: UserRound, location: MapPin, residence: House, footprints: Footprints, growth: Sprout, moments: MessageCircle, relations: Users, proactive: MessageCircle, wardrobe: Shirt, items: BookOpen, links: Link, context: ScanText, profile: Contact, memories: Brain, runs: Clock3, traces: ListTree, events: Radio, tools: Wrench, system: Server, quality: FlaskConical, persona: ShieldCheck }
interface TraceSpanInfo {
  id: string
  name: string
  type: string
  caller: string
  parentId?: string
  startTime: number
  endTime?: number
  duration?: number
  status: string
  attributes: Record<string, unknown>
  error?: string
}

interface SystemInfo {
  electron: string
  node: string
  chrome: string
  platform: string
  arch: string
  appVersion: string
  uptime: number
  memoryUsage: { rss: number; heapUsed: number; heapTotal: number }
  settings: {
    model: string
    baseUrl: string
    activeRoleId: string
    hasApiKey: boolean
    hasCustomPrompt: boolean
    sandboxMode?: string
    executionMode?: string
    sessionTokenBudget?: number
    dailyTokenBudget?: number
  }
  mcp: Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>
  toolCount: number
  permissionRules?: {
    total: number
    enabled: number
    items: Array<{
      id: string
      type: string
      pattern: string
      action: string
      enabled: boolean
      description?: string
    }>
    truncated: boolean
  }
  skills?: {
    total: number
    items: Array<{ name: string; source: string; description: string }>
    truncated: boolean
  }
}

interface DebugToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
  metadata: {
    isReadOnly: boolean
    isDestructive: boolean
    isConcurrencySafe: boolean
    longRunning?: boolean
  }
}

interface CallerStat {
  count: number
  totalMs: number
  avgMs: number
  totalInputTokens: number
  totalOutputTokens: number
}

interface TracesPayload {
  spans: TraceSpanInfo[]
  callerStats: Record<string, CallerStat>
  tokenLanes?: {
    foreground: { inputTokens: number; outputTokens: number }
    background: { inputTokens: number; outputTokens: number }
  }
  dailyTokenUsage?: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
}


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
  const [tools, setTools] = useState<DebugToolInfo[]>([])
  const [traces, setTraces] = useState<TracesPayload | null>(null)
  const [error, setError] = useState('')
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
    setError('')
    if (!window.electronAPI?.debug) return
    if (page === 'system' || page === 'tools') {
      Promise.allSettled([window.electronAPI.debug.systemInfo(), window.electronAPI.debug.tools(), window.electronAPI.debug.traces()]).then(([system, registered, traceResult]) => {
        if (!current) return
        if (system.status === 'fulfilled') setSystemInfo(system.value as SystemInfo)
        if (registered.status === 'fulfilled') setTools(registered.value)
        if (traceResult.status === 'fulfilled') setTraces({ ...traceResult.value, callerStats: traceResult.value.callerStats as Record<string, CallerStat> })
        if (system.status === 'rejected' || registered.status === 'rejected' || traceResult.status === 'rejected') setError('部分系统证据刷新失败，保留上次成功结果')
      })
    }
    if (page === 'traces') window.electronAPI.debug.traces().then(data => { if (current) setTraces({ spans: data.spans, callerStats: data.callerStats as Record<string, CallerStat>, tokenLanes: data.tokenLanes, dailyTokenUsage: data.dailyTokenUsage }) }).catch(() => { if (current) setError('调用链读取失败，保留上次成功证据') })
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
        {scopeError && (domain || page === 'assets') && <p role="alert" className="debug-prompt-state">{scopeError}</p>}{error && <ErrorState title="诊断读取异常" description={error} />}
        {page === 'assets' && <RegisteredAssetWorkbench scope={scope} revision={revision} focusKey={assetKey} onUsage={openUsage} onTotal={setAssetTotal} />}
        {domain && <>{roleId ? <CompanionEvidencePanel key={`${page}:${roleId}:${evidenceTarget?.id ?? ''}`} scope={scope} onRoleChange={setRoleId} targetId={evidenceTarget?.id} onEvidence={(view, id) => { navigate(view); setEvidenceTarget(id ? { view, id } : null) }} view={page as DebugEvidenceView} roleId={roleId} revision={revision} /> : <EmptyState title="尚未取得人物范围" description="未确定人物时不生成默认状态。" />}</>}
        {page === 'context' && <><p>从实际调用查看保存的 System、Messages 与语义来源；当前定义不替代历史输入。此清单是全局调用范围，不受诊断人物筛选影响。</p><LLMCallsPanel showHeading={false} revision={revision} onAsset={key => { navigate('assets'); setAssetKey(key) }} /></>}
        {['runs', 'traces', 'events'].includes(page) && <RequestRuntimePanel view={page === 'runs' ? 'llm' : page as RequestRuntimeView} traces={traces} events={eventLog} focusedLLMCallId={callId} focusedTraceSpanId={spanId} revision={revision} onAsset={key => { navigate('assets'); setAssetKey(key) }} />}
        {page === 'system' && <DebugOverview snapshot={buildDebugOverviewSnapshot({ system: systemInfo ?? undefined, traces: traces ?? undefined, world: scope?.activeRoleId ? { role: { name: scope.roles.find(role => role.id === scope.activeRoleId)?.name ?? scope.activeRoleId } } : undefined, eventCount: eventLog.length, unavailable: [...(!systemInfo ? ['system' as const] : []), ...(!traces ? ['traces' as const] : []), ...(!scope?.activeRoleId ? ['world' as const] : [])] })} loading={false} error={error} onOpen={tab => navigate(({ prompt: 'assets', 'request-runtime': 'runs', world: 'now', system: 'system' } as const)[tab])} />}
        {page === 'tools' && <p>注册定义不等于本次可用或实际使用；使用证据请从生产资产目录进入关联调用。</p>}
        {(page === 'system' || page === 'tools') && <SystemTab info={systemInfo} tools={tools} />}
        {page === 'quality' && <SkillEvalPanel revision={revision} />}{page === 'persona' && <PersonaEvalPanel revision={revision} />}
      </main>
    </div>
  </div>
}
function SystemTab({ info, tools }: { info: SystemInfo | null; tools: DebugToolInfo[] }) {
  if (!info) return <EmptyState title="尚未读取系统快照" description="可刷新当前分区重试；未读取不显示默认配置或零值。" />

  const detailSections = [
    {
      title: '运行环境',
      items: [
        ['Electron', info.electron],
        ['Node.js', info.node],
        ['Chrome', info.chrome],
        ['平台', `${info.platform} / ${info.arch}`],
        ['运行时间', formatUptime(info.uptime)],
      ],
    },
    {
      title: '内存使用',
      items: [
        ['RSS', formatBytes(info.memoryUsage.rss)],
        ['Heap Used', formatBytes(info.memoryUsage.heapUsed)],
        ['Heap Total', formatBytes(info.memoryUsage.heapTotal)],
        ['利用率', `${Math.round((info.memoryUsage.heapUsed / info.memoryUsage.heapTotal) * 100)}%`],
      ],
    },
  ]

  const sections = [
    {
      title: '运行时策略',
      items: [
        ['有效沙箱', info.settings.sandboxMode || '—'],
        ['审批模式', info.settings.executionMode || '—'],
        ['会话 Token 预算', String(info.settings.sessionTokenBudget ?? 0)],
        ['日 Token 预算', String(info.settings.dailyTokenBudget ?? 0)],
      ],
    },
    {
      title: 'LLM 配置',
      items: [
        ['模型', info.settings.model],
        ['Base URL', info.settings.baseUrl],
        ['主角', info.settings.activeRoleId],
        ['API Key', info.settings.hasApiKey ? '已配置' : '未配置'],
        ['自定义 Prompt', info.settings.hasCustomPrompt ? '有' : '—'],
      ],
    },
  ]

  const rules = info.permissionRules
  const skills = info.skills

  return (
    <div className="debug-system-workbench">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="工具数" value={String(info.toolCount)} color="cyan" />
        <StatCard label="Skills" value={String(skills?.total ?? '未读取')} color="violet" />
        <StatCard label="权限规则" value={String(rules?.enabled ?? '未读取')} color="emerald" />
        <StatCard label="MCP" value={String(info.mcp.length)} color="cyan" />
      </div>

      {sections.map(section => (
        <div key={section.title} className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{section.title}</div>
          <div className="theme-card rounded-lg border">
            {section.items.map(([label, value], i) => (
              <div
                key={label}
                className={`flex justify-between px-4 py-2 text-xs ${
                  i < section.items.length - 1 ? 'border-b' : ''
                }`}
                style={i < section.items.length - 1 ? { borderColor: 'var(--border-color)' } : undefined}
              >
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <details className="mb-4 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
        <summary className="cursor-pointer px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          运行环境与内存
        </summary>
        <div className="border-t px-3 pt-3" style={{ borderColor: 'var(--border-color)' }}>
          {detailSections.map(section => (
            <div key={section.title} className="mb-4 last:mb-0">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{section.title}</div>
              <div className="theme-card rounded-lg border">
                {section.items.map(([label, value], i) => (
                  <div
                    key={label}
                    className={`flex justify-between px-4 py-2 text-xs ${i < section.items.length - 1 ? 'border-b' : ''}`}
                    style={i < section.items.length - 1 ? { borderColor: 'var(--border-color)' } : undefined}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <div className="mb-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          工具注册表（{tools.length}）
        </div>
        {tools.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>未注册工具</p>
        ) : (
          <div className="space-y-1.5">
            {tools.map((tool) => (
              <details key={tool.name} className="theme-card rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
                <summary className="cursor-pointer">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{tool.name}</div>
                      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{tool.description}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1 text-[10px]">
                      <ToolFlag enabled={tool.metadata.isReadOnly} trueLabel="只读" falseLabel="可写" tone="success" />
                      <ToolFlag enabled={tool.metadata.isDestructive} trueLabel="破坏性" falseLabel="非破坏性" tone="danger" />
                      <ToolFlag enabled={tool.metadata.isConcurrencySafe} trueLabel="可并发" falseLabel="串行" tone="accent" />
                      {tool.metadata.longRunning && (
                        <ToolFlag enabled trueLabel="长任务" falseLabel="" tone="warning" />
                      )}
                    </div>
                  </div>
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words border-t pt-2 font-mono text-[10px] leading-relaxed" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                  {JSON.stringify(tool.parameters, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>

      {rules && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            权限规则（{rules.enabled}/{rules.total} 启用{rules.truncated ? ' · 已截断' : ''}）
          </div>
          {rules.items.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>无自定义规则（走默认沙箱链）</p>
          ) : (
            <div className="space-y-1">
              {rules.items.map((r) => (
                <div
                  key={r.id}
                  className="theme-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-[11px]"
                  style={{ borderColor: 'var(--border-color)', opacity: r.enabled ? 1 : 0.5 }}
                >
                  <span style={{ color: r.action === 'deny' ? 'var(--danger)' : r.action === 'ask' ? 'var(--warning)' : 'var(--success)' }}>
                    {r.action}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{r.type}</span>
                  <span className="break-all" style={{ color: 'var(--text-primary)' }}>{r.pattern}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {skills && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Skills（{skills.total}{skills.truncated ? ' · 已截断' : ''}）
          </div>
          {skills.items.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>未加载 Skill</p>
          ) : (
            <div className="space-y-1">
              {skills.items.map((s) => (
                <div key={s.name} className="theme-card rounded-lg border px-3 py-1.5" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-2 text-xs">
                    <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.source}</span>
                  </div>
                  {s.description && (
                    <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {info.mcp.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>MCP 连接</div>
          <div className="space-y-1">
            {info.mcp.map(s => (
              <div key={s.id} className="theme-card flex items-center justify-between rounded-lg border px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    s.status === 'connected' ? 'bg-emerald-400' :
                    s.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  {s.error && <span className="text-[10px]" style={{ color: 'var(--danger)' }}>{s.error}</span>}
                </div>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.toolCount} tools</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div data-stat-category={color} className="theme-card rounded-lg border p-3 text-center" style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
    </div>
  )
}

function ToolFlag({
  enabled,
  trueLabel,
  falseLabel,
  tone,
}: {
  enabled: boolean
  trueLabel: string
  falseLabel: string
  tone: 'success' | 'danger' | 'accent' | 'warning'
}) {
  const color = enabled
    ? `var(--${tone})`
    : 'var(--text-muted)'
  return (
    <span className="rounded border px-1.5 py-0.5" style={{ borderColor: color, color }}>
      {enabled ? trueLabel : falseLabel}
    </span>
  )
}

/** 背景：三种观察粒度已有各自侧栏入口；意图：保留真实面板而去掉重复导航。
 * 约束：关联调用与 Span 标识继续传递，刷新由统一分区控制器触发。
 */
function RequestRuntimePanel({ view, traces, events, focusedLLMCallId, focusedTraceSpanId, onAsset, revision }: {
  view: RequestRuntimeView
  traces: TracesPayload | null
  events: Array<{ time: number; type: string; detail: string }>
  focusedLLMCallId: string
  focusedTraceSpanId: string
  onAsset: (key: string) => void
  revision: number
}) {
  return <div className="debug-runtime-workbench space-y-4" data-testid="request-runtime-panel">
    {view === 'llm' && <LLMCallsPanel showHeading={false} focusId={focusedLLMCallId} revision={revision} onAsset={onAsset} />}
    {view === 'traces' && <TracesTab data={traces} focusId={focusedTraceSpanId} />}
    {view === 'events' && <EventsTab events={events} />}
  </div>
}

function TracesTab({ data, focusId }: { data: TracesPayload | null; focusId?: string }) {
  useEffect(() => {
    if (!focusId) return
    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-trace-span-id]'))
        .find((element) => element.dataset.traceSpanId === focusId)
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [data, focusId])

  if (!data) {
    return <EmptyState title="尚未读取调用链" description="可刷新当前分区重试；未读取不等于没有 Span。" />
  }

  const spans = data.spans
  const callers = Object.entries(data.callerStats || {})
  const fg = data.tokenLanes?.foreground
  const bg = data.tokenLanes?.background
  const focusedExists = Boolean(focusId && spans.some((span) => span.id === focusId))

  const byParent = new Map<string | undefined, TraceSpanInfo[]>()
  for (const s of spans) {
    const key = s.parentId
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(s)
  }

  const roots = [
    ...(byParent.get(undefined) ?? []),
    ...spans.filter(s => s.parentId && !spans.some(p => p.id === s.parentId)),
  ]
  const seen = new Set<string>()
  const uniqueRoots = roots.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  function renderNode(span: TraceSpanInfo, depth: number): ReactNode {
    const children = (byParent.get(span.id) ?? []).filter(c => c.id !== span.id)
    return (
      <div key={span.id}>
        <div
          data-trace-span-id={span.id}
          className="flex items-center gap-2 rounded px-2 py-1 font-mono text-[11px]"
          style={{
            paddingLeft: 8 + depth * 14,
            color: 'var(--text-secondary)',
            background: span.id === focusId ? 'var(--accent-subtle)' : 'transparent',
            outline: span.id === focusId ? '1px solid var(--accent)' : 'none',
          }}
        >
          <span className={span.status === 'error' ? 'text-red-400' : span.status === 'running' ? 'text-amber-400' : 'text-emerald-400'}>
            {span.status === 'ok' ? '●' : span.status === 'error' ? '✗' : '○'}
          </span>
          <span style={{ color: 'var(--text-primary)' }}>{span.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>{span.type}/{span.caller}</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {span.duration !== undefined ? `${span.duration}ms` : '…'}
          </span>
          {span.error && <span className="truncate text-red-400">{span.error}</span>}
          {(() => {
            const raw = span.attributes.assetKeys
            const keys = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : typeof raw === 'string' ? [raw] : []
            return keys.length > 0 ? <span className="truncate" style={{ color: 'var(--accent-fg)' }}>{keys.join(' · ')}</span> : null
          })()}
          {typeof span.attributes.decision === 'string' && <span style={{ color: 'var(--text-muted)' }}>decision={span.attributes.decision}</span>}
          {typeof span.attributes.sandboxMode === 'string' && <span style={{ color: 'var(--text-muted)' }}>sandbox={span.attributes.sandboxMode}</span>}
        </div>
        {children.map(c => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="debug-runtime-traces space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="今日 Token"
          value={String(data.dailyTokenUsage ?? 0)}
          color="emerald"
        />
        <StatCard
          label="前台 in/out"
          value={fg ? `${fg.inputTokens}/${fg.outputTokens}` : '—'}
          color="cyan"
        />
        <StatCard
          label="后台 in/out"
          value={bg ? `${bg.inputTokens}/${bg.outputTokens}` : '—'}
          color="violet"
        />
      </div>

      {callers.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Caller 统计
          </div>
          <div className="theme-card overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            {callers.map(([name, s], i) => (
              <div
                key={name}
                className={`flex flex-wrap justify-between gap-2 px-3 py-1.5 font-mono text-[11px] ${i < callers.length - 1 ? 'border-b' : ''}`}
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{name}</span>
                <span>
                  n={s.count} · avg={Math.round(s.avgMs)}ms · tok {s.totalInputTokens}/{s.totalOutputTokens}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Span 树（最近 {spans.length}）
        </div>
        {focusId && !focusedExists && (
          <p className="mb-2 rounded border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            目标 Span 不在当前内存窗口中；关联证据仍保留，可按 Span ID 在持久化记录中排查：<span className="font-mono">{focusId}</span>
          </p>
        )}
        {spans.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>暂无 Span。发送消息后会出现调用链。</p>
        ) : (
          <div className="space-y-0.5">{uniqueRoots.map(r => renderNode(r, 0))}</div>
        )}
      </div>
    </div>
  )
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
