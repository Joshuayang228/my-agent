import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  FileText, BarChart3, ClipboardList, Zap, RotateCcw,
  Bug, Globe, ArrowLeft, Layers3, Activity, FlaskConical,
} from 'lucide-react'
import { PromptManagerPanel, type DebugPromptInfo } from './debug/PromptManagerPanel'
import { LLMCallsPanel } from './debug/LLMCallsPanel'
import { WorldStatePanel, type WorldSnapshot } from './debug/WorldStatePanel'
import { PersonaEvalPanel } from './debug/PersonaEvalPanel'
import { SkillEvalPanel } from './debug/SkillEvalPanel'

type DebugTab = 'prompt' | 'request-runtime' | 'world' | 'eval' | 'system'
type RequestRuntimeView = 'llm' | 'traces' | 'events'

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
    conversationDebugMode?: boolean
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

export const DEBUG_TABS: { id: DebugTab; label: string; icon: ReactNode }[] = [
  { id: 'prompt', label: '提示词管理器', icon: <FileText size={12} /> },
  { id: 'request-runtime', label: '请求与运行', icon: <Layers3 size={12} /> },
  { id: 'world', label: '伙伴状态', icon: <Globe size={12} /> },
  { id: 'eval', label: '质量 / Eval', icon: <FlaskConical size={12} /> },
  { id: 'system', label: '系统', icon: <BarChart3 size={12} /> },
]

interface DevPanelProps {
  onClose: () => void
  eventLog: Array<{ time: number; type: string; detail: string }>
}

/** Debug 独立全页（与 Playground 分离，不再共用 surface 双页壳） */
export function DevPanel({ onClose, eventLog }: DevPanelProps) {
  const [debugTab, setDebugTab] = useState<DebugTab>('prompt')
  const [promptInfo, setPromptInfo] = useState<DebugPromptInfo | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [tools, setTools] = useState<DebugToolInfo[]>([])
  const [traces, setTraces] = useState<TracesPayload | null>(null)
  const [requestRuntimeView, setRequestRuntimeView] = useState<RequestRuntimeView>('llm')
  const [worldSnap, setWorldSnap] = useState<WorldSnapshot | null>(null)
  const [worldError, setWorldError] = useState('')

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.debug) return
    try {
      if (debugTab === 'prompt') {
        setPromptInfo(await window.electronAPI.debug.systemPrompt())
      } else if (debugTab === 'world') {
        setWorldError('')
        setWorldSnap(await window.electronAPI.debug.worldSnapshot())
      } else if (debugTab === 'system') {
        const [nextSystemInfo, nextTools] = await Promise.all([
          window.electronAPI.debug.systemInfo(),
          window.electronAPI.debug.tools(),
        ])
        setSystemInfo(nextSystemInfo)
        setTools(nextTools)
      } else if (debugTab === 'request-runtime' && requestRuntimeView === 'traces') {
        const data = await window.electronAPI.debug.traces()
        setTraces({
          spans: data.spans ?? [],
          callerStats: (data.callerStats ?? {}) as Record<string, CallerStat>,
          tokenLanes: data.tokenLanes,
          dailyTokenUsage: typeof data.dailyTokenUsage === 'number' ? data.dailyTokenUsage : undefined,
        })
      }
    } catch (e) {
      if (debugTab === 'world') {
        setWorldError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [debugTab, requestRuntimeView])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <div className="flex h-full min-h-0" data-testid="dev-panel" data-surface="debug">
      <nav
        className="flex w-[156px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-2 py-3"
        style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        aria-label="Debug 分区"
      >
        <button
          type="button"
          onClick={onClose}
          className="mb-2 flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] transition"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
          title="返回聊天"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          返回
        </button>
        <div className="mb-1 flex items-center justify-between gap-1 px-2.5 pb-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Bug size={13} style={{ color: 'var(--success)' }} />
            Debug
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded p-1 transition"
            style={{ color: 'var(--text-muted)' }}
            title="刷新"
          >
            <RotateCcw size={12} />
          </button>
        </div>
        {DEBUG_TABS.map(t => {
          const active = debugTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setDebugTab(t.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition"
              style={{
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                background: active ? 'var(--sidebar-active)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ color: active ? 'var(--success)' : 'var(--text-muted)' }}>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
        {debugTab === 'prompt' && (
          <PromptManagerPanel info={promptInfo} onRefresh={() => refresh()} />
        )}
        {debugTab === 'request-runtime' && (
          <RequestRuntimePanel
            view={requestRuntimeView}
            setView={setRequestRuntimeView}
            traces={traces}
            events={eventLog}
          />
        )}
        {debugTab === 'world' && (
          <WorldStatePanel snap={worldSnap} error={worldError} />
        )}
        {debugTab === 'eval' && (
          <div className="mx-auto max-w-5xl space-y-4">
            <SkillEvalPanel />
            <PersonaEvalPanel />
          </div>
        )}
        {debugTab === 'system' && <SystemTab info={systemInfo} tools={tools} />}
      </div>
    </div>
  )
}

function SystemTab({ info, tools }: { info: SystemInfo | null; tools: DebugToolInfo[] }) {
  if (!info) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

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
        ['对话 Debug', info.settings.conversationDebugMode ? '开' : '关'],
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
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="工具数" value={String(info.toolCount)} color="cyan" />
        <StatCard label="Skills" value={String(skills?.total ?? 0)} color="violet" />
        <StatCard label="权限规则" value={String(rules?.enabled ?? 0)} color="emerald" />
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
  const colorMap: Record<string, string> = {
    cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-400',
    violet: 'border-violet-500/30 bg-violet-500/5 text-violet-400',
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  }
  return (
    <div className={`rounded-lg border p-3 text-center ${colorMap[color] || colorMap.cyan}`}>
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

/** 请求与运行共享一个诊断域；LLM 请求、调用链和事件只是三种观察粒度。 */
function RequestRuntimePanel({
  view,
  setView,
  traces,
  events,
}: {
  view: RequestRuntimeView
  setView: (view: RequestRuntimeView) => void
  traces: TracesPayload | null
  events: Array<{ time: number; type: string; detail: string }>
}) {
  const views: Array<{ id: RequestRuntimeView; label: string; icon: ReactNode }> = [
    { id: 'llm', label: 'LLM 调用', icon: <Activity size={13} /> },
    { id: 'traces', label: '调用链', icon: <Zap size={13} /> },
    { id: 'events', label: '实时事件', icon: <ClipboardList size={13} /> },
  ]
  return (
    <div className="space-y-4" data-testid="request-runtime-panel">
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>请求与运行</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>从单次模型请求到整轮 Agent Loop，统一查看真实执行链路。</p>
      </div>
      <div className="flex flex-wrap gap-1 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
        {views.map((item) => {
          const active = view === item.id
          return (
            <button key={item.id} type="button" onClick={() => setView(item.id)} className="inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium" style={{ color: active ? 'var(--accent-fg)' : 'var(--text-muted)', background: active ? 'var(--accent-subtle)' : 'transparent' }}>
              {item.icon}{item.label}
            </button>
          )
        })}
      </div>
      {view === 'llm' && <LLMCallsPanel />}
      {view === 'traces' && <TracesTab data={traces} />}
      {view === 'events' && <EventsTab events={events} />}
    </div>
  )
}

function TracesTab({ data }: { data: TracesPayload | null }) {
  if (!data) {
    return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中…</div>
  }

  const spans = data.spans
  const callers = Object.entries(data.callerStats || {})
  const fg = data.tokenLanes?.foreground
  const bg = data.tokenLanes?.background

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
          className="flex items-center gap-2 rounded px-2 py-1 font-mono text-[11px]"
          style={{ paddingLeft: 8 + depth * 14, color: 'var(--text-secondary)' }}
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
        </div>
        {children.map(c => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
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
    <div>
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
            <span className="truncate" style={{ color: ev.type === 'compact' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{ev.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
