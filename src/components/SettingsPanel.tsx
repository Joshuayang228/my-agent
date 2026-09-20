import { useState, useEffect, useCallback, useRef, useImperativeHandle, type Ref } from 'react'
import { useToast } from './Toast'
import { PermissionSettingsContent } from './settings/PermissionSettingsContent'
import { MemoryPanel } from './MemoryPanel'
import { SkillsPanel } from './SkillsPanel'
import { CharacterShelfPanel } from './CharacterShelfPanel'
import { ActionButton } from './foundation/ActionButton'
import { SettingsLayout, type SettingsPageId } from './settings/SettingsLayout'
import { CompanionSettingsContent, type CompanionExpertise } from './settings/CompanionSettingsContent'
import { SettingCard, SettingRow, SettingsPageHeader } from './settings/SettingsFields'
import { AboutSettingsContent } from './settings/AboutSettingsContent'
import { DataSettingsContent, type DataSettingsAction } from './settings/DataSettingsContent'
import { AppearanceSettingsContent } from './settings/AppearanceSettingsContent'
import { ModelRoutingSettings } from './settings/ModelRoutingSettings'
import { ModelAdvancedSettings } from './settings/ModelAdvancedSettings'
import { modelParameterError } from '../shared/model-parameters'
import { resolveRoutedConfigs } from '../shared/model-routing'
import { backupFailureMessage } from '../shared/backup-errors'
import { McpServiceCard, type McpServiceState } from './settings/McpServiceCard'
import type { McpServerStatus } from '../shared/types'
import { McpConnectionForm } from './settings/McpConnectionForm'

interface SettingsForm {
  llmTemperature: string
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
  sessionTokenBudget: string
  dailyTokenBudget: string
  /** PermissionRule[] JSON — 自定义命令/工具规则 */
  permissionRules: string
  developerMode: string
}

type McpServerEntry = import('../shared/types').McpServerConfig

interface McpToolEntry { serverId: string; serverName: string; name: string; description: string; allowed: boolean }

const DEFAULTS: SettingsForm = {
  llmTemperature: '0.7',
  companionResponseNote: '',
  activeRoleId: 'lin',
  executionMode: 'auto',
  userExpertiseLevel: 'auto',
  companionMomentTipsMuted: 'false',
  companionMomentTipsQuietStart: '22',
  companionMomentTipsQuietEnd: '8',
  companionMomentTipsMaxPerDay: '3',
  companionProactiveGreetingEnabled: 'false',
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

interface SettingsPanelProps {
  onClose: () => void
  saveBeforeLeaveRef?: Ref<() => Promise<boolean>>
  currentTheme?: string
  onThemeChange?: (themeId: string) => void
  /** Playground 只读预览：不读取、写入或探测真实设置。 */
  preview?: boolean
  /** 只在 Playground preview 中生效；正式设置从外观开始，未配置模型时进入模型。 */
  previewInitialSection?: SettingsSection
}

export function SettingsPanel({
  onClose,
  saveBeforeLeaveRef,
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

  const [dataBusy, setDataBusy] = useState<DataSettingsAction | null>(null)
  const dataBusyRef = useRef(false)
  const [verifiedConnectionKey, setVerifiedConnectionKey] = useState('')
  const [protagonists, setProtagonists] = useState<RoleInfo[]>([])
  const [mcpServers, setMcpServers] = useState<McpServerEntry[]>([])
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([])
  const [mcpTools, setMcpTools] = useState<McpToolEntry[] | null>(null)
  const [mcpBusy, setMcpBusy] = useState(false)
  const mcpBusyRef = useRef(false)
  const mcpNavigationPendingRef = useRef(false)
  const mcpFormBeforeLeaveRef = useRef<(() => boolean) | null>(null)
  const mcpLoginRef = useRef<string | null>(null)
  useEffect(() => () => {
    const id = mcpLoginRef.current
    if (id) void window.electronAPI?.mcp.cancelLogin(id).catch(() => toast('登录取消状态未确认，主进程将在超时后清理。', 'warning'))
  }, [activeSection, toast])
  const [mcpReadError, setMcpReadError] = useState('')
  const mcpReadGeneration = useRef(0)
  const [modelConnections, setModelConnections] = useState('[]')
  const [modelConfigurationRevision, setModelConfigurationRevision] = useState(0)
  const [modelRoutes, setModelRoutes] = useState('[]')
  const modelBeforeLeaveRef = useRef<(() => boolean) | null>(null)
  const [mcpAdding, setMcpAdding] = useState(false)

  useEffect(() => {
    if (preview) setActiveSection(previewInitialSection ?? 'appearance')
  }, [preview, previewInitialSection])
  // 背景：全表保存会把未编辑的旧配置覆盖回去。只排队真实修改，串行落盘；失败项保留供重试。
  const settingsLoadedRef = useRef(false)
  const pendingSettingsRef = useRef(new Map<keyof SettingsForm, string>())
  const savingRef = useRef<Promise<boolean> | null>(null)
  const permissionSavesRef = useRef(0)

  useEffect(() => {
    if (preview || !window.electronAPI) return
    // 普通设置防抖和在途保存不经过模型草稿门控；留页等待原队列完成，不能在卸载中赌异步写盘。
    // 只检查实时队列与保存锁，失败项保留重试；清空后必须放行，预览不得拦截生产窗口。
    const preventPendingLoss = (event: BeforeUnloadEvent) => {
      if (!pendingSettingsRef.current.size && !savingRef.current && !permissionSavesRef.current && !mcpNavigationPendingRef.current && mcpFormBeforeLeaveRef.current?.() !== false) return
      event.preventDefault()
      event.returnValue = ''
      toast('设置尚未保存完成，请稍后再离开；保存失败时请重试。', 'warning')
    }
    window.addEventListener('beforeunload', preventPendingLoss)
    return () => window.removeEventListener('beforeunload', preventPendingLoss)
  }, [preview, toast])

  const applyMcpStatuses = useCallback((statuses: McpServerStatus[]) => {
    setMcpStatuses(statuses)
  }, [])

  const refreshMcpStatus = useCallback(async () => {
    if (preview || !window.electronAPI?.mcp?.status) return
    const generation = ++mcpReadGeneration.current
    try {
      const statuses = await window.electronAPI.mcp.status()
      if (generation !== mcpReadGeneration.current) return
      const tools = window.electronAPI.mcp.listTools ? await window.electronAPI.mcp.listTools() : []
      if (generation !== mcpReadGeneration.current) return
      applyMcpStatuses(statuses)
      setMcpTools(tools)
      setMcpReadError('')
    } catch {
      if (generation !== mcpReadGeneration.current) return
      setMcpTools(null)
      setMcpReadError('连接状态或工具清单读取失败，请刷新重试。')
    }
  }, [preview, applyMcpStatuses])

  /**
   * 背景：MCP 列表整体保存，连续操作可能用旧快照覆盖另一次修改。
   * 设计意图：串行化当前设置页的变更，失败留在原页面，刷新重试不伪装成功。
   * 关键约束：先同步占用再 await，固定控件不卸载；不代替主进程确认和权限检查。
   */
  const runMcpAction = async (action: () => Promise<void>, protectNavigation = true) => {
    // 向导保存后刷新前，管理操作仍持有旧整表快照；串行化两个入口以免覆盖新连接。
    // 锁住整个向导周期而非只锁请求瞬间，保存刷新成功或取消后才恢复已有服务操作。
    if (mcpAdding || mcpBusyRef.current || preview || !window.electronAPI) return
    mcpBusyRef.current = true
    // 普通管理请求必须保留结果接收页；OAuth 登录仍沿用离页取消，不由此锁改变其生命周期。
    mcpNavigationPendingRef.current = protectNavigation
    setMcpBusy(true)
    try { await action() }
    catch { toast('MCP 操作未完成，请重试', 'error') }
    finally { mcpNavigationPendingRef.current = false; mcpBusyRef.current = false; setMcpBusy(false) }
  }

  useEffect(() => {
    if (preview) return
    document.documentElement.dataset.fontScale = fontScale
    localStorage.setItem('uiFontScale', fontScale)
  }, [fontScale, preview])

  useEffect(() => {
    if (preview || !window.electronAPI) return
    window.electronAPI.settings.get().then((s) => {
      setForm({
        llmTemperature: s.llmTemperature || DEFAULTS.llmTemperature,
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
    const unsubscribe = window.electronAPI.mcp.onStatusChanged?.((snapshot) => {
      // 背景：断开推送会与旧查询交错；新事件使旧读取失效而不等待旧请求，工具清单也必须属于同一代快照。
      const generation = ++mcpReadGeneration.current
      applyMcpStatuses(snapshot)
      setMcpTools(null)
      if (window.electronAPI.mcp.listTools) {
        void window.electronAPI.mcp.listTools().then((tools) => {
          if (generation !== mcpReadGeneration.current) return
          setMcpTools(tools)
          setMcpReadError('')
        }).catch(() => {
          if (generation !== mcpReadGeneration.current) return
          setMcpTools(null)
          setMcpReadError('连接状态或工具清单读取失败，请刷新重试。')
        })
      }
    })
    return () => { mcpReadGeneration.current++; unsubscribe?.() }
  }, [preview, refreshMcpStatus, applyMcpStatuses])

  const persistSettings = useCallback((): Promise<boolean> => {
    if (savingRef.current) return savingRef.current
    if (preview || !window.electronAPI || !settingsLoadedRef.current) return Promise.resolve(true)
    const flush = async () => {
      try {
        while (pendingSettingsRef.current.size) {
          const [key, value] = pendingSettingsRef.current.entries().next().value!
          const parameterError = modelParameterError(key, value)
          if (parameterError) {
            setSaveFailed(true)
            if (activeSectionRef.current !== 'model') toast(parameterError, 'error')
            return false
          }
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
        // 伙伴和模型页已有行内重试入口；重复 Toast 会遮挡草稿，其他页仍需失败通知。
        if (activeSectionRef.current !== 'companion' && activeSectionRef.current !== 'model') toast('设置自动保存失败，修改仍保留，请重试', 'error')
        return false
      }
    }
    savingRef.current = flush().finally(() => { savingRef.current = null })
    return savingRef.current
  }, [preview, toast])

  // 背景：子页草稿不属于自动保存字段；意图：所有导航先检查再清空保存队列；约束：防抖仍只调用 persistSettings，不能自动提交连接草稿。
  const prepareToLeave = useCallback(async () => {
    if (mcpNavigationPendingRef.current || mcpFormBeforeLeaveRef.current?.() === false) {
      toast('MCP 操作正在完成，请稍后再离开。', 'warning')
      return false
    }
    if (permissionSavesRef.current) {
      toast('权限设置正在保存，请稍后再离开。', 'warning')
      return false
    }
    if (modelBeforeLeaveRef.current && !modelBeforeLeaveRef.current()) return false
    if (!(await persistSettings())) return false
    if (permissionSavesRef.current || mcpNavigationPendingRef.current || mcpFormBeforeLeaveRef.current?.() === false) return false
    return modelBeforeLeaveRef.current?.() ?? true
  }, [persistSettings, toast])
  useImperativeHandle(saveBeforeLeaveRef, () => prepareToLeave, [prepareToLeave])

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

  const savePermissionSetting = async (key: 'executionMode' | 'permissionRules', value: string) => {
    if (preview) { setForm(current => ({ ...current, [key]: value })); return }
    if (!window.electronAPI) throw new Error('设置服务不可用')
    // 权限请求不进入自动保存队列；独立计数保护离页，避免一个请求完成后释放另一个在途请求。
    // 仅记录等待状态，不重放权限写入；失败由原表单保留草稿并提示重试，finally 必须释放计数。
    permissionSavesRef.current++
    try {
      await window.electronAPI.settings.set(key, value)
      setForm(current => ({ ...current, [key]: value }))
    } finally { permissionSavesRef.current-- }
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

  const handleRemoveMcp = useCallback(async (id: string) => {
    let saved = false
    try {
      const updated = mcpServers.filter(s => s.id !== id)
      await saveMcpList(updated)
      saved = true
      if (!preview) await window.electronAPI?.mcp.disconnect(id)
      await refreshMcpStatus()
    } catch {
      toast(saved ? '配置已删除，但未能确认服务断开，请重启应用检查' : 'MCP 配置未删除，请重试', 'warning')
    }
  }, [mcpServers, preview, saveMcpList, refreshMcpStatus, toast])

  const handleToggleMcp = useCallback(async (id: string) => {
    const server = mcpServers.find(s => s.id === id)
    if (!server) return
    let saved = false
    try {
      if (server.enabled) {
        const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: false } : s)
        // 保存可能失败或被取消；先保留原连接，成功后才执行禁用，避免界面与实际连接相反。
        await saveMcpList(updated)
        saved = true
        if (!preview) await window.electronAPI?.mcp.disconnect(id)
      } else {
        const updated = mcpServers.map(s => s.id === id ? { ...s, enabled: true } : s)
        await saveMcpList(updated)
        saved = true
        if (server.oauth) mcpLoginRef.current = server.id
        const result = preview ? undefined : await window.electronAPI?.mcp.connect({ ...server, enabled: true })
        if (mcpLoginRef.current === server.id) mcpLoginRef.current = null
        if (result && !result.success) toast(`MCP 连接失败: ${result.error}`, 'error')
      }
      await refreshMcpStatus()
    } catch {
      toast(saved ? '配置已保存，但未能确认连接状态，请重启应用检查' : 'MCP 状态未改变，请重试', 'warning')
    } finally { if (mcpLoginRef.current === id) mcpLoginRef.current = null }
  }, [mcpServers, preview, saveMcpList, refreshMcpStatus, toast])

  // ── 各区块渲染 ──

  const renderGeneral = () => <AppearanceSettingsContent theme={currentTheme} fontScale={fontScale} onThemeChange={onThemeChange} onFontScaleChange={setFontScale} />

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

  const primaryTestTarget = resolveRoutedConfigs(modelConnections, modelRoutes, 'primary')[0]
  // Provider 预设仍由 PROVIDER_PRESET_GROUPS 作为 Playground 与生产资产的唯一事实源；正式页不再复制旧预设卡片。
  const renderModel = () => (
    <div className="space-y-4">
      <SettingsPageHeader title="模型" description="管理模型连接与用途安排；密钥只保存在本机安全存储中。" />
      <ModelRoutingSettings beforeLeaveRef={modelBeforeLeaveRef} connectionsRaw={modelConnections} routesRaw={modelRoutes} onTestConnection={async (connection, draftApiKey) => {
        if (preview || !window.electronAPI) return { ok: false, error: '当前仅可在正式设置中测试' }
        const apiKey = draftApiKey?.trim()
        return window.electronAPI.settings.testConnection({
          baseUrl: connection.baseUrl,
          model: connection.model,
          provider: connection.provider,
          ...(apiKey ? { apiKey } : { useStoredApiKey: true, connectionId: connection.id }),
        })
      }} onFetchModels={async (connection, draftApiKey) => {
        if (preview || !window.electronAPI) return { ok: false, error: '当前仅可在正式设置中获取模型', reason: 'network', retryable: false }
        const apiKey = draftApiKey?.trim()
        return window.electronAPI.settings.fetchModels({
          baseUrl: connection.baseUrl,
          provider: connection.provider,
          ...(apiKey ? { apiKey } : { useStoredApiKey: true, connectionId: connection.id }),
        })
      }} onSave={async (connections, routes) => {
        if (preview || !window.electronAPI) return
        await window.electronAPI.settings.saveModelConfiguration({ connections, routes })
        try {
          const parsed = JSON.parse(connections)
          setModelConnections(JSON.stringify(Array.isArray(parsed) ? parsed.map((item) => {
            if (!item || typeof item !== 'object') return item
            const connection = item as Record<string, unknown>
            return { ...connection, apiKey: '', hasApiKey: Boolean(typeof connection.apiKey === 'string' && connection.apiKey.trim()) || connection.hasApiKey === true }
          }) : []))
        } catch {
          setModelConnections('[]')
        }
        setModelRoutes(routes)
        // 相同端点换 Key 后脱敏快照可能不变；成功写入仍让旧测试失效，不用密钥原文作比较。
        setModelConfigurationRevision(revision => revision + 1)
      }} />
      <ModelAdvancedSettings values={form} onChange={update} saveFailed={saveFailed} onRetrySave={() => { void persistSettings() }}
        testIdentity={JSON.stringify([modelConnections, modelRoutes, modelConfigurationRevision])}
        testTarget={primaryTestTarget ? `${primaryTestTarget.name} · ${primaryTestTarget.model}` : undefined}
        onTest={async () => {
          if (preview || !window.electronAPI || !primaryTestTarget) return { ok: false, error: '请先为主对话安排可用模型。' }
          return window.electronAPI.settings.testConnection({ connectionId: primaryTestTarget.id, useStoredApiKey: true,
            baseUrl: primaryTestTarget.baseUrl, model: primaryTestTarget.model, provider: primaryTestTarget.provider })
        }} />
    </div>
  )
  const renderMemory = () => (
    <MemoryPanel onClose={() => setActiveSection('companion')} {...(preview ? { previewMemories: [], readOnly: true } : {})} />
  )

  const renderTools = () => preview
    ? <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Skills 预览不读取本机文件。</div>
    : <SkillsPanel visible />

  const renderSecurity = () => (
    <div className="space-y-4">
      <SettingsPageHeader title="权限与自动化" description="让你决定 Agent 什么时候先问你、什么时候按计划推进；越高风险的能力越应该明确。" />
      <PermissionSettingsContent mode={form.executionMode} onModeChange={value => savePermissionSetting('executionMode', value)}
        rules={form.permissionRules} onRulesChange={value => savePermissionSetting('permissionRules', value)} />
    </div>
  )

  const renderConnection = () => (
    <div className="space-y-4">
      <SettingsPageHeader title="MCP" description="连接外部工具和服务，扩展 Agent 能力；每个服务独立管理。" />

      <SettingCard>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>已连接服务</div>
        <button
          onClick={() => { if (!mcpBusyRef.current) setMcpAdding(true) }}
          disabled={mcpAdding || mcpBusy}
          className="h-8 shrink-0 rounded-[var(--radius-md)] border px-3 text-xs transition"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-fg)' }}
        >
          + 添加
        </button>
      </div>
      </SettingCard>

      {mcpAdding && !preview && <McpConnectionForm beforeLeaveRef={mcpFormBeforeLeaveRef} actions={window.electronAPI.mcp} onCancel={() => setMcpAdding(false)} onSaved={async (result) => {
        const settings = await window.electronAPI.settings.get()
        const servers = JSON.parse(settings.mcpServers || '[]')
        if (!Array.isArray(servers)) throw new Error('MCP 配置读取失败')
        setMcpServers(servers)
        await refreshMcpStatus()
        if (!result.ok) toast(result.error, 'warning')
        setMcpAdding(false)
      }} />}

      {mcpServers.length === 0 && !mcpAdding && (
        <SettingCard>
        <div className="border-t border-dashed pt-3 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          暂无 MCP 服务器，点击"+ 添加"连接外部能力
        </div>
        </SettingCard>
      )}

      {mcpReadError && <div role="alert" className="flex items-center justify-between gap-3 text-xs" style={{ color: 'var(--danger)' }}><span>{mcpReadError}</span><ActionButton disabled={mcpBusy} onClick={() => void runMcpAction(refreshMcpStatus)}>刷新</ActionButton></div>}
      <div className="space-y-3">
        {mcpServers.map((server) => {
          const current = mcpStatuses.find((item) => item.id === server.id)
          const status: McpServiceState = !server.enabled
            ? 'disabled'
            : current?.status === 'connected' || current?.status === 'connecting' || current?.status === 'error' || current?.status === 'auth'
              ? current.status
              : server.oauth ? 'auth' : 'disconnected'
          const error = current?.status === 'error'
            ? (current.error || (current.reconnecting ? '服务意外断开，正在尝试重新连接。' : '连接失败，请检查服务后重试。'))
            : undefined
          return <McpServiceCard key={server.id} id={server.id} name={server.name} enabled={server.enabled}
            transport={server.transport === 'streamable-http' ? '远程 · Streamable HTTP' : server.transport === 'sse' ? '远程 · SSE' : '本地 · stdio'} status={status}
            error={error}
            tools={mcpTools?.filter((tool) => tool.serverId === server.id).map((tool) => ({ id: tool.name, ...tool })) ?? null}
            busy={mcpBusy || mcpAdding} testId={`settings-mcp-server-${server.id}`}
            onEnabledChange={() => void runMcpAction(() => handleToggleMcp(server.id), !server.oauth)}
            onRemove={() => void runMcpAction(() => handleRemoveMcp(server.id))}
            onCancel={server.oauth ? () => { void window.electronAPI.mcp.cancelLogin(server.id).catch(() => toast('取消状态未确认，请重试。', 'warning')) } : undefined}
            onRetry={() => void runMcpAction(async () => {
              setMcpStatuses((items) => [...items.filter((item) => item.id !== server.id), { id: server.id, name: server.name, status: 'connecting', toolCount: 0 }])
              try {
                if (server.oauth) mcpLoginRef.current = server.id
                const result = await window.electronAPI.mcp.connect(server)
                if (!result.success) toast(result.error || '连接失败，请重试', 'error')
              } finally { if (mcpLoginRef.current === server.id) mcpLoginRef.current = null; await refreshMcpStatus() }
            }, !server.oauth)}
            onToolChange={(name, allowed) => void runMcpAction(async () => {
              const result = await window.electronAPI.mcp.setToolAllowed(server.id, name, allowed)
              if (!result.success) { toast(result.error || '工具许可未更新', 'error'); return }
              const allowedTools = (mcpTools ?? []).filter((tool) => tool.serverId === server.id && (tool.name === name ? allowed : tool.allowed)).map((tool) => tool.name)
              setMcpServers((items) => items.map((item) => item.id === server.id ? { ...item, allowedTools } : item))
              await refreshMcpStatus()
            })} />
        })}
      </div>
    </div>
  )

  const renderData = () => (
    <DataSettingsContent activeAction={dataBusy} onAction={async (action) => {
      if (preview) return { message: `已模拟${action === 'export' ? '导出' : '导入'}（仅样张反馈）` }
      if (!window.electronAPI) return { error: true, message: '请在桌面应用中管理备份。' }
      if (dataBusyRef.current) return null
      dataBusyRef.current = true
      setDataBusy(action)
      try {
        const result = await window.electronAPI.data[action]()
        if (!result.success && result.error === 'busy') return { error: true, message: '另一个备份操作正在进行，请完成后重试。' }
        if (!result.success) return result.error === 'cancelled' ? null : {
          error: true,
          message: backupFailureMessage(action, result.error),
        }
        return { message: `${action === 'export' ? '导出' : '导入'}成功：${result.stats?.sessions ?? 0} 个会话、${result.stats?.memories ?? 0} 条记忆、${result.stats?.livingAssets ?? 0} 条生活记录。` }
      } finally {
        dataBusyRef.current = false
        setDataBusy(null)
      }
    }} />
  )

  const renderAbout = () => (
    <AboutSettingsContent
      developerMode={form.developerMode === 'true'}
      onDeveloperModeChange={(enabled) => update('developerMode', enabled ? 'true' : 'false')}
    />
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
      <SettingsLayout activeSection={page} onClose={() => { void prepareToLeave().then((saved) => { if (saved) onClose() }) }} panelOwnsScroll={embedded}
        onSelect={(id) => {
          if (id === page) return
          void prepareToLeave().then((allowed) => { if (allowed) { setRoleShelfOpen(false); setActiveSection(PAGE_SECTIONS[id]) } })
        }}>
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
