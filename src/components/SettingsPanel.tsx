import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './Toast'
import { PermissionRulesEditor } from './PermissionRulesEditor'
import { PROVIDER_PRESET_GROUPS, type ProviderPreset } from '../shared/provider-presets'
import { DESIGN_THEME_ASSETS, FONT_SCALE_ASSETS } from '../shared/design-asset-registry'
import {
  Upload, Download, Settings, Shield, Cpu, Database, Code,
  ChevronRight, Eye, EyeOff, Info, Heart, Brain, Wrench, SlidersHorizontal, Link2,
  ArrowLeft, Check,
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
  executionMode: string
  /** auto | novice | intermediate | expert — 能力解释粒度（M30-G3） */
  userExpertiseLevel: string
  /** 新 Moment 应用内轻提示静音（M31-G1） */
  companionMomentTipsMuted: string
  /** 勿扰开始小时（M31-G2） */
  companionMomentTipsQuietStart: string
  /** 勿扰结束小时（M31-G2） */
  companionMomentTipsQuietEnd: string
  /** 每日最多轻提示（M31-G2）；0=不限 */
  companionMomentTipsMaxPerDay: string
  /** 定时主动问候（M31-G3）；默认关 */
  companionProactiveGreetingEnabled: string
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
  executionMode: 'auto',
  userExpertiseLevel: 'auto',
  companionMomentTipsMuted: 'false',
  companionMomentTipsQuietStart: '22',
  companionMomentTipsQuietEnd: '8',
  companionMomentTipsMaxPerDay: '3',
  companionProactiveGreetingEnabled: 'false',
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

export type SettingsSection =
  | 'general'
  | 'companion'
  | 'model'
  | 'memory'
  | 'security'
  | 'connection'
  | 'data'
  | 'about'
  | 'parameters'
  | 'tools'
  | 'developer'

const NAV_ITEMS: { group: string; items: { id: SettingsSection; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: '基础',
    items: [
      { id: 'general', label: '通用', icon: <Settings size={15} /> },
      { id: 'companion', label: '伙伴', icon: <Heart size={15} /> },
      { id: 'model', label: '模型', icon: <Cpu size={15} /> },
      { id: 'memory', label: '记忆', icon: <Brain size={15} /> },
      { id: 'security', label: '安全', icon: <Shield size={15} /> },
      { id: 'connection', label: '连接', icon: <Link2 size={15} /> },
      { id: 'data', label: '数据', icon: <Database size={15} /> },
      { id: 'about', label: '关于', icon: <Info size={15} /> },
    ],
  },
  {
    group: '高级',
    items: [
      { id: 'parameters', label: '参数', icon: <SlidersHorizontal size={15} /> },
      { id: 'tools', label: '工具', icon: <Wrench size={15} /> },
      { id: 'developer', label: '开发者', icon: <Code size={15} /> },
    ],
  },
]

const FONT_SCALES = FONT_SCALE_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh, desc: asset.descriptionZh }))

const THEMES = DESIGN_THEME_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh, desc: asset.descriptionZh, color: asset.representativeColor, isDark: asset.isDark }))

interface SettingsPanelProps {
  onClose: () => void
  onOpenDevPanel?: () => void
  onOpenPlayground?: () => void
  onOpenMemory?: () => void
  onOpenSkills?: () => void
  currentTheme?: string
  onThemeChange?: (themeId: string) => void
  /** Playground 只读预览：不读取、写入或探测真实设置。 */
  preview?: boolean
  /** 只在 Playground preview 中生效；正式设置仍从「通用」开始。 */
  previewInitialSection?: SettingsSection
}

export function SettingsPanel({
  onClose,
  onOpenDevPanel,
  onOpenPlayground,
  onOpenMemory,
  onOpenSkills,
  currentTheme,
  onThemeChange,
  preview = false,
  previewInitialSection,
}: SettingsPanelProps) {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    preview && previewInitialSection ? previewInitialSection : 'general',
  )
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('uiFontScale') || 'md')
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false)
  const [apiKeyChanged, setApiKeyChanged] = useState(false)
  const [firstRun, setFirstRun] = useState(true)
  const [connectionTesting, setConnectionTesting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [verifiedConnectionKey, setVerifiedConnectionKey] = useState('')
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

  useEffect(() => {
    if (preview) setActiveSection(previewInitialSection ?? 'general')
  }, [preview, previewInitialSection])
  // 自动保存只处理用户真实修改：初始加载不回写；修订号用于识别保存期间发生的新编辑。
  const settingsLoadedRef = useRef(false)
  const settingsRevisionRef = useRef(0)

  const refreshMcpStatus = useCallback(async () => {
    if (preview || !window.electronAPI) return
    const statuses = await window.electronAPI.mcp.status()
    setMcpStatuses(statuses)
  }, [preview])

  const loadMutable = useCallback(async (roleId: string) => {
    if (preview || !window.electronAPI?.companion || !roleId) return
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
  }, [preview])

  useEffect(() => {
    if (preview) return
    document.documentElement.dataset.fontScale = fontScale
    localStorage.setItem('uiFontScale', fontScale)
  }, [fontScale, preview])

  useEffect(() => {
    if (preview || !window.electronAPI) return
    window.electronAPI.settings.get().then((s) => {
      const hasApiKey = s.llmApiKeyConfigured === 'true' || Boolean(s.llmApiKey?.trim())
      setHasStoredApiKey(hasApiKey)
      setApiKeyChanged(false)
      setFirstRun(!hasApiKey)
      if (!hasApiKey) setActiveSection('model')
      setForm({
        // API Key 原文不从主进程下沉；输入框只承载本次新输入。
        llmApiKey: '',
        llmBaseUrl: s.llmBaseUrl || DEFAULTS.llmBaseUrl,
        llmModel: s.llmModel || DEFAULTS.llmModel,
        llmTemperature: s.llmTemperature || DEFAULTS.llmTemperature,
        llmTopP: s.llmTopP || DEFAULTS.llmTopP,
        llmMaxTokens: s.llmMaxTokens || DEFAULTS.llmMaxTokens,
        systemPrompt: s.systemPrompt || '',
        activeRoleId: s.activeRoleId || DEFAULTS.activeRoleId,
        executionMode: s.executionMode || DEFAULTS.executionMode,
        userExpertiseLevel: s.userExpertiseLevel || DEFAULTS.userExpertiseLevel,
        companionMomentTipsMuted: s.companionMomentTipsMuted || DEFAULTS.companionMomentTipsMuted,
        companionMomentTipsQuietStart:
          s.companionMomentTipsQuietStart || DEFAULTS.companionMomentTipsQuietStart,
        companionMomentTipsQuietEnd:
          s.companionMomentTipsQuietEnd || DEFAULTS.companionMomentTipsQuietEnd,
        companionMomentTipsMaxPerDay:
          s.companionMomentTipsMaxPerDay || DEFAULTS.companionMomentTipsMaxPerDay,
        companionProactiveGreetingEnabled:
          s.companionProactiveGreetingEnabled || DEFAULTS.companionProactiveGreetingEnabled,
        auxModel: s.auxModel || '',
        sessionTokenBudget: s.sessionTokenBudget || '0',
        dailyTokenBudget: s.dailyTokenBudget || '0',
        permissionRules: s.permissionRules || DEFAULTS.permissionRules,
      })
      settingsLoadedRef.current = true
      try {
        const servers = JSON.parse(s.mcpServers || '[]')
        setMcpServers(servers)
      } catch { /* ignore */ }
      void loadMutable(s.activeRoleId || DEFAULTS.activeRoleId)
    })
    window.electronAPI.companion.listProtagonists().then(setProtagonists)
    refreshMcpStatus()
  }, [loadMutable, preview, refreshMcpStatus])

  const persistSettings = useCallback(async (): Promise<void> => {
    if (preview || !window.electronAPI || !settingsLoadedRef.current || settingsRevisionRef.current === 0) return
    const savingRevision = settingsRevisionRef.current
    try {
      for (const [key, value] of Object.entries(form)) {
        // activeRoleId 只能走 companion.requestSwitch（含 pause/catchup）。
        if (key === 'activeRoleId') continue
        // 安全视图不下沉原始 API Key；用户没有输入新值时绝不能用空串覆盖已保存密钥。
        if (key === 'llmApiKey' && !apiKeyChanged) continue
        await window.electronAPI.settings.set(key, value)
      }
      if (apiKeyChanged) {
        const hasApiKey = Boolean(form.llmApiKey.trim())
        setHasStoredApiKey(hasApiKey)
        if (!hasApiKey) setFirstRun(true)
        setApiKeyChanged(false)
      }
      // 保存过程中若又有编辑，保留新修订，交给下一轮防抖继续落盘。
      if (settingsRevisionRef.current === savingRevision) settingsRevisionRef.current = 0
    } catch {
      toast('设置自动保存失败，请重试', 'error')
    }
  }, [apiKeyChanged, form, preview, toast])

  const initialLoadDone = useRef(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (preview) return
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void persistSettings()
    }, 800)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [persistSettings, preview])

  const persistSettingsRef = useRef(persistSettings)
  // 直接刷新 latest ref，确保用户刚编辑就返回 / 按 Esc 时不会调用上一帧的保存闭包。
  persistSettingsRef.current = persistSettings

  useEffect(() => {
    if (preview) return
    return () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    // 返回、Esc 或跳转其它全页视图时，刷新尚未到防抖时间的最后一次修改。
    void persistSettingsRef.current()
    }
  }, [preview])

  const effectiveApiKeyForTest = apiKeyChanged ? form.llmApiKey.trim() : (hasStoredApiKey ? '[stored-api-key]' : '')
  const connectionKey = `${effectiveApiKeyForTest}\n${form.llmBaseUrl.trim()}\n${form.llmModel.trim()}`
  const canTestConnection = Boolean(effectiveApiKeyForTest && form.llmBaseUrl.trim() && form.llmModel.trim())

  const testConnection = useCallback(async () => {
    if (preview) {
      setVerifiedConnectionKey(connectionKey)
      setConnectionStatus({ kind: 'success', text: 'Playground 预览 · 未连接真实模型' })
      return
    }
    if (!window.electronAPI?.settings?.testConnection) {
      setConnectionStatus({ kind: 'error', text: '当前环境不支持连接测试' })
      return
    }
    if (!canTestConnection) {
      setConnectionStatus({ kind: 'error', text: '请先填写 API Key、Base URL 和模型名' })
      return
    }
    setConnectionTesting(true)
    setConnectionStatus(null)
    setVerifiedConnectionKey('')
    try {
      const result = await window.electronAPI.settings.testConnection({
        apiKey: apiKeyChanged ? form.llmApiKey : undefined,
        useStoredApiKey: !apiKeyChanged && hasStoredApiKey,
        baseUrl: form.llmBaseUrl,
        model: form.llmModel,
      })
      if (result.ok) {
        setVerifiedConnectionKey(connectionKey)
        setFirstRun(false)
        setConnectionStatus({ kind: 'success', text: `连接成功 · ${result.model} · ${result.ms}ms；配置会自动保存` })
      } else {
        setConnectionStatus({ kind: 'error', text: result.error })
      }
    } catch {
      setConnectionStatus({ kind: 'error', text: '连接测试失败，请检查网络和模型配置' })
    } finally {
      setConnectionTesting(false)
    }
  }, [apiKeyChanged, canTestConnection, connectionKey, form.llmApiKey, form.llmBaseUrl, form.llmModel, hasStoredApiKey, preview])

  const applyPreset = useCallback((preset: ProviderPreset) => {
    settingsRevisionRef.current += 1
    setVerifiedConnectionKey('')
    setConnectionStatus(null)
    setForm((f) => ({ ...f, llmBaseUrl: preset.baseUrl }))
  }, [])

  const update = (key: keyof SettingsForm, value: string) => {
    if (preview) return
    settingsRevisionRef.current += 1
    if (key === 'llmApiKey') setApiKeyChanged(true)
    if (key === 'llmApiKey' || key === 'llmBaseUrl' || key === 'llmModel') {
      setVerifiedConnectionKey('')
      setConnectionStatus(null)
    }
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** 执行模式点选即落盘（与对话页同一 settings.executionMode） */
  const updateAndPersist = async (key: 'executionMode', value: string) => {
    update(key, value)
    if (preview || !window.electronAPI) return
    await window.electronAPI.settings.set(key, value)
    toast('执行模式已切换', 'success')
  }

  const saveMcpList = useCallback(async (servers: McpServerEntry[]) => {
    // 先让主进程校验/确认并持久化，成功后再更新本地列表；取消确认不能留下“假保存”状态。
    if (preview) {
      setMcpServers(servers)
      return
    }
    if (window.electronAPI) {
      await window.electronAPI.settings.set('mcpServers', JSON.stringify(servers))
    }
    setMcpServers(servers)
  }, [preview])

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
    try {
      await saveMcpList(updated)
      const result = preview ? undefined : await window.electronAPI?.mcp.connect(entry)
      if (result && !result.success) {
        toast(`MCP 连接失败: ${result.error}`, 'error')
      }
      await refreshMcpStatus()
      setNewMcp({ name: '', transport: 'stdio', command: '', args: '', url: '', env: '' })
      setMcpAdding(false)
    } catch {
      toast('MCP 配置未保存，可能是你取消了安全确认', 'warning')
    }
  }, [newMcp, mcpServers, preview, saveMcpList, refreshMcpStatus, toast])

  const handleRemoveMcp = useCallback(async (id: string) => {
    try {
      if (!preview) await window.electronAPI?.mcp.disconnect(id)
      const updated = mcpServers.filter(s => s.id !== id)
      await saveMcpList(updated)
      await refreshMcpStatus()
    } catch {
      toast('MCP 配置未删除，可能是你取消了安全确认', 'warning')
    }
  }, [mcpServers, preview, saveMcpList, refreshMcpStatus, toast])

  const handleToggleMcp = useCallback(async (id: string) => {
    const server = mcpServers.find(s => s.id === id)
    if (!server) return
    try {
      if (server.enabled) {
        if (!preview) await window.electronAPI?.mcp.disconnect(id)
        const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: false } : s)
        await saveMcpList(updated)
      } else {
        const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: true } : s)
        await saveMcpList(updated)
        const result = preview ? undefined : await window.electronAPI?.mcp.connect({ ...server, enabled: true })
        if (result && !result.success) toast(`MCP 连接失败: ${result.error}`, 'error')
      }
      await refreshMcpStatus()
    } catch {
      toast('MCP 状态未改变，可能是你取消了安全确认', 'warning')
    }
  }, [mcpServers, preview, saveMcpList, refreshMcpStatus, toast])

  // ── 各区块渲染 ──

  const renderGeneral = () => (
    <div className="space-y-6">
      <SectionTitle>通用</SectionTitle>

      <FieldGroup label="界面语言" hint="当前仅提供简体中文；其它语言未接入，不提供假选项。">
        <button type="button" className="settings-option px-3 py-2 text-xs" data-selected="true">
          <div className="font-medium">简体中文</div>
          <div className="mt-0.5 text-[10px] opacity-70">默认界面语言</div>
        </button>
      </FieldGroup>

      <FieldGroup label="外观" hint="选择界面主题风格；浅色主题为纸感暖底。">
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

      <FieldGroup label="字体大小" hint="仅影响界面基准字号，保存在本机（不进云端）。">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))' }}>
          {FONT_SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setFontScale(s.id)}
              className="settings-option px-3 py-2 text-xs"
              data-selected={fontScale === s.id ? 'true' : undefined}
            >
              <div className="font-medium">{s.label}</div>
              <div className="mt-0.5 text-[10px] opacity-70">{s.desc}</div>
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>
  )

  const renderCompanion = () => (
    <div className="space-y-6">
      <SectionTitle>伙伴</SectionTitle>


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
                      toast(result.reacquaint?.toast || `已切换到${p.name}`, 'success')
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
        label="动态轻提示"
        hint="活跃主角有新朋友圈投影时，应用内气泡提示（非系统通知）。最短间隔约 15 分钟；默认勿扰 22–8 点，每日最多 3 条。"
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update('companionMomentTipsMuted', 'false')}
            className="settings-option px-3 py-2 text-xs"
            data-selected={form.companionMomentTipsMuted !== 'true' ? 'true' : undefined}
          >
            <div className="font-medium">开启</div>
            <div className="mt-0.5 text-[10px] opacity-70">有新动态时轻提示</div>
          </button>
          <button
            type="button"
            onClick={() => update('companionMomentTipsMuted', 'true')}
            className="settings-option px-3 py-2 text-xs"
            data-selected={form.companionMomentTipsMuted === 'true' ? 'true' : undefined}
          >
            <div className="font-medium">静音</div>
            <div className="mt-0.5 text-[10px] opacity-70">仍推进日子，不弹气泡</div>
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            勿扰开始（时）
            <input
              type="number"
              min={0}
              max={23}
              value={form.companionMomentTipsQuietStart}
              onChange={(e) => update('companionMomentTipsQuietStart', e.target.value)}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
            />
          </label>
          <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            勿扰结束（时）
            <input
              type="number"
              min={0}
              max={23}
              value={form.companionMomentTipsQuietEnd}
              onChange={(e) => update('companionMomentTipsQuietEnd', e.target.value)}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
            />
          </label>
          <label className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            每日上限（0=不限）
            <input
              type="number"
              min={0}
              max={99}
              value={form.companionMomentTipsMaxPerDay}
              onChange={(e) => update('companionMomentTipsMaxPerDay', e.target.value)}
              className="theme-input mt-1 w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
            />
          </label>
        </div>
        <p className="mt-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          起止小时相同=关闭勿扰；起&gt;止表示跨午夜（如 22→8）。日子仍会推进，只是不弹气泡。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update('companionProactiveGreetingEnabled', 'false')}
            className="settings-option px-3 py-2 text-xs"
            data-selected={form.companionProactiveGreetingEnabled !== 'true' ? 'true' : undefined}
          >
            <div className="font-medium">定时问候：关</div>
            <div className="mt-0.5 text-[10px] opacity-70">默认；不主动找上门</div>
          </button>
          <button
            type="button"
            onClick={() => update('companionProactiveGreetingEnabled', 'true')}
            className="settings-option px-3 py-2 text-xs"
            data-selected={form.companionProactiveGreetingEnabled === 'true' ? 'true' : undefined}
          >
            <div className="font-medium">定时问候：开</div>
            <div className="mt-0.5 text-[10px] opacity-70">有近 24h 动态时每日至多一次</div>
          </button>
        </div>
      </FieldGroup>

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

  /** Provider 卡片复用同一组生产预设；首次配置折叠展示，避免把核心字段推到首屏之外。 */
  const renderProviderPresets = () => (
    <FieldGroup label="Provider 预设" hint="选择后只填入 Provider Base URL；模型名由账户实际开放列表决定，在下方单独填写。">
      <div className="space-y-4">
        {PROVIDER_PRESET_GROUPS.map((group) => (
          <div key={group.group}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {group.group}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((preset) => {
                const selected = form.llmBaseUrl === preset.baseUrl
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition"
                    style={{
                      borderColor: selected ? 'var(--accent)' : 'var(--border-color)',
                      background: selected ? 'var(--accent-subtle)' : 'var(--card-bg)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {preset.label}
                      </span>
                      {selected && <Check size={14} style={{ color: 'var(--accent-fg)' }} />}
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px]" style={{ color: 'var(--text-muted)' }} title={preset.baseUrl}>
                      {preset.baseUrl}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </FieldGroup>
  )

  const renderModel = () => (
    <div className="space-y-6">
      <div>
        <SectionTitle>模型</SectionTitle>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>
          参考 Alice 的内置 Provider 入口选择预设，再填 API Key；编程套餐单独分组，ListenHub（TTS）和本地订阅代理不混入普通聊天。Provider 只负责端点，模型名由账户实际可用列表决定。
        </p>
      </div>

      {firstRun && (
        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--accent)', background: 'var(--accent-subtle)' }} data-testid="first-run-setup">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>先连接模型，再开始对话</h3>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
            默认已选 OpenAI 入口；也可以展开其它 Provider。模型名请按账户实际可用列表填写，连接测试只负责确认当前配置可用。
          </p>
          <ol className="mt-3 space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <li>1. 确认 Provider 和 Base URL</li>
            <li>2. 填写 API Key，等待自动保存</li>
            <li>3. 测试连接，成功后返回聊天</li>
          </ol>
        </section>
      )}

      {firstRun ? (
        <details className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}>
          <summary className="cursor-pointer text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            选择其它 Provider 预设
          </summary>
          <div className="mt-4">{renderProviderPresets()}</div>
        </details>
      ) : renderProviderPresets()}

      <FieldGroup label="API Key" hint="仅在输入新值时写入本机安全存储；已保存的 Key 不会回传到 Renderer。">
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={form.llmApiKey}
            onChange={(e) => update('llmApiKey', e.target.value)}
            placeholder={hasStoredApiKey && !apiKeyChanged ? '已安全保存（输入新值可替换）' : 'sk-...'}
            className="theme-input w-full rounded-lg border px-3 py-2 pr-16 font-mono text-sm outline-none transition"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition"
            style={{ color: 'var(--text-muted)' }}
            title={showApiKey ? '隐藏 API Key' : '显示 API Key'}
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
          className="theme-input w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition"
        />
      </FieldGroup>

      <div className="grid gap-4 sm:grid-cols-2">
        <FieldGroup label="主模型" hint="对话主力；按当前 Provider 账户实际可用列表填写，不由 Provider 预设写死。">
          <input
            type="text"
            value={form.llmModel}
            onChange={(e) => update('llmModel', e.target.value)}
            placeholder="填写 Provider 控制台中的模型 ID"
            className="theme-input w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition"
          />
        </FieldGroup>
        <FieldGroup label="辅助模型" hint="留空沿用主模型（标题/压缩等轻量任务）。">
          <input
            type="text"
            value={form.auxModel}
            onChange={(e) => update('auxModel', e.target.value)}
            placeholder="可选：填写辅助模型 ID"
            className="theme-input w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none transition"
          />
        </FieldGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void testConnection()}
          disabled={connectionTesting || !canTestConnection}
          className="rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-45"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          data-testid="test-connection"
        >
          {connectionTesting ? '测试中…' : '测试连接'}
        </button>
        {connectionStatus && (
          <span className="text-xs" style={{ color: connectionStatus.kind === 'success' ? 'var(--success)' : 'var(--danger)' }} role="status">
            {connectionStatus.text}
          </span>
        )}
      </div>
    </div>
  )

  const renderParameters = () => (
    <div className="space-y-6">
      <SectionTitle>参数</SectionTitle>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        采样与预算类高级参数；日常改模型请回「模型」。
      </p>
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

  const renderMemory = () => (
    <div className="space-y-6">
      <SectionTitle>记忆</SectionTitle>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {preview
          ? '在这里调整长期相处方式；具体记忆可随时查看、纠正或遗忘。'
          : '结构化记忆与向量召回在「记忆」面板管理；此处只放解释粒度等横切开关。'}
      </p>
      <FieldGroup
        label="解释粒度（专家度）"
        hint="影响能力讲解详略，不改工具权限。自动=按对话/画像启发式。"
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))' }}>
          {([
            { value: 'auto', label: '自动', desc: '启发式，偏中性' },
            { value: 'novice', label: '入门', desc: '多白话与步骤' },
            { value: 'intermediate', label: '熟练', desc: '少铺垫' },
            { value: 'expert', label: '专家', desc: '结论优先' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('userExpertiseLevel', opt.value)}
              className="settings-option px-3 py-2 text-xs"
              data-selected={form.userExpertiseLevel === opt.value ? 'true' : undefined}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="mt-0.5 text-[10px] opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="记忆面板" hint="浏览、纠正引用与遗忘条目。">
        <button
          type="button"
          onClick={() => { onOpenMemory?.(); onClose() }}
          className="settings-option flex w-full items-center gap-2 px-4 py-2 text-xs"
        >
          <Brain size={14} />
          打开记忆面板
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Shift+M</span>
        </button>
      </FieldGroup>
    </div>
  )

  const renderTools = () => (
    <div className="space-y-6">
      <SectionTitle>工具</SectionTitle>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Skills 与项目工作目录；沙箱边界见「安全」。项目切换仍在 Chat 输入区（DEC-020）。
      </p>
      <FieldGroup label="Skills" hint="按需注入的 Markdown 能力手册。">
        <button
          type="button"
          onClick={() => onOpenSkills?.()}
          className="settings-option flex w-full items-center gap-2 px-4 py-2 text-xs"
        >
          <Wrench size={14} />
          打开 Skills 面板
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Shift+K</span>
        </button>
      </FieldGroup>
      <FieldGroup label="工作目录" hint="shell / 文件工具的 cwd 与沙箱根。">
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          在聊天输入区下方的「项目 / 文件夹」选择器切换。设置页不重复造第二入口，避免两处状态不一致。
        </p>
      </FieldGroup>
    </div>
  )

  const renderSecurity = () => (
    <div className="space-y-6">
      <SectionTitle>安全与权限</SectionTitle>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        文件写入边界由对话页输入区的审批模式控制（请求批准 / 替我审批 → 仅工作区内写入；完全访问 → 放开路径沙箱）。此处只管规则与默认确认策略。
      </p>

      <FieldGroup label="执行模式" hint="工具调用默认确认策略（与对话页同一设置项；完全访问请在对话页切换）">
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))' }}>
          {([
            { value: 'auto', label: '自动', desc: '仅破坏性操作需确认；工作区写入' },
            { value: 'confirm-all', label: '全部确认', desc: '每次工具调用都需审批；工作区写入' },
            { value: 'plan-first', label: '先计划', desc: 'AI 先说计划再执行；工作区写入' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { void updateAndPersist('executionMode', opt.value) }}
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
        hint="可视化编辑；type=命令/工具/路径，action=允许/拒绝/询问。保存后热更新到权限引擎。高级用户仍可展开 JSON。"
      >
        <PermissionRulesEditor
          value={form.permissionRules}
          onChange={(json) => update('permissionRules', json)}
        />
      </FieldGroup>
    </div>
  )

  const renderConnection = () => (
    <div className="space-y-6">
      <SectionTitle>连接（MCP）</SectionTitle>

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
        调试工具和内部状态查看；Debug 统一以全页工作区呈现
      </p>

      <FieldGroup label="体验调试（全页）">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { onOpenDevPanel?.(); onClose() }}
            className="settings-option flex w-full items-center gap-2 px-4 py-2 text-xs"
          >
            <Code size={14} />
            打开 Debug
            <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Shift+D</span>
          </button>
          <button
            type="button"
            onClick={() => { onOpenPlayground?.(); onClose() }}
            className="settings-option flex w-full items-center gap-2 px-4 py-2 text-xs"
          >
            <Code size={14} />
            打开 Playground
            <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Ctrl+Shift+P</span>
          </button>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          侧栏各有独立全页入口（纵向分列，非双 tab），对齐 Alice Debug / Playground。
        </p>
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
    companion: renderCompanion,
    model: renderModel,
    memory: renderMemory,
    security: renderSecurity,
    connection: renderConnection,
    data: renderData,
    about: renderAbout,
    parameters: renderParameters,
    tools: renderTools,
    developer: renderDeveloper,
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1" data-testid="settings-panel">
      {/* 左侧导航 */}
      <aside
        data-testid="settings-nav"
        className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r py-4"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      >
        <div className="mb-3 px-3">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] transition"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="返回聊天"
            data-testid="settings-back"
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
            返回
          </button>
        </div>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} className="mb-3 px-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {group.group}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`settings-nav-item flex w-full items-center gap-2 px-2.5 py-1.5 text-[13px] ${
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
      </aside>

      {/* 右侧内容：设置项修改后自动保存，不再保留重复的标题 / 保存工具栏。 */}
      <div data-testid="settings-main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* 内容区：铺满右栏；表单最大宽度便于阅读，但仍相对右栏居中而非整窗左贴 */}
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="view-transition mx-auto w-full max-w-3xl" key={activeSection}>
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
