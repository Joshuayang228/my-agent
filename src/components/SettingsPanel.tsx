import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './Toast'
import {
  Upload, Download, Settings, Shield, Cpu, Plug, Database, Code,
  User, ChevronRight, Eye, EyeOff, Info,
} from 'lucide-react'

interface SettingsForm {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  systemPrompt: string
  activeRoleId: string
  sandboxMode: string
  executionMode: string
  auxModel: string
  sessionTokenBudget: string
  dailyTokenBudget: string
  /** PermissionRule[] JSON — 自定义命令/工具规则 */
  permissionRules: string
}

interface McpServerEntry {
  id: string
  name: string
  transport?: 'stdio' | 'sse'
  command: string
  args: string[]
  env?: Record<string, string>
  url?: string
  enabled: boolean
}

interface McpServerStatus {
  id: string
  name: string
  status: string
  toolCount: number
  error?: string
}

const DEFAULTS: SettingsForm = {
  llmApiKey: '',
  llmBaseUrl: 'https://api.openai.com/v1',
  llmModel: 'gpt-4o',
  llmTemperature: '0.7',
  llmTopP: '1',
  llmMaxTokens: '4096',
  systemPrompt: '',
  activeRoleId: 'lin',
  sandboxMode: 'workspace-write',
  executionMode: 'auto',
  auxModel: '',
  sessionTokenBudget: '0',
  dailyTokenBudget: '0',
  permissionRules: '[]',
}

interface RoleInfo {
  id: string
  name: string
  description: string
}

interface PresetItem { label: string; baseUrl: string; model: string }

const PRESET_GROUPS: { group: string; items: PresetItem[] }[] = [
  {
    group: '海外直连',
    items: [
      { label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
      { label: 'GPT-4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      { label: 'Claude Sonnet', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
    ],
  },
  {
    group: '国内服务商',
    items: [
      { label: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
      { label: 'DeepSeek V4 Flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
      { label: '通义千问 Max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
      { label: 'Kimi K2', baseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2' },
    ],
  },
  {
    group: '本地 / 自定义',
    items: [
      { label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
      { label: 'LM Studio', baseUrl: 'http://localhost:1234/v1', model: 'local-model' },
    ],
  },
]

type SettingsSection = 'general' | 'model' | 'security' | 'mcp' | 'data' | 'developer' | 'about'

const NAV_ITEMS: { group: string; items: { id: SettingsSection; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: '基础',
    items: [
      { id: 'general', label: '通用', icon: <Settings size={15} /> },
      { id: 'model', label: '模型', icon: <Cpu size={15} /> },
      { id: 'security', label: '安全', icon: <Shield size={15} /> },
    ],
  },
  {
    group: '高级',
    items: [
      { id: 'mcp', label: 'MCP', icon: <Plug size={15} /> },
      { id: 'data', label: '数据', icon: <Database size={15} /> },
      { id: 'developer', label: '开发者', icon: <Code size={15} /> },
      { id: 'about', label: '关于', icon: <Info size={15} /> },
    ],
  },
]

const THEMES: { id: string; label: string; desc: string; color: string; isDark: boolean }[] = [
  { id: 'dark', label: '暗夜', desc: 'GitHub 暗色经典', color: '#0d1117', isDark: true },
  { id: 'light', label: '日光', desc: '清亮白色', color: '#ffffff', isDark: false },
  { id: 'mist', label: '薄雾', desc: '半透玻璃，薰衣草', color: '#7c8cf5', isDark: false },
  { id: 'night-feast', label: '夜宴', desc: '深紫护眼', color: '#a855f7', isDark: true },
  { id: 'green-garden', label: '青园', desc: '青绿自然', color: '#059669', isDark: false },
  { id: 'golden', label: '金阁', desc: '香槟轻奢', color: '#b45309', isDark: false },
  { id: 'blue-pool', label: '蓝池', desc: '深邃天蓝', color: '#38bdf8', isDark: true },
]

interface SettingsPanelProps {
  onClose: () => void
  onOpenDevPanel?: () => void
  currentTheme?: string
  onThemeChange?: (themeId: string) => void
}

export function SettingsPanel({ onClose, onOpenDevPanel, currentTheme, onThemeChange }: SettingsPanelProps) {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [protagonists, setProtagonists] = useState<RoleInfo[]>([])
  const [mutableBody, setMutableBody] = useState('')
  const [mutableLoading, setMutableLoading] = useState(false)
  const [mutableSaving, setMutableSaving] = useState(false)
  const [mutableVersions, setMutableVersions] = useState<Array<{
    version: number
    summary: string
    createdAt: number
  }>>([])
  const [reflectionHint, setReflectionHint] = useState('加载中…')
  const [reflectionRunning, setReflectionRunning] = useState(false)
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([])
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([])
  const [mcpAdding, setMcpAdding] = useState(false)
  const [newMcp, setNewMcp] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'sse',
    command: '',
    args: '',
    url: '',
    env: '',
  })

  const refreshMcpStatus = useCallback(async () => {
    if (!window.electronAPI) return
    const statuses = await window.electronAPI.mcp.status()
    setMcpStatuses(statuses)
  }, [])

  const loadMutable = useCallback(async (roleId: string) => {
    if (!window.electronAPI?.companion || !roleId) return
    setMutableLoading(true)
    try {
      const [cur, versions] = await Promise.all([
        window.electronAPI.companion.getMutable(roleId),
        window.electronAPI.companion.listMutableVersions(roleId),
      ])
      setMutableBody(cur.body)
      setMutableVersions(
        versions.map((v) => ({
          version: v.version,
          summary: v.summary,
          createdAt: v.createdAt,
        })),
      )
      if (window.electronAPI.companion.reflectionStatus) {
        const st = await window.electronAPI.companion.reflectionStatus(roleId)
        const g = st.gate
        const last = st.state.lastRunAt
          ? new Date(st.state.lastRunAt).toLocaleString('zh-CN', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
          : '从未'
        setReflectionHint(
          g.allowed
            ? `可反思 · 近7日消息 ${g.recentUserMessages} · 上次 ${last}`
            : `暂不可反思（${g.reason}${g.detail ? `：${g.detail}` : ''}）· 上次 ${last}`,
        )
      }
    } finally {
      setMutableLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.settings.get().then((s) => {
      setForm({
        llmApiKey: s.llmApiKey || '',
        llmBaseUrl: s.llmBaseUrl || DEFAULTS.llmBaseUrl,
        llmModel: s.llmModel || DEFAULTS.llmModel,
        llmTemperature: s.llmTemperature || DEFAULTS.llmTemperature,
        llmTopP: s.llmTopP || DEFAULTS.llmTopP,
        llmMaxTokens: s.llmMaxTokens || DEFAULTS.llmMaxTokens,
        systemPrompt: s.systemPrompt || '',
        activeRoleId: s.activeRoleId || DEFAULTS.activeRoleId,
        sandboxMode: s.sandboxMode || DEFAULTS.sandboxMode,
        executionMode: s.executionMode || DEFAULTS.executionMode,
        auxModel: s.auxModel || '',
        sessionTokenBudget: s.sessionTokenBudget || '0',
        dailyTokenBudget: s.dailyTokenBudget || '0',
        permissionRules: s.permissionRules || DEFAULTS.permissionRules,
      })
      try {
        const servers = JSON.parse(s.mcpServers || '[]')
        setMcpServers(servers)
      } catch { /* ignore */ }
      void loadMutable(s.activeRoleId || DEFAULTS.activeRoleId)
    })
    window.electronAPI.companion.listProtagonists().then(setProtagonists)
    refreshMcpStatus()
  }, [loadMutable, refreshMcpStatus])

  const handleSave = useCallback(async () => {
    if (!window.electronAPI) return
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(form)) {
        // activeRoleId 只能走 companion.requestSwitch（含 pause/catchup）
        if (key === 'activeRoleId') continue
        await window.electronAPI.settings.set(key, value)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [form])

  const initialLoadDone = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(async () => {
      if (!window.electronAPI) return
      try {
        for (const [key, value] of Object.entries(form)) {
          if (key === 'activeRoleId') continue
          await window.electronAPI.settings.set(key, value)
        }
        toast('设置已自动保存', 'success')
      } catch { /* silent */ }
    }, 1500)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [form, toast])

  const applyPreset = useCallback((preset: PresetItem) => {
    setForm((f) => ({ ...f, llmBaseUrl: preset.baseUrl, llmModel: preset.model }))
  }, [])

  const update = (key: keyof SettingsForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const saveMcpList = useCallback(async (servers: McpServerEntry[]) => {
    setMcpServers(servers)
    if (window.electronAPI) {
      await window.electronAPI.settings.set('mcpServers', JSON.stringify(servers))
    }
  }, [])

  const handleAddMcp = useCallback(async () => {
    if (!newMcp.name) return
    if (newMcp.transport === 'sse' ? !newMcp.url.trim() : !newMcp.command) return
    let env: Record<string, string> | undefined
    if (newMcp.env.trim()) {
      env = {}
      for (const line of newMcp.env.split('\n')) {
        const eq = line.indexOf('=')
        if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
      }
    }
    const entry: McpServerEntry = {
      id: `mcp-${Date.now()}`,
      name: newMcp.name,
      transport: newMcp.transport,
      command: newMcp.transport === 'sse' ? '' : newMcp.command,
      args: newMcp.transport === 'sse' ? [] : newMcp.args.split(/\s+/).filter(Boolean),
      url: newMcp.transport === 'sse' ? newMcp.url.trim() : undefined,
      env,
      enabled: true,
    }
    const updated = [...mcpServers, entry]
    await saveMcpList(updated)
    const result = await window.electronAPI?.mcp.connect(entry)
    if (result && !result.success) {
      toast(`MCP 连接失败: ${result.error}`, 'error')
    }
    await refreshMcpStatus()
    setNewMcp({ name: '', transport: 'stdio', command: '', args: '', url: '', env: '' })
    setMcpAdding(false)
  }, [newMcp, mcpServers, saveMcpList, refreshMcpStatus, toast])

  const handleRemoveMcp = useCallback(async (id: string) => {
    await window.electronAPI?.mcp.disconnect(id)
    const updated = mcpServers.filter(s => s.id !== id)
    await saveMcpList(updated)
    await refreshMcpStatus()
  }, [mcpServers, saveMcpList, refreshMcpStatus])

  const handleToggleMcp = useCallback(async (id: string) => {
    const server = mcpServers.find(s => s.id === id)
    if (!server) return
    if (server.enabled) {
      await window.electronAPI?.mcp.disconnect(id)
      const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: false } : s)
      await saveMcpList(updated)
    } else {
      const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: true } : s)
      await saveMcpList(updated)
      await window.electronAPI?.mcp.connect({ ...server, enabled: true })
    }
    await refreshMcpStatus()
  }, [mcpServers, saveMcpList, refreshMcpStatus])

  // ── 各区块渲染 ──

  const renderGeneral = () => (
    <div className="space-y-6">
      <SectionTitle>通用</SectionTitle>

      <FieldGroup label="外观" hint="选择界面主题风格">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))' }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onThemeChange?.(t.id)}
              className="settings-option p-2.5 text-xs"
              data-selected={currentTheme === t.id ? 'true' : undefined}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full border"
                  style={{ background: t.color, borderColor: 'var(--border-color)' }}
                />
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{t.label}</span>
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
            </button>
          ))}
        </div>
      </FieldGroup>

      {protagonists.length > 0 && (
        <FieldGroup label="活跃主角" hint="主入口在「角色架」（欢迎页/状态条）。此处为快捷切换。同宇宙 3 槽；切换=完整换人；流式中禁止；旧会话请新建对话。">
          <div className="flex flex-wrap gap-2">
            {protagonists.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (form.activeRoleId === p.id) return
                  void (async () => {
                    const result = await window.electronAPI?.companion.requestSwitch(p.id)
                    if (!result) return
                    if (result.ok) {
                      update('activeRoleId', p.id)
                      void loadMutable(p.id)
                      toast(
                        result.catchupQueued
                          ? `已切换到${p.name}，正在追赶最近生活…`
                          : `已切换到${p.name}`,
                        'success',
                      )
                      return
                    }
                    if (result.code === 'SESSION_ACTIVE') {
                      toast('对话进行中，请先结束或中断当前回复后再切换主角', 'error')
                      return
                    }
                    if (result.code === 'ALREADY_ACTIVE') {
                      update('activeRoleId', p.id)
                      void loadMutable(p.id)
                      return
                    }
                    if (result.code === 'UNKNOWN_ROLE') {
                      toast('未知主角，无法切换', 'error')
                    }
                  })()
                }}
                className="settings-option px-3 py-2 text-xs"
                data-selected={form.activeRoleId === p.id ? 'true' : undefined}
              >
                <div className="font-medium" style={{ color: form.activeRoleId === p.id ? 'var(--accent-fg)' : 'var(--text-primary)' }}>
                  {p.name}
                </div>
                <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.description}</div>
              </button>
            ))}
          </div>
        </FieldGroup>
      )}

      <FieldGroup
        label="成长区（MUTABLE）"
        hint="只改当前活跃主角的可成长语气/习惯；PROTECTED 核心身份不可在此编辑。保存会记版本，可回滚。"
      >
        <textarea
          value={mutableBody}
          onChange={(e) => setMutableBody(e.target.value)}
          disabled={mutableLoading || mutableSaving}
          rows={5}
          placeholder={mutableLoading ? '加载中…' : '当前主角的可成长行为规范'}
          className="theme-input w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none transition"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={mutableLoading || mutableSaving || !mutableBody.trim()}
            onClick={() => {
              void (async () => {
                if (!window.electronAPI?.companion) return
                setMutableSaving(true)
                try {
                  const result = await window.electronAPI.companion.setMutable(
                    form.activeRoleId,
                    mutableBody,
                    'settings-edit',
                  )
                  if (result.ok) {
                    toast(`已保存成长区 v${result.version}`, 'success')
                    await loadMutable(form.activeRoleId)
                  } else {
                    toast(result.error || '保存失败', 'error')
                  }
                } finally {
                  setMutableSaving(false)
                }
              })()
            }}
            className="settings-option px-3 py-1.5 text-xs font-medium"
          >
            {mutableSaving ? '保存中…' : '保存成长区'}
          </button>
          <button
            type="button"
            disabled={mutableLoading || mutableSaving}
            onClick={() => void loadMutable(form.activeRoleId)}
            className="settings-option px-3 py-1.5 text-xs"
          >
            重新加载
          </button>
        </div>
        {mutableVersions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              版本历史
            </div>
            {mutableVersions.slice(0, 8).map((v) => (
              <div
                key={v.version}
                className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[11px]"
                style={{ borderColor: 'var(--border-color)' }}
              >
                <span style={{ color: 'var(--text-secondary)' }}>
                  v{v.version}
                  {v.summary ? ` · ${v.summary}` : ''}
                  <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(v.createdAt).toLocaleString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                <button
                  type="button"
                  className="settings-option px-2 py-0.5 text-[10px]"
                  disabled={mutableSaving}
                  onClick={() => {
                    void (async () => {
                      if (!window.electronAPI?.companion) return
                      setMutableSaving(true)
                      try {
                        const result = await window.electronAPI.companion.rollbackMutable(
                          form.activeRoleId,
                          v.version,
                        )
                        if (result.ok) {
                          toast(`已回滚到 v${v.version}（现为 v${result.version}）`, 'success')
                          await loadMutable(form.activeRoleId)
                        } else {
                          toast(result.error || '回滚失败', 'error')
                        }
                      } finally {
                        setMutableSaving(false)
                      }
                    })()
                  }}
                >
                  回滚
                </button>
              </div>
            ))}
          </div>
        )}
      </FieldGroup>

      <FieldGroup
        label="自动反思"
        hint="对话后后台低频微调成长区（72h 冷启动 + 24h 冷却 + 近7日≥5条消息）。不改 PROTECTED。"
      >
        <p className="mb-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {reflectionHint}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={reflectionRunning || mutableLoading}
            className="settings-option px-3 py-1.5 text-xs font-medium"
            onClick={() => {
              void (async () => {
                if (!window.electronAPI?.companion.runReflection) return
                setReflectionRunning(true)
                try {
                  const r = await window.electronAPI.companion.runReflection(form.activeRoleId, false)
                  if (r.skipped) {
                    toast(r.summary || r.reason || '已跳过', 'info')
                  } else if (r.changed) {
                    toast(`反思已写入成长区${r.version ? ` v${r.version}` : ''}：${r.summary}`, 'success')
                    await loadMutable(form.activeRoleId)
                  } else {
                    toast(`反思完成，无需改动：${r.summary}`, 'info')
                    await loadMutable(form.activeRoleId)
                  }
                } finally {
                  setReflectionRunning(false)
                }
              })()
            }}
          >
            {reflectionRunning ? '反思中…' : '立即反思'}
          </button>
          <button
            type="button"
            disabled={reflectionRunning || mutableLoading}
            className="settings-option px-3 py-1.5 text-xs"
            onClick={() => {
              void (async () => {
                if (!window.electronAPI?.companion.runReflection) return
                if (!window.confirm('强制反思会跳过冷启动/冷却/消息数门闸，仍调用模型。继续？')) return
                setReflectionRunning(true)
                try {
                  const r = await window.electronAPI.companion.runReflection(form.activeRoleId, true)
                  if (r.changed) {
                    toast(`强制反思已写入：${r.summary}`, 'success')
                  } else {
                    toast(r.summary || '无改动', 'info')
                  }
                  await loadMutable(form.activeRoleId)
                } finally {
                  setReflectionRunning(false)
                }
              })()
            }}
          >
            强制反思
          </button>
        </div>
      </FieldGroup>

      <FieldGroup label="自定义补充指令" hint="注入到 System Prompt L3 层">
        <textarea
          value={form.systemPrompt}
          onChange={(e) => update('systemPrompt', e.target.value)}
          placeholder="例如：回答时多用比喻，保持简洁..."
          rows={3}
          className="theme-input w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition"
        />
      </FieldGroup>
    </div>
  )

  const renderModel = () => (
    <div className="space-y-6">
      <SectionTitle>模型配置</SectionTitle>

      <FieldGroup label="快速选择">
        <div className="space-y-3">
          {PRESET_GROUPS.map((group) => (
            <div key={group.group}>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {group.group}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((p) => {
                  const selected = form.llmBaseUrl === p.baseUrl && form.llmModel === p.model
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="settings-option px-3 py-1.5 text-xs"
                      data-selected={selected ? 'true' : undefined}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="API Key">
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={form.llmApiKey}
            onChange={(e) => update('llmApiKey', e.target.value)}
            placeholder="sk-..."
            className="theme-input w-full rounded-lg border px-3 py-2 pr-16 text-sm outline-none transition"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition"
            style={{ color: 'var(--text-muted)' }}
          >
            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </FieldGroup>

      <FieldGroup label="Base URL">
        <input
          type="text"
          value={form.llmBaseUrl}
          onChange={(e) => update('llmBaseUrl', e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
        />
      </FieldGroup>

      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label="主模型">
          <input
            type="text"
            value={form.llmModel}
            onChange={(e) => update('llmModel', e.target.value)}
            placeholder="gpt-4o"
            className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
          />
        </FieldGroup>
        <FieldGroup label="辅助模型" hint="留空沿用主模型">
          <input
            type="text"
            value={form.auxModel}
            onChange={(e) => update('auxModel', e.target.value)}
            placeholder="如 gpt-4o-mini"
            className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
          />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <FieldGroup label="Temperature">
          <input
            type="number" step="0.1" min="0" max="2"
            value={form.llmTemperature}
            onChange={(e) => update('llmTemperature', e.target.value)}
            className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
          />
        </FieldGroup>
        <FieldGroup label="Top P">
          <input
            type="number" step="0.1" min="0" max="1"
            value={form.llmTopP}
            onChange={(e) => update('llmTopP', e.target.value)}
            className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
          />
        </FieldGroup>
        <FieldGroup label="Max Tokens">
          <input
            type="number" step="256" min="256" max="128000"
            value={form.llmMaxTokens}
            onChange={(e) => update('llmMaxTokens', e.target.value)}
            className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
          />
        </FieldGroup>
      </div>
    </div>
  )

  const renderSecurity = () => (
    <div className="space-y-6">
      <SectionTitle>安全与权限</SectionTitle>

      <FieldGroup label="沙箱模式" hint="控制文件写入和命令执行的安全策略">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))' }}>
          {([
            { value: 'read-only', label: '只读', desc: '最安全，禁止写入和网络' },
            { value: 'workspace-write', label: '工作区写入', desc: '允许工作区内操作' },
            { value: 'full-access', label: '完全访问', desc: '不限制（需谨慎）', danger: true },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('sandboxMode', opt.value)}
              className="settings-option px-3 py-2 text-xs"
              data-selected={form.sandboxMode === opt.value ? 'true' : undefined}
              data-danger={'danger' in opt && opt.danger ? 'true' : undefined}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="mt-0.5 text-[10px] opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup label="执行模式" hint="工具调用审批策略">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))' }}>
          {([
            { value: 'auto', label: '自动', desc: '仅破坏性操作需确认' },
            { value: 'confirm-all', label: '全部确认', desc: '每次工具调用都需审批' },
            { value: 'plan-first', label: '先计划', desc: 'AI 先说计划再执行' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('executionMode', opt.value)}
              className="settings-option px-3 py-2 text-xs"
              data-selected={form.executionMode === opt.value ? 'true' : undefined}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="mt-0.5 text-[10px] opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </FieldGroup>

      <FieldGroup
        label="自定义权限规则"
        hint='JSON 数组。示例：[{"id":"no-publish","type":"command","pattern":"npm publish","action":"deny","enabled":true}]。type=command|tool|path；action=allow|deny|ask'
      >
        <textarea
          value={form.permissionRules}
          onChange={(e) => update('permissionRules', e.target.value)}
          rows={5}
          spellCheck={false}
          className="theme-input w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none transition"
          placeholder='[]'
        />
      </FieldGroup>

      <FieldGroup label="Token 预算">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: 'var(--text-muted)' }}>会话预算</label>
            <input
              type="number" step="10000" min="0"
              value={form.sessionTokenBudget}
              onChange={(e) => update('sessionTokenBudget', e.target.value)}
              placeholder="0 = 无限制"
              className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px]" style={{ color: 'var(--text-muted)' }}>每日预算</label>
            <input
              type="number" step="100000" min="0"
              value={form.dailyTokenBudget}
              onChange={(e) => update('dailyTokenBudget', e.target.value)}
              placeholder="0 = 无限制"
              className="theme-input w-full rounded-lg border px-3 py-2 text-sm outline-none transition"
            />
          </div>
        </div>
        <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>0 = 无限制，单位: tokens</div>
      </FieldGroup>
    </div>
  )

  const renderMcp = () => (
    <div className="space-y-6">
      <SectionTitle>MCP 服务器</SectionTitle>

      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          连接外部工具和服务，扩展 Agent 能力
        </p>
        <button
          onClick={() => setMcpAdding(!mcpAdding)}
          className="rounded-lg px-2 py-0.5 text-xs transition"
          style={{ color: 'var(--accent-fg)' }}
        >
          {mcpAdding ? '取消' : '+ 添加'}
        </button>
      </div>

      {mcpAdding && (
        <div className="settings-field">
          <input
            type="text"
            value={newMcp.name}
            onChange={e => setNewMcp(m => ({ ...m, name: e.target.value }))}
            placeholder="名称（如 filesystem）"
            className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
          />
          <select
            value={newMcp.transport}
            onChange={e => setNewMcp(m => ({ ...m, transport: e.target.value as 'stdio' | 'sse' }))}
            className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
          >
            <option value="stdio">stdio（本地命令）</option>
            <option value="sse">SSE（远程 URL）</option>
          </select>
          {newMcp.transport === 'sse' ? (
            <input
              type="text"
              value={newMcp.url}
              onChange={e => setNewMcp(m => ({ ...m, url: e.target.value }))}
              placeholder="SSE URL（如 http://localhost:3000/sse）"
              className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
            />
          ) : (
            <>
              <input
                type="text"
                value={newMcp.command}
                onChange={e => setNewMcp(m => ({ ...m, command: e.target.value }))}
                placeholder="命令（如 npx, node, python3）"
                className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
              />
              <input
                type="text"
                value={newMcp.args}
                onChange={e => setNewMcp(m => ({ ...m, args: e.target.value }))}
                placeholder="参数（空格分隔）"
                className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
              />
            </>
          )}
          <textarea
            value={newMcp.env}
            onChange={e => setNewMcp(m => ({ ...m, env: e.target.value }))}
            placeholder="环境变量（每行 KEY=VALUE，可选）"
            rows={2}
            className="theme-input mb-2 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleAddMcp}
            disabled={!newMcp.name || (newMcp.transport === 'sse' ? !newMcp.url.trim() : !newMcp.command)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-white transition disabled:opacity-40"
            style={{ background: 'var(--accent-emphasis)' }}
          >
            连接
          </button>
        </div>
      )}

      {mcpServers.length === 0 && !mcpAdding && (
        <div className="rounded-lg border border-dashed p-4 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          暂无 MCP 服务器，点击"+ 添加"连接外部能力
        </div>
      )}

      <div className="space-y-2">
        {mcpServers.map(server => {
          const st = mcpStatuses.find(s => s.id === server.id)
          return (
            <div key={server.id} className="theme-card flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    st?.status === 'connected' ? 'bg-green-400' :
                    st?.status === 'connecting' ? 'bg-yellow-400' :
                    st?.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                  }`} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{server.name}</span>
                  {st?.toolCount ? (
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{st.toolCount} tools</span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {server.transport === 'sse'
                    ? `SSE ${server.url ?? ''}`
                    : `${server.command} ${server.args.join(' ')}`}
                </div>
                {st?.error && (
                  <div className="mt-0.5 truncate text-[10px] text-red-400">{st.error}</div>
                )}
              </div>
              <div className="ml-2 flex items-center gap-1">
                <button
                  onClick={() => handleToggleMcp(server.id)}
                  className={`rounded px-2 py-0.5 text-[10px] transition ${
                    server.enabled ? 'text-yellow-400' : 'text-green-400'
                  }`}
                  style={{ }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {server.enabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => handleRemoveMcp(server.id)}
                  className="rounded px-2 py-0.5 text-[10px] text-red-400 transition"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  删除
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderData = () => (
    <div className="space-y-6">
      <SectionTitle>数据管理</SectionTitle>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        导出或导入你的会话历史、记忆和设置
      </p>

      <FieldGroup label="导入 / 导出">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!window.electronAPI) return
              const res = await window.electronAPI.data.export()
              if (res.success) toast(`导出成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆`, 'success')
              else if (res.error !== 'cancelled') toast(`导出失败: ${res.error}`, 'error')
            }}
            className="settings-option flex items-center gap-2 px-4 py-2 text-xs"
          >
            <Upload size={14} /> 导出数据
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.electronAPI) return
              const res = await window.electronAPI.data.import()
              if (res.success) toast(`导入成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆 + ${res.stats?.settings} 项设置`, 'success')
              else if (res.error !== 'cancelled') toast(`导入失败: ${res.error}`, 'error')
            }}
            className="settings-option flex items-center gap-2 px-4 py-2 text-xs"
          >
            <Download size={14} /> 导入数据
          </button>
        </div>
      </FieldGroup>
    </div>
  )

  const renderDeveloper = () => (
    <div className="space-y-6">
      <SectionTitle>开发者</SectionTitle>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        调试工具和内部状态查看
      </p>

      <FieldGroup label="调试">
        <button
          type="button"
          onClick={() => { onOpenDevPanel?.(); onClose() }}
          className="settings-option flex w-full items-center gap-2 px-4 py-2 text-xs"
        >
          <Code size={14} />
          打开开发者面板
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Shift+D</span>
        </button>
      </FieldGroup>
    </div>
  )

  const renderAbout = () => (
    <div className="space-y-6">
      <SectionTitle>关于</SectionTitle>

      <div className="settings-field">
        <h3 className="text-lg font-bold italic" style={{ color: 'var(--text-primary)' }}>My Agent</h3>
        <p className="mt-1 text-xs italic" style={{ color: 'var(--text-muted)' }}>
          "越探索，越着迷。"
        </p>
        <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div>Version 0.1.0 (开发中)</div>
          <div>基于 Alice 方法论构建</div>
          <div>Electron + React + TypeScript</div>
        </div>
      </div>

      <FieldGroup label="项目信息">
        <div className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex justify-between">
            <span>运行环境</span>
            <span style={{ color: 'var(--text-muted)' }}>Electron</span>
          </div>
          <div className="flex justify-between">
            <span>本地数据库</span>
            <span style={{ color: 'var(--text-muted)' }}>SQLite (sql.js)</span>
          </div>
          <div className="flex justify-between">
            <span>向量引擎</span>
            <span style={{ color: 'var(--text-muted)' }}>Vectra</span>
          </div>
        </div>
      </FieldGroup>

      <FieldGroup label="致谢">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          受 Alice 项目启发，参考了 OpenAI Codex、Claude Desktop 等产品的设计理念。
          感谢开源社区的贡献。
        </p>
      </FieldGroup>
    </div>
  )

  const SECTION_RENDERERS: Record<SettingsSection, () => React.ReactNode> = {
    general: renderGeneral,
    model: renderModel,
    security: renderSecurity,
    mcp: renderMcp,
    data: renderData,
    developer: renderDeveloper,
    about: renderAbout,
  }

  return (
    <div className="flex h-full">
      {/* 左侧导航 */}
      <div className="flex w-[180px] shrink-0 flex-col border-r py-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} className="mb-3 px-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {group.group}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition ${
                  activeSection === item.id ? 'font-medium' : ''
                }`}
                style={{
                  color: activeSection === item.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: activeSection === item.id ? 'var(--hover-overlay)' : undefined,
                }}
                onMouseEnter={(e) => { if (activeSection !== item.id) e.currentTarget.style.background = 'var(--hover-overlay)' }}
                onMouseLeave={(e) => { if (activeSection !== item.id) e.currentTarget.style.background = '' }}
              >
                <span style={{ color: activeSection === item.id ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {item.icon}
                </span>
                {item.label}
                {activeSection === item.id && (
                  <ChevronRight size={12} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 右侧内容 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <div className="flex items-center justify-between border-b px-6 py-3" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>设置</h2>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-400">已保存</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg px-3 py-1 text-xs font-medium text-white transition disabled:opacity-50"
              style={{ background: 'var(--accent-emphasis)' }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">
          <div className="view-transition" key={activeSection}>
            {SECTION_RENDERERS[activeSection]()}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
      {children}
    </h3>
  )
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-field">
      <label className="theme-label mb-1.5 block text-xs font-medium">{label}</label>
      {hint && <div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
      {children}
    </div>
  )
}
