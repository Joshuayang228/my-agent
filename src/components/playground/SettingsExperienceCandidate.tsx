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
import { Brain, ChevronRight, CircleHelp, Cloud, Heart, KeyRound, Link2, Plug, Settings2, ShieldCheck, SlidersHorizontal, UserRound, Wrench, Activity, Gauge, Plus, ListChecks, ArrowLeft } from 'lucide-react'
import { AppearanceSettingsContent } from '../settings/AppearanceSettingsContent'
import { SettingsLayout, type SettingsPageId } from '../settings/SettingsLayout'
import { ScopeBadge, SettingCard, SettingRow, SettingSwitch, SettingsPageHeader } from '../settings/SettingsFields'
import { CompanionSettingsContent } from '../settings/CompanionSettingsContent'
import { ActionButton } from '../foundation/ActionButton'
import { AboutSettingsContent } from '../settings/AboutSettingsContent'
import { DataSettingsContent } from '../settings/DataSettingsContent'
import { McpServiceCard } from '../settings/McpServiceCard'
import { ModelConnectionForm } from '../settings/ModelConnectionForm'
import { ModelConnectionCard } from '../settings/ModelConnectionCard'
import { ModelConnectionList } from '../settings/ModelConnectionList'
import { ModelUsageArrangements } from '../settings/ModelUsageArrangements'
import { ModelAdvancedSettings } from '../settings/ModelAdvancedSettings'
import { resolveRoutedConfigs, MODEL_ROUTE_PURPOSES as ROUTE_PURPOSES } from '../../shared/model-routing'
import { connectionCredentialLabel } from '../../shared/model-connection-form'
import { CONNECTION_ADAPTERS, CONNECTION_PRESETS, CONNECTION_SOURCE_OPTIONS, connectionDraftForSource, providerSource, sameConnectionEndpoint } from '../../shared/model-connection-form'
import { SkillDetail, SkillFilePreview, SkillListCard } from '../settings/SkillViews'
import type { SkillInfo, ModelConnectionSource as ConnectionSource } from '../../shared/types'
import { McpConnectionPreview } from './McpConnectionPreview'
import { THEME_STUDIES, getThemeStudyStyle, type ThemeStudyId } from './foundation-themes'
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
  return <AppearanceSettingsContent prefix="settings-candidate" theme={activeTheme} fontScale={fontScale} onThemeChange={onThemeChange} onFontScaleChange={onFontScaleChange} />
}

function CompanionPage({ momentTips, onMomentTipsChange, onOpenRoleShelf, onProactiveGreetingChange, proactiveGreeting, expertise, onExpertiseChange }: { momentTips: boolean; onMomentTipsChange: (value: boolean) => void; onOpenRoleShelf?: () => void; onProactiveGreetingChange: (value: boolean) => void; proactiveGreeting: boolean; expertise: string; onExpertiseChange: (value: string) => void }) {
  const [quietStart, setQuietStart] = useState('22')
  const [quietEnd, setQuietEnd] = useState('8')
  const [maxPerDay, setMaxPerDay] = useState('3')
  const [note, setNote] = useState('当我把事情排得太满时，提醒我留一点空白。')
  return <CompanionSettingsContent
    expertise={expertise as 'auto' | 'novice' | 'intermediate' | 'expert'}
    onExpertiseChange={onExpertiseChange as (value: 'auto' | 'novice' | 'intermediate' | 'expert') => void}
    momentTipsMuted={!momentTips}
    onMomentTipsMutedChange={(muted) => onMomentTipsChange(!muted)}
    proactiveGreeting={proactiveGreeting}
    onProactiveGreetingChange={onProactiveGreetingChange}
    quietStart={quietStart}
    quietEnd={quietEnd}
    maxPerDay={maxPerDay}
    onQuietStartChange={setQuietStart}
    onQuietEndChange={setQuietEnd}
    onMaxPerDayChange={setMaxPerDay}
    note={note}
    onNoteChange={setNote}
    testIdPrefix="settings-candidate-"
    roleAction={<ActionButton onClick={onOpenRoleShelf} className="gap-1" data-testid="settings-candidate-open-role-shelf">小林 · 管理角色架 <ChevronRight size={12} /></ActionButton>}
  />
}

type ModelPurpose = 'primary' | 'auxiliary' | 'image' | 'unused'
type CapabilityState = 'supported' | 'unknown' | 'unsupported'
type ModelFixture = { id: string; enabled: boolean; visibleInPicker: boolean; purpose: ModelPurpose; image: CapabilityState; tools: CapabilityState }
type ConnectionAdapter = 'openai-compatible' | 'anthropic' | 'google'
type ModelConnectionFixture = { id: string; name: string; source: ConnectionSource; protocol?: string; providerLabel: string; baseUrl: string; credentialStatus: 'missing' | 'stored'; status: 'untested' | 'healthy' | 'failed'; models: ModelFixture[] }

const fixtureCredentialLabel = (connection: ModelConnectionFixture) => connectionCredentialLabel({ baseUrl: connection.baseUrl, provider: CONNECTION_ADAPTERS.find((item) => item.label === connection.protocol)?.provider ?? 'auto', hasApiKey: connection.credentialStatus === 'stored' })
type ModelRoutePurpose = 'primary' | 'auxiliary' | 'image'
type ModelRoute = { connectionId: string; modelId: string; enabled: boolean }
type ModelFetchState = 'idle' | 'loading' | 'success' | 'empty' | 'unsupported' | 'error'
const connectionCardFetchState = (state: ModelFetchState = 'idle') => state === 'empty' ? 'success' : state

const FETCHED_MODEL_FIXTURES = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'text-embedding-3-small']

function sourceLabel(value: ConnectionSource) { return CONNECTION_SOURCE_OPTIONS.find((item) => item.id === value)?.label ?? '自定义连接' }
const CONNECTION_ADAPTER_LABELS = Object.fromEntries(CONNECTION_ADAPTERS.map((item) => [item.id, item.label])) as Record<ConnectionAdapter, string>
function createConnection(provider: { providerId: string; label: string; baseUrl: string; group?: string }, index = 0): ModelConnectionFixture {
  return { id: `connection-${provider.providerId}-${index}`, name: index === 0 ? `${provider.label} 主账号` : `${provider.label} 连接`, source: providerSource(provider), providerLabel: provider.label, baseUrl: provider.baseUrl, credentialStatus: 'stored', status: 'untested', models: index === 0 ? [{ id: 'gpt-4o', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'gpt-4o-mini', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'image-model-id', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }] : [] }
}

function ModelPage({ selectedProvider }: { selectedProvider: string; onProviderChange: (provider: string) => void }) {
  const allProviders = CONNECTION_PRESETS
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
  const [parameters, setParameters] = useState({ sessionTokenBudget: '0', dailyTokenBudget: '0', llmTemperature: '0.7' })
  const primaryTarget = resolveRoutedConfigs(JSON.stringify(connections.map(connection => ({ ...connection, enabled: true }))),
    JSON.stringify(routes.primary.map(route => ({ ...route, purpose: 'primary', model: route.modelId }))), 'primary')[0]
  const selectedProviderConfig = allProviders.find((item) => item.providerId === providerId)
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
  /**
   * 背景：切换来源时旧 render 的选项仍属于上一类；设计意图：按目标来源选默认预设，整组同步。
   * 关键约束：不调用父级 Provider 选择，不改变已有样张或用途；换渠道清除临时 Key，自定义适配器独立保存。
   */
  const chooseSource = (next: ConnectionSource) => {
    const draft = connectionDraftForSource(next)
    setSource(next)
    setApiKey('')
    setProviderId(draft.presetId)
    setName(draft.name)
    setBaseUrl(draft.baseUrl)
    setAdapter('openai-compatible')
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
      if (!connection.baseUrl.trim() || fixtureCredentialLabel(connection) === '未配置') {
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
      setConnections((items) => items.map((connection) => connection.id !== editingId ? connection : { ...connection, ...patch, credentialStatus: apiKey.trim() ? 'stored' : sameConnectionEndpoint({ baseUrl: connection.baseUrl, provider: connection.protocol }, { baseUrl: patch.baseUrl, provider: patch.protocol }) ? connection.credentialStatus : 'missing', status: 'untested' }))
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
    const valid = Boolean(connection.baseUrl.trim()) && fixtureCredentialLabel(connection) !== '未配置'
    setConnections((items) => items.map((item) => item.id === connectionId ? { ...item, status: valid ? 'healthy' : 'failed' } : item))
  }
  const setPreview = (state: 'empty' | 'one' | 'two') => { fetchTimers.current.forEach((timer) => window.clearTimeout(timer)); fetchTimers.current.clear(); setFetchStates({}); setFetchedModelsByConnection({}); setModelDrafts({}); closeForm(); setPreviewState(state); if (state === 'empty') { setConnections([]); setRoutes({ primary: [], auxiliary: [], image: [] }); return }; const first = createConnection(firstProvider); if (state === 'one') { setConnections([first]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], auxiliary: [{ connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }); return }; const second = createConnection(allProviders.find((item) => item.providerId === 'openrouter') ?? allProviders[1], 1); second.name = '国际流动'; second.source = 'relay'; second.models = [{ id: 'deepseek-chat', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'deepseek-reasoner', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }]; setConnections([first, second]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: second.id, modelId: 'deepseek-chat', enabled: true }], auxiliary: [{ connectionId: second.id, modelId: 'deepseek-reasoner', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }) }
  const availableModels = connections.flatMap((connection) => connection.models.filter((model) => model.enabled).map((model) => ({ connectionId: connection.id, connectionName: connection.name, modelId: model.id })))
  const addRoute = (purpose: ModelRoutePurpose, key: string) => { const [connectionId, modelId] = key.split('::'); if (!connectionId || !modelId) return; setRoutes((current) => ({ ...current, [purpose]: current[purpose].some((item) => item.connectionId === connectionId && item.modelId === modelId) ? current[purpose] : [...current[purpose], { connectionId, modelId, enabled: true }] })) }
  const moveRoute = (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => setRoutes((current) => { const next = [...current[purpose]]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, [purpose]: next } })
  const connectionForm = <ModelConnectionForm preview editing={Boolean(editingId)}
    value={{ name, source, presetId: providerId, provider: CONNECTION_ADAPTERS.find((item) => item.id === adapter)!.provider, baseUrl, apiKey }}
    onChange={(next) => {
      setName(next.name); setSource(next.source); setProviderId(next.presetId); setBaseUrl(next.baseUrl); setApiKey(next.apiKey)
      setAdapter(CONNECTION_ADAPTERS.find((item) => item.provider === next.provider)?.id ?? 'openai-compatible')
    }} onCancel={closeForm} onSave={finishSave} />
  return (
    <div className="space-y-4" data-testid="settings-candidate-section-model">
      <CandidatePageHeader icon={<Cloud size={14} />} title="模型" description="先安排每种用途，再管理连接和连接下的模型清单。" />
      <div className="flex flex-wrap items-center justify-between gap-2" data-testid="settings-candidate-model-state-tabs"><div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>模型状态样张</div><div className="flex flex-wrap gap-1" data-playground-switcher role="tablist" aria-label="模型状态样张">{(['empty', 'one', 'two'] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={previewState === state} onClick={() => setPreview(state)} className="settings-option px-2.5 py-1 text-[10px]" data-testid={`settings-candidate-model-state-${state}`} data-selected={previewState === state ? 'true' : undefined}>{state === 'empty' ? '空态' : state === 'one' ? '单连接' : '多连接'}</button>)}</div></div>
      <ModelUsageArrangements testIdPrefix="settings-candidate" purposes={ROUTE_PURPOSES}
        routes={ROUTE_PURPOSES.flatMap(purpose => routes[purpose.id].map(route => ({ purpose: purpose.id, connectionId: route.connectionId, model: route.modelId, enabled: route.enabled })))}
        options={availableModels.map(item => ({ value: `${item.connectionId}::${item.modelId}`, label: `${item.connectionName} · ${item.modelId}` }))}
        routeLabel={route => `${connections.find(item => item.id === route.connectionId)?.name || route.connectionId} · ${route.model}`}
        onAdd={addRoute} onMove={moveRoute}
        onToggle={route => setRoutes(current => ({ ...current, [route.purpose]: current[route.purpose].map(item => item.connectionId === route.connectionId && item.modelId === route.model ? { ...item, enabled: !item.enabled } : item) }))}
        onRemove={route => setRoutes(current => ({ ...current, [route.purpose]: current[route.purpose].filter(item => item.connectionId !== route.connectionId || item.modelId !== route.model) }))} />
      <ModelConnectionList count={connections.length} onAdd={openAdd} disabled={showAdd || editingId !== null} testIdPrefix="settings-candidate">
        {connections.map(connection => <ModelConnectionCard key={connection.id} testIdPrefix="settings-candidate" id={connection.id} name={connection.name}
          sourceLabel={sourceLabel(connection.source)} providerLabel={connection.protocol ?? connection.providerLabel} custom={connection.source === 'custom'}
          baseUrl={connection.baseUrl} credentialLabel={fixtureCredentialLabel(connection)} hasApiKey={connection.credentialStatus === 'stored'} models={connection.models}
          draft={modelDrafts[connection.id] ?? ''} onDraftChange={value => setModelDrafts(current => ({ ...current, [connection.id]: value }))}
          onSubmitModel={() => submitModelDraft(connection)} onAddModel={modelId => { addModelToConnection(connection.id, modelId); setModelDrafts(current => ({ ...current, [connection.id]: '' })) }}
          onToggleModel={model => updateModel(connection.id, model.id, { enabled: !model.enabled })} onRemoveModel={modelId => removeModel(connection.id, modelId)}
          onEdit={() => openEdit(connection)} onTest={() => testConnection(connection.id)} onFetch={() => fetchModels(connection.id)}
          testState={connection.status === 'healthy' ? 'success' : connection.status === 'failed' ? 'error' : 'idle'}
          testMessage={connection.status === 'healthy' ? '连接测试通过（样张）' : connection.status === 'failed' ? '连接测试失败（样张）：请检查地址和凭据。' : undefined}
          fetchState={connectionCardFetchState(fetchStates[connection.id])} fetchedModels={fetchedModelsByConnection[connection.id] ?? []}
          editing={editingId === connection.id ? connectionForm : undefined} editingTestId="settings-candidate-model-add-form" />)}
      </ModelConnectionList>
      {showAdd && !editingId && <SettingCard testId="settings-candidate-model-add-form">{connectionForm}</SettingCard>}
      <ModelAdvancedSettings values={parameters} onChange={(key, value) => setParameters(current => ({ ...current, [key]: value }))}
        testIdPrefix="settings-candidate-" testIdentity={JSON.stringify([connections, routes])}
        testTarget={primaryTarget ? `${primaryTarget.name} · ${primaryTarget.model}` : undefined}
        onTest={async () => primaryTarget && connections.find(connection => connection.id === primaryTarget.id)?.credentialStatus === 'stored'
          ? { ok: true, model: `${primaryTarget.model}（样张）`, ms: 0 }
          : { ok: false, error: '连接测试失败（样张）：请检查地址和凭据。' }} />
    </div>
  )
}
function MemoryPage({ detail }: { detail?: ReactNode }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-memory"><CandidatePageHeader icon={<Brain size={14} />} title="记忆" description="查看和管理会影响未来相处的长期信息。" />{detail ?? <SettingCard><div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>记忆内容由产品体验页统一管理。</div></SettingCard>}</div>
}

function DataPage() {
  return <DataSettingsContent testIdPrefix="settings-candidate-" onAction={async action => ({ message: `已模拟${action === 'export' ? '导出' : '导入'}（仅样张反馈）` })} />
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
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [expertise, setExpertise] = useState('auto')
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
      {activeSection === 'appearance' && <AppearancePage activeTheme={activeTheme} fontScale={fontScale} onFontScaleChange={setFontScale} onThemeChange={setActiveTheme} />}{activeSection === 'memory' && <MemoryPage detail={memoryDetail} />}{activeSection === 'companion' && (companionDetail ?? <CompanionPage expertise={expertise} momentTips={momentTips} onExpertiseChange={setExpertise} onOpenRoleShelf={onOpenRoleShelf} onMomentTipsChange={setMomentTips} onProactiveGreetingChange={setProactiveGreeting} proactiveGreeting={proactiveGreeting} />)}{activeSection === 'model' && <ModelPage selectedProvider={selectedProvider} onProviderChange={setSelectedProvider} />}{activeSection === 'data' && <DataPage />}{activeSection === 'permissions' && <PermissionsPage mode={permissionMode} onModeChange={setPermissionMode} />}{activeSection === 'skills' && <CapabilityPage mode="skills" />}{activeSection === 'mcp' && <CapabilityPage mode="mcp" />}{activeSection === 'about' && <AboutPage developerMode={developerMode} onDeveloperModeChange={setDeveloperMode} />}
    </SettingsLayout>
  </div>
}
