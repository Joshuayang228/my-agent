import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  FileText, Wrench, BarChart3, ClipboardList, Zap, RotateCcw, X,
  FlaskConical, Bug, Play, Globe, Palette, LayoutTemplate, AlertTriangle,
} from 'lucide-react'

type Surface = 'debug' | 'playground'
type DebugTab = 'prompt' | 'world' | 'system' | 'traces' | 'events'
type PlayTab = 'prompt-lab' | 'tool-run' | 'tokens' | 'fixtures'

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

interface ToolInfo {
  name: string
  description: string
  parameters: Record<string, unknown>
  metadata: { isReadOnly: boolean; isDestructive: boolean; isConcurrencySafe: boolean }
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

const PLAY_TABS: { id: PlayTab; label: string; icon: React.ReactNode }[] = [
  { id: 'prompt-lab', label: 'Prompt 试验', icon: <FlaskConical size={12} /> },
  { id: 'tool-run', label: '工具手测', icon: <Wrench size={12} /> },
  { id: 'tokens', label: '设计 token', icon: <Palette size={12} /> },
  { id: 'fixtures', label: '体验夹具', icon: <LayoutTemplate size={12} /> },
]

interface DevPanelProps {
  /** 由侧栏独立入口决定，不再在页内二选一嵌套 */
  surface: Surface
  onClose: () => void
  eventLog: Array<{ time: number; type: string; detail: string }>
  /** 弱链跳到另一独立页（可选） */
  onOpenSibling?: (surface: Surface) => void
}

export function DevPanel({ surface, onClose, eventLog, onOpenSibling }: DevPanelProps) {
  const [debugTab, setDebugTab] = useState<DebugTab>('prompt')
  const [playTab, setPlayTab] = useState<PlayTab>('prompt-lab')
  const [promptInfo, setPromptInfo] = useState<PromptInfo | null>(null)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [promptLayer, setPromptLayer] = useState<'full' | 'l1' | 'l2' | 'l3' | 'l4'>('full')
  const [traces, setTraces] = useState<TracesPayload | null>(null)
  const [worldSnap, setWorldSnap] = useState<WorldSnapshot | null>(null)
  const [worldError, setWorldError] = useState('')

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.debug) return
    try {
      if (surface === 'debug') {
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
      } else if (playTab === 'tool-run') {
        setTools(await window.electronAPI.debug.tools())
      }
    } catch (e) {
      if (debugTab === 'world') {
        setWorldError(e instanceof Error ? e.message : String(e))
      }
    }
  }, [surface, debugTab, playTab])

  useEffect(() => { void refresh() }, [refresh])

  const tabs = surface === 'debug' ? DEBUG_TABS : PLAY_TABS
  const activeTab = surface === 'debug' ? debugTab : playTab
  const title = surface === 'debug' ? 'Debug' : 'Playground'
  const TitleIcon = surface === 'debug' ? Bug : Play

  return (
    <div className="flex h-full flex-col" data-testid="dev-panel" data-surface={surface}>
      <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              <TitleIcon size={16} style={{ color: 'var(--success)' }} />
              {title}
            </span>
            {onOpenSibling && (
              <button
                type="button"
                className="text-[11px] underline-offset-2 hover:underline"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => onOpenSibling(surface === 'debug' ? 'playground' : 'debug')}
              >
                {surface === 'debug' ? '去 Playground' : '去 Debug'}
              </button>
            )}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {surface === 'debug'
              ? '只读透视：生产实装、世界态与运行痕迹。'
              : '安全试验：Prompt 覆盖、工具手测、设计 token（不写全局设置）。'}
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

      <div className="flex border-b px-5" style={{ borderColor: 'var(--border-color)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => {
              if (surface === 'debug') setDebugTab(t.id as DebugTab)
              else setPlayTab(t.id as PlayTab)
            }}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
              activeTab === t.id ? 'border-emerald-400 text-emerald-500' : 'border-transparent'
            }`}
            style={activeTab !== t.id ? { color: 'var(--text-muted)' } : undefined}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {surface === 'debug' && debugTab === 'prompt' && (
          <PromptTab info={promptInfo} layer={promptLayer} setLayer={setPromptLayer} readonly />
        )}
        {surface === 'debug' && debugTab === 'world' && (
          <WorldTab snap={worldSnap} error={worldError} />
        )}
        {surface === 'debug' && debugTab === 'system' && <SystemTab info={systemInfo} />}
        {surface === 'debug' && debugTab === 'traces' && <TracesTab data={traces} />}
        {surface === 'debug' && debugTab === 'events' && <EventsTab events={eventLog} />}
        {surface === 'playground' && playTab === 'prompt-lab' && (
          <PromptLabTab onLoadedProduction={setPromptInfo} />
        )}
        {surface === 'playground' && playTab === 'tool-run' && <ToolRunTab tools={tools} />}
        {surface === 'playground' && playTab === 'tokens' && <TokensTab />}
        {surface === 'playground' && playTab === 'fixtures' && <FixturesTab />}
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

function PromptLabTab({ onLoadedProduction }: { onLoadedProduction: (info: PromptInfo) => void }) {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('用一句话解释什么是 KV Cache。')
  const [running, setRunning] = useState(false)
  const [loadingProd, setLoadingProd] = useState(false)
  const [result, setResult] = useState<{ text: string; ms: number; model: string } | null>(null)
  const [error, setError] = useState('')

  const loadProduction = async () => {
    if (!window.electronAPI?.debug) {
      setError('需要 Electron 环境')
      return
    }
    setLoadingProd(true)
    setError('')
    try {
      const info = await window.electronAPI.debug.systemPrompt()
      onLoadedProduction(info)
      setSystemPrompt(info.full || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingProd(false)
    }
  }

  const run = async () => {
    if (!window.electronAPI?.debug?.playgroundRun) {
      setError('需要 Electron 环境')
      return
    }
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const r = await window.electronAPI.debug.playgroundRun({
        systemPrompt: systemPrompt.trim() || undefined,
        userPrompt,
      })
      if (r.ok) setResult({ text: r.text, ms: r.ms, model: r.model })
      else setError(r.error)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="prompt-lab">
      <p className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
        会话级覆盖：下方 System 仅用于本次试跑，<strong style={{ color: 'var(--text-primary)' }}>不会写入设置</strong>。
        可先「载入当前实装」再改。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loadingProd}
          onClick={() => void loadProduction()}
          className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {loadingProd ? '载入中…' : '载入当前实装'}
        </button>
        <button
          type="button"
          onClick={() => setSystemPrompt('')}
          className="settings-option px-3 py-1.5 text-xs"
        >
          清空 System（用默认试验指令）
        </button>
      </div>
      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        System（会话覆盖）
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
          placeholder="空 = 使用默认 playground 指令；不写全局 settings"
        />
      </label>
      <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
        User
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={3}
          className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
        />
      </label>
      <button
        type="button"
        disabled={running || !userPrompt.trim()}
        onClick={() => void run()}
        className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {running ? '运行中…' : '试跑（单轮 · 无工具）'}
      </button>
      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          {error}
        </p>
      )}
      {result && (
        <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-color)' }}>
          <div className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {result.model} · {result.ms}ms
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
            {result.text}
          </pre>
        </div>
      )}
    </div>
  )
}

function ToolRunTab({ tools }: { tools: ToolInfo[] }) {
  const [name, setName] = useState('')
  const [argsJson, setArgsJson] = useState('{\n  \n}')
  const [confirmRisk, setConfirmRisk] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [meta, setMeta] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!name && tools.length > 0) {
      const first = tools.find(t => !t.name.startsWith('mcp:')) ?? tools[0]
      setName(first.name)
      setArgsJson(`${JSON.stringify(exampleArgs(first), null, 2)}\n`)
    }
  }, [tools, name])

  const selected = tools.find(t => t.name === name)

  const onPick = (n: string) => {
    setName(n)
    const t = tools.find(x => x.name === n)
    if (t) setArgsJson(`${JSON.stringify(exampleArgs(t), null, 2)}\n`)
    setConfirmRisk(false)
    setError('')
    setOutput('')
    setMeta('')
  }

  const run = async () => {
    if (!window.electronAPI?.debug?.toolRun) {
      setError('需要 Electron 环境')
      return
    }
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(argsJson || '{}') as Record<string, unknown>
    } catch {
      setError('参数不是合法 JSON')
      return
    }
    setRunning(true)
    setError('')
    setOutput('')
    setMeta('')
    try {
      const r = await window.electronAPI.debug.toolRun({
        name,
        args,
        confirmRisk,
      })
      if (r.ok) {
        setOutput(r.content)
        setMeta(`${r.ms}ms · chain=${r.permission.chain} · ${r.permission.reason}${r.isError ? ' · tool reported error' : ''}`)
      } else if (r.needsConfirmation) {
        setError(`需要确认风险：${r.error}（勾选下方确认后再执行）`)
        setMeta(r.permission ? `chain=${r.permission.chain}` : '')
      } else {
        setError(r.error)
        setMeta(r.permission ? `chain=${r.permission.chain}` : '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3" data-testid="tool-run">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        真实走 Registry + 权限引擎。硬拒绝不可绕过；破坏性 / 需审批工具必须勾选确认。
      </p>
      {tools.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载工具列表中…</div>
      ) : (
        <>
          <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            工具
            <select
              value={name}
              onChange={(e) => onPick(e.target.value)}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
            >
              {tools.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {selected.description}
              {selected.metadata.isDestructive && (
                <span className="ml-2 text-red-400">破坏性</span>
              )}
            </p>
          )}
          <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
            参数 JSON
            <textarea
              value={argsJson}
              onChange={(e) => setArgsJson(e.target.value)}
              rows={8}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={confirmRisk}
              onChange={(e) => setConfirmRisk(e.target.checked)}
            />
            我了解风险，确认执行（破坏性 / 需审批时必选）
          </label>
          <button
            type="button"
            disabled={running || !name}
            onClick={() => void run()}
            className="settings-option px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {running ? '执行中…' : '执行工具'}
          </button>
        </>
      )}
      {error && (
        <p className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--danger, #c44)', color: 'var(--danger, #c44)' }}>
          {error}
        </p>
      )}
      {meta && (
        <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{meta}</p>
      )}
      {output && (
        <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
          {output}
        </pre>
      )}
    </div>
  )
}

/** Playground：当前主题下的设计 token + 基础控件样例（M32-G5） */
function TokensTab() {
  const [tick, setTick] = useState(0)
  const read = (name: string) => {
    void tick
    if (typeof document === 'undefined') return ''
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  }

  const colors = [
    ['--bg-primary', '结构 · 主底'],
    ['--bg-secondary', '结构 · 次底'],
    ['--bg-tertiary', '结构 · 三级'],
    ['--bg-inset', '结构 · 内凹'],
    ['--text-primary', '文本 · 主'],
    ['--text-secondary', '文本 · 次'],
    ['--text-muted', '文本 · 弱'],
    ['--accent-emphasis', '强调 · 实色'],
    ['--accent-fg', '强调 · 前景'],
    ['--accent-subtle', '强调 · 浅底'],
    ['--border-color', '边框'],
    ['--success', '语义 · 成功'],
    ['--danger', '语义 · 危险'],
  ] as const

  const radii = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl'] as const
  const motions = ['--motion-fast', '--motion-normal', '--motion-slow'] as const

  return (
    <div className="space-y-5" data-testid="tokens-lab">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        读取当前主题的 CSS 变量（人眼回归场）。规范见 <code className="font-mono">agent-skills/frontend-guidelines.md</code>。
        不是完整 Storybook。
      </p>
      <button
        type="button"
        className="settings-option px-3 py-1.5 text-xs"
        onClick={() => setTick(t => t + 1)}
      >
        重新读取 token
      </button>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          颜色
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {colors.map(([name, label]) => {
            const val = read(name)
            return (
              <div
                key={name}
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <div className="h-10" style={{ background: `var(${name})` }} />
                <div className="space-y-0.5 px-2 py-1.5">
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  <div className="truncate font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{val || '—'}</div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          圆角 / 动效
        </h3>
        <div className="flex flex-wrap gap-3">
          {radii.map(name => (
            <div key={name} className="text-center">
              <div
                className="mx-auto mb-1 h-12 w-12 border"
                style={{
                  borderColor: 'var(--accent-fg)',
                  background: 'var(--accent-subtle)',
                  borderRadius: `var(${name})`,
                }}
              />
              <div className="font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{name}</div>
              <div className="font-mono text-[9px]" style={{ color: 'var(--text-secondary)' }}>{read(name) || '—'}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
          {motions.map(name => (
            <span key={name}>{name} = {read(name) || '—'}</span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          基础控件（现有 class）
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="settings-option px-3 py-1.5 text-xs">主要按钮</button>
          <button
            type="button"
            className="rounded-lg border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            次要
          </button>
          <input
            className="theme-input w-40 rounded-lg border px-2 py-1.5 text-xs outline-none"
            placeholder="theme-input"
            defaultValue=""
          />
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px]"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
          >
            chip
          </span>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          禁止左侧 accent 竖线贴标签；层级用底色 / 字重 / 留白。
        </p>
      </section>
    </div>
  )
}

/**
 * Playground 体验夹具（M32-G6 精简）：只放会反复回归的 空态 / 错误 / 权限确认。
 * 不是完整 Storybook；视觉用现有 CSS token，不另造组件库。
 */
function FixturesTab() {
  return (
    <div className="space-y-5" data-testid="fixtures-lab">
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        P0 体验回归夹具。改主题 / 文案时来这里扫一眼；不复制 Alice 错误卡博物馆。
      </p>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          空态
        </h3>
        <div
          className="flex flex-col items-center rounded-xl border px-6 py-10 text-center"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>还没有话题</p>
          <p className="mt-1 max-w-xs text-[12px]" style={{ color: 'var(--text-muted)' }}>
            打个招呼，或从侧栏开一个新会话。伙伴在这儿等你。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['今天怎么样？', '帮我理一下待办', '随便聊聊'].map((t) => (
              <span
                key={t}
                className="rounded-full px-3 py-1 text-[11px]"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          错误卡（常用 3 态）
        </h3>
        <div className="space-y-2">
          <FixtureError
            title="未配置 API Key"
            body="请在设置 → 模型里填写密钥后再试。"
            action="打开设置"
          />
          <FixtureError
            title="操作被权限策略拒绝"
            body="可以切换审批模式，或让 Agent 换更安全的替代方案。"
            action="查看权限"
          />
          <FixtureError
            title="请求暂时失败"
            body="可能是限流或上游抖动。稍后再试，或检查网络 / Base URL。"
            action="重试"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          权限确认（静态样例）
        </h3>
        <div
          className="mx-auto max-w-md rounded-lg border p-5 shadow-2xl"
          style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
        >
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--warning)' }}>
            <AlertTriangle size={14} /> 操作确认
          </h4>
          <p className="mb-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>AI 请求执行以下操作：</p>
          <div className="mb-4 rounded-md border px-3 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
            <div className="font-mono text-[13px]" style={{ color: 'var(--accent)' }}>shell_exec</div>
            <pre className="mt-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {JSON.stringify({ command: 'rm -rf ./tmp' }, null, 2)}
            </pre>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            >
              拒绝
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
              style={{ background: 'var(--warning)' }}
            >
              允许执行
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function FixtureError({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border-color))', background: 'var(--bg-secondary)' }}
    >
      <div className="text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{title}</div>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <button
        type="button"
        className="mt-2 rounded border px-2 py-0.5 text-[11px]"
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
      >
        {action}
      </button>
    </div>
  )
}

function exampleArgs(tool: ToolInfo): Record<string, unknown> {
  const props = (tool.parameters?.properties ?? {}) as Record<string, { type?: string }>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (v?.type === 'string') out[k] = ''
    else if (v?.type === 'number' || v?.type === 'integer') out[k] = 0
    else if (v?.type === 'boolean') out[k] = false
    else if (v?.type === 'array') out[k] = []
    else if (v?.type === 'object') out[k] = {}
    else out[k] = null
  }
  return out
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
          生产实装（只读）。要改了试跑 → 切到 Playground「Prompt 试验」。
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
