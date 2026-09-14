import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './Toast'
import { PermissionRulesEditor } from './PermissionRulesEditor'
import { MemoryPanel } from './MemoryPanel'
import { SkillsPanel } from './SkillsPanel'
import { CharacterShelfPanel } from './CharacterShelfPanel'
import { ActionButton } from './foundation/ActionButton'
import { SettingsLayout, type SettingsPageId } from './settings/SettingsLayout'
import { CompanionSettingsContent, type CompanionExpertise } from './settings/CompanionSettingsContent'
import { SettingCard, SettingRow, SettingsPageHeader } from './settings/SettingsFields'
import { ModelRoutingSettings } from './settings/ModelRoutingSettings'
import { DESIGN_THEME_ASSETS, FONT_SCALE_ASSETS } from '../shared/design-asset-registry'
import {
  Upload, Download,
  Check, ChevronRight,
} from 'lucide-react'

interface SettingsForm {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  llmTemperature: string
  llmTopP: string
  llmMaxTokens: string
  companionResponseNote: string
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
  developerMode: string
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
  allowedTools?: string[]
}

interface McpToolEntry { serverId: string; serverName: string; name: string; description: string; allowed: boolean }

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
  companionResponseNote: '',
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
  developerMode: 'false',
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
  /** 只在 Playground preview 中生效；正式设置从外观开始，未配置模型时进入模型。 */
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
  const activeSectionRef = useRef(activeSection)
  activeSectionRef.current = activeSection
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('uiFontScale') || 'md')
  const [form, setForm] = useState<SettingsForm>(DEFAULTS)
  const [saveFailed, setSaveFailed] = useState(false)
  const [showAdvancedModel, setShowAdvancedModel] = useState(false)
  const [dataBusy, setDataBusy] = useState<'export' | 'import' | null>(null)
  const [verifiedConnectionKey, setVerifiedConnectionKey] = useState('')
  const [protagonists, setProtagonists] = useState<RoleInfo[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([])
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([])
  const [mcpTools, setMcpTools] = useState<McpToolEntry[]>([])
  const [modelConnections, setModelConnections] = useState('[]')
  const [modelRoutes, setModelRoutes] = useState('[]')
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
  // 背景：全表保存会把未编辑的旧配置覆盖回去。只排队真实修改，串行落盘；失败项保留供重试。
  const settingsLoadedRef = useRef(false)
  const pendingSettingsRef = useRef(new Map<keyof SettingsForm, string>())
  const savingRef = useRef<Promise<boolean> | null>(null)

  const refreshMcpStatus = useCallback(async () => {
    if (preview || !window.electronAPI) return
    const statuses = await window.electronAPI.mcp.status()
    setMcpStatuses(statuses)
    setMcpTools(await window.electronAPI.mcp.listTools())
  }, [preview])

  useEffect(() => {
    if (preview) return
    document.documentElement.dataset.fontScale = fontScale
    localStorage.setItem('uiFontScale', fontScale)
  }, [fontScale, preview])

  useEffect(() => {
    if (preview || !window.electronAPI) return
    window.electronAPI.settings.get().then((s) => {
      setForm({
        // API Key 原文不从主进程下沉；输入框只承载本次新输入。
        llmApiKey: '',
        llmBaseUrl: s.llmBaseUrl || DEFAULTS.llmBaseUrl,
        llmModel: s.llmModel || DEFAULTS.llmModel,
        llmTemperature: s.llmTemperature || DEFAULTS.llmTemperature,
        llmTopP: s.llmTopP || DEFAULTS.llmTopP,
        llmMaxTokens: s.llmMaxTokens || DEFAULTS.llmMaxTokens,
        companionResponseNote: s.companionResponseNote || '',
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
        developerMode: s.developerMode || DEFAULTS.developerMode,
      })
      setModelConnections(s.modelConnections || '[]')
      setModelRoutes(s.modelRoutes || '[]')
      settingsLoadedRef.current = true
      try {
        const servers = JSON.parse(s.mcpServers || '[]')
        setMcpServers(servers)
      } catch { /* ignore */ }
    })
    window.electronAPI.companion.listProtagonists().then(setProtagonists)
    refreshMcpStatus()
  }, [preview, refreshMcpStatus])

  const persistSettings = useCallback((): Promise<boolean> => {
    if (savingRef.current) return savingRef.current
    if (preview || !window.electronAPI || !settingsLoadedRef.current) return Promise.resolve(true)
    const flush = async () => {
      try {
        while (pendingSettingsRef.current.size) {
          const [key, value] = pendingSettingsRef.current.entries().next().value!
          await window.electronAPI.settings.set(key, value)
          // 保存过程中同字段的新值不能被旧请求清掉；下一圈继续提交它。
          if (pendingSettingsRef.current.get(key) === value) {
            pendingSettingsRef.current.delete(key)
          }
        }
        setSaveFailed(false)
        return true
      } catch {
        setSaveFailed(true)
        // 伙伴页已有固定重试槽；重复 Toast 会遮挡操作，其他页仍需可见的失败通知。
        if (activeSectionRef.current !== 'companion') toast('设置自动保存失败，修改仍保留，请重试', 'error')
        return false
      }
    }
    savingRef.current = flush().finally(() => { savingRef.current = null })
    return savingRef.current
  }, [preview, toast])

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
  }, [form, persistSettings, preview])

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

  const update = (key: keyof SettingsForm, value: string) => {
    if (preview) return
    if (key === 'activeRoleId') return
    pendingSettingsRef.current.set(key, value)
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** 执行模式点选即落盘（与对话页同一 settings.executionMode） */
  const updateAndPersist = async (key: 'executionMode', value: string) => {
    if (preview || !window.electronAPI) return
    try {
      await window.electronAPI.settings.set(key, value)
      setForm((current) => ({ ...current, [key]: value }))
      toast('执行模式已切换', 'success')
    } catch {
      toast('执行模式未更改，请确认后重试', 'error')
    }
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
      <SettingsPageHeader title="外观与界面" description="调整应用主题和界面显示；主题选项来自基础设计资产。" />
      <SettingCard testId="settings-theme-card">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>主题</h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{THEMES.find((theme) => theme.id === currentTheme)?.label ?? currentTheme}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((theme) => {
            const selected = currentTheme === theme.id
            return <button key={theme.id} data-testid={`settings-theme-${theme.id}`} type="button" aria-pressed={selected} onClick={() => onThemeChange?.(theme.id)} className="rounded-[var(--radius-md)] border p-3 text-left transition" data-selected={selected ? 'true' : undefined} style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border" style={{ background: theme.color, borderColor: 'var(--border-color)' }} /><span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{theme.label}</span><Check size={13} aria-hidden="true" className={`ml-auto shrink-0 ${selected ? 'visible' : 'invisible'}`} style={{ color: 'var(--accent-fg)' }} /></div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{theme.desc}</div></button>
          })}
        </div>
      </SettingCard>
      <SettingCard>
        <SettingRow label="字体大小" description="只影响本机界面字号；不改变内容本身。" scope="本机" stacked>
          <div className="grid gap-2 sm:grid-cols-3">{FONT_SCALES.map((scale) => { const selected = fontScale === scale.id; return <button key={scale.id} type="button" aria-pressed={selected} onClick={() => setFontScale(scale.id)} className="rounded-[var(--radius-md)] border px-3 py-2 text-left transition" data-selected={selected ? 'true' : undefined} style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{scale.label}</div><div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{scale.desc}</div></button> })}</div>
        </SettingRow>
      </SettingCard>
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
    note={form.companionResponseNote}
    onNoteChange={(value) => update('companionResponseNote', value)}
    saveFailed={saveFailed}
    onRetrySave={() => { void persistSettings() }}
    roleAction={<ActionButton onClick={() => setRoleShelfOpen(true)} disabled={preview} data-testid="settings-open-role-shelf">管理角色架</ActionButton>}
  />

  // Provider 预设仍由 PROVIDER_PRESET_GROUPS 作为 Playground 与生产资产的唯一事实源；正式页不再复制旧预设卡片。
  const renderModel = () => (
    <div className="space-y-6">
      <SettingsPageHeader title="模型" description="管理模型连接与用途安排；密钥只保存在本机安全存储中。" />
      <ModelRoutingSettings connectionsRaw={modelConnections} routesRaw={modelRoutes} legacyBaseUrl={form.llmBaseUrl} legacyModel={form.llmModel} onSave={async (connections, routes) => {
        if (preview || !window.electronAPI) return
        await window.electronAPI.settings.set('modelConnections', connections)
        await window.electronAPI.settings.set('modelRoutes', routes)
        setModelConnections(connections)
        setModelRoutes(routes)
      }} />
      <SettingCard>
        <button type="button" onClick={() => setShowAdvancedModel((value) => !value)} aria-expanded={showAdvancedModel} className="flex w-full items-center justify-between gap-3 text-left">
          <span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>高级设置</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>预算和生成参数只在需要时查看。</span></span>
          <ChevronRight size={14} className={showAdvancedModel ? 'rotate-90 transition' : 'transition'} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        </button>
        {showAdvancedModel && <div className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
          <div data-testid="settings-model-budget"><div className="mb-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>运行预算</div><div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>输入与输出 Token 合计；0 表示不限制。</div><div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>会话预算（Token）<input aria-label="会话预算（Token）" value={form.sessionTokenBudget} onChange={(event) => update('sessionTokenBudget', event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>每日预算（Token）<input aria-label="每日预算（Token）" value={form.dailyTokenBudget} onChange={(event) => update('dailyTokenBudget', event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Temperature<input aria-label="Temperature" value={form.llmTemperature} onChange={(event) => update('llmTemperature', event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Top P<input aria-label="Top P" value={form.llmTopP} onChange={(event) => update('llmTopP', event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>最大输出 Token<input aria-label="最大输出 Token" value={form.llmMaxTokens} onChange={(event) => update('llmMaxTokens', event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label></div>
        </div>}
      </SettingCard>
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
      <SettingsPageHeader title="权限与自动化" description="决定 Agent 何时需要确认，以及哪些明确规则可以覆盖默认策略。" />
      <SettingCard>
        <SettingRow label="执行模式" description="工具调用默认确认策略；完全访问仍由对话页的审批入口控制。" scope="影响后续任务" stacked>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            { value: 'auto', label: '自动', desc: '仅破坏性操作需确认；工作区写入' },
            { value: 'confirm-all', label: '全部确认', desc: '每次工具调用都需审批；工作区写入' },
            { value: 'plan-first', label: '先计划', desc: 'AI 先说计划再执行；工作区写入' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { void updateAndPersist('executionMode', opt.value) }}
              className="rounded-[var(--radius-md)] border px-3 py-3 text-left text-xs transition"
              data-selected={form.executionMode === opt.value ? 'true' : undefined}
              style={{ borderColor: form.executionMode === opt.value ? 'var(--accent)' : 'var(--border-subtle)', background: form.executionMode === opt.value ? 'var(--accent-subtle)' : 'transparent' }}
            >
              <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</div>
              <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
            </button>
          ))}
        </div>
        </SettingRow>
      </SettingCard>
      <SettingCard>
        <SettingRow label="自定义规则" description="明确的命令、工具或路径规则可以覆盖默认审批方式；保存后立即交给权限引擎。" scope="实时生效" stacked>
        <PermissionRulesEditor
          value={form.permissionRules}
          onChange={(json) => update('permissionRules', json)}
        />
        </SettingRow>
      </SettingCard>
    </div>
  )

  const renderConnection = () => (
    <div className="space-y-6">
      <SettingsPageHeader title="MCP" description="连接外部工具和服务，扩展 Agent 能力；每个服务独立管理。" />

      <SettingCard>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>已连接服务</div>
        <button
          onClick={() => setMcpAdding(!mcpAdding)}
          className="h-8 shrink-0 rounded-[var(--radius-md)] border px-3 text-xs transition"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-fg)' }}
        >
          {mcpAdding ? '取消' : '+ 添加'}
        </button>
      </div>
      </SettingCard>

      {mcpAdding && (
        <SettingCard>
        <div className="space-y-2" data-testid="mcp-connection-form">
          <input
            type="text"
            value={newMcp.name}
            onChange={e => setNewMcp(m => ({ ...m, name: e.target.value }))}
            placeholder="名称（如 filesystem）"
            className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
          />
          <select
            value={newMcp.transport}
            onChange={e => setNewMcp(m => ({ ...m, transport: e.target.value as 'stdio' | 'sse' }))}
            className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
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
              className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
            />
          ) : (
            <>
              <input
                type="text"
                value={newMcp.command}
                onChange={e => setNewMcp(m => ({ ...m, command: e.target.value }))}
                placeholder="命令（如 npx, node, python3）"
              className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
              />
              <input
                type="text"
                value={newMcp.args}
                onChange={e => setNewMcp(m => ({ ...m, args: e.target.value }))}
                placeholder="参数（空格分隔）"
              className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
              />
            </>
          )}
          <textarea
            value={newMcp.env}
            onChange={e => setNewMcp(m => ({ ...m, env: e.target.value }))}
            placeholder="环境变量（每行 KEY=VALUE，可选）"
            rows={2}
            className="theme-input mb-2 w-full rounded-[var(--radius-md)] border px-2 py-1.5 text-xs outline-none"
          />
          <button
            type="button"
            onClick={handleAddMcp}
            disabled={!newMcp.name || (newMcp.transport === 'sse' ? !newMcp.url.trim() : !newMcp.command)}
            className="rounded-[var(--radius-md)] px-3 py-1 text-xs font-medium transition disabled:opacity-40"
            style={{ background: 'var(--accent-emphasis)' }}
          >
            连接
          </button>
        </div>
        </SettingCard>
      )}

      {mcpServers.length === 0 && !mcpAdding && (
        <SettingCard>
        <div className="border-t border-dashed pt-3 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          暂无 MCP 服务器，点击"+ 添加"连接外部能力
        </div>
        </SettingCard>
      )}

      <div className="space-y-2">
        {mcpServers.map(server => {
          const st = mcpStatuses.find(s => s.id === server.id)
          return (
            <SettingCard key={server.id} testId={`settings-mcp-server-${server.id}`}>
            <div className="flex items-center justify-between gap-3">
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
                {st?.status === 'connected' && <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}><div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>工具许可</div><div className="space-y-1.5">{mcpTools.filter((tool) => tool.serverId === server.id).map((tool) => <label key={tool.name} className="flex min-w-0 items-start justify-between gap-3 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><span className="min-w-0"><span className="block break-words" style={{ color: 'var(--text-primary)' }}>{tool.name}</span>{tool.description && <span className="mt-0.5 block break-words text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.description}</span>}</span><input type="checkbox" aria-label={'允许 ' + tool.name} checked={tool.allowed} onChange={async (event) => { if (preview || !window.electronAPI) return; const result = await window.electronAPI.mcp.setToolAllowed(server.id, tool.name, event.target.checked); if (!result.success) toast(result.error || '工具许可未更新', 'error'); await refreshMcpStatus() }} /></label>)}</div></div>}
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                <button
                  onClick={() => handleToggleMcp(server.id)}
                  className={`h-8 min-w-12 rounded-[var(--radius-md)] border px-2 text-[10px] transition ${
                    server.enabled ? 'text-yellow-400' : 'text-green-400'
                  }`}
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {server.enabled ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => handleRemoveMcp(server.id)}
                  className="h-8 min-w-12 rounded-[var(--radius-md)] border px-2 text-[10px] text-red-400 transition"
                  style={{ borderColor: 'var(--border-subtle)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  删除
                </button>
              </div>
            </div>
            </SettingCard>
          )
        })}
      </div>
    </div>
  )

  const renderData = () => (
    <div className="space-y-6">
      <SettingsPageHeader title="数据与隐私" description="管理本地数据的迁移和备份，并明确哪些内容不会跟着备份文件离开设备。" />
      <SettingCard>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={dataBusy !== null}
            onClick={async () => {
              if (!window.electronAPI || dataBusy) return
              setDataBusy('export')
              try {
                const res = await window.electronAPI.data.export()
                if (res.success) toast(`导出成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆`, 'success')
                else if (res.error !== 'cancelled') toast(`导出失败: ${res.error}`, 'error')
              } finally { setDataBusy(null) }
            }}
            className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="flex min-w-0 items-center gap-2"><Upload size={15} className="shrink-0" style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导出数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>生成一份本地备份</span></span></span><ChevronRight size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>
          <button
            type="button"
            disabled={dataBusy !== null}
            onClick={async () => {
              if (!window.electronAPI || dataBusy) return
              setDataBusy('import')
              try {
                const res = await window.electronAPI.data.import()
                if (res.success) toast(`导入成功！${res.stats?.sessions} 个会话 + ${res.stats?.memories} 条记忆 + ${res.stats?.settings} 项设置`, 'success')
                else if (res.error !== 'cancelled') toast(`导入失败: ${res.error}`, 'error')
              } finally { setDataBusy(null) }
            }}
            className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="flex min-w-0 items-center gap-2"><Download size={15} className="shrink-0" style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导入数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>从本地备份恢复</span></span></span><ChevronRight size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </SettingCard>
      <SettingCard>
        <div className="grid gap-4 text-[11px] sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
          <div><div className="mb-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>备份包含</div><p>会话与消息、记忆条目、普通模型与伙伴偏好。</p></div>
          <div><div className="mb-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>备份不包含</div><p>API Key、MCP 密钥、权限规则与本机项目路径。</p></div>
        </div>
      </SettingCard>
    </div>
  )

  const renderAbout = () => (
    <div className="space-y-6">
      <SettingsPageHeader title="关于 My Agent" description="查看版本、运行环境和本机数据位置。" />
      <SettingCard>
        <div className="flex items-start gap-3"><span className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My Agent</span><span className="rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>开发中</span></div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>越探索，越着迷。</p>
        <div className="mt-4 grid gap-3 text-[11px] sm:grid-cols-3" style={{ color: 'var(--text-secondary)' }}><div><div style={{ color: 'var(--text-muted)' }}>版本</div><div className="mt-1">0.1.0</div></div><div><div style={{ color: 'var(--text-muted)' }}>运行环境</div><div className="mt-1">Electron</div></div><div><div style={{ color: 'var(--text-muted)' }}>数据位置</div><div className="mt-1">本机存储</div></div></div>
      </SettingCard>
      <SettingCard>
        <SettingRow label="开发者模式" description="开启后显示 Debug 与 Playground 入口；关闭不会删除任何数据或设置。" scope="本机">
          <button type="button" role="switch" aria-checked={form.developerMode === 'true'} onClick={() => update('developerMode', form.developerMode === 'true' ? 'false' : 'true')} className="relative h-5 w-9 shrink-0 rounded-full transition" style={{ background: form.developerMode === 'true' ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }} data-testid="settings-developer-mode"><span className="absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition" style={{ background: 'var(--text-primary)', left: form.developerMode === 'true' ? 'calc(100% - 1.125rem)' : '0.125rem' }} /></button>
        </SettingRow>
      </SettingCard>
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
      <SettingsLayout activeSection={page} onClose={() => { void persistSettings().then((saved) => { if (saved) onClose() }) }} panelOwnsScroll={embedded}
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
