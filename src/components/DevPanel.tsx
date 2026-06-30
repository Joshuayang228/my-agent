import { useState, useEffect, useCallback } from 'react'
import { FileText, Wrench, BarChart3, ClipboardList, Zap, RotateCcw, X, CheckCircle, XCircle, ChevronRight } from 'lucide-react'

type Tab = 'prompt' | 'tools' | 'system' | 'events'

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
  settings: { model: string; baseUrl: string; personaId: string; hasApiKey: boolean; hasCustomPrompt: boolean }
  mcp: Array<{ id: string; name: string; status: string; toolCount: number; error?: string }>
  toolCount: number
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

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'prompt', label: 'System Prompt', icon: <FileText size={12} /> },
  { id: 'tools', label: '工具注册表', icon: <Wrench size={12} /> },
  { id: 'system', label: '系统状态', icon: <BarChart3 size={12} /> },
  { id: 'events', label: '事件日志', icon: <ClipboardList size={12} /> },
]

interface DevPanelProps {
  onClose: () => void
  eventLog: Array<{ time: number; type: string; detail: string }>
}

export function DevPanel({ onClose, eventLog }: DevPanelProps) {
  const [tab, setTab] = useState<Tab>('prompt')
  const [promptInfo, setPromptInfo] = useState<PromptInfo | null>(null)
  const [tools, setTools] = useState<ToolInfo[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [expandedTool, setExpandedTool] = useState<string | null>(null)
  const [promptLayer, setPromptLayer] = useState<'full' | 'l1' | 'l2' | 'l3' | 'l4'>('full')

  const refresh = useCallback(async () => {
    if (!window.electronAPI?.debug) return
    try {
      if (tab === 'prompt') {
        const info = await window.electronAPI.debug.systemPrompt()
        setPromptInfo(info)
      } else if (tab === 'tools') {
        const list = await window.electronAPI.debug.tools()
        setTools(list)
      } else if (tab === 'system') {
        const info = await window.electronAPI.debug.systemInfo()
        setSystemInfo(info)
      }
    } catch { /* not in Electron */ }
  }, [tab])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--success)' }}><Zap size={14} /> Dev</span>
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--accent-subtle)', color: 'var(--success)' }}>DEBUG</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="rounded-lg px-2 py-1 text-xs transition"
              style={{ color: 'var(--text-muted)' }}
            >
              <RotateCcw size={12} /> 刷新
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex border-b px-5" style={{ borderColor: 'var(--border-color)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
                tab === t.id
                  ? 'border-emerald-400 text-emerald-500'
                  : 'border-transparent'
              }`}
              style={tab !== t.id ? { color: 'var(--text-muted)' } : undefined}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'prompt' && <PromptTab info={promptInfo} layer={promptLayer} setLayer={setPromptLayer} />}
          {tab === 'tools' && <ToolsTab tools={tools} expanded={expandedTool} setExpanded={setExpandedTool} />}
          {tab === 'system' && <SystemTab info={systemInfo} />}
          {tab === 'events' && <EventsTab events={eventLog} />}
        </div>
    </div>
  )
}

function PromptTab({ info, layer, setLayer }: {
  info: PromptInfo | null
  layer: string
  setLayer: (l: 'full' | 'l1' | 'l2' | 'l3' | 'l4') => void
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
              layer === l.id
                ? 'border-emerald-500 bg-emerald-500/10'
                : ''
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

function ToolsTab({ tools, expanded, setExpanded }: {
  tools: ToolInfo[]
  expanded: string | null
  setExpanded: (name: string | null) => void
}) {
  if (tools.length === 0) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>加载中...</div>

  const builtins = tools.filter(t => !t.name.startsWith('mcp:'))
  const mcpTools = tools.filter(t => t.name.startsWith('mcp:'))

  return (
    <div>
      <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        共 {tools.length} 个工具（{builtins.length} 内置 + {mcpTools.length} MCP）
      </div>

      {[
        { label: '内置工具', items: builtins },
        ...(mcpTools.length > 0 ? [{ label: 'MCP 工具', items: mcpTools }] : []),
      ].map(group => (
        <div key={group.label} className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group.label}</div>
          <div className="space-y-1">
            {group.items.map(tool => (
              <div key={tool.name} className="theme-card rounded-lg border">
                <button
                  onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className={`h-2 w-2 rounded-full ${
                    tool.metadata.isDestructive ? 'bg-red-400' :
                    tool.metadata.isReadOnly ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className="flex-1 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{tool.name}</span>
                  <div className="flex gap-1">
                    {tool.metadata.isReadOnly && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-500">只读</span>}
                    {tool.metadata.isDestructive && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">破坏性</span>}
                    {tool.metadata.isConcurrencySafe && <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-500">并发安全</span>}
                  </div>
                  <ChevronRight size={12} className={`transition-transform ${expanded === tool.name ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </button>
                {expanded === tool.name && (
                  <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{tool.description}</p>
                    <pre className="overflow-auto rounded p-2 text-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
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
      title: 'LLM 配置',
      items: [
        ['模型', info.settings.model],
        ['Base URL', info.settings.baseUrl],
        ['人格', info.settings.personaId],
        ['API Key', info.settings.hasApiKey ? '已配置' : '未配置'],
        ['自定义 Prompt', info.settings.hasCustomPrompt ? '有' : '—'],
      ],
    },
  ]

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="工具数" value={String(info.toolCount)} color="cyan" />
        <StatCard label="MCP 服务器" value={String(info.mcp.length)} color="violet" />
        <StatCard label="运行时间" value={formatUptime(info.uptime)} color="emerald" />
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
  }

  return (
    <div>
      <div className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>共 {events.length} 条事件</div>
      <div className="space-y-0.5 font-mono text-[11px]">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 rounded px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {new Date(ev.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`w-20 shrink-0 ${typeColor[ev.type] || ''}`} style={!typeColor[ev.type] ? { color: 'var(--text-muted)' } : undefined}>{ev.type}</span>
            <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{ev.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
