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
import { Brain, Check, ChevronRight, Circle, CircleHelp, Cloud, Database, Download, Eye, Heart, KeyRound, Link2, LockKeyhole, Palette, Plug, Save, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Upload, UserRound, Wrench, Activity, Gauge, Plus, Server, ListChecks, ArrowLeft, ArrowUp, ArrowDown, GripVertical, RefreshCw, Trash2, X } from 'lucide-react'
import { DESIGN_THEME_ASSETS, FONT_SCALE_ASSETS } from '../../shared/design-asset-registry'
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

export type SettingsCandidateSection = 'appearance' | 'companion' | 'model' | 'memory' | 'data' | 'permissions' | 'skills' | 'mcp' | 'about'

export interface SettingsExperienceCandidateProps {
  companionDetail?: ReactNode
  memoryDetail?: ReactNode
  initialSection?: SettingsCandidateSection
  onOpenRoleShelf?: () => void
}
interface SettingCardProps { children: ReactNode; testId?: string }
interface SettingRowProps { children: ReactNode; description?: string; icon?: ReactNode; label: string; scope?: string; stacked?: boolean }
interface CandidateSwitchProps { checked: boolean; compact?: boolean; description: string; label: string; onChange: (checked: boolean) => void; scope?: string; testId: string }

export const SETTINGS_CANDIDATE_NAV_GROUPS: Array<{ group: string; items: Array<{ id: SettingsCandidateSection; label: string; icon: ReactNode }> }> = [
  { group: '日常', items: [
    { id: 'appearance' as const, label: '外观与界面', icon: <Palette size={15} strokeWidth={1.8} /> },
    { id: 'companion' as const, label: '伙伴与相处', icon: <Heart size={15} strokeWidth={1.8} /> },
    { id: 'model' as const, label: '模型', icon: <Cloud size={15} strokeWidth={1.8} /> },
    { id: 'memory' as const, label: '记忆', icon: <Brain size={15} strokeWidth={1.8} /> },
    { id: 'data' as const, label: '数据与隐私', icon: <Database size={15} strokeWidth={1.8} /> },
  ] },
  { group: '高级', items: [
    { id: 'permissions' as const, label: '权限与自动化', icon: <ShieldCheck size={15} strokeWidth={1.8} /> },
    { id: 'skills' as const, label: 'Skills', icon: <Wrench size={15} strokeWidth={1.8} /> },
    { id: 'mcp' as const, label: 'MCP', icon: <Link2 size={15} strokeWidth={1.8} /> },
  ] },
]

const NAV_ITEMS: Array<{ id: SettingsCandidateSection; label: string; icon: ReactNode }> = SETTINGS_CANDIDATE_NAV_GROUPS.flatMap((group) => group.items)

function SettingCard({ children, testId }: SettingCardProps) {
  return <section className="rounded-[var(--radius-lg)] border p-4 sm:p-5" data-testid={testId} style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>{children}</section>
}

function ScopeBadge({ label }: { label: string }) {
  return <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>{label}</span>
}

function SettingRow({ children, description, icon, label, scope, stacked = false }: SettingRowProps) {
  return <div className={`flex gap-4 ${stacked ? 'flex-col' : 'items-start justify-between'}`}>
    <div className="flex min-w-0 gap-3">
      {icon && <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent-fg)' }} aria-hidden="true">{icon}</span>}
      <div className="min-w-0"><div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}><span>{label}</span>{scope && <ScopeBadge label={scope} />}</div>{description && <p className="mt-1 max-w-xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p>}</div>
    </div>
    <div className={stacked ? '' : 'shrink-0'}>{children}</div>
  </div>
}

function CandidateSwitch({ checked, compact = false, description, label, onChange, scope, testId }: CandidateSwitchProps) {
  if (compact) {
    return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="relative h-5 w-9 shrink-0 rounded-full transition" style={{ background: checked ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }} data-testid={testId}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition" style={{ left: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }} aria-hidden="true" /></button>
  }
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 rounded-[var(--radius-md)] border px-3 py-3 text-left transition" style={{ borderColor: 'var(--border-subtle)', background: checked ? 'var(--accent-subtle)' : 'transparent' }} data-testid={testId}><span className="min-w-0"><span className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}{scope && <ScopeBadge label={scope} />}</span><span className="mt-0.5 block text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{description}</span></span><span className="relative h-5 w-9 shrink-0 rounded-full transition" style={{ background: checked ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }} aria-hidden="true"><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition" style={{ left: checked ? 'calc(100% - 1.125rem)' : '0.125rem' }} /></span></button>
}
function CandidatePageHeader({ description, icon, title }: { description: string; icon: ReactNode; title: string }) {
  return <header className="mb-5 flex items-start justify-between gap-4"><div className="min-w-0"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--accent-fg)' }}><span aria-hidden="true">{icon}</span>设置样张</div><h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2><p className="mt-1 max-w-2xl text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>{description}</p></div><span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>仅供预览</span></header>
}

function AppearancePage({ activeTheme, fontScale, onFontScaleChange, onThemeChange }: { activeTheme: string; fontScale: string; onFontScaleChange: (value: string) => void; onThemeChange: (value: string) => void }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-appearance"><CandidatePageHeader icon={<Palette size={14} />} title="外观与界面" description="调整应用主题和界面显示；主题选项来自基础设计资产。" /><SettingCard><SettingRow scope="本机" label="界面语言" description="当前只提供简体中文，语言切换接入前保持为说明状态。" icon={<CircleHelp size={15} />}><span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>简体中文</span></SettingRow></SettingCard><SettingCard testId="settings-candidate-theme-card"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>主题</h3><p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>选择基础主题；这里的选项与应用实际使用的主题保持一致。</p></div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{DESIGN_THEME_ASSETS.find((theme) => theme.id === activeTheme)?.labelZh ?? activeTheme}</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{DESIGN_THEME_ASSETS.map((theme) => { const selected = activeTheme === theme.id; return <button key={theme.id} type="button" aria-pressed={selected} onClick={() => onThemeChange(theme.id)} className="rounded-[var(--radius-md)] border p-3 text-left transition" data-selected={selected ? 'true' : undefined} style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border" style={{ background: theme.representativeColor, borderColor: 'var(--border-color)' }} /><span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{theme.labelZh}</span>{selected && <Check size={13} className="ml-auto" style={{ color: 'var(--accent-fg)' }} />}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{theme.descriptionZh}</div></button> })}</div></SettingCard><SettingCard><SettingRow scope="本机" label="字体大小" description="只影响本机界面字号；不改变内容本身。" icon={<Eye size={15} />} stacked><div className="grid gap-2 sm:grid-cols-3">{FONT_SCALE_ASSETS.map((scale) => { const selected = fontScale === scale.id; return <button key={scale.id} type="button" aria-pressed={selected} onClick={() => onFontScaleChange(scale.id)} className="rounded-[var(--radius-md)] border px-3 py-2 text-left transition" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{scale.labelZh}</div><div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>{scale.descriptionZh}</div></button> })}</div></SettingRow></SettingCard></div>
}

function CompanionPage({ momentTips, onMomentTipsChange, onOpenRoleShelf, onProactiveGreetingChange, proactiveGreeting, expertise, onExpertiseChange }: { momentTips: boolean; onMomentTipsChange: (value: boolean) => void; onOpenRoleShelf?: () => void; onProactiveGreetingChange: (value: boolean) => void; proactiveGreeting: boolean; expertise: string; onExpertiseChange: (value: string) => void }) {
  const answerOptions = [
    ['auto', '自动', '根据问题难度调整', '简单问题直接回答，复杂问题补充步骤。'],
    ['novice', '讲清楚一些', '多补充背景和步骤', '解释为什么这样做，再带你一步步完成。'],
    ['intermediate', '重点优先', '先结论，再补关键原因', '给出做法，同时保留必要注意事项。'],
    ['expert', '直接一点', '默认进入细节', '省略基础介绍，直接给方案、参数和边界。'],
  ] as const
  return <div className="space-y-4" data-testid="settings-candidate-section-companion"><CandidatePageHeader icon={<Heart size={14} />} title="伙伴与相处" description="调整伙伴和你说话、提醒以及回应你的方式。" /><SettingCard><SettingRow scope="伙伴" label="当前伙伴" description="朋友圈、衣柜和对话都会跟随当前主角。" icon={<UserRound size={15} />}><button type="button" onClick={onOpenRoleShelf} className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] transition" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} data-testid="settings-candidate-open-role-shelf">小林 · 管理角色架 <ChevronRight size={12} /></button></SettingRow></SettingCard><SettingCard><SettingRow scope="伙伴" label="回答方式" description="你希望伙伴平时怎么回答你？" icon={<Eye size={15} />} stacked><div className="grid gap-2 sm:grid-cols-2">{answerOptions.map(([value, label, description, example]) => { const selected = expertise === value; return <button key={value} type="button" aria-pressed={selected} onClick={() => onExpertiseChange(value)} className="rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}><div className="flex items-center justify-between gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}{selected && <Check size={13} style={{ color: 'var(--accent-fg)' }} />}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{description}</div><div className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>例如：{example}</div></button> })}</div></SettingRow></SettingCard><SettingCard><div className="space-y-2" data-testid="settings-candidate-companion-controls"><SettingRow label="相处补充说明" description="告诉伙伴你希望长期保持的回应方式；这是当前样张中的临时输入。" icon={<Sparkles size={15} />} stacked><textarea aria-label="相处补充说明" defaultValue="当我把事情排得太满时，提醒我留一点空白。" rows={3} className="theme-input w-full resize-y rounded-[var(--radius-md)] border px-3 py-2 text-[12px] outline-none" /></SettingRow><CandidateSwitch checked={momentTips} scope="伙伴" label="生活动态提醒" description="有新的生活动态时，在应用内轻轻提醒你。" onChange={onMomentTipsChange} testId="settings-candidate-switch-moment-tips" />{momentTips && <div className="rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><div className="mb-2 text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>提醒节奏</div><div className="grid gap-2 sm:grid-cols-3">{[['勿扰开始', '22:00'], ['勿扰结束', '08:00'], ['每日最多', '3 条']].map(([label, value]) => <div key={label} className="rounded-[var(--radius-sm)] border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div><div className="mt-1 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{value}</div></div>)}</div></div>}<CandidateSwitch checked={proactiveGreeting} scope="伙伴" label="主动问候" description="允许伙伴在合适的时机主动来打个招呼，默认保持关闭。" onChange={onProactiveGreetingChange} testId="settings-candidate-switch-proactive-greeting" /></div></SettingCard></div>
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
  const closeAdd = () => { setShowAdd(false); setApiKey('') }
  const openAdd = () => { chooseSource('relay'); setShowAdd(true); setApiKey('') }
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
  const finishAdd = () => {
    if (!name.trim() || !baseUrl.trim()) return
    if (source !== 'custom' && (!selectedProviderConfig || providerSource(selectedProviderConfig) !== source)) return
    const id = `connection-${crypto.randomUUID()}`
    const connection: ModelConnectionFixture = { id, name: name.trim(), source, protocol: source === 'custom' ? CONNECTION_ADAPTER_LABELS[adapter] : undefined, providerLabel: source === 'custom' ? '自定义连接' : selectedProviderConfig!.label, baseUrl: baseUrl.trim(), credentialStatus: apiKey.trim() ? 'stored' : 'missing', status: 'untested', models: [] }
    setConnections((items) => [...items, connection])
    closeAdd()
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
  const setPreview = (state: 'empty' | 'one' | 'two') => { fetchTimers.current.forEach((timer) => window.clearTimeout(timer)); fetchTimers.current.clear(); setFetchStates({}); setFetchedModelsByConnection({}); setModelDrafts({}); setPreviewState(state); if (state === 'empty') { setConnections([]); setRoutes({ primary: [], auxiliary: [], image: [] }); return }; const first = createConnection(firstProvider); if (state === 'one') { setConnections([first]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], auxiliary: [{ connectionId: first.id, modelId: 'gpt-4o-mini', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }); return }; const second = createConnection(allProviders.find((item) => item.providerId === 'openrouter') ?? allProviders[1], 1); second.name = '国际流动'; second.source = 'relay'; second.models = [{ id: 'deepseek-chat', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }, { id: 'deepseek-reasoner', enabled: true, visibleInPicker: true, purpose: 'unused', image: 'unknown', tools: 'unknown' }]; setConnections([first, second]); setRoutes({ primary: [{ connectionId: first.id, modelId: 'gpt-4o', enabled: true }, { connectionId: second.id, modelId: 'deepseek-chat', enabled: true }], auxiliary: [{ connectionId: second.id, modelId: 'deepseek-reasoner', enabled: true }], image: [{ connectionId: first.id, modelId: 'image-model-id', enabled: true }] }) }
  const availableModels = connections.flatMap((connection) => connection.models.filter((model) => model.enabled).map((model) => ({ connectionId: connection.id, connectionName: connection.name, modelId: model.id })))
  const routeLabel = (route: ModelRoute) => { const connection = connections.find((item) => item.id === route.connectionId); return connection ? `${connection.name} · ${route.modelId}` : route.modelId }
  const addRoute = (purpose: ModelRoutePurpose, key: string) => { const [connectionId, modelId] = key.split('::'); if (!connectionId || !modelId) return; setRoutes((current) => ({ ...current, [purpose]: current[purpose].some((item) => item.connectionId === connectionId && item.modelId === modelId) ? current[purpose] : [...current[purpose], { connectionId, modelId, enabled: true }] })) }
  const moveRoute = (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => setRoutes((current) => { const next = [...current[purpose]]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return { ...current, [purpose]: next } })
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
            <div className="flex flex-wrap items-center gap-2 px-3 py-3" data-testid={`settings-candidate-connection-header-${connection.id}`}>
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: connection.status === 'healthy' ? 'var(--success)' : connection.status === 'failed' ? 'var(--danger)' : 'var(--text-muted)' }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium" title={connection.name} style={{ color: 'var(--text-primary)' }}>{connection.name}</span>
                  <span className="mt-1 block truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{sourceLabel(connection.source)} · {connection.protocol ?? connection.providerLabel} · {connection.models.length} 个模型</span>
                </span>
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
          </div>
        })}
      </div></SettingCard>
      {showAdd && <SettingCard testId="settings-candidate-model-add-form">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>添加连接</h3>
          <button type="button" aria-label="关闭添加连接" title="关闭添加连接" onClick={closeAdd} className="rounded p-1"><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
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
          <button type="button" onClick={closeAdd} className="rounded px-3 py-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>取消</button>
          <button type="button" onClick={finishAdd} disabled={!name.trim() || !baseUrl.trim()} className="rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px] font-medium disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }}>保存连接</button>
        </div>
      </SettingCard>}
      <SettingCard><button type="button" onClick={() => setShowAdvanced(!showAdvanced)} aria-expanded={showAdvanced} className="flex w-full items-center justify-between gap-3 text-left" data-testid="settings-candidate-model-advanced-toggle"><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>高级设置</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>连接测试、预算和生成参数只在需要时查看。</span></span><ChevronRight size={14} className={`transition ${showAdvanced ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)' }} /></button>{showAdvanced && <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}><div data-testid="settings-candidate-model-budget"><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>运行预算 <ScopeBadge label="全局" /></div><div className="mb-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>输入与输出 Token 合计；0 表示不限制。</div><div className="grid gap-2 sm:grid-cols-2"><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>会话预算（Token）<input aria-label="会话预算（Token）" value={sessionBudget} onChange={(event) => setSessionBudget(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>每日预算（Token）<input aria-label="每日预算（Token）" value={dailyBudget} onChange={(event) => setDailyBudget(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label></div><div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>当前：{sessionBudget === '0' ? '不限制' : `${sessionBudget} Token`}</div></div><label className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>Temperature<input aria-label="Temperature" value={temperature} onChange={(event) => setTemperature(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" /></label><button type="button" onClick={() => onModelStatusChange('success')} className="rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--accent-fg)' }} data-testid="settings-candidate-model-test">测试连接</button>{modelStatus !== 'idle' && <div role="status" className="rounded-[var(--radius-md)] px-3 py-2 text-[11px]" style={{ background: modelStatus === 'success' ? 'var(--accent-subtle)' : 'color-mix(in srgb, var(--danger) 10%, transparent)', color: modelStatus === 'success' ? 'var(--accent-fg)' : 'var(--danger)' }} data-testid="settings-candidate-model-status">{modelStatus === 'success' ? '连接配置看起来可用（仅样张反馈）' : '连接测试失败；请检查地址和凭据。'}</div>}</div>}</SettingCard>
    </div>
  )
}
function MemoryPage({ detail }: { detail?: ReactNode }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-memory"><CandidatePageHeader icon={<Brain size={14} />} title="记忆" description="查看和管理会影响未来相处的长期信息。" />{detail ?? <SettingCard><div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>记忆内容由产品体验页统一管理。</div></SettingCard>}</div>
}

function DataPage({ lastAction, onAction }: { lastAction: string; onAction: (action: string) => void }) {
  return <div className="space-y-4" data-testid="settings-candidate-section-data"><CandidatePageHeader icon={<Database size={14} />} title="数据与隐私" description="管理本地数据的迁移和备份，并明确哪些内容不会跟着备份文件离开设备。" /><SettingCard><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => onAction('已模拟导出')} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition" style={{ borderColor: 'var(--border-subtle)' }} data-testid="settings-candidate-export"><span className="flex items-center gap-2"><Upload size={15} style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导出数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>生成一份本地备份</span></span></span><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></button><button type="button" onClick={() => onAction('已模拟导入')} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-3 text-left transition" style={{ borderColor: 'var(--border-subtle)' }} data-testid="settings-candidate-import"><span className="flex items-center gap-2"><Download size={15} style={{ color: 'var(--accent-fg)' }} /><span><span className="block text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>导入数据</span><span className="mt-1 block text-[10px]" style={{ color: 'var(--text-muted)' }}>从本地备份恢复</span></span></span><ChevronRight size={14} style={{ color: 'var(--text-muted)' }} /></button></div>{lastAction && <div className="mt-3 rounded-[var(--radius-md)] px-3 py-2 text-[11px]" role="status" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{lastAction}（仅样张反馈）</div>}</SettingCard><SettingCard><div className="grid gap-4 sm:grid-cols-2"><div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><Save size={14} style={{ color: 'var(--accent-fg)' }} />备份包含</div><ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>会话与消息</li><li>记忆条目</li><li>普通模型与伙伴偏好</li></ul></div><div><div className="mb-2 flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><LockKeyhole size={14} style={{ color: 'var(--accent-fg)' }} />备份不包含</div><ul className="space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><li>API Key 和 MCP 密钥</li><li>权限规则与执行模式</li><li>本机项目路径</li></ul></div></div></SettingCard></div>
}

function PermissionsPage({ mode, onModeChange }: { mode: string; onModeChange: (value: string) => void }) {
  const [ruleTarget, setRuleTarget] = useState('命令')
  const [ruleAction, setRuleAction] = useState('拒绝')
  const [rulePattern, setRulePattern] = useState('npm publish')
  const [savedRule, setSavedRule] = useState({ target: '命令', action: '拒绝', pattern: 'npm publish' })
  return <div className="space-y-4" data-testid="settings-candidate-section-permissions">
    <CandidatePageHeader icon={<ShieldCheck size={14} />} title="权限与自动化" description="让你决定 Agent 什么时候先问你、什么时候按计划推进；越高风险的能力越应该明确。" />
    <SettingCard>
      <div className="mb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>默认审批方式<ScopeBadge label="全局" /></h3>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>选择一个默认方式；遇到具体操作时，你仍然可以临时调整。</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">{[['auto', '自动', '只在需要时确认'], ['confirm-all', '全部确认', '每次工具调用都先问'], ['plan-first', '先计划', '先看计划再执行']].map(([value, label, description]) => {
        const selected = mode === value
        return <button key={value} type="button" aria-pressed={selected} onClick={() => onModeChange(value)} className="rounded-[var(--radius-md)] border p-3 text-left transition" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)', background: selected ? 'var(--accent-subtle)' : 'transparent' }}>
          <div className="flex items-center justify-between gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}{selected && <Check size={13} style={{ color: 'var(--accent-fg)' }} />}</div>
          <div className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{description}</div>
        </button>
      })}</div>
    </SettingCard>
    <SettingCard testId="settings-candidate-rules-existing">
      <h3 className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}><Settings2 size={15} style={{ color: 'var(--accent-fg)' }} />已有规则</h3>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>自己指定某类操作：允许、需要确认，或直接拒绝。</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{savedRule.action} · {savedRule.target}</div>
          <div className="mt-1 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{savedRule.pattern}</div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: savedRule.action === '拒绝' ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--accent-subtle)', color: savedRule.action === '拒绝' ? 'var(--danger)' : 'var(--accent-fg)' }}>{savedRule.action}</span>
      </div>
    </SettingCard>
    <SettingCard testId="settings-candidate-rules-create">
      <div className="mb-3">
        <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>新增一条规则</div>
        <div className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>例如：拒绝发布命令；修改文件时，每次先问你。</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>操作类型<select aria-label="规则操作类型" value={ruleTarget} onChange={(event) => setRuleTarget(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none"><option>命令</option><option>修改文件</option><option>删除文件</option></select></label>
        <label className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>处理方式<select aria-label="规则处理方式" value={ruleAction} onChange={(event) => setRuleAction(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none"><option>允许</option><option>需要确认</option><option>拒绝</option></select></label>
        <label className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>匹配内容<input aria-label="规则匹配内容" value={rulePattern} onChange={(event) => setRulePattern(event.target.value)} className="theme-input mt-1 w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none" placeholder="例如：npm publish" /></label>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => setSavedRule({ target: ruleTarget, action: ruleAction, pattern: rulePattern || '未填写' })} className="rounded-[var(--radius-md)] border px-3 py-1.5 text-[10px] font-medium" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} data-testid="settings-candidate-save-rule">保存这条样张</button>
      </div>
    </SettingCard>
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
const MCP_STATUS_LABELS: Record<McpPreviewStatus, string> = {
  connected: '已连接', connecting: '连接中', confirm: '待确认', disabled: '已停用', error: '连接失败', auth: '需要登录',
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
      {form && <McpConnectionForm key={form} scene={form} onCancel={() => { setForm(null); if (scene.startsWith('add-')) setScene('empty') }} onSave={(server) => { setServers((current) => [...current, { ...server, id: `added-${++serial.current}` }]); setForm(null); if (scene.startsWith('add-')) setScene('one') }} />}
      {!form && servers.length === 0 && <div className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }} data-testid="settings-candidate-mcp-empty">还没有 MCP 服务</div>}
      {servers.map((server) => {
        const ready = server.status === 'connected'
        const confirming = server.status === 'confirm'
        const enabled = server.status !== 'disabled'
        const allowedCount = server.tools.filter((tool) => tool.allowed).length
        return <SettingCard key={server.id} testId={`settings-candidate-mcp-server-${server.id}`}>
          <div className="flex items-center gap-3">
            <Server size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
            <h3 className="min-w-0 flex-1 break-words text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{server.name}</h3>
            {!confirming && <CandidateSwitch compact checked={enabled} label={`启用${server.name}`} description="" testId={`mcp-enabled-${server.id}`} onChange={(checked) => updateServer(server.id, { status: checked ? 'connected' : 'disabled' })} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span>{server.transport}</span>
            <span className="inline-flex items-center gap-1" role="status" style={{ color: ready ? 'var(--success)' : server.status === 'error' ? 'var(--danger)' : 'var(--text-secondary)' }}>
              {server.status === 'connecting' && <RefreshCw size={12} className="animate-spin" />}{MCP_STATUS_LABELS[server.status]}
            </span>
          </div>
          {confirming && <div className="mt-4 space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><p>允许伙伴连接此服务，并使用选中的工具？</p><code className="block break-all text-[10px]" style={{ color: 'var(--text-muted)' }}>{server.address}</code></div>}
          {(ready || confirming) && <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}><span>{server.tools.length} 个工具</span>{server.tools.length > 0 && <span>{allowedCount} 个{confirming ? '已选择' : '已允许'}</span>}</div>
            {server.tools.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>已连接，服务未提供工具。</p> : <ul className="space-y-2">
              {server.tools.map((tool) => <li key={tool.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} data-testid="mcp-tool-row">
                <div className="min-w-0"><span style={{ color: 'var(--text-primary)' }}>{tool.name}</span><code className="ml-2 break-all text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.id}</code></div>
                {confirming ? <input type="checkbox" aria-label={`允许${tool.name}`} checked={tool.allowed} onChange={() => updateServer(server.id, { tools: server.tools.map((item) => item.id === tool.id ? { ...item, allowed: !item.allowed } : item) })} /> : !tool.allowed && <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>未允许</span>}
              </li>)}
            </ul>}
          </div>}
          {server.status === 'connecting' && <div className="mt-4 flex items-center justify-between gap-3 text-[11px]"><span style={{ color: 'var(--text-muted)' }}>正在连接并获取工具清单…</span><button type="button" onClick={() => updateServer(server.id, { status: 'disabled' })}>取消</button></div>}
          {server.status === 'error' && <div className="mt-4 flex items-center justify-between gap-3 text-[11px]"><span style={{ color: 'var(--text-secondary)' }}>连接超时，请检查服务是否正在运行。</span><button type="button" className="inline-flex shrink-0 items-center gap-1" onClick={() => updateServer(server.id, { status: 'connecting' })} style={{ color: 'var(--accent-fg)' }}><RefreshCw size={12} />重试</button></div>}
          {server.status === 'auth' && <p className="mt-4 text-[11px]" style={{ color: 'var(--text-secondary)' }}>登录后才能获取此服务的工具清单。</p>}
          {server.status === 'disabled' && <p className="mt-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>配置已保留，伙伴暂不使用此服务。</p>}
          {confirming && <div className="mt-4 flex justify-end gap-3 text-[11px]"><button type="button" onClick={() => chooseScene('empty')}>取消</button><button type="button" onClick={() => updateServer(server.id, { status: 'connected' })} className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border px-3 py-1.5" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }}><Check size={13} />确认连接</button></div>}
        </SettingCard>
      })}
    </div>
  </div>
}

/**
 * 背景：添加入口需要可审阅的填写、失败和工具确认过程，不能直接跳过配置。
 * 设计意图：表单只校验本地输入，用明确标注的样张结果替代网络；字段改动使旧结果失效。
 * 关键约束：不执行命令或保存令牌；取消、场景切换卸载时清除模拟计时器。
 */
function McpConnectionForm({ scene, onCancel, onSave }: { scene: McpScene; onCancel: () => void; onSave: (server: Omit<McpPreviewServer, 'id'>) => void }) {
  const [kind, setKind] = useState(scene === 'add-local' ? 'local' : 'remote')
  const [name, setName] = useState(scene === 'add-invalid' ? '' : scene === 'add-local' ? '文件服务' : '文档服务')
  const [url, setUrl] = useState('https://docs.example.com/mcp')
  const [auth, setAuth] = useState('none')
  const [token, setToken] = useState('')
  const [command, setCommand] = useState('npx')
  const [args, setArgs] = useState('-y\n@modelcontextprotocol/server-filesystem\n./workspace')
  const [env, setEnv] = useState('')
  const [error, setError] = useState(scene === 'add-invalid' ? '请输入连接名称。' : '')
  const [state, setState] = useState<'editing' | 'connecting' | 'ready'>(scene === 'add-ready' ? 'ready' : scene === 'add-connecting' ? 'connecting' : 'editing')
  const [testing, setTesting] = useState(false)
  const [allowed, setAllowed] = useState(true)
  const invalidate = () => { setState('editing'); setTesting(false); setError('') }
  useEffect(() => {
    if (!testing) return
    const timer = window.setTimeout(() => { setState('ready'); setTesting(false); setAllowed(true) }, 650)
    return () => window.clearTimeout(timer)
  }, [testing])
  const testConnection = () => {
    let message = ''
    if (!name.trim()) message = '请输入连接名称。'
    else if (kind === 'remote') {
      try { const address = new URL(url); if (!['https:', 'http:'].includes(address.protocol) || address.username || address.password) message = '请输入不含账号密码的 HTTP 或 HTTPS 地址。' }
      catch { message = '请输入完整的服务 URL。' }
      if (!message && auth === 'bearer' && !token.trim()) message = '请输入访问令牌，或选择无需认证。'
    } else if (!command.trim()) message = '请输入启动命令。'
    else if (env.split('\n').some((line) => line.trim() && !/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(line.trim()))) message = '环境变量每行使用 NAME=value 格式。'
    setError(message)
    if (!message) { setState('connecting'); setTesting(true) }
  }
  const fieldClass = 'theme-input mt-1 w-full min-w-0 rounded-md border px-2 py-2 text-[12px]'
  return <SettingCard testId="mcp-connection-form">
    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-[13px] font-medium">添加连接</h3><button type="button" aria-label="关闭添加连接" title="关闭添加连接" className="p-1" onClick={onCancel}><X size={14} /></button></div>
    <div className="mb-4 flex gap-1" role="group" aria-label="MCP 连接类型">{[['remote', '远程服务'], ['local', '本地服务']].map(([id, label]) => <button key={id} type="button" aria-pressed={kind === id} disabled={state === 'connecting'} className="settings-option px-3 py-1.5 text-[12px]" data-selected={kind === id ? 'true' : undefined} onClick={() => { setKind(id); invalidate() }}>{label}</button>)}</div>
    <form onSubmit={(event) => { event.preventDefault(); testConnection() }}>
      <fieldset disabled={state === 'connecting'} className="grid min-w-0 gap-3 text-[11px]">
        <label>连接名称<input className={fieldClass} value={name} maxLength={100} onChange={(event) => { setName(event.target.value); invalidate() }} /></label>
        {kind === 'remote' ? <>
          <label>服务 URL<input className={fieldClass} value={url} maxLength={2048} onChange={(event) => { setUrl(event.target.value); invalidate() }} /></label>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Streamable HTTP</div>
          <label>认证方式<select className={fieldClass} value={auth} onChange={(event) => { setAuth(event.target.value); setToken(''); invalidate() }}><option value="none">无需认证</option><option value="bearer">访问令牌（Bearer）</option></select></label>
          {auth === 'bearer' && <label>访问令牌<input type="password" autoComplete="off" className={fieldClass} value={token} maxLength={4096} onChange={(event) => { setToken(event.target.value); invalidate() }} /></label>}
        </> : <>
          <label>启动命令<input className={fieldClass} value={command} maxLength={500} onChange={(event) => { setCommand(event.target.value); invalidate() }} /></label>
          <label>参数（每行一个）<textarea rows={3} className={fieldClass} value={args} maxLength={4096} onChange={(event) => { setArgs(event.target.value); invalidate() }} /></label>
          <label>环境变量（每行 NAME=value）<textarea rows={2} className={fieldClass} value={env} maxLength={4096} onChange={(event) => { setEnv(event.target.value); invalidate() }} /></label>
        </>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
      {state === 'connecting' && <div role="status" className="mt-4 flex items-center gap-2 text-[12px]"><RefreshCw size={14} className="animate-spin" />正在连接并获取工具…<button type="button" className="ml-auto" onClick={invalidate}>取消测试</button></div>}
      {state === 'ready' && <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}><p role="status" className="mb-2 text-[12px]" style={{ color: 'var(--success)' }}>已获取 1 个工具（样张）</p><label className="flex items-center justify-between gap-2 text-[12px]">{kind === 'remote' ? '搜索文档' : '列出目录'}<input type="checkbox" aria-label="允许使用发现的工具" checked={allowed} onChange={(event) => setAllowed(event.target.checked)} /></label></div>}
      <p className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>隔离样张，不会连接服务或保存凭据。</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2 text-[12px]"><button type="button" className="settings-option px-3 py-1.5" onClick={onCancel}>取消</button><button type="submit" disabled={state === 'connecting'} className="settings-option px-3 py-1.5 disabled:opacity-40">测试连接</button><button type="button" disabled={state !== 'ready'} className="settings-option rounded-md border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} onClick={() => onSave({ name: name.trim(), transport: kind === 'remote' ? '远程 · Streamable HTTP' : '本地 · stdio', address: kind === 'remote' ? url.trim() : command.trim(), status: 'connected', tools: [{ id: kind === 'remote' ? 'search_docs' : 'list_directory', name: kind === 'remote' ? '搜索文档' : '列出目录', allowed }] })}>保存连接</button></div>
    </form>
  </SettingCard>
}

function CapabilityPage({ mode }: { mode: 'skills' | 'mcp' }) {
  const [skillsEnabled, setSkillsEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(skillsSamples.map((sample, index) => [sample.name, index === 0])))
  const [selectedSkill, setSelectedSkill] = useState(skillsSamples[0].name)
  const skill = skillsSamples.find((sample) => sample.name === selectedSkill) ?? skillsSamples[0]
  const [skillsState, setSkillsState] = useState<'单个' | '多个' | '详情'>('单个')

  return <div className="space-y-4" data-testid={`settings-candidate-section-${mode}`}>
    <CandidatePageHeader icon={mode === 'skills' ? <Wrench size={14} /> : <Link2 size={14} />} title={mode === 'skills' ? 'Skills' : 'MCP'} description={mode === 'skills' ? '管理伙伴可以按需使用的工作方法。' : '管理伙伴可以使用的外部服务连接。'} />
    {mode === 'skills' && <>
      <div className="flex items-center justify-end gap-1" data-playground-switcher role="tablist" aria-label="Skills 样张状态" data-testid="settings-candidate-skills-states">
        {(['单个', '多个', '详情'] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={skillsState === state} onClick={() => setSkillsState(state)} className="settings-option px-2.5 py-1 text-[10px]" data-selected={skillsState === state ? 'true' : undefined}>{state}</button>)}
      </div>
      {skillsState === '详情' ? <SettingCard testId="settings-candidate-skill-detail">
        <div className="mb-2">
          <button type="button" onClick={() => setSkillsState('多个')} aria-label="返回 Skills" title="返回 Skills" className="inline-flex h-7 shrink-0 items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }} data-testid="settings-candidate-skill-back"><ArrowLeft size={16} />返回 Skills</button>
        </div>
        <div className="mb-4 flex items-center gap-3">
          <h3 className="min-w-0 flex-1 break-words text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{skill.name}</h3>
          <CandidateSwitch checked={skillsEnabled[skill.name]} compact label={skill.name} description="" onChange={(enabled) => setSkillsEnabled((current) => ({ ...current, [skill.name]: enabled }))} testId="settings-candidate-skills-enabled" />
        </div>
        <div className="space-y-2 text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
          <p className="whitespace-pre-line"><span className="font-medium">触发条件：</span>{skill.trigger || '未单独声明'}</p>
          <p><span className="font-medium">技能描述：</span>{skill.description}</p>
        </div>
        <dl className="my-5 grid grid-cols-2 gap-3 border-y py-3 text-[11px] sm:grid-cols-4" style={{ borderColor: 'var(--border-subtle)' }}>
          {Object.entries({ 作者: skill.author, 版本: skill.version, 来源: '内置', 状态: skillsEnabled[skill.name] ? '已启用' : '未启用' }).map(([label, value]) => <div key={label}><dt style={{ color: 'var(--text-muted)' }}>{label}</dt><dd className="mt-1">{value}</dd></div>)}
        </dl>
        <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
          <div className="text-[11px]"><div className="mb-2" style={{ color: 'var(--text-muted)' }}>文件</div><span className="block px-2 py-1.5" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}>SKILL.md</span></div>
          <pre className="min-w-0 whitespace-pre-wrap break-words rounded-[var(--radius-md)] border p-3 font-mono text-[11px] leading-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }} data-testid="settings-candidate-skill-file-preview">{skill.raw}</pre>
        </div>
      </SettingCard> : <div className="grid gap-3 sm:grid-cols-2">
        {(skillsState === '多个' ? skillsSamples : skillsSamples.slice(0, 1)).map((sample) => <SettingCard key={sample.name} testId={'settings-candidate-skill-card-' + sample.name}>
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="min-w-0 break-words text-left text-[13px] font-medium" style={{ color: 'var(--text-primary)' }} onClick={() => { setSelectedSkill(sample.name); setSkillsState('详情') }}>{sample.name}</button>
            <CandidateSwitch checked={skillsEnabled[sample.name]} compact label={sample.name} description="" onChange={(enabled) => setSkillsEnabled((current) => ({ ...current, [sample.name]: enabled }))} testId={sample.name === skillsSamples[0].name ? 'settings-candidate-skills-enabled' : 'settings-candidate-skill-toggle-' + sample.name} />
          </div>
        </SettingCard>)}
      </div>}
    </>}
    {mode === 'mcp' && <McpScenePreview />}
  </div>
}
function AboutPage() {
  return <div className="space-y-4" data-testid="settings-candidate-section-about"><CandidatePageHeader icon={<CircleHelp size={14} />} title="关于 My Agent" description="查看版本、运行环境和本机数据位置。" /><SettingCard><div className="flex items-start gap-3"><Sparkles size={18} style={{ color: 'var(--companion-accent-warm)' }} /><div><div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>My Agent</div><p className="mt-1 text-[12px]" style={{ color: 'var(--text-muted)' }}>品牌标语待定</p></div></div><div className="mt-5 grid gap-3 text-[11px] sm:grid-cols-3" style={{ color: 'var(--text-secondary)' }}><div><div style={{ color: 'var(--text-muted)' }}>版本</div><div className="mt-1">0.1.0 · 开发中</div></div><div><div style={{ color: 'var(--text-muted)' }}>运行环境</div><div className="mt-1">Electron</div></div><div><div style={{ color: 'var(--text-muted)' }}>数据位置</div><div className="mt-1">本机存储</div></div></div></SettingCard></div>
}

export function SettingsExperienceCandidate({ companionDetail, memoryDetail, initialSection, onOpenRoleShelf }: SettingsExperienceCandidateProps) {
  const [activeSection, setActiveSection] = useState<SettingsCandidateSection>(initialSection ?? 'appearance')
  const [activeTheme, setActiveTheme] = useState('mist')
  const [fontScale, setFontScale] = useState('md')
  const [momentTips, setMomentTips] = useState(true)
  const [proactiveGreeting, setProactiveGreeting] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [expertise, setExpertise] = useState('auto')
  const [dataAction, setDataAction] = useState('')
  const [permissionMode, setPermissionMode] = useState('auto')

  useEffect(() => {
    // 背景：记忆页和设置页共用候选壳层，切换场景时可能保留上一次的设置分区。
    // 设计意图：按外部场景重新定位入口，避免用户回到设置时落在不可预期的局部页面。
    // 关键约束：只有 initialSection 变化才重置，普通的候选页内部交互不能被渲染刷新打断。
    setActiveSection(initialSection ?? 'appearance')
  }, [initialSection])

  const activeSectionLabel = [...NAV_ITEMS, { id: 'about' as const, label: '关于 My Agent', icon: <CircleHelp size={15} /> }].find((item) => item.id === activeSection)?.label ?? '设置'

  return <div aria-label="设置候选版" className="flex min-h-[620px] w-full min-w-0 overflow-hidden rounded-[var(--radius-lg)] border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }} data-testid="settings-candidate"><aside className="hidden w-[198px] shrink-0 flex-col border-r px-3 py-4 md:flex" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} data-testid="settings-nav"><div className="mb-5 px-2"><div className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: 'var(--text-primary)' }}>设置</div><p className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>把真正需要决定的事放在眼前。</p></div><nav className="flex-1 space-y-5" aria-label="设置候选导航">{SETTINGS_CANDIDATE_NAV_GROUPS.map((group) => <div key={group.group}><div className="mb-1 px-2 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{group.group}</div><div className="space-y-0.5">{group.items.map((item) => { const active = item.id === activeSection; return <button key={item.id} type="button" aria-current={active ? 'page' : undefined} aria-controls={`settings-candidate-panel-${item.id}`} title={item.label} onClick={() => setActiveSection(item.id)} className="settings-nav-item flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] transition" style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)', background: active ? 'var(--hover-overlay)' : undefined }} data-testid={`settings-candidate-nav-${item.id}`}><span style={{ color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{item.icon}</span><span className="min-w-0 truncate">{item.label}</span>{active && <ChevronRight size={12} className="ml-auto shrink-0" style={{ color: 'var(--text-muted)' }} />}</button> })}</div></div>)}</nav><div className="mt-5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}><button type="button" onClick={() => setActiveSection('about')} aria-current={activeSection === 'about' ? 'page' : undefined} aria-controls="settings-candidate-panel-about" title="关于 My Agent" className="settings-nav-item flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px]" style={{ color: activeSection === 'about' ? 'var(--text-primary)' : 'var(--text-secondary)', background: activeSection === 'about' ? 'var(--hover-overlay)' : undefined }} data-testid="settings-candidate-nav-about"><CircleHelp size={15} style={{ color: activeSection === 'about' ? 'var(--accent-fg)' : 'var(--text-muted)' }} />关于 My Agent</button></div></aside><div className="flex min-w-0 flex-1 flex-col"><div className="min-w-0 overflow-hidden border-b px-3 py-2 md:hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}><div className="flex min-w-0 w-full gap-1 overflow-x-auto" role="tablist" aria-label="设置候选导航" data-testid="settings-candidate-mobile-nav">{NAV_ITEMS.map((item) => { const active = item.id === activeSection; return <button key={item.id} type="button" role="tab" aria-selected={active} aria-controls={`settings-candidate-panel-${item.id}`} title={item.label} onClick={() => setActiveSection(item.id)} className="settings-option shrink-0 px-2.5 py-1.5 text-[10px]" data-selected={active ? 'true' : undefined}>{item.label}</button> })}<button type="button" role="tab" aria-selected={activeSection === 'about'} aria-controls="settings-candidate-panel-about" title="关于 My Agent" onClick={() => setActiveSection('about')} className="settings-option shrink-0 px-2.5 py-1.5 text-[10px]" data-selected={activeSection === 'about' ? 'true' : undefined}>关于</button></div></div><main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" data-testid="settings-main"><div key={activeSection} id={`settings-candidate-panel-${activeSection}`} role="tabpanel" aria-label={activeSectionLabel} className="view-transition mx-auto w-full max-w-3xl" data-testid="settings-candidate-content">{activeSection === 'appearance' && <AppearancePage activeTheme={activeTheme} fontScale={fontScale} onFontScaleChange={setFontScale} onThemeChange={setActiveTheme} />}{activeSection === 'memory' && <MemoryPage detail={memoryDetail} />}{activeSection === 'companion' && (companionDetail ?? <CompanionPage expertise={expertise} momentTips={momentTips} onExpertiseChange={setExpertise} onOpenRoleShelf={onOpenRoleShelf} onMomentTipsChange={setMomentTips} onProactiveGreetingChange={setProactiveGreeting} proactiveGreeting={proactiveGreeting} />)}{activeSection === 'model' && <ModelPage modelStatus={modelStatus} onModelStatusChange={setModelStatus} selectedProvider={selectedProvider} onProviderChange={setSelectedProvider} />}{activeSection === 'data' && <DataPage lastAction={dataAction} onAction={setDataAction} />}{activeSection === 'permissions' && <PermissionsPage mode={permissionMode} onModeChange={setPermissionMode} />}{activeSection === 'skills' && <CapabilityPage mode="skills" />}{activeSection === 'mcp' && <CapabilityPage mode="mcp" />}{activeSection === 'about' && <AboutPage />}</div></main></div></div>
}
