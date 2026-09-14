import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './Toast'
import { PermissionRulesEditor } from './PermissionRulesEditor'
import { MemoryPanel } from './MemoryPanel'
import { SkillsPanel } from './SkillsPanel'
import { CharacterShelfPanel } from './CharacterShelfPanel'
import { ActionButton } from './foundation/ActionButton'
import { SettingsLayout, type SettingsPageId } from './settings/SettingsLayout'
import { CompanionSettingsContent, type CompanionExpertise } from './settings/CompanionSettingsContent'
import { PROVIDER_PRESET_GROUPS, type ProviderPreset } from '../shared/provider-presets'
import { DESIGN_THEME_ASSETS, FONT_SCALE_ASSETS } from '../shared/design-asset-registry'
import {
  Upload, Download,
  Eye, EyeOff,
  Check,
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

export type SettingsSection = SettingsPageId

const PAGE_SECTIONS: Record<SettingsPageId, SettingsSection> = {
  appearance: 'appearance', companion: 'companion', model: 'model', memory: 'memory',
  data: 'data', permissions: 'permissions', skills: 'skills', mcp: 'mcp', about: 'about',
}

const SECTION_PAGES: Record<SettingsSection, SettingsPageId> = PAGE_SECTIONS

const FONT_SCALES = FONT_SCALE_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh, desc: asset.descriptionZh }))

const THEMES = DESIGN_THEME_ASSETS.map((asset) => ({ id: asset.id, label: asset.labelZh, desc: asset.descriptionZh, color: asset.representativeColor, isDark: asset.isDark }))

interface SettingsPanelProps {
  onClose: () => void
  currentTheme?: string
  onThemeChange?: (themeId: string) => void
  /** Playground 只读预览：不读取、写入或探测真实设置。 */
  preview?: boolean
  /** 只在 Playground preview 中生效；正式设置仍从「通用」开始。 */
  previewInitialSection?: SettingsSection
}

export function SettingsPanel({
  onClose,
  currentTheme,
  onThemeChange,
  preview = false,
  previewInitialSection,
}: SettingsPanelProps) {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    preview && previewInitialSection ? previewInitialSection : 'appearance',
  )
  const [roleShelfOpen, setRoleShelfOpen] = useState(false)
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
    if (preview) setActiveSection(previewInitialSection ?? 'appearance')
  }, [preview, previewInitialSection])
  // 自动保存只处理用户真实修改：初始加载不回写；修订号用于识别保存期间发生的新编辑。
  const settingsLoadedRef = useRef(false)
  const settingsRevisionRef = useRef(0)

  const refreshMcpStatus = useCallback(async () => {
    if (preview || !window.electronAPI) return
    const statuses = await window.electronAPI.mcp.status()
    setMcpStatuses(statuses)
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
    })
    window.electronAPI.companion.listProtagonists().then(setProtagonists)
    refreshMcpStatus()
  }, [preview, refreshMcpStatus])

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

  const renderCompanion = () => <CompanionSettingsContent
    expertise={form.userExpertiseLevel as CompanionExpertise}
    onExpertiseChange={(value) => update('userExpertiseLevel', value)}
    momentTipsMuted={form.companionMomentTipsMuted === 'true'}
    onMomentTipsMutedChange={(value) => update('companionMomentTipsMuted', value ? 'true' : 'false')}
    proactiveGreeting={form.companionProactiveGreetingEnabled === 'true'}
    onProactiveGreetingChange={(value) => update('companionProactiveGreetingEnabled', value ? 'true' : 'false')}
    quietStart={form.companionMomentTipsQuietStart}
    quietEnd={form.companionMomentTipsQuietEnd}
    maxPerDay={form.companionMomentTipsMaxPerDay}
    onQuietStartChange={(value) => update('companionMomentTipsQuietStart', value)}
    onQuietEndChange={(value) => update('companionMomentTipsQuietEnd', value)}
    onMaxPerDayChange={(value) => update('companionMomentTipsMaxPerDay', value)}
    note={form.systemPrompt}
    onNoteChange={(value) => update('systemPrompt', value)}
    roleAction={<ActionButton onClick={() => setRoleShelfOpen(true)} disabled={preview} data-testid="settings-open-role-shelf">管理角色架</ActionButton>}
  />

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

  const renderMemory = () => (
    <MemoryPanel onClose={() => setActiveSection('companion')} {...(preview ? { previewMemories: [], readOnly: true } : {})} />
  )

  const renderTools = () => preview
    ? <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Skills 预览不读取本机文件。</div>
    : <SkillsPanel visible onClose={() => setActiveSection('about')} />

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
    appearance: renderGeneral,
    companion: renderCompanion,
    model: renderModel,
    memory: renderMemory,
    permissions: renderSecurity,
    mcp: renderConnection,
    data: renderData,
    skills: renderTools,
    about: renderAbout,
  }

  const page = SECTION_PAGES[activeSection]
  const embedded = activeSection === 'memory' || activeSection === 'skills' || (activeSection === 'companion' && roleShelfOpen)

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1" data-testid="settings-panel">
      <SettingsLayout activeSection={page} onClose={onClose} panelOwnsScroll={embedded}
        onSelect={(id) => { setRoleShelfOpen(false); setActiveSection(PAGE_SECTIONS[id]) }}>
        {activeSection === 'companion' && roleShelfOpen && !preview
          ? <CharacterShelfPanel onClose={() => setRoleShelfOpen(false)} onSwitched={(role) => {
              setForm((current) => ({ ...current, activeRoleId: role.id }))
            }} />
          : <>
              {SECTION_RENDERERS[activeSection]()}
            </>}
      </SettingsLayout>
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
