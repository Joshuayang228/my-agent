import { useState, useEffect, useCallback } from 'react'

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

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'prompt', label: 'System Prompt', icon: '📝' },
  { id: 'tools', label: '工具注册表', icon: '🔧' },
  { id: 'system', label: '系统状态', icon: '📊' },
  { id: 'events', label: '事件日志', icon: '📋' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-emerald-400">⚡ Developer Panel</span>
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">DEBUG</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              ↻ 刷新
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/50 px-5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition ${
                tab === t.id
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
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
    </div>
  )
}

function PromptTab({ info, layer, setLayer }: {
  info: PromptInfo | null
  layer: string
  setLayer: (l: 'full' | 'l1' | 'l2' | 'l3' | 'l4') => void
}) {
  if (!info) return <div className="text-sm text-slate-500">加载中... (需要 Electron 环境)</div>

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
        <span className="text-xs text-slate-400">当前人格：</span>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-400">
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
                : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            <div className={`text-[11px] font-medium ${layer === l.id ? 'text-emerald-400' : 'text-slate-300'}`}>
              {l.label}
            </div>
            <div className="text-[10px] text-slate-500">{l.desc}</div>
          </button>
        ))}
      </div>

      <pre className="max-h-[50vh] overflow-auto rounded-lg border border-slate-700/60 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
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
  if (tools.length === 0) return <div className="text-sm text-slate-500">加载中...</div>

  const builtins = tools.filter(t => !t.name.startsWith('mcp:'))
  const mcpTools = tools.filter(t => t.name.startsWith('mcp:'))

  return (
    <div>
      <div className="mb-3 text-xs text-slate-400">
        共 {tools.length} 个工具（{builtins.length} 内置 + {mcpTools.length} MCP）
      </div>

      {[
        { label: '内置工具', items: builtins },
        ...(mcpTools.length > 0 ? [{ label: 'MCP 工具', items: mcpTools }] : []),
      ].map(group => (
        <div key={group.label} className="mb-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{group.label}</div>
          <div className="space-y-1">
            {group.items.map(tool => (
              <div key={tool.name} className="rounded-lg border border-slate-700/60 bg-slate-800/40">
                <button
                  onClick={() => setExpanded(expanded === tool.name ? null : tool.name)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
                >
                  <span className={`h-2 w-2 rounded-full ${
                    tool.metadata.isDestructive ? 'bg-red-400' :
                    tool.metadata.isReadOnly ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className="flex-1 font-mono text-xs text-slate-200">{tool.name}</span>
                  <div className="flex gap-1">
                    {tool.metadata.isReadOnly && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">只读</span>}
                    {tool.metadata.isDestructive && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400">破坏性</span>}
                    {tool.metadata.isConcurrencySafe && <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-400">并发安全</span>}
                  </div>
                  <span className="text-[10px] text-slate-600">{expanded === tool.name ? '▼' : '▶'}</span>
                </button>
                {expanded === tool.name && (
                  <div className="border-t border-slate-700/40 px-4 py-3">
                    <p className="mb-2 text-xs text-slate-400">{tool.description}</p>
                    <pre className="overflow-auto rounded bg-slate-950 p-2 text-[10px] text-slate-500">
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
  if (!info) return <div className="text-sm text-slate-500">加载中...</div>

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
        ['API Key', info.settings.hasApiKey ? '✅ 已配置' : '❌ 未配置'],
        ['自定义 Prompt', info.settings.hasCustomPrompt ? '✅ 有' : '—'],
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
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{section.title}</div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/40">
            {section.items.map(([label, value], i) => (
              <div
                key={label}
                className={`flex justify-between px-4 py-2 text-xs ${
                  i < section.items.length - 1 ? 'border-b border-slate-700/30' : ''
                }`}
              >
                <span className="text-slate-400">{label}</span>
                <span className="font-mono text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {info.mcp.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">MCP 连接</div>
          <div className="space-y-1">
            {info.mcp.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    s.status === 'connected' ? 'bg-emerald-400' :
                    s.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  <span className="text-xs text-slate-200">{s.name}</span>
                </div>
                <span className="text-[10px] text-slate-500">{s.toolCount} tools</span>
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
    return <div className="text-sm text-slate-500">暂无事件。发送消息后会在这里看到实时事件流。</div>
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
      <div className="mb-3 text-xs text-slate-400">共 {events.length} 条事件</div>
      <div className="space-y-0.5 font-mono text-[11px]">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3 rounded px-2 py-1 hover:bg-slate-800/50">
            <span className="shrink-0 text-slate-600">
              {new Date(ev.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`w-20 shrink-0 ${typeColor[ev.type] || 'text-slate-400'}`}>{ev.type}</span>
            <span className="truncate text-slate-400">{ev.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
