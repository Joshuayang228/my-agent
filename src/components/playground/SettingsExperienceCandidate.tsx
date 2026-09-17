/**
 * 设置体验候选：只负责 Playground 的信息架构和组合态验证。
 *
 * 背景：正式 Settings 承载真实设置读取、自动保存、权限确认和敏感值脱敏，
 *       不能为了试验新的 IA 直接在生产面板上改默认行为。
 * 设计意图：用与生产能力对齐、但完全由 Renderer fixture 驱动的候选，先验证
 *       用户能否理解“日常设置 / 高级设置 / 低频入口”的边界。
 * 关键约束：不得调用 window.electronAPI，不展示真实 Key、MCP secret、权限规则或路径；
 *       所有开关、连接状态和输入都只存在于当前 Playground 会话。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PermissionSettingsContent } from '../settings/PermissionSettingsContent'
import { Brain, Check, ChevronRight, Circle, CircleHelp, Cloud, Database, Download, Eye, Heart, KeyRound, Link2, LockKeyhole, Palette, Plug, Save, Settings2, ShieldCheck, SlidersHorizontal, Upload, UserRound, Wrench, Activity, Gauge, Plus, ListChecks, ArrowLeft, ArrowUp, ArrowDown, GripVertical, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import { FONT_SCALE_ASSETS } from '../../shared/design-asset-registry'
import { SettingsLayout, type SettingsPageId } from '../settings/SettingsLayout'
import { ScopeBadge, SettingCard, SettingRow, SettingSwitch, SettingsPageHeader } from '../settings/SettingsFields'
import { CompanionSettingsContent } from '../settings/CompanionSettingsContent'
import { AboutSettingsContent } from '../settings/AboutSettingsContent'
import { McpServiceCard } from '../settings/McpServiceCard'
import { SkillDetail, SkillFilePreview, SkillListCard } from '../settings/SkillViews'
import type { SkillInfo } from '../../shared/types'
import { McpConnectionPreview } from './McpConnectionPreview'
import { THEME_STUDIES, getThemeStudyStyle, type ThemeStudyId } from './foundation-themes'
import { PROVIDER_PRESET_GROUPS } from '../../shared/provider-presets'
import { JSON_SCHEMA, load } from 'js-yaml'
import codeReview from '../../../electron/skills-builtin/code-review/SKILL.md?raw'
import contentCreator from '../../../electron/skills-builtin/content-creator/SKILL.md?raw'

/**
 * 背景：用户要求用真实内置 Skill 验收详情，手写摘要会偏离源文件。
 * 设计意图：仅导入明确选定的两个静态样本，用现有 YAML 库读取元信息。
 * 关键约束：不是生产 loader，不扫描资产目录、不执行正文、不写生产启用状态。
 */
const skillsSamples = [codeReview, contentCreator].map((raw) => {
  const header = /^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw)
  const parsed: unknown = header ? load(header[1], { schema: JSON_SCHEMA }) : null
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('内置 Skill 样张缺少有效元信息')
  }
  const data = parsed as Record<string, unknown>
  const field = (key: string) => typeof data[key] === 'string' ? data[key].trim() : ''
  if (!field('name') || !field('description')) throw new Error('内置 Skill 样张缺少名称或描述')
  return {
    name: field('name'),
    description: field('description'),
    trigger: field('when_to_use'),
    author: field('author') || '未声明',
    version: field('version') || '未声明',
    raw,
  }
})

export type SettingsCandidateSection = SettingsPageId

export interface SettingsExperienceCandidateProps {
  companionDetail?: ReactNode
  memoryDetail?: ReactNode
  initialSection?: SettingsCandidateSection
  onOpenRoleShelf?: () => void
}
interface CandidateSwitchProps { checked: boolean; compact?: boolean; description: string; label: string; onChange: (checked: boolean) => void; scope?: string; testId: string }

export { SETTINGS_NAV_GROUPS as SETTINGS_CANDIDATE_NAV_GROUPS } from '../settings/SettingsLayout'

function CandidateSwitch({ checked, compact = false, description, label, onChange, scope, testId }: CandidateSwitchProps) {
  return <SettingSwitch checked={checked} compact={compact} description={description} label={label} onChange={onChange} scope={scope} testId={testId} />
}
function CandidatePageHeader({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return <SettingsPageHeader icon={icon} eyebrow="设置样张" badge="仅供预览" title={title} description={description} />
}

function AppearancePage({ activeTheme, fontScale, onFontScaleChange, onThemeChange }: { activeTheme: ThemeStudyId; fontScale: string; onFontScaleChange: (value: string) => void; onThemeChange: (value: ThemeStudyId) => void }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-appearance"><CandidatePageHeader icon={<Palette size={14} />} title="外观与界面" description="调整应用主题和界面显示；主题选项来自基础设计资产。" /><SettingCard><SettingRow scope="本机" label="界面语言" description="当前只提供简体中文，语言切换接入前保持为说明状态。" icon={<CircleHelp size={15} />}><span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>简体中文</span></SettingRow></SettingCard><SettingCard testId="settings-candidate-theme-card"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>主题</h3></div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{THEME_STUDIES.find((theme) => theme.id === activeTheme)?.label ?? activeTheme}</span></div><div className="grid gap-2 sm:grid-cols-2">{THEME_STUDIES.map((theme) => { const selected = activeTheme === theme.id; return <button key={theme.id} data-testid={`settings-candidate-theme-${theme.id}`} type="button" aria-pressed={selected} onClick={() => onThemeChange(theme.id)} className="rounded-[var(--radius-md)] border p-3 text-left transition" data-selected={selected ? 'true' : undefined} style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border" style={{ background: theme.colors.accent, borderColor: 'var(--border-color)' }} /><span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{theme.label}</span><Check size={13} aria-hidden="true" className={`ml-auto shrink-0 ${selected ? 'visible' : 'invisible'}`} style={{ color: 'var(--accent-fg)' }} /></div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{theme.description}</div></button> })}</div></SettingCard><SettingCard><SettingRow scope="本机" label="字体大小" description="只影响本机界面字号；不改变内容本身。" icon={<Eye size={15} />} stacked><div className="grid gap-2 sm:grid-cols-3">{FONT_SCALE_ASSETS.map((scale) => { const selected = fontScale === scale.id; return <button key={scale.id} type="button" aria-pressed={selected} onClick={() => onFontScaleChange(scale.id)} className="rounded-[var(--radius-md)] border px-3 py-2 text-left transition" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{scale.labelZh}</div><div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{scale.descriptionZh}</div></button> })}</div></SettingRow></SettingCard></div>
}

function CompanionPage({ momentTips, onMomentTipsChange, onOpenRoleShelf, onProactiveGreetingChange, proactiveGreeting, expertise, onExpertiseChange }: { momentTips: boolean; onMomentTipsChange: (value: boolean) => void; onOpenRoleShelf?: () => void; onProactiveGreetingChange: (value: boolean) => void; proactiveGreeting: boolean; expertise: string; onExpertiseChange: (value: string) => void }) {
  return <CompanionSettingsContent
    expertise={expertise as 'auto' | 'novice' | 'intermediate' | 'expert'}
    onExpertiseChange={onExpertiseChange as (value: 'auto' | 'novice' | 'intermediate' | 'expert') => void}
    momentTipsMuted={!momentTips}
    onMomentTipsMutedChange={(muted) => onMomentTipsChange(!muted)}
    proactiveGreeting={proactiveGreeting}
    onProactiveGreetingChange={onProactiveGreetingChange}
    quietStart="22"
    quietEnd="8"
    maxPerDay="3"
    onQuietStartChange={() => undefined}
    onQuietEndChange={() => undefined}
    onMaxPerDayChange={() => undefined}
    note="当我把事情排得太满时，提醒我留一点空白。"
    onNoteChange={() => undefined}
    testIdPrefix="settings-candidate-"
    roleAction={<button type="button" onClick={onOpenRoleShelf} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} data-testid="settings-candidate-open-role-shelf">小林 · 管理角色架 <ChevronRight size={12} /></button>}
  />
}

type ModelPurpose = 'primary' | 'auxiliary' | 'image' | 'unused'
type CapabilityState = 'supported' | 'unknown' | 'unsupported'
type ConnectionSource = 'official' | 'coding' | 'relay' | 'local' | 'custom'
type ModelFixture = { id: string; enabled: boolean; visibleInPicker: boolean; purpose: ModelPurpose; image: CapabilityState; tools: CapabilityState }
type ConnectionAdapter = 'openai-compatible' | 'anthropic' | 'google'
type ModelConnectionFixture = { id: string; name: string; source: ConnectionSource; protocol?: string; providerLabel: string; baseUrl: string; credentialStatus: 'missing' | 'stored'; status: 'untested' | 'healthy' | 'failed'; models: ModelFixture[] }
type ModelRoutePurpose = 'primary' | 'auxiliary' | 'image'
type ModelRoute = { connectionId: string; modelId: string; enabled: boolean }
type ModelFetchState = 'idle' | 'loading' | 'success' | 'empty' | 'unsupported' | 'error'

const CONNECTION_SOURCE_OPTIONS: Array<{ id: ConnectionSource; label: string; description: string }> = [
  { id: 'official', label: '官方服务商', description: '官方 API 入口' },
  { id: 'coding', label: '编程套餐', description: '面向编程工具的独立套餐入口' },
  { id: 'relay', label: '聚合 / 中转', description: '聚合平台、中转站和统一网关' },
  { id: 'local', label: '本地模型', description: 'Ollama、LM Studio 等本机服务' },
  { id: 'custom', label: '自定义连接', description: '填写协议适配器和 Base URL' },
]
const ROUTE_PURPOSES: Array<{ id: ModelRoutePurpose; label: string; description: string }> = [
  { id: 'primary', label: '主对话', description: '普通聊天和连续对话' },
  { id: 'auxiliary', label: '辅助任务', description: '标题、整理和轻量后台任务' },
  { id: 'image', label: '生图', description: '图像生成调用' },
]
const FETCHED_MODEL_FIXTURES = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'text-embedding-3-small']

function sourceLabel(value: ConnectionSource) { return CONNECTION_SOURCE_OPTIONS.find((item) => item.id === value)?.label ?? '自定义连接' }
const CONNECTION_ADAPTER_LABELS: Record<ConnectionAdapter, string> = { 'openai-compatible': 'OpenAI Compatible', anthropic: 'Anthropic', google: 'Gemini' }
type CandidateProvider = { providerId: string; label: string; baseUrl: string; group?: string }

/**
 * 背景：候选分类要合并聚合入口，同时保留独立套餐；设计意图：只映射展示来源，不改生产预设。
 * 关键约束：普通 Ark 归聚合，volces_coding 仍按套餐分组；地址和身份继续读取共享注册表。
 */
function providerSource(provider: CandidateProvider): ConnectionSource {
  if (provider.group === '编程套餐') return 'coding'
  if (provider.group === '聚合与代理' || provider.providerId === 'volces') return 'relay'
  if (provider.group === '本地 / 自定义') return 'local'
  return 'official'
}
function createConnection(provider: { providerId: string; label: string; baseUrl: string; group?: string }, index = 0): ModelConnectionFixture {
  return { id: `connection-${provider.providerId}-${index}`, name: index === 0 ? `${provider.label} 主账号` : `${provider.label} 连接`, source: providerSource(provider), providerLabel: provider.label, baseUrl: provider.baseUrl, credentialStatus: 'stored', status: 'untested', models: index === 0 ? [{ id: 'gpt-4o', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'gpt-4o-mini', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'image-model-id', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }] : [] }
}

function ModelPage({ modelStatus, onModelStatusChange, selectedProvider }: { modelStatus: 'idle' | 'success' | 'error'; onModelStatusChange: (status: 'idle' | 'success' | 'error') => void; selectedProvider: string; onProviderChange: (provider: string) => void }) {
  const allProviders = PROVIDER_PRESET_GROUPS.flatMap((group) => group.items).filter((provider) => provider.providerId !== 'miyang')
  const firstProvider = allProviders.find((provider) => provider.providerId === selectedProvider) ?? allProviders[0]
  const [previewState, setPreviewState] = useState<'empty' | 'one' | 'two'>('one')
  const [connections, setConnections] = useState<ModelConnectionFixture[]>(() => [createConnection(firstProvider)])
  const [routes, setRoutes] = useState<Record<ModelRoutePurpose, ModelRoute[]>>({ primary: [{ connectionId: connections[0]?.id ?? '', modelId: 'gpt-4o', enabled: true }, { connectionId: connections[0]?.id ?? '', modelId: 'gpt-4o-mini', enabled: true }], auxiliary: [{ connectionId: connections[0]?.id ?? '', modelId: 'gpt-4o-mini', enabled: true }], image: [{ connectionId: connections[0]?.id ?? '', modelId: 'image-model-id', enabled: true }] })
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [source, setSource] = useState<ConnectionSource>('relay')
  const [providerId, setProviderId] = useState('openrouter')
  const [adapter, setAdapter] = useState<ConnectionAdapter>('openai-compatible')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({})
  const fetchTimers = useRef(new Map<string, number>())
  const [fetchStates, setFetchStates] = useState<Record<string, ModelFetchState>>({})
  const [fetchedModelsByConnection, setFetchedModelsByConnection] = useState<Record<string, string[]>>({})
  useEffect(() => {
    const timers = fetchTimers.current
    return () => { timers.forEach((timer) => window.clearTimeout(timer)); timers.clear() }
  }, [])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sessionBudget, setSessionBudget] = useState('0')
  const [dailyBudget, setDailyBudget] = useState('0')
  const [temperature, setTemperature] = useState('0.7')
  const selectedProviderConfig = allProviders.find((item) => item.providerId === providerId)
  const providerOptions = allProviders.filter((item) => providerSource(item) === source)
  const presetLabel = source === 'coding' ? '编程套餐' : source === 'relay' ? '聚合 / 中转服务' : source === 'local' ? '本地服务' : '官方服务商'
  const adapterFromProtocol = (protocol?: string): ConnectionAdapter => (Object.entries(CONNECTION_ADAPTER_LABELS).find(([, label]) => label === protocol)?.[0] as ConnectionAdapter | undefined) ?? 'openai-compatible'
  const closeForm = () => { setShowAdd(false); setEditingId(null); setApiKey('') }
  const openAdd = () => { setEditingId(null); chooseSource('relay'); setShowAdd(true); setApiKey('') }
  /**
   * 背景：已有连接只能看详情，改名称/地址/密钥没有入口。
   * 设计意图：编辑复用添加表单，不另造第二套字段。
   * 关键约束：保存只改连接身份，不重建模型清单和用途路由。
   */
  const openEdit = (connection: ModelConnectionFixture) => {
    setEditingId(connection.id)
    setSource(connection.source)
    setName(connection.name)
    setBaseUrl(connection.baseUrl)
    setApiKey('')
    if (connection.source === 'custom') {
      setAdapter(adapterFromProtocol(connection.protocol))
    } else {
      const provider = allProviders.find((item) => item.label === connection.providerLabel && providerSource(item) === connection.source) ?? allProviders.find((item) => providerSource(item) === connection.source)
      if (provider) setProviderId(provider.providerId)
    }
    setShowAdd(false)
  }
  const defaultConnectionName = (provider: { label: string }, sourceType: ConnectionSource) => sourceType === 'relay' ? `${provider.label} 聚合` : sourceType === 'local' ? provider.label : `${provider.label} 连接`
  /**
   * 背景：切换来源时旧 render 的选项仍属于上一类；设计意图：按目标来源选默认预设，整组同步。
   * 关键约束：不调用父级 Provider 选择，不改变已有样张或用途；换渠道清除临时 Key，自定义适配器独立保存。
   */
  const chooseSource = (next: ConnectionSource) => {
    setSource(next)
    setApiKey('')
    if (next === 'custom') { setName(''); setBaseUrl(''); setAdapter('openai-compatible'); return }
    const provider = next === 'relay' ? allProviders.find((item) => item.providerId === 'openrouter') : allProviders.find((item) => providerSource(item) === next)
    if (!provider) return
    setProviderId(provider.providerId)
    setName(defaultConnectionName(provider, next))
    setBaseUrl(provider.baseUrl)
  }
  const chooseProvider = (next: string) => {
    const provider = providerOptions.find((item) => item.providerId === next)
    if (!provider) return
    setProviderId(next)
    setName(defaultConnectionName(provider, source))
    setBaseUrl(provider.baseUrl)
    setApiKey('')
  }
  const addModelToConnection = (connectionId: string, nextModelId: string) => { const id = nextModelId.trim(); if (!id) return; setConnections((items) => items.map((connection) => connection.id !== connectionId || connection.models.some((model) => model.id === id) ? connection : { ...connection, models: [...connection.models, { id, enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }] })) }
  /**
   * 背景：获取动作在卡片头部，连接详情始终可见；设计意图：按连接保存候选和请求，成功后展示可直接加入的模型项。
   * 关键约束：这是隔离延时夹具，不访问供应商；重复点击不重复请求，卸载或重置样张必须清理定时器。
   */
  const fetchModels = (connectionId: string) => {
    if (fetchTimers.current.has(connectionId)) return
    const connection = connections.find((item) => item.id === connectionId)
    if (!connection) return
    setFetchStates((current) => ({ ...current, [connectionId]: 'loading' }))
    const timer = window.setTimeout(() => {
      fetchTimers.current.delete(connectionId)
      if (!connection.baseUrl.trim() || connection.credentialStatus === 'missing') {
        setFetchStates((current) => ({ ...current, [connectionId]: 'error' }))
        return
      }
      setFetchedModelsByConnection((current) => ({ ...current, [connectionId]: FETCHED_MODEL_FIXTURES }))
      setFetchStates((current) => ({ ...current, [connectionId]: 'success' }))
    }, 550)
    fetchTimers.current.set(connectionId, timer)
  }
  const submitModelDraft = (connection: ModelConnectionFixture) => {
    const modelId = modelDrafts[connection.id]?.trim()
    if (!modelId || connection.models.some((model) => model.id === modelId)) return
    addModelToConnection(connection.id, modelId)
    setModelDrafts((current) => ({ ...current, [connection.id]: '' }))
  }
  /**
   * 背景：预设不是协议或可调用性保证；设计意图：保存入口身份，仅自定义连接记录显式适配器。
   * 关键约束：连接不抢占用途路由；Key 只转换为样张状态后清空，不持久化、不发请求。
   */
  const finishSave = () => {
    if (!name.trim() || !baseUrl.trim()) return
    if (source !== 'custom' && (!selectedProviderConfig || providerSource(selectedProviderConfig) !== source)) return
    const patch = { name: name.trim(), source, protocol: source === 'custom' ? CONNECTION_ADAPTER_LABELS[adapter] : undefined, providerLabel: source === 'custom' ? '自定义连接' : selectedProviderConfig!.label, baseUrl: baseUrl.trim() }
    if (editingId) {
      setConnections((items) => items.map((connection) => connection.id !== editingId ? connection : { ...connection, ...patch, credentialStatus: apiKey.trim() ? 'stored' : connection.credentialStatus, status: 'untested' }))
    } else {
      const id = `connection-${crypto.randomUUID()}`
      setConnections((items) => [...items, { id, ...patch, credentialStatus: apiKey.trim() ? 'stored' : 'missing', status: 'untested', models: [] }])
    }
    closeForm()
  }
  const updateModel = (connectionId: string, modelIdValue: string, patch: Partial<ModelFixture>) => setConnections((items) => items.map((connection) => connection.id !== connectionId ? connection : { ...connection, models: connection.models.map((model) => model.id === modelIdValue ? { ...model, ...patch } : model) }))
  const removeModel = (connectionId: string, modelIdValue: string) => { setConnections((items) => items.map((connection) => connection.id !== connectionId ? connection : { ...connection, models: connection.models.filter((model) => model.id !== modelIdValue) })); setRoutes((current) => Object.fromEntries(Object.entries(current).map(([purpose, items]) => [purpose, items.filter((item) => !(item.connectionId === connectionId && item.modelId === modelIdValue))])) as Record<ModelRoutePurpose, ModelRoute[]>) }
  const testConnection = (connectionId: string) => {
    const connection = connections.find((item) => item.id === connectionId)
    if (!connection) return
    const valid = Boolean(connection.baseUrl.trim()) && connection.credentialStatus === 'stored'
    setConnections((items) => items.map((item) => item.id === connectionId ? { ...item, status: valid ? 'healthy' : 'failed' } : item))
    onModelStatusChange(valid ? 'success' : 'error')
  }
  const setPreview = (state: 'empty' | 'one' | 'two') => { fetchTimers.current.forEach((timer) => window.clearTimeout(timer)); fetchTimers.current.clear(); setFetchStates({}); setFetchedModelsByConnection({}); setModelDrafts({}); closeForm(); setPreviewState(state); if (state === 'empty') { setConnections([]); setRoutes({ primary: [], auxiliary: [], image: [] }); return }; const first = createConnection(firstProvider); if (state === 'one') { setConnections([first]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], auxiliary: [{ connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }); return }; const second = createConnection(allProviders.find((item) => item.providerId === 'openrouter') ?? allProviders[1], 1); second.name = '国际流动'; second.source = 'relay'; second.models = [{ id: 'deepseek-chat', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'deepseek-reasoner', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }]; setConnections([first, second]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: second.id, modelId: 'deepseek-chat', enabled: true }], auxiliary: [{ connectionId: second.id, modelId: 'deepseek-reasoner', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }) }
  const availableModels = connections.flatMap((connection) => connection.models.filter((model) => model.enabled).map((model) => ({ connectionId: connection.id, connectionName: connection.name, modelId: model.id })))
  const routeLabel = (route: ModelRoute) => { const connection = connections.find((item) => item.id === route.connectionId); return connection ? `${connection.name} · ${route.modelId}` : route.modelId }
  const addRoute = (purpose: ModelRoutePurpose, key: string) => { const [connectionId, modelId] = key.split('::'); if (!connectionId || !modelId) return; setRoutes((current) => ({ ...current, [purpose]: current[purpose].some((item) => item.connectionId === connectionId && item.modelId === modelId) ? current[purpose] : [...current[purpose], { connectionId, modelId, enabled: true }] })) }
  const moveRoute = (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => setRoutes((current) => { const next = [...current[purpose]]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, [purpose]: next } })
  const connectionForm = (
    <>
<div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{editingId ? '编辑连接' : '添加连接'}</h3>
          <button type="button" aria-label={editingId ? '关闭编辑连接' : '关闭添加连接'} title={editingId ? '关闭编辑连接' : '关闭添加连接'} onClick={closeForm} className="rounded p-1"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="连接入口类型">
          {CONNECTION_SOURCE_OPTIONS.map((item) => <button key={item.id} type="button" role="radio" aria-checked={source === item.id} onClick={() => chooseSource(item.id)} className="settings-option px-2.5 py-1.5 text-[10px]" data-selected={source === item.id ? 'true' : undefined}>{item.label}</button>)}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>连接名称
            <input aria-label="连接名称" value={name} onChange={(event) => setName(event.target.value)} placeholder="连接名称" className="theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" />
          </label>
          {source === 'custom' ? <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>适配器
            <select aria-label="连接适配器" value={adapter} onChange={(event) => setAdapter(event.target.value as ConnectionAdapter)} className="theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none">
              {Object.entries(CONNECTION_ADAPTER_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label> : <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{presetLabel}
            <select aria-label={presetLabel} value={providerId} onChange={(event) => chooseProvider(event.target.value)} className="theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none">
              {providerOptions.map((provider) => <option key={provider.providerId} value={provider.providerId}>{provider.label}</option>)}
            </select>
          </label>}
          <label className="min-w-0 text-[10px] sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>Base URL
            <input aria-label="Base URL" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://..." className="theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" />
          </label>
          <label className="min-w-0 text-[10px] sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>API Key（仅样张状态）
            <input aria-label="API Key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="不会写入真实设置" className="theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <button type="button" onClick={closeForm} className="rounded px-3 py-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>取消</button>
          <button type="button" onClick={finishSave} disabled={!name.trim() || !baseUrl.trim()} className="rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px] font-medium disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }}>保存连接</button>
        </div>
    </>
  )
  return (
    <div className="space-y-4" data-testid="settings-candidate-section-model">
      <CandidatePageHeader icon={<Cloud size={14} />} title="模型" description="先安排每种用途，再管理连接和连接下的模型清单。" />
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="settings-candidate-model-state-tabs"><div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>模型状态样张</div><div className="flex flex-wrap gap-1" data-playground-switcher role="tablist" aria-label="模型状态样张">{(['empty', 'one', 'two'] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={previewState === state} onClick={() => setPreview(state)} className="settings-option px-2.5 py-1 text-[10px]" data-testid={`settings-candidate-model-state-${state}`} data-selected={previewState === state ? 'true' : undefined}>{state === 'empty' ? '空态' : state === 'one' ? '单连接' : '多连接'}</button>)}</div></div>
      <SettingCard testId="settings-candidate-model-current"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>模型使用安排</h3><p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>从已添加的连接模型中选择；顺序就是优先级，第一项失败时按顺序尝试下一项。</p></div><span className="shrink-0 rounded-full border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>影响后续任务</span></div><div className="mt-4 space-y-4">{ROUTE_PURPOSES.map((purpose) => <section key={purpose.id} className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`settings-candidate-route-${purpose.id}`}><div className="flex items-start justify-between gap-3"><div><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{purpose.label}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{purpose.description}</div></div><select aria-label={`添加${purpose.label}模型`} value="" onChange={(event) => addRoute(purpose.id, event.target.value)} className="theme-input max-w-[13rem] rounded-[var(--radius-md)] border px-2 py-1.5 text-[10px] outline-none"><option value="">添加模型</option>{availableModels.map((item) => <option key={`${item.connectionId}::${item.modelId}`} value={`${item.connectionId}::${item.modelId}`}>{item.connectionName} · {item.modelId}</option>)}</select></div>{routes[purpose.id].length === 0 ? <div className="mt-3 rounded-[var(--radius-md)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>还没有安排模型；请从已添加的模型中选择。</div> : <div className="mt-3 space-y-2">{routes[purpose.id].map((route, index) => <div key={`${route.connectionId}-${route.modelId}`} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2" style={{ borderColor: route.enabled ? 'var(--border-subtle)' : 'var(--border-color)', opacity: route.enabled ? 1 : 0.58 }}><span className="w-5 shrink-0 text-center text-[11px] font-semibold" style={{ color: 'var(--accent-fg)' }}>{index + 1}</span><GripVertical size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" /><span className="min-w-0 flex-1 truncate text-[11px]" title={routeLabel(route)} style={{ color: 'var(--text-primary)' }}>{routeLabel(route)}</span><button type="button" role="switch" aria-checked={route.enabled} aria-label={`${routeLabel(route)}${route.enabled ? '已启用' : '已停用'}`} onClick={() => setRoutes((current) => ({ ...current, [purpose.id]: current[purpose.id].map((item, itemIndex) => itemIndex === index ? { ...item, enabled: !item.enabled } : item) }))} className="rounded-[var(--radius-sm)] px-2 py-1 text-[10px]" style={{ color: route.enabled ? 'var(--accent-fg)' : 'var(--text-muted)', background: route.enabled ? 'var(--accent-subtle)' : 'transparent' }}>{route.enabled ? '启用' : '停用'}</button><button type="button" aria-label={`上移${routeLabel(route)}`} title="上移" disabled={index === 0} onClick={() => moveRoute(purpose.id, index, -1)} className="rounded p-1 disabled:opacity-30"><ArrowUp size={13} style={{ color: 'var(--text-muted)' }} /></button><button type="button" aria-label={`下移${routeLabel(route)}`} title="下移" disabled={index === routes[purpose.id].length - 1} onClick={() => moveRoute(purpose.id, index, 1)} className="rounded p-1 disabled:opacity-30"><ArrowDown size={13} style={{ color: 'var(--text-muted)' }} /></button><button type="button" aria-label={`移除${routeLabel(route)}`} title="移除" onClick={() => setRoutes((current) => ({ ...current, [purpose.id]: current[purpose.id].filter((_, itemIndex) => itemIndex !== index) }))} className="rounded p-1"><X size={13} style={{ color: 'var(--danger)' }} /></button></div>)}</div>}</section>)}</div></SettingCard>
      <SettingCard testId="settings-candidate-model-connections"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>连接与模型清单</h3><p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{connections.length ? `${connections.length} 个连接入口；模型用途在上方单独安排。` : '还没有连接，添加后再维护模型清单。'}</p></div><button type="button" onClick={openAdd} className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5 text-[11px] font-medium" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} data-testid="settings-candidate-model-add"><Plus size={13} />添加连接</button></div>{connections.length === 0 && <div data-testid="settings-candidate-model-empty" className="mt-5 border-t pt-5 text-center" style={{ borderColor: 'var(--border-subtle)' }}><div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>还没有连接入口</div><p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>添加连接后，在连接下维护多个模型，再到上方安排用途。</p></div>}<div className="mt-4 space-y-2">
        {connections.map((connection) => {
          const draft = modelDrafts[connection.id] ?? ''
          const duplicate = connection.models.some((model) => model.id === draft.trim())
          const fetchState = fetchStates[connection.id] ?? 'idle'
          const fetchedModels = fetchedModelsByConnection[connection.id] ?? []
          return <div key={connection.id} className="min-w-0 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`settings-candidate-model-profile-${connection.id}`}>
            {editingId === connection.id ? <div className="p-3" data-testid="settings-candidate-model-add-form">{connectionForm}</div> : <>
            <div className="flex flex-wrap items-center gap-2 px-3 py-3" data-testid={`settings-candidate-connection-header-${connection.id}`}>
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: connection.status === 'healthy' ? 'var(--success)' : connection.status === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium" title={connection.name} style={{ color: 'var(--text-primary)' }}>{connection.name}</span>
                  <span className="mt-1 block truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{sourceLabel(connection.source)} · {connection.protocol ?? connection.providerLabel} · {connection.models.length} 个模型</span>
                </span>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button type="button" aria-label={`编辑连接 ${connection.name}`} title="编辑连接" onClick={() => openEdit(connection)} className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} data-testid={`settings-candidate-edit-connection-${connection.id}`}><Pencil size={13} /></button>
                <button type="button" disabled={fetchState === 'loading'} onClick={() => fetchModels(connection.id)} className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border px-2 text-[10px] disabled:opacity-50" style={{ borderColor: 'var(--border-color)', color: 'var(--accent-fg)' }} data-testid={`settings-candidate-fetch-models-${connection.id}`}><RefreshCw size={12} className={fetchState === 'loading' ? 'animate-spin' : ''} />{fetchState === 'loading' ? '正在获取…' : '获取已有模型'}</button>
                <button type="button" onClick={() => testConnection(connection.id)} className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border px-2 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--accent-fg)' }}><Check size={12} />测试连接</button>
              </div>
            </div>
            <div id={`connection-details-${connection.id}`} className="border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="grid gap-2 text-[10px] sm:grid-cols-3">
                <div className="min-w-0"><span style={{ color: 'var(--text-muted)' }}>{connection.source === 'custom' ? '适配器' : '服务入口'}</span><div className="mt-1 truncate font-medium" title={connection.protocol ?? connection.providerLabel} style={{ color: 'var(--text-secondary)' }}>{connection.protocol ?? connection.providerLabel}</div></div>
                <div className="min-w-0"><span style={{ color: 'var(--text-muted)' }}>Base URL</span><div className="mt-1 truncate font-mono" title={connection.baseUrl} style={{ color: 'var(--text-secondary)' }}>{connection.baseUrl}</div></div>
                <div><span style={{ color: 'var(--text-muted)' }}>密钥状态</span><div className="mt-1 font-medium" style={{ color: connection.credentialStatus === 'stored' ? 'var(--success)' : 'var(--danger)' }}>{connection.credentialStatus === 'stored' ? '已配置' : '未配置'}</div></div>
              </div>
              {connection.status !== 'untested' && <div role="status" className="mt-2 text-[10px]" style={{ color: connection.status === 'healthy' ? 'var(--success)' : 'var(--danger)' }}>{connection.status === 'healthy' ? '连接测试通过（样张）' : '连接测试失败（样张）：请检查地址和凭据。'}</div>}
              <div className="mt-4 text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>模型清单 · {connection.models.length} 个</div>
              <div className="mt-3 space-y-2">
                {connection.models.length === 0 && <div className="rounded-[var(--radius-sm)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>这个连接还没有添加模型。</div>}
                {connection.models.map((model) => <div key={model.id} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={model.id} style={{ color: 'var(--text-primary)' }}>{model.id}</span>
                  <button type="button" role="switch" aria-checked={model.enabled} aria-label={`${model.id}${model.enabled ? '已启用' : '未启用'}`} title={model.enabled ? '已启用' : '未启用'} onClick={() => updateModel(connection.id, model.id, { enabled: !model.enabled })} className="rounded p-1"><span className="sr-only">{model.enabled ? '已启用' : '未启用'}</span>{model.enabled ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Circle size={12} style={{ color: 'var(--text-muted)' }} />}</button>
                  <button type="button" aria-label={`移除模型 ${model.id}`} title="移除模型" onClick={() => removeModel(connection.id, model.id)} className="rounded p-1"><Trash2 size={12} style={{ color: 'var(--danger)' }} /></button>
                </div>)}
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2">
                <input aria-label={`手动添加模型 ${connection.name}`} value={draft} onChange={(event) => setModelDrafts((current) => ({ ...current, [connection.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submitModelDraft(connection) } }} placeholder="填写模型 ID" className="theme-input h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2.5 text-[10px] outline-none" />
                <button type="button" aria-label="手动添加模型" title={duplicate ? '模型已添加' : '添加模型'} disabled={!draft.trim() || duplicate} onClick={() => submitModelDraft(connection)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border disabled:opacity-40" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Plus size={14} /></button>
              </div>
              {fetchState === 'success' && fetchedModels.length > 0 && <div className="mt-3 space-y-2" data-testid={`settings-candidate-fetched-models-${connection.id}`}><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>获取到的模型 · 点击加入清单</div><div className="flex flex-wrap gap-1.5">{fetchedModels.map((modelId) => { const alreadyAdded = connection.models.some((model) => model.id === modelId); return <button key={modelId} type="button" disabled={alreadyAdded} onClick={() => { if (alreadyAdded) return; addModelToConnection(connection.id, modelId); setModelDrafts((current) => ({ ...current, [connection.id]: '' })) }} className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[10px] disabled:opacity-50" title={alreadyAdded ? '已添加' : `添加 ${modelId}`} style={{ borderColor: alreadyAdded ? 'var(--success)' : 'var(--border-color)', color: alreadyAdded ? 'var(--success)' : 'var(--text-secondary)' }}><span className="max-w-[16rem] truncate" title={modelId}>{modelId}</span>{alreadyAdded ? <Check size={12} /> : <Plus size={12} />}</button> })}</div></div>}
              {duplicate && <div className="mt-2 text-[10px]" role="status" style={{ color: 'var(--text-muted)' }}>这个模型已在清单中。</div>}
              {fetchState === 'success' && fetchedModels.length === 0 && <div className="mt-2 text-[10px]" role="status" style={{ color: 'var(--text-muted)' }}>没有获取到模型，可手动添加模型 ID。</div>}
              {fetchState === 'error' && <div role="status" className="mt-3 rounded-[var(--radius-sm)] px-3 py-2 text-[10px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>获取失败：请检查 Base URL 和连接凭据；仍可手动添加模型。</div>}
              {fetchState === 'unsupported' && <div role="status" className="mt-3 rounded-[var(--radius-sm)] px-3 py-2 text-[10px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>这个连接暂不提供模型列表；请手动添加模型 ID。</div>}
            </div>
            </>}
          </div>
        })}
      </div></SettingCard>
      {showAdd && !editingId && <SettingCard testId="settings-candidate-model-add-form">{connectionForm}</SettingCard>}
      <SettingCard><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced} className="flex w-full items-center justify-between gap-3 text-left" data-testid="settings-candidate-model-advanced-toggle"><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>高级设置</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>连接测试、预算和生成参数只在需要时查看。</span></span><ChevronRight size={14} className={`transition ${showAdvanced ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} /></button>{showAdvanced && <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}><div data-testid="settings-candidate-model-budget"><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>运行预算 <ScopeBadge label="全局" /></div><div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>输入与输出 Token 合计；0 表示不限制。</div><div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>会话预算（Token）<input aria-label="会话预算（Token）" value={sessionBudget} onChange={(event) => setSessionBudget(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>每日预算（Token）<input aria-label="每日预算（Token）" value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label></div><div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>当前：{sessionBudget === '0' ? '不限制' : `${sessionBudget} Token`}</div></div><label className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>Temperature<input aria-label="Temperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><button type="button" onClick={() => onModelStatusChange('success')} className="rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--accent-fg)' }} data-testid="settings-candidate-model-test">测试连接</button>{modelStatus !== 'idle' && <div role="status" className="rounded-[var(--radius-md)] px-3 py-2 text-[11px]" style={{ background: modelStatus === 'success' ? 'var(--accent-subtle)' : 'color-mix(in srgb, var(--danger) 10%, transparent)', color: modelStatus === 'success' ? 'var(--accent-fg)' : 'var(--danger)' }} data-testid="settings-candidate-model-status">{modelStatus === 'success' ? '连接配置看起来可用（仅样张反馈）' : '连接测试失败；请检查地址和凭据。'}</div>}</div>}</SettingCard>
    </div>
  )
}
function MemoryPage({ detail }: { detail?: ReactNode }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-memory"><CandidatePageHeader icon={<Brain size={14} />} title="记忆" description="查看和管理会影响未来相处的长期信息。" />{detail ?? <SettingCard><div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>记忆内容由产品体验页统一管理。</div></SettingCard>}</div>
}

function DataPage({ lastAction, onAction }: { lastAction: string; onAction: (action: string) => void }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-data"><CandidatePageHeader icon={<Database size={14} />} title="数据与隐私" description="管理本地数据的迁移和备份，并明确哪些内容不会跟着备份文件离开设备。" /><SettingCard><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => onAction('已模拟导出')} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition" style={{ borderColor: 'var(--border-subtle)' }} data-testid="settings-candidate-export"><span className="flex items-center gap-2"><Upload size={15} style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导出数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>生成一份本地备份</span></span></span><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></button><button type="button" onClick={() => onAction('已模拟导入')} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition" style={{ borderColor: 'var(--border-subtle)' }} data-testid="settings-candidate-import"><span className="flex items-center gap-2"><Download size={15} style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导入数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>从本地备份恢复</span></span></span><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></button></div>{lastAction && <div className="mt-3 rounded-[var(--radius-md)] px-3 py-2 text-[11px]" role="status" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{lastAction}（仅样张反馈）</div>}</SettingCard><SettingCard><div className="grid gap-4 sm:grid-cols-2"><div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><Save size={14} style={{ color: 'var(--accent-fg)' }} />备份包含</div><ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>会话与消息</li><li>记忆条目</li><li>普通模型与伙伴偏好</li><li>生活资产与播种标记</li></ul></div><div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><LockKeyhole size={14} style={{ color: 'var(--accent-fg)' }} />备份不包含</div><ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>API Key 和 MCP 密钥</li><li>权限规则与执行模式</li><li>本机项目路径</li></ul></div></div></SettingCard></div>
}

function PermissionsPage({ mode, onModeChange }: { mode: string; onModeChange: (value: string) => void }) {
  const [rules, setRules] = useState(JSON.stringify([{ id: 'preview-publish', type: 'command', action: 'deny', pattern: 'npm publish', enabled: true }]))
  return <div className="space-y-4" data-testid="settings-candidate-section-permissions">
    <CandidatePageHeader icon={<ShieldCheck size={14} />} title="权限与自动化" description="让你决定 Agent 什么时候先问你、什么时候按计划推进；越高风险的能力越应该明确。" />
    <PermissionSettingsContent mode={mode} onModeChange={onModeChange} rules={rules} onRulesChange={setRules} prefix="settings-candidate" />
  </div>
}
const MCP_SCENES = [
  ['empty', '未添加'], ['one', '1 个 MCP'], ['two', '2 个 MCP'],
  ['connecting', '连接中'], ['confirm', '待确认'],
  ['tool-one', '1 个工具'], ['tool-two', '2 个工具'], ['tool-three', '3 个工具'],
  ['no-tools', '无工具'], ['disabled', '已停用'], ['error', '连接失败'], ['auth', '待登录'],
  ['add-remote', '添加连接'], ['add-local', '本地填写'], ['add-invalid', '校验失败'], ['add-connecting', '添加连接中'], ['add-ready', '获取工具成功'],
] as const
type McpScene = typeof MCP_SCENES[number][0]
type McpPreviewStatus = 'connected' | 'connecting' | 'confirm' | 'disabled' | 'error' | 'auth'
interface McpPreviewServer {
  id: string
  name: string
  transport: string
  address: string
  status: McpPreviewStatus
  tools: Array<{ id: string; name: string; allowed: boolean }>
}

/**
 * 背景：审阅者需要直接比较服务数、连接状态和工具数量，不应先完成添加向导。
 * 设计意图：每个场景重新创建独立夹具，让重试/确认只改变本地预览。
 * 关键约束：地址与工具仅供样张，不探测网络、不启动进程、不写真实配置。
 */
function createMcpScene(scene: McpScene): McpPreviewServer[] {
  if (scene === 'empty') return []
  const count = scene === 'no-tools' ? 0 : scene === 'tool-one' ? 1 : scene === 'tool-two' ? 2 : 3
  const status: McpPreviewStatus = scene === 'connecting' || scene === 'confirm' || scene === 'disabled' || scene === 'error' || scene === 'auth' ? scene : 'connected'
  const files: McpPreviewServer = {
    id: 'files', name: '文件服务', transport: '本地 · stdio', address: 'npx @modelcontextprotocol/server-filesystem', status,
    tools: [
      { id: 'read_file', name: '读取文件', allowed: true },
      { id: 'list_directory', name: '列出目录', allowed: true },
      { id: 'search_files', name: '搜索文件', allowed: true },
    ].slice(0, count),
  }
  const docs: McpPreviewServer = {
    id: 'docs', name: '文档服务', transport: '远程 · Streamable HTTP', address: 'https://docs.example.com/mcp', status,
    tools: [{ id: 'search_docs', name: '搜索文档', allowed: true }],
  }
  return scene === 'two' ? [files, docs] : scene === 'auth' ? [docs] : [files]
}

/**
 * 背景：MCP 候选要能审阅多服务而不引入一套真实连接管理器。
 * 设计意图：场景按钮直达，服务卡片只组合现有开关、文本列表和命令按钮。
 * 关键约束：连接中保持稳定供审阅；切换场景重置交互，不把夹具状态解释为连接证据。
 */
function McpScenePreview() {
  const [scene, setScene] = useState<McpScene>('empty')
  const [servers, setServers] = useState<McpPreviewServer[]>([])
  const [form, setForm] = useState<McpScene | null>(null)
  const serial = useRef(0)
  const chooseScene = (next: McpScene) => { setScene(next); setForm(next.startsWith('add-') ? next : null); setServers(next.startsWith('add-') ? [] : createMcpScene(next)) }
  const updateServer = (id: string, patch: Partial<McpPreviewServer>) => setServers((current) => current.map((server) => server.id === id ? { ...server, ...patch } : server))
  return <div className="space-y-4" data-testid="settings-candidate-mcp-scenes">
    <div className="flex flex-wrap gap-1" data-playground-switcher role="tablist" aria-label="MCP 样张场景">
      {MCP_SCENES.map(([id, label]) => <button key={id} id={`mcp-scene-${id}`} type="button" role="tab" aria-selected={scene === id} aria-controls="mcp-scene-panel" onClick={() => chooseScene(id)} className="settings-option px-2.5 py-1.5 text-[11px]" data-selected={scene === id ? 'true' : undefined}>{label}</button>)}
    </div>
    <div id="mcp-scene-panel" role="tabpanel" aria-labelledby={`mcp-scene-${scene}`} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{servers.length} 个服务</span>
        <button type="button" onClick={() => setForm('add-remote')} className="settings-option inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} data-testid="settings-candidate-mcp-add"><Plus size={14} />添加连接</button>
      </div>
      {form && <McpConnectionPreview key={form} scene={form} onCancel={() => { setForm(null); if (scene.startsWith('add-')) setScene('empty') }} onSave={(server) => { setServers((current) => [...current, { ...server, id: `added-${++serial.current}` }]); setForm(null); if (scene.startsWith('add-')) setScene('one') }} />}
      {!form && servers.length === 0 && <div className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }} data-testid="settings-candidate-mcp-empty">还没有 MCP 服务</div>}
      {servers.map((server) => <McpServiceCard key={server.id} {...server} enabled={server.status !== 'disabled'} testId={`settings-candidate-mcp-server-${server.id}`}
        onEnabledChange={(checked) => updateServer(server.id, { status: checked ? 'connected' : 'disabled' })}
        onToolChange={server.status === 'confirm' ? (id, allowed) => updateServer(server.id, { tools: server.tools.map((tool) => tool.id === id ? { ...tool, allowed } : tool) }) : undefined}
        onRetry={() => updateServer(server.id, { status: 'connecting' })}
        onCancel={() => server.status === 'confirm' ? chooseScene('empty') : updateServer(server.id, { status: 'disabled' })}
        onConfirm={() => updateServer(server.id, { status: 'connected' })} />)}
    </div>
  </div>
}

function CapabilityPage({ mode }: { mode: 'skills' | 'mcp' }) {
  const [skillsEnabled, setSkillsEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(skillsSamples.map((sample, index) => [sample.name, index === 0])))
  const [selectedSkill, setSelectedSkill] = useState(skillsSamples[0].name)
  const skill = skillsSamples.find((sample) => sample.name === selectedSkill) ?? skillsSamples[0]
  const [skillsState, setSkillsState] = useState<'单个' | '多个' | '详情'>('单个')
  const viewSkill = (sample: typeof skillsSamples[number]): SkillInfo => ({ name: sample.name, description: sample.description, when_to_use: sample.trigger, author: sample.author, version: sample.version, source: 'builtin', enabled: skillsEnabled[sample.name] })
  const toggleSkill = (name: string, enabled: boolean) => setSkillsEnabled((current) => ({ ...current, [name]: enabled }))

  return <div className="space-y-4" data-testid={`settings-candidate-section-${mode}`}>
    <CandidatePageHeader icon={mode === 'skills' ? <Wrench size={14} /> : <Link2 size={14} />} title={mode === 'skills' ? 'Skills' : 'MCP'} description={mode === 'skills' ? '管理伙伴可以按需使用的工作方法。' : '管理伙伴可以使用的外部服务连接。'} />
    {mode === 'skills' && <>
      <div className="flex items-center justify-end gap-1" data-playground-switcher role="tablist" aria-label="Skills 样张状态" data-testid="settings-candidate-skills-states">
        {(['单个', '多个', '详情'] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={skillsState === state} onClick={() => setSkillsState(state)} className="settings-option px-2.5 py-1 text-[10px]" data-selected={skillsState === state ? 'true' : undefined}>{state}</button>)}
      </div>
      {skillsState === '详情' ? <SkillDetail skill={viewSkill(skill)} testId="settings-candidate-skill-detail" toggleTestId="settings-candidate-skills-enabled" onBack={() => setSkillsState('多个')} onEnabledChange={(enabled) => toggleSkill(skill.name, enabled)} content={<SkillFilePreview content={skill.raw} testId="settings-candidate-skill-file-preview" />} /> : <div className="grid gap-3 sm:grid-cols-2">
        {(skillsState === '多个' ? skillsSamples : skillsSamples.slice(0, 1)).map((sample) => <SkillListCard key={sample.name} skill={viewSkill(sample)} testId={'settings-candidate-skill-card-' + sample.name} toggleTestId={sample.name === skillsSamples[0].name ? 'settings-candidate-skills-enabled' : 'settings-candidate-skill-toggle-' + sample.name} onOpen={() => { setSelectedSkill(sample.name); setSkillsState('详情') }} onEnabledChange={(enabled) => toggleSkill(sample.name, enabled)} />)}
      </div>}
    </>}
    {mode === 'mcp' && <McpScenePreview />}
  </div>
}
function AboutPage({ developerMode, onDeveloperModeChange }: { developerMode: boolean; onDeveloperModeChange: (enabled: boolean) => void }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-about">
    <CandidatePageHeader icon={<CircleHelp size={14} />} title="关于 My Agent" description="查看版本、运行环境和本机数据位置。" />
    <AboutSettingsContent developerMode={developerMode} onDeveloperModeChange={onDeveloperModeChange} showHeader={false} testIdPrefix="settings-candidate-" />
  </div>
}

export function SettingsExperienceCandidate({ companionDetail, memoryDetail, initialSection, onOpenRoleShelf }: SettingsExperienceCandidateProps) {
  const [activeSection, setActiveSection] = useState<SettingsCandidateSection>(initialSection ?? 'appearance')
  const [activeTheme, setActiveTheme] = useState<ThemeStudyId>(THEME_STUDIES[0].id)
  const [fontScale, setFontScale] = useState('md')
  const [momentTips, setMomentTips] = useState(true)
  const [proactiveGreeting, setProactiveGreeting] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [expertise, setExpertise] = useState('auto')
  const [dataAction, setDataAction] = useState('')
  const [permissionMode, setPermissionMode] = useState('auto')
  const [developerMode, setDeveloperMode] = useState(false)

  useEffect(() => {
    // 背景：记忆页和设置页共用候选壳层，切换场景时可能保留上一次的设置分区。
    // 设计意图：按外部场景重新定位入口，避免用户回到设置时落在不可预期的局部页面。
    // 关键约束：只有 initialSection 变化才重置，普通的候选页内部交互不能被渲染刷新打断。
    setActiveSection(initialSection ?? 'appearance')
  }, [initialSection])



  return <div aria-label="设置候选版" className="flex min-h-[620px] w-full min-w-0 overflow-hidden rounded-[var(--radius-lg)] border" style={{ ...getThemeStudyStyle(THEME_STUDIES.find((theme) => theme.id === activeTheme)!), borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }} data-playground-theme={activeTheme} data-testid="settings-candidate">
    <SettingsLayout activeSection={activeSection} onSelect={setActiveSection} prefix="settings-candidate">
      {activeSection === 'appearance' && <AppearancePage activeTheme={activeTheme} fontScale={fontScale} onFontScaleChange={setFontScale} onThemeChange={setActiveTheme} />}{activeSection === 'memory' && <MemoryPage detail={memoryDetail} />}{activeSection === 'companion' && (companionDetail ?? <CompanionPage expertise={expertise} momentTips={momentTips} onExpertiseChange={setExpertise} onOpenRoleShelf={onOpenRoleShelf} onMomentTipsChange={setMomentTips} onProactiveGreetingChange={setProactiveGreeting} proactiveGreeting={proactiveGreeting} />)}{activeSection === 'model' && <ModelPage modelStatus={modelStatus} onModelStatusChange={setModelStatus} selectedProvider={selectedProvider} onProviderChange={setSelectedProvider} />}{activeSection === 'data' && <DataPage lastAction={dataAction} onAction={setDataAction} />}{activeSection === 'permissions' && <PermissionsPage mode={permissionMode} onModeChange={setPermissionMode} />}{activeSection === 'skills' && <CapabilityPage mode="skills" />}{activeSection === 'mcp' && <CapabilityPage mode="mcp" />}{activeSection === 'about' && <AboutPage developerMode={developerMode} onDeveloperModeChange={setDeveloperMode} />}
    </SettingsLayout>
  </div>
}
