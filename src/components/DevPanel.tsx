import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  FileText, BarChart3, ClipboardList, Zap, RotateCcw, X,
  Bug, Globe,
} from 'lucide-react'

type DebugTab = 'prompt' | 'world' | 'system' | 'traces' | 'events'

interface WorldSnapshot {
  role: { id: string; name: string; description: string; universeId: string }
  mutable: {
    body: string
    truncated: boolean
    version: number | null
    updatedAt: number | null
    source: 'override' | 'pack-default'
  }
  world: { home: string; timezone: string; situation: string; updatedAt: number } | null
  life: {
    pausedAt: number | null
    lastTickAt: number
    catchupSummary: string
    catchupTruncated: boolean
  } | null
  dayScript: {
    date: string
    id: string
    theme: string
    slots: Array<{
      hour: number
      minute: number
      type: string
      activity: string
      mood: string
      location: string
    }>
    slotsTruncated: boolean
  } | null
  moments: Array<{ id: string; publishedAt: number; text: string }>
  momentsTruncated: boolean
  profile: { identity: string; workflow: string; voice: string } | null
  memories: Array<{ id: string; category: string; content: string; updatedAt: number }>
  memoriesTruncated: boolean
  generatedAt: number
}

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

interface PromptInfo {
  full: string
  layers: { l1: string; l2: string; l3: string; l4: string }
  persona: { id: string; name: string }
  charCount: number
  estimatedTokens: number
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

const DEBUG_TABS: { id: DebugTab; label: string; icon: React.ReactNode }[] = [
  { id: 'prompt', label: 'Prompt 实装', icon: <FileText size={12} /> },
  { id: 'world', label: '世界态', icon: <Globe size={12} /> },
  { id: 'system', label: '系统', icon: <BarChart3 size={12} /> },
  { id: 'traces', label: '调用链', icon: <Zap size={12} /> },
  { id: 'events', label: '事件', icon: <ClipboardList size={12} /> },
]

interface DevPanelProps {
  onClose: () => void
  eventLog: Array<{ time: number; type: string; detail: string }>
}

/** Debug 独立全页（与 Playground 分离，不再共用 surface 双页壳） */
export function DevPanel({ onClose, eventLog }: DevPanelProps) {
  const [debugTab, setDebugTab] = useState<DebugTab>('prompt')
  const [promptInfo, setPromptInfo] = useState<PromptInfo | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [promptLayer, setPromptLayer] = useState<'full' | 'l1' | 'l2' | 'l3' | 'l4'>('full')
  const [traces, setTraces] = useState<TracesPayload | null>(null)
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
        setSystemInfo(await window.electronAPI.debug.systemInfo())
      } else if (debugTab === 'traces') {
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
  }, [debugTab])

  useEffect(() => { void refresh() }, [refresh])

  return (
    <div className="flex h-full flex-col" data-testid="dev-panel" data-surface="debug">
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            <Bug size={16} style={{ color: 'var(--success)' }} />
            Debug
          </span>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            只读透视：生产实装、世界态与运行痕迹。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => void refresh()} className="rounded-lg px-2 py-1 text-xs transition" style={{ color: 'var(--text-muted)' }}>
            <RotateCcw size={12} /> 刷新
          </button>
          <button onClick={onClose} className="rounded-lg p-1.5 transition" style={{ color: 'var(--text-muted)' }} title="返回聊天">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-[156px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-2 py-3"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
          aria-label="Debug 分区"
        >
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
            <PromptTab info={promptInfo} layer={promptLayer} setLayer={setPromptLayer} readonly />
          )}
          {debugTab === 'world' && (
            <WorldTab snap={worldSnap} error={worldError} />
          )}
          {debugTab === 'system' && <SystemTab info={systemInfo} />}
          {debugTab === 'traces' && <TracesTab data={traces} />}
          {debugTab === 'events' && <EventsTab events={eventLog} />}
        </div>
      </div>
    </div>
  )
}

function WorldTab({ snap, error }: { snap: WorldSnapshot | null; error: string }) {
  if (error) {
    return <p className="text-xs" style={{ color: 'var(--danger, #c44)' }}>{error}</p>
  }
  if (!snap) {
    return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中…（需要 Electron）</div>
  }

  const fmt = (ms: number) =>
    ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '—'

  return (
    <div className="space-y-4" data-testid="world-snapshot">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        只读透视：它以为自己是谁、在哪、今天剧本与近记忆。已截断长字段；不含 API Key。
        <span className="ml-2 font-mono">@{fmt(snap.generatedAt)}</span>
      </p>

      <Section title="活跃主角">
        <KV label="id" value={snap.role.id} mono />
        <KV label="name" value={snap.role.name} />
        <KV label="universe" value={snap.role.universeId} mono />
        <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{snap.role.description}</p>
      </Section>

      <Section title={`MUTABLE（${snap.mutable.source}${snap.mutable.version != null ? ` · v${snap.mutable.version}` : ''}）`}>
        {snap.mutable.truncated && (
          <p className="mb-1 text-[10px] text-amber-500">正文已截断</p>
        )}
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
          {snap.mutable.body || '（空）'}
        </pre>
      </Section>

      <Section title="世界薄片">
        {!snap.world ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>尚无 role_state</p>
        ) : (
          <>
            <KV label="home" value={snap.world.home} />
            <KV label="timezone" value={snap.world.timezone} mono />
            <KV label="situation" value={snap.world.situation || '—'} />
            <KV label="updated" value={fmt(snap.world.updatedAt)} mono />
          </>
        )}
      </Section>

      <Section title="生活引擎">
        {!snap.life ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>—</p>
        ) : (
          <>
            <KV label="pausedAt" value={snap.life.pausedAt ? fmt(snap.life.pausedAt) : '（活跃）'} mono />
            <KV label="lastTickAt" value={fmt(snap.life.lastTickAt)} mono />
            {snap.life.catchupTruncated && (
              <p className="mb-1 text-[10px] text-amber-500">catchup 已截断</p>
            )}
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded border p-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
              {snap.life.catchupSummary || '（无 catchup）'}
            </pre>
          </>
        )}
      </Section>

      <Section title={`今日剧本${snap.dayScript ? ` · ${snap.dayScript.date}` : ''}`}>
        {!snap.dayScript ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>今日尚无 day_script</p>
        ) : (
          <>
            <KV label="theme" value={snap.dayScript.theme || '—'} />
            {snap.dayScript.slotsTruncated && (
              <p className="mb-1 text-[10px] text-amber-500">槽位已截断</p>
            )}
            <div className="space-y-1">
              {snap.dayScript.slots.map((s, i) => (
                <div key={i} className="rounded border px-2 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}
                  </span>
                  {' '}
                  <span style={{ color: 'var(--text-primary)' }}>{s.activity}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {s.mood} · {s.location} · {s.type}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title={`近 Moments${snap.momentsTruncated ? '（已截断）' : ''}`}>
        {snap.moments.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无</p>
        ) : (
          <div className="space-y-1">
            {snap.moments.map((m) => (
              <div key={m.id} className="rounded border px-2 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmt(m.publishedAt)}</div>
                <div style={{ color: 'var(--text-secondary)' }}>{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="用户画像（L3）">
        {!snap.profile ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>无画像</p>
        ) : (
          <>
            <KV label="identity" value={snap.profile.identity || '—'} />
            <KV label="workflow" value={snap.profile.workflow || '—'} />
            <KV label="voice" value={snap.profile.voice || '—'} />
          </>
        )}
      </Section>

      <Section title={`近记忆${snap.memoriesTruncated ? '（已截断）' : ''}`}>
        {snap.memories.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>暂无</p>
        ) : (
          <div className="space-y-1">
            {snap.memories.map((m) => (
              <div key={m.id} className="flex gap-2 rounded border px-2 py-1 text-[11px]" style={{ borderColor: 'var(--border-color)' }}>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.category}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.content}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div className="theme-card rounded-lg border p-3" style={{ borderColor: 'var(--border-color)' }}>
        {children}
      </div>
    </div>
  )
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs leading-relaxed">
      <span className="w-20 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={mono ? 'font-mono break-all' : 'break-words'} style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function PromptTab({ info, layer, setLayer, readonly }: {
  info: PromptInfo | null
  layer: string
  setLayer: (l: 'full' | 'l1' | 'l2' | 'l3' | 'l4') => void
  readonly?: boolean
}) {
  if (!info) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中... (需要 Electron 环境)</div>

  const layers = [
    { id: 'full' as const, label: '完整 Prompt', desc: `${info.charCount} chars / ~${info.estimatedTokens} tokens` },
    { id: 'l1' as const, label: 'L1 人格定义', desc: '[PROTECTED] + [MUTABLE]' },
    { id: 'l2' as const, label: 'L2 能力边界', desc: '工具列表、行为规范' },
    { id: 'l3' as const, label: 'L3 上下文注入', desc: '画像、记忆、自定义指令' },
    { id: 'l4' as const, label: 'L4 动态', desc: '当前时间' },
  ]

  const content = layer === 'full' ? info.full : info.layers[layer as keyof typeof info.layers] || ''

  return (
    <div>
      {readonly && (
        <p className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          生产实装（只读）。要改了试跑 → 切到 Playground「对话试验」。
        </p>
      )}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>当前人格：</span>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-500">
          {info.persona.name}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {layers.map(l => (
          <button
            key={l.id}
            onClick={() => setLayer(l.id)}
            className={`rounded-lg border px-3 py-1.5 text-left transition ${
              layer === l.id ? 'border-emerald-500 bg-emerald-500/10' : ''
            }`}
            style={layer !== l.id ? { borderColor: 'var(--border-color)' } : undefined}
          >
            <div className="text-[11px] font-medium" style={{ color: layer === l.id ? '#34d399' : 'var(--text-primary)' }}>
              {l.label}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{l.desc}</div>
          </button>
        ))}
      </div>

      <pre className="max-h-[50vh] overflow-auto rounded-lg border p-4 text-xs leading-relaxed" style={{ borderColor: 'var(--card-border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
        {content}
      </pre>
    </div>
  )
}

function SystemTab({ info }: { info: SystemInfo | null }) {
  if (!info) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

  const sections = [
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
    {
      title: '运行时策略',
      items: [
        ['沙箱', info.settings.sandboxMode || '—'],
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
    <div className={`rounded-xl border p-3 text-center ${colorMap[color] || colorMap.cyan}`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] opacity-70">{label}</div>
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
