/**
 * 页面级基线故事：把正式壳层组件放进固定视口，先确认组合态的比例与层级。
 * 该展厅只提供静态 props，不创建会话、不发送模型请求，也不保存设置。
 */

import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowRight, ChevronDown, CircleAlert, Folder, MapPin, MessageCircle, PanelLeftOpen, PanelRight, RotateCcw, Search, Shield, X, Check } from 'lucide-react'
import { SettingsExperienceCandidate } from './SettingsExperienceCandidate'
import { WorkspaceDock, WorkspaceExperienceCandidate } from './WorkspaceExperienceCandidate'
import { MemoryPanel, type MemoryPreviewEvidence } from '../MemoryPanel'
import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import { ChatWelcome } from '../chat/ChatWelcome'
import { ChatComposer } from '../chat/ChatComposer'
import { ChatMessageFrame } from '../chat/ChatMessageFrame'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import type { MomentItem, MomentsPreviewData } from '../MomentsPanel'
import { PrimarySidebar, type SidebarSession } from '../shell/PrimarySidebar'
import { WorldHub, type WorldTab } from '../shell/WorldHub'
import { AssetsPanel } from '../AssetsPanel'
import { CastPanel, type CastPreviewData } from '../CastPanel'
import { WorldDetailsPanel } from '../WorldDetailsPanel'
import { WorldProfileHeader } from '../world/WorldProfileHeader'
import type { WorldAssetRecord } from '../world/WorldAssetEditor'
import type { MemoryEntry } from '../../shared/types'
import { MEMORY_GROUPS } from '../../shared/memory-groups'
import type { PlaygroundTabId } from './catalog'
import { PLAYGROUND_PERSONAS, type PlaygroundPersona } from '../../shared/playground-journey-fixtures'
import momentTeaByWindow from '../../assets/playground/moment-tea-by-window.jpg'

type SurfaceId = 'chat' | 'sidebar' | 'dock' | 'world' | 'memory' | 'settings'

const SURFACES: { id: SurfaceId; label: string; description: string; adopted: boolean }[] = [
  { id: 'chat', label: 'Chat 壳', description: 'Sidebar 底部开发入口候选、会话标题、居中欢迎区与紧凑输入卡', adopted: false },
  { id: 'sidebar', label: 'Primary Sidebar', description: '伙伴身份、会话与底栏入口', adopted: true },
  { id: 'dock', label: 'Right Dock', description: '文件、审阅、终端与 Debug 层级', adopted: true },
  { id: 'world', label: '人物世界', description: '生活面 tab 与内容节奏', adopted: true },
  { id: 'memory', label: '记忆', description: '四类长期记忆、独立条目卡、敏感项与编辑态', adopted: true },
  { id: 'settings', label: '设置', description: '设置分组与详情区的整体密度', adopted: true },
]

const NOW = Date.now()
type MemoryPreviewGroup = 'identity' | 'collaboration' | 'communication' | 'relationship'

interface MemoryPreviewGroupDefinition {
  id: MemoryPreviewGroup
  label: string
  memories: MemoryEntry[]
}

/**
 * 这里的展示分组是 Playground 的用户心智候选，不改变生产 MemoryCategory。
 * 每条 fixture 只归一个主类，避免“关于你”成为无边界的兜底分类。
 */
const MEMORY_PREVIEW_GROUPS: MemoryPreviewGroupDefinition[] = [
  {
    id: 'identity',
    label: '身份信息',
    memories: [
      { id: 'memory-user-identity', category: 'identity', content: '正在做一款人格化桌面 Agent。', createdAt: NOW - 12 * 86_400_000, updatedAt: NOW - 12 * 86_400_000 },
      { id: 'memory-user-background', category: 'identity', content: '既懂产品，也愿意亲自理解工程实现。', createdAt: NOW - 10 * 86_400_000, updatedAt: NOW - 10 * 86_400_000 },
      { id: 'memory-user-focus', category: 'preference', content: '长期关注人格化体验，以及产品设计与工程落地之间的关系。', createdAt: NOW - 3 * 86_400_000, updatedAt: NOW - 3 * 86_400_000 },
    ],
  },
  {
    id: 'collaboration',
    label: '工作方式',
    memories: [
      { id: 'memory-user-workflow', category: 'workflow', content: '先研究现有实现，再形成判断和施工方案。', createdAt: NOW - 9 * 86_400_000, updatedAt: NOW - 8 * 86_400_000 },
      { id: 'memory-user-validation', category: 'workflow', content: '复杂改动要先写施工合同，并按步骤验收。', createdAt: NOW - 7 * 86_400_000, updatedAt: NOW - 6 * 86_400_000 },
      { id: 'memory-relationship-root-cause', category: 'feedback', content: '发现问题时先定位根因，不用猜测式修改。', createdAt: NOW - 2 * 86_400_000, updatedAt: NOW - 2 * 86_400_000 },
      { id: 'memory-user-quality', category: 'preference', content: '交付不能只做到能运行，也要达到应有的审美与完成度。', createdAt: NOW - 3 * 86_400_000, updatedAt: NOW - 3 * 86_400_000 },
    ],
  },
  {
    id: 'communication',
    label: '沟通偏好',
    memories: [
      { id: 'memory-user-voice', category: 'voice', content: '偏好直接、清楚、有判断依据的回答。', createdAt: NOW - 5 * 86_400_000, updatedAt: NOW - 5 * 86_400_000 },
      { id: 'memory-relationship-purpose', category: 'feedback', content: '希望新增卡片和入口前，先说明它解决什么问题。', createdAt: NOW - 6 * 86_400_000, updatedAt: NOW - 6 * 86_400_000 },
      { id: 'memory-relationship-density', category: 'preference', content: '不喜欢无意义的层级、重复说明和打扰式提示。', createdAt: NOW - 4 * 86_400_000, updatedAt: NOW - 4 * 86_400_000 },
    ],
  },
  {
    id: 'relationship',
    label: '我们之间',
    memories: [
      { id: 'memory-relationship-research', category: 'feedback', content: '我们约定：先参考 Alice 和项目现状，再形成自己的判断。', createdAt: NOW - 11 * 86_400_000, updatedAt: NOW - 11 * 86_400_000 },
      { id: 'memory-relationship-playground', category: 'workflow', content: '我们约定：候选先在 Playground 验收，再决定是否回流正式产品。', createdAt: NOW - 8 * 86_400_000, updatedAt: NOW - 7 * 86_400_000 },
      { id: 'memory-relationship-boundary', category: 'fact', content: '我们共同确定：人物世界呈现伙伴生活，记忆管理长期信息。', createdAt: NOW - 86_400_000, updatedAt: NOW - 86_400_000 },
    ],
  },
]

const SENSITIVE_MEMORY_FIXTURE: MemoryEntry = {
  id: 'memory-sensitive',
  category: 'fact',
  content: '最近在调整睡眠和处方药安排。',
  createdAt: NOW,
  updatedAt: NOW,
}

const MEMORY_PREVIEW_EVIDENCE: Partial<Record<string, MemoryPreviewEvidence>> = {
  'memory-user-identity': { source: '你介绍正在做的人格化桌面 Agent 时留下的背景（隔离样张）' },
  'memory-user-background': { source: '你长期展现出的产品与工程工作方式（隔离样张）' },
  'memory-user-focus': { source: '你长期关注产品与工程如何共同落地（隔离样张）' },
  'memory-user-quality': { source: '你对交付质量提出的持续要求（隔离样张）' },
  'memory-user-workflow': { source: '你多次确认的研究与协作方式（隔离样张）' },
  'memory-user-validation': { source: '你对复杂改动的长期要求（隔离样张）' },
  'memory-relationship-root-cause': { source: '你对问题处理方式的明确要求（隔离样张）' },
  'memory-user-voice': { source: '你对回复方式给出的反馈（隔离样张）' },
  'memory-relationship-purpose': { source: '你对页面结构提出的持续要求（隔离样张）' },
  'memory-relationship-density': { source: '你对信息密度和层级的反馈（隔离样张）' },
  'memory-relationship-research': { source: '我们共同确认的研究顺序（隔离样张）' },
  'memory-relationship-playground': { source: '我们共同确认的产品施工流程（隔离样张）' },
  'memory-relationship-boundary': { source: '我们共同确定的产品边界（隔离样张）' },
  'memory-sensitive': { source: '你主动提到的近况（隔离样张）' },
}

const MOMENTS_PREVIEW_FIXTURES: MomentsPreviewData = {
  roleId: 'lin',
  roleName: '小林',
  summary: '今天的生活节奏比较松，他把下午留给了整理桌面和散步。',
  items: [
    {
      id: 'playground-moment-1', roleId: 'lin', eventId: 'fixture-walk',
      publishedAt: NOW - 35 * 60_000, text: '把窗帘拉开了一点，泡了杯乌龙茶，准备先把桌面清出一块。',
      meta: { type: 'daily', location: '家中', interactions: [{ kind: 'comment', castName: '小航', text: '这次先别把自己排得太满。' }] },
      media: [{ src: momentTeaByWindow, alt: '窗边的乌龙茶、笔记和远处山影' }],
    },
    {
      id: 'playground-moment-2', roleId: 'lin', eventId: 'fixture-notes',
      publishedAt: NOW - 3 * 3_600_000, text: '路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。',
      meta: { type: 'mood', location: '河边', interactions: [{ kind: 'coframe', castName: '阿禾' }] },
    },
    {
      id: 'playground-moment-3', roleId: 'lin', eventId: 'fixture-tea',
      publishedAt: NOW - 26 * 3_600_000, text: '下午茶时间。今天没有急着把所有事情做完，留一点空白也很好。',
      meta: { type: 'daily', location: '窗边', interactions: [] },
    },
  ] satisfies MomentItem[],
}


/**
 * 将同一组确定性动态投影到当前实验主角，保持故事结构稳定而让跨页面身份变化可见。
 * 背景：产品体验需要验证“当前主角”贯穿 Chat、人物世界六个生活面，而不是每个页面各自写死名字。
 * 关键约束：只复制 Playground fixture，不读取生产生活事件，也不改变正式 Moments 数据。
 */
function momentsPreviewForPersona(persona: PlaygroundPersona): MomentsPreviewData {
  return {
    ...MOMENTS_PREVIEW_FIXTURES,
    roleId: persona.id,
    roleName: persona.name,
    summary: `${persona.name}今天的生活节奏比较松，留了一点时间整理桌面和散步。`,
    items: MOMENTS_PREVIEW_FIXTURES.items.map((item) => ({
      ...item,
      roleId: persona.id,
    })),
  }
}

const SAMPLE_SESSIONS: SidebarSession[] = [
  {
    id: 'surface-session-1',
    title: '把右坞整理一下',
    createdAt: Date.now() - 86_400_000,
    updatedAt: Date.now() - 20 * 60_000,
    messageCount: 8,
    roleId: 'lin',
    sessionKind: 'main',
  },
  {
    id: 'surface-session-2',
    title: '今天想聊点轻松的',
    createdAt: Date.now() - 2 * 86_400_000,
    updatedAt: Date.now() - 2 * 3_600_000,
    messageCount: 5,
    roleId: 'lin',
    sessionKind: 'main',
  },
]

function noop() {}

function SurfaceViewport({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="playground-experience-stage flex min-h-[580px] flex-1 flex-col overflow-hidden rounded-2xl border p-2 sm:p-3" data-testid={testId} style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
      <div className="playground-experience-canvas flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl" style={{ background: 'var(--bg-primary)' }}>
        {children}
      </div>
    </div>
  )
}

const PAGE_CANDIDATE_STYLE = `
    .playground-sidebar-candidate {
      align-self: stretch;
      display: flex;
      align-items: stretch;
    }
    .playground-sidebar-candidate > [data-testid="primary-sidebar"] {
      flex: 0 0 auto;
    }
    .playground-sidebar-candidate [data-testid="primary-sidebar"] button[title="记忆"] { display: none; }
    .playground-sidebar-candidate [data-testid="primary-sidebar"] .grid:has(> button[title="记忆"]) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .playground-memory-candidate [data-testid="memory-category-filters"] {
      display: none;
    }
  `

type ChatJourney = 'welcome' | 'conversation' | 'work' | 'confirmation' | 'completed' | 'failed'

const CHAT_JOURNEYS: Array<{ id: ChatJourney; label: string; description: string }> = [
  { id: 'welcome', label: '初次进入', description: '轻量欢迎，不打断主任务。' },
  { id: 'conversation', label: '正在聊天', description: '对话成为页面的唯一主叙事。' },
  { id: 'work', label: '处理中', description: '需要工作区时，再让它按需出现。' },
  { id: 'confirmation', label: '需确认', description: '高影响操作必须在对话中说明并等待用户决定。' },
  { id: 'completed', label: '已完成', description: '任务结果回到对话，而不是留在工作区。' },
  { id: 'failed', label: '未完成', description: '说明失败原因并保留重试和回到对话的路径。' },
]

/**
 * Playground 只模拟 Chat 任务生命周期的可见状态，不驱动真实 Prompt、工具或权限引擎。
 * 背景：先确认用户何时需要确认、何时看到结果或失败，避免把不稳定模型输出当作 UI 验收前提。
 * 关键约束：只有 work 状态显示五功能工作区；确认由舞台级全局层承载，完成回到普通回复，失败保留恢复动作。处理中不再把任务进度卡塞进消息流。
 */
function ChatTaskJourney({ journey, onJourneyChange }: { journey: ChatJourney; onJourneyChange: (journey: ChatJourney) => void }) {
  if (journey === 'failed') {
    return (
      <div className="rounded-[var(--radius-lg)] border p-3.5" data-testid="chat-surface-failed" style={{ borderColor: 'color-mix(in srgb, var(--danger) 28%, var(--border-subtle))', background: 'var(--card-bg)' }}>
        <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><CircleAlert size={15} style={{ color: 'var(--danger)' }} />这次还没有完成</div>
        <p className="mt-2 text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>我没能读取目标材料，因此没有修改任何内容。你可以重试，或者先继续聊聊再决定。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onJourneyChange('work')} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] transition" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }} data-testid="chat-surface-retry-task"><RotateCcw size={11} />重试</button>
          <button type="button" onClick={() => onJourneyChange('conversation')} className="rounded-md px-2.5 py-1.5 text-[10px] transition" style={{ color: 'var(--text-muted)' }} data-testid="chat-surface-return-to-conversation">回到对话</button>
        </div>
      </div>
    )
  }

  // 需确认由舞台级确认层承载，已完成由普通伙伴回复承载；两者都不再向消息流追加业务卡片。
  return null
}

function ChatSurface({ persona, onNavigate, onOpenRoleShelf }: { persona: PlaygroundPersona; onNavigate?: (tab: PlaygroundTabId) => void; onOpenRoleShelf?: () => void }) {
  const sessionFilterRef = useRef<HTMLInputElement>(null)
  const [viewport, setViewport] = useState<'standard' | 'split'>('standard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [journey, setJourneyState] = useState<ChatJourney>('welcome')
  const [previewInput, setPreviewInput] = useState('')
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewMessage, setPreviewMessage] = useState('')
  const previewFileRef = useRef<HTMLInputElement>(null)
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const setJourney = (next: ChatJourney) => {
    setJourneyState(next)
    setWorkspaceOpen(true)
  }
  const handleContextMenu = (event: MouseEvent, sessionId: string) => {
    event.preventDefault()
    void sessionId
  }
  const sendPreview = () => {
    if (!previewInput.trim()) return
    setPreviewMessage(previewInput.trim() + (previewFiles.length ? '\n附件：' + previewFiles.join('、') : ''))
    setPreviewInput('')
    setPreviewFiles([])
    setJourney('conversation')
  }
  const isWelcome = journey === 'welcome'
  const isWork = journey === 'work'
  const isTaskJourney = journey === 'work' || journey === 'confirmation' || journey === 'completed' || journey === 'failed'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2" data-testid="chat-surface-toolbar" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="shrink-0 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>主旅程</span>
          <div data-playground-switcher role="tablist" aria-label="Chat 主旅程">
            {CHAT_JOURNEYS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={journey === item.id}
                onClick={() => setJourney(item.id)}
                className="shrink-0 rounded px-2 py-1 text-[10px] transition"
                title={item.description}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div data-playground-switcher role="group" aria-label="Chat 样张宽度">
          {([
            { id: 'standard' as const, label: '标准宽度' },
            { id: 'split' as const, label: '分栏窄宽' },
          ]).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setViewport(item.id)
                setSidebarOpen(true)
              }}
              aria-pressed={viewport === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full transition-[max-width]" style={{ maxWidth: viewport === 'split' ? 760 : 1040 }}>
        <SurfaceViewport testId="chat-surface-viewport">
          <style>{PAGE_CANDIDATE_STYLE}</style>
          <div className="relative flex h-full min-h-[580px]">
            {sidebarOpen && (
              <div className="playground-sidebar-candidate shrink-0" data-testid="surface-sidebar-candidate">
                <PrimarySidebar
                  personaName={persona.name}
                  personaBlurb={persona.blurb}
                  activeView="chat"
                  activeSessionId={isWelcome ? null : 'surface-session-1'}
                  sessionGroups={[{ label: '今天', items: SAMPLE_SESSIONS }]}
                  sessionPreviews={{ 'surface-session-1': '先把必须今天完成的挑出来…' }}
                  pinnedIds={[]}
                  bgStreamingSessionId={isWork ? 'surface-session-1' : null}
                  activeBgTaskCount={isWork ? 1 : 0}
                  sidebarSearchOpen={false}
                  sessionFilter=""
                  sessionFilterRef={sessionFilterRef}
                  renamingId={null}
                  renameValue=""
                  onOpenShelf={onOpenRoleShelf ?? noop}
                  onCreateSession={noop}
                  onToggleSearch={noop}
                  onSessionFilterChange={noop}
                  onCloseSearch={noop}
                  onSelectSession={noop}
                  onStartRename={noop}
                  onRenameChange={noop}
                  onCommitRename={noop}
                  onCancelRename={noop}
                  onDeleteSession={noop}
                  onContextMenu={handleContextMenu}
                  onNavigate={noop}
                  onCollapse={() => setSidebarOpen(false)}
                  width={248}
                />
              </div>
            )}

            <div className="relative flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg-primary)' }} data-testid="chat-surface-main" data-persona-id={persona.id}>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] transition"
                  style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
                  data-testid="surface-sidebar-reopen"
                  title="重新展开主侧栏"
                >
                  <PanelLeftOpen size={15} />
                </button>
              )}
              {isWork && <div className="hidden h-12 shrink-0 items-center justify-end px-3 md:flex" data-testid="chat-surface-workspace-toolbar">
                <button type="button" title={workspaceOpen ? '收起工作区' : '打开工作区'} aria-label={workspaceOpen ? '收起工作区' : '打开工作区'} aria-expanded={workspaceOpen} aria-controls="chat-surface-workspace-panel" onClick={() => setWorkspaceOpen((open) => !open)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-secondary)' }} data-testid="chat-surface-workspace-toggle"><PanelRight size={16} aria-hidden="true" /></button>
              </div>}
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-y-auto px-6 py-8">
                  {isWelcome ? (
                    <ChatWelcome title={`嗨，我是${persona.name}`} subtitle={persona.blurb}
                      onGreet={() => setJourney('conversation')}
                      onPlanDay={() => setJourney('conversation')}
                      onOpenWorld={() => onNavigate?.('world')}
                      actionTestId="chat-journey-quick-action" />
                  ) : (
                    <div className="mx-auto w-full max-w-[800px] space-y-7 py-4" data-testid="chat-surface-message-flow">
                      <ChatMessageFrame role="user">
                        <span className="whitespace-pre-wrap break-words">{previewMessage || '帮我把今天的事情理一下，先做最重要的。'}</span>
                      </ChatMessageFrame>
                      <ChatMessageFrame role="assistant" name={persona.name} previewTimeLabel="刚刚">
                          <p className="text-[14px] leading-7" data-testid={journey === 'completed' ? 'chat-surface-completed-reply' : undefined} style={{ color: 'var(--text-primary)' }}>{journey === 'completed' ? '已经整理好优先顺序。今天先处理最重要的三件事，剩下的我先放在会话里，之后可以继续接着排。' : '可以。我们先把今天必须完成的事情挑出来，再给剩下的留一点喘息的空间。'}</p>
                          <div className="mt-3 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}><MessageCircle size={12} aria-hidden="true" />上下文会跟着当前会话保留</div>
                      </ChatMessageFrame>
                      {isTaskJourney && <ChatTaskJourney journey={journey} onJourneyChange={setJourney} />}
                    </div>
                  )}
                </div>
                <div className="shrink-0 px-5 pb-5 pt-2">
                  <div className="mx-auto max-w-[800px]">
                    <input ref={previewFileRef} type="file" multiple hidden data-testid="chat-preview-file-input"
                      onChange={(event) => { setPreviewFiles(Array.from(event.target.files ?? []).map(file => file.name)); event.target.value = '' }} />
                    <ChatComposer
                      inputProps={{ value: previewInput, onChange: event => setPreviewInput(event.target.value),
                        placeholder: isWelcome ? `和${persona.name}说说…` : `继续和${persona.name}聊聊…`, 'data-testid': 'chat-surface-input',
                        onKeyDown: event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendPreview() } } }}
                      modelLabel="样张模型" sendDisabled={!previewInput.trim()} onSend={sendPreview}
                      onAttach={() => previewFileRef.current?.click()}
                      prefix={previewFiles.length > 0 && <div className="flex flex-wrap gap-1" data-testid="chat-preview-attachments">
                        {previewFiles.map((name, index) => <span key={index} className="inline-flex max-w-full items-center gap-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                          <span className="min-w-0 truncate">{name}</span><IconButton label={`移除${name}`} size={24} onClick={() => setPreviewFiles(files => files.filter((_, item) => item !== index))}><X size={12} /></IconButton>
                        </span>)}
                      </div>}
                      approvalControl={<ActionButton disabled title="审批设置在此样张中不可修改" className="gap-1 !border-0 !px-2 !text-[10.5px]"><Shield size={12} />确认模式<ChevronDown size={9} /></ActionButton>}
                    />
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><span className="flex items-center gap-1"><Folder size={11} /> my-agent · 样张项目</span><span>{isWork ? (workspaceOpen ? '工作区已打开' : '工作区已收起') : journey === 'confirmation' ? '等待确认' : journey === 'completed' ? '任务已完成' : journey === 'failed' ? '可以重试或继续聊聊' : isWelcome ? '准备开始' : '对话进行中'}</span></div>
                  </div>
                </div>
              </div>
            </div>
            {journey === 'confirmation' && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-4" data-testid="chat-surface-confirmation-overlay" role="dialog" aria-modal="true" aria-label="全局操作确认" style={{ background: 'color-mix(in srgb, var(--bg-primary) 78%, transparent)', backdropFilter: 'blur(5px)' }}>
                <div className="flex w-full max-w-md flex-col items-stretch gap-3" data-testid="chat-surface-confirmation">
                  <p className="px-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>这是应用内全局确认层，不属于 Chat 消息流；确认后任务才会继续。</p>
                  <PermissionConfirmCard toolName="file_write" args={{ path: 'src/components/', operation: '整理目录结构' }} onAllow={() => setJourney('work')} onDeny={() => setJourney('failed')} />
                  <button type="button" onClick={() => setJourney('conversation')} className="self-start rounded-md px-2.5 py-1.5 text-[10px] transition" style={{ color: 'var(--text-muted)' }} data-testid="chat-surface-return-to-conversation">暂时不处理，回到对话</button>
                </div>
              </div>
            )}
            {isWork && (
              <div id="chat-surface-workspace-panel" className={`hidden min-w-0 self-stretch shrink-0 overflow-hidden border-l ${workspaceOpen ? 'md:flex' : ''}`} data-testid="chat-surface-workspace" style={{ width: viewport === 'split' ? 320 : 420, maxWidth: '45%', borderColor: 'var(--border-color)' }}>
                <WorkspaceDock initialView="files" initialScene="Markdown" onClose={() => setJourney('conversation')} />
              </div>
            )}
          </div>
        </SurfaceViewport>
      </div>
    </div>
  )
}

function SidebarSurface() {
  const sessionFilterRef = useRef<HTMLInputElement>(null)
  const handleContextMenu = (event: MouseEvent, sessionId: string) => {
    event.preventDefault()
    void sessionId
  }

  return (
    <SurfaceViewport>
      <style>{PAGE_CANDIDATE_STYLE}</style>
      <div className="flex h-full min-h-[620px]">
        <div className="playground-sidebar-candidate shrink-0" data-testid="sidebar-surface-candidate">
          <PrimarySidebar
            personaName="小林"
            personaBlurb="沉稳体贴的数字伙伴"
            activeView="chat"
            activeSessionId="surface-session-1"
            sessionGroups={[{ label: '今天', items: SAMPLE_SESSIONS }]}
            sessionPreviews={{ 'surface-session-1': '先把必须今天完成的挑出来…' }}
            pinnedIds={[]}
            bgStreamingSessionId={null}
            activeBgTaskCount={0}
            sidebarSearchOpen={false}
            sessionFilter=""
            sessionFilterRef={sessionFilterRef}
            renamingId={null}
            renameValue=""
            onOpenShelf={noop}
            onCreateSession={noop}
            onToggleSearch={noop}
            onSessionFilterChange={noop}
            onCloseSearch={noop}
            onSelectSession={noop}
            onStartRename={noop}
            onRenameChange={noop}
            onCommitRename={noop}
            onCancelRename={noop}
            onDeleteSession={noop}
            onContextMenu={handleContextMenu}
            onNavigate={noop}
            onCollapse={noop}
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
          主内容区
        </div>
      </div>
    </SurfaceViewport>
  )
}

function DockSurface() {
  return <WorkspaceExperienceCandidate />
}
function MomentsProfileHero({ persona }: { persona: PlaygroundPersona }) {
  return <WorldProfileHeader profile={{ name: persona.name, description: persona.blurb }} testId="playground-moments-profile" />
}

function worldPreviewAsset(personaId: string, id: string, kind: string, name: string, payload: Record<string, unknown>, acquiredAt = 1): WorldAssetRecord {
  return { id: `${personaId}-${id}`, roleId: personaId, kind, name, payload, acquiredAt, sourceEventId: null }
}

function worldPreviewFixtures(persona: PlaygroundPersona) {
  const wardrobe = persona.id === 'lin'
    ? [
        worldPreviewAsset(persona.id, 'coat', 'wardrobe', '灰蓝薄外套', { color: '灰蓝', style: '薄外套', occasion: '傍晚散步' }),
        worldPreviewAsset(persona.id, 'bag', 'wardrobe', '深蓝帆布包', { color: '深蓝', style: '帆布包', occasion: '常带着电脑' }, 2),
        worldPreviewAsset(persona.id, 'camera', 'wardrobe', '旧相机', { color: '旧', style: '相机', occasion: '散步偶尔带上' }, 3),
      ]
    : [
        worldPreviewAsset(persona.id, 'coat', 'wardrobe', '米白针织衫', { color: '米白', style: '针织衫', occasion: '安静的下午' }),
        worldPreviewAsset(persona.id, 'bag', 'wardrobe', '灰绿帆布包', { color: '灰绿', style: '帆布包', occasion: '耳机和随手记' }, 2),
        worldPreviewAsset(persona.id, 'umbrella', 'wardrobe', '折叠伞', { color: '折叠', style: '雨具', occasion: '天气不确定' }, 3),
      ]
  const living: WorldAssetRecord[] = [
    worldPreviewAsset(persona.id, 'reading', 'culture', '《瓦尔登湖》', { type: 'reading', detail: '正在读', note: '有时候不是事情太多，而是没有给自己留下足够的空白。' }),
    worldPreviewAsset(persona.id, 'music', 'culture', '旅行的意义', { type: 'music', detail: '最近常听 · 傍晚散步' }, 2),
    worldPreviewAsset(persona.id, 'film', 'culture', '《海街日记》', { type: 'film', detail: '喜欢的电影' }, 3),
    worldPreviewAsset(persona.id, 'photo', 'culture', '窗边的光', { type: 'photography', detail: '自己的作品 · 2026 年 8 月' }, 4),
    worldPreviewAsset(persona.id, 'desk', 'home', '书桌', { interior: '窗帘拉开了一点，桌面留出了一块安静的空白。' }, 5),
    worldPreviewAsset(persona.id, 'lamp', 'furniture', '台灯', { description: '暖光 · 已打开' }, 6),
    worldPreviewAsset(persona.id, 'tea', 'object', '乌龙茶', { description: '刚泡好 · 还温着' }, 7),
    worldPreviewAsset(persona.id, 'home-camera', 'object', '旧相机', { description: '放在桌角' }, 8),
    worldPreviewAsset(persona.id, 'cafe', 'footprint', '楼下咖啡店', { visitStatus: 'favorite' }, 9),
    worldPreviewAsset(persona.id, 'riverside', 'footprint', '河边步道', { visitStatus: 'favorite' }, 10),
    worldPreviewAsset(persona.id, 'beihai', 'footprint', '北海', { visitStatus: 'wanted' }, 11),
  ]
  return {
    wardrobe,
    living,
    moments: [{ publishedAt: Date.UTC(2026, 8, 1), meta: { location: '杭州 · 西湖边' }, text: '和阿遥一起散步，记下了一段慢下来的下午。' }],
    presence: '下午 · 家中',
  }
}

function WorldSurface({ persona, onNavigate }: { persona: PlaygroundPersona; onNavigate?: (tab: PlaygroundTabId) => void }) {
  const [tab, setTab] = useState<WorldTab>('moments')
  const fixtures = useMemo(() => worldPreviewFixtures(persona), [persona])
  const castPreview = useMemo<CastPreviewData>(() => {
    const contacts = persona.id === 'lin'
      ? [{ id: 'yao', name: '阿遥', text: '偶尔联系的朋友' }, { id: 'xu', name: '许叔', text: '楼下咖啡店老板' }]
      : [{ id: 'lin', name: '小林', text: '偶尔联系的朋友' }, { id: 'he', name: '阿禾', text: '一起散步的朋友' }]
    return {
      roleId: persona.id,
      roleName: persona.name,
      lines: contacts.map((contact) => ({ otherId: contact.id, otherName: contact.name, relationType: 'friend', text: contact.text })),
      cast: contacts.map((contact) => ({ id: contact.id, name: contact.name, description: contact.text, summary: contact.text, canBeProtagonist: false, summonHint: contact.text })),
      availabilityById: Object.fromEntries(contacts.map((contact, index) => [contact.id, { roleId: contact.id, name: contact.name, available: index === 0, presence: index === 0 ? '在家读书' : '正在工作' }])),
    }
  }, [persona])
  const previewPanels: Partial<Record<WorldTab, ReactNode>> = {
    wardrobe: (
      <div data-testid="world-wardrobe-fixture" data-persona-id={persona.id}>
        <AssetsPanel key={persona.id} onClose={noop} previewAssets={fixtures.wardrobe} previewEditable previewRoleName={persona.name} previewWearingId={fixtures.wardrobe[0]?.id} />
      </div>
    ),
    culture: (
      <div data-testid="world-culture-fixture" data-persona-id={persona.id}>
        <WorldDetailsPanel key={`${persona.id}-culture`} tab="culture" previewAssets={fixtures.living} previewEditable previewRoleName={persona.name} />
      </div>
    ),
    home: (
      <div data-testid="world-home-fixture" data-persona-id={persona.id}>
        <WorldDetailsPanel key={`${persona.id}-home`} tab="home" previewAssets={fixtures.living} previewMoments={fixtures.moments} previewPresence={fixtures.presence} previewEditable previewRoleName={persona.name} />
      </div>
    ),
    cast: (
      <div className="h-full min-h-0" data-testid="world-cast-fixture" data-persona-id={persona.id}>
        <CastPanel key={persona.id} onClose={noop} previewData={castPreview} />
      </div>
    ),
    footprints: (
      <div data-testid="world-footprints-fixture" data-persona-id={persona.id}>
        <WorldDetailsPanel key={`${persona.id}-footprints`} tab="footprints" previewAssets={fixtures.living} previewMoments={fixtures.moments} previewEditable previewRoleName={persona.name} />
      </div>
    ),
  }
  return (
    <SurfaceViewport>
      <div className="flex h-full min-h-0 flex-col" data-testid="playground-world-experience" data-persona-id={persona.id}>
        <MomentsProfileHero persona={persona} />
        <div className="min-h-0 flex-1">
          <WorldHub
            tab={tab}
            onTabChange={setTab}
            onClose={noop}
            onOpenSession={noop}
            onSwitched={noop}
            recentByRole={{}}
            momentsPreview={momentsPreviewForPersona(persona)}
            momentsAppearance="alice-feed"
            showSocialActions
            hideMomentsHeader
            previewPanels={previewPanels}
            hideHeader
          />
        </div>
      </div>
    </SurfaceViewport>
  )
}

function SettingsSurface({ persona, onPersonaChange, scenario, onScenarioChange, onNavigate }: { persona: PlaygroundPersona; onPersonaChange: (personaId: string) => void; scenario: SettingsScenario; onScenarioChange: (scenario: SettingsScenario) => void; onNavigate?: (tab: PlaygroundTabId) => void }) {
  return (
    <div className="space-y-2">
      <SurfaceViewport>
        <div aria-label="设置隔离预览" data-testid="settings-surface-candidate">
          <SettingsExperienceCandidate
            memoryDetail={<MemorySurface />}
            companionDetail={scenario === 'role-shelf' ? <RoleShelfFixture persona={persona} onPersonaChange={onPersonaChange} /> : undefined}
            initialSection={scenario === 'memory-management' ? 'memory' : scenario === 'role-shelf' ? 'companion' : undefined}
            onOpenRoleShelf={() => onScenarioChange('role-shelf')}
          />
        </div>
      </SurfaceViewport>
    </div>
  )
}

/** 设置页中的角色架候选：只展示切换关系，不连接真实角色列表或写入主角状态。 */
function RoleShelfFixture({ persona, onPersonaChange }: { persona: PlaygroundPersona; onPersonaChange: (personaId: string) => void }) {
  return (
    <div className="space-y-4" data-testid="settings-role-shelf-fixture">
      <div className="mb-4 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>角色架</h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>管理同一生活世界中的主角，切换后朋友圈与对话一起跟随。</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAYGROUND_PERSONAS.map((option) => {
          const active = option.id === persona.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onPersonaChange(option.id)}
              aria-pressed={active}
              data-testid={`settings-persona-option-${option.id}`}
              className="rounded-xl border p-4 text-left transition"
              style={{ borderColor: active ? 'var(--companion-accent-warm)' : 'var(--border-subtle)', background: active ? 'var(--accent-subtle)' : 'var(--card-bg)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{option.name}</div>
                  <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{option.blurb} · {option.detail}</p>
                </div>
                {active && <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px]" style={{ background: 'var(--card-bg)', color: 'var(--accent-fg)' }}>当前主角</span>}
              </div>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>这是 Playground 的隔离切换；确认后，Chat 与人物世界会沿用同一位主角。</p>
    </div>
  )
}

type MemoryScenario = 'list' | 'long' | 'empty' | 'sensitive' | 'editing'

const LONG_MEMORY_CONTENT = [
  '在讨论一款需要长期使用的产品时，我希望先把真实使用场景、用户正在完成的任务和最容易被打断的环节说清楚，再决定页面里应该出现哪些信息。不要因为某个组件已经存在，就把它放进当前页面；也不要为了让页面显得完整，添加没有明确用途的入口。对低频能力，我更偏好能在需要时找到、平时不占据注意力的安排。',
  '当我给出截图或指出一个布局问题时，请以我指向的区域为准，先确认是内容层级、对齐、间距还是交互状态出了问题。改动前说明依据，改动后展示实际效果。如果正文很长，应允许它自然换行并保留段落，不要截断成省略号，也不要让日期和操作按钮挤占下一行。鼠标移入和移出时，正文的位置与卡片高度应保持稳定。',
  '我关心的不只是某个静态画面是否整齐，还包括连续操作时是否顺手：阅读之后可以直接编辑，取消后能回到原来的内容，删除前能明确确认，切换主题和缩窄窗口后仍然可读。这些偏好适用于日常协作，但不应被理解为每次回答都要附上一套流程说明。',
].join('\n\n')

/**
 * 预览态只演示长期记忆的用户信息架构；Debug 开关和来源全部停留在 Renderer fixture。
 * 生产记忆仍不具备可展示 provenance，不能借这个候选伪造生产事实。
 */
function MemorySurface({ onNavigate, onOpenMemorySettings }: { onNavigate?: (tab: PlaygroundTabId) => void; onOpenMemorySettings?: () => void }) {
  const [scenario, setScenario] = useState<MemoryScenario>('list')
  const [group, setGroup] = useState<MemoryPreviewGroup>('identity')
  const [scenarioGroup, setScenarioGroup] = useState<MemoryPreviewGroup>('identity')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const scenarios: Array<{ id: MemoryScenario; label: string }> = [
    { id: 'list', label: '清单' }, { id: 'long', label: '长记忆' },
    { id: 'empty', label: '空态' }, { id: 'sensitive', label: '敏感项' },
    { id: 'editing', label: '纠正记忆' },
  ]
  const memories = useMemo(() => {
    if (scenario === 'empty') return []
    const entries = MEMORY_PREVIEW_GROUPS.flatMap((item) => item.memories.map((memory, index) => ({
      ...memory,
      category: MEMORY_GROUPS.find((definition) => definition.id === item.id)!.category,
      content: scenario === 'long' && index === 0 ? LONG_MEMORY_CONTENT : memory.content,
    })))
    return scenario === 'sensitive'
      ? [...entries, { ...SENSITIVE_MEMORY_FIXTURE, category: MEMORY_GROUPS.find((item) => item.id === scenarioGroup)!.category }]
      : entries
  }, [scenario, scenarioGroup])
  const editingId = MEMORY_PREVIEW_GROUPS.find((item) => item.id === group)?.memories[0]?.id

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>状态样张</span>
      <div className="flex flex-wrap gap-1" data-playground-switcher role="tablist" aria-label="记忆页面场景">
        {scenarios.map((item) => <button key={item.id} type="button" role="tab" aria-selected={scenario === item.id}
          onClick={() => { setScenario(item.id); setScenarioGroup(group) }} className="settings-option px-2.5 py-1 text-[10px]"
          data-selected={scenario === item.id ? 'true' : undefined}>{item.label}</button>)}
      </div>
      <button type="button" role="switch" aria-checked={debugEnabled} aria-label="Debug 模式" data-testid="memory-debug-mode"
        onClick={() => { setDebugEnabled(!debugEnabled); setShowSource(false) }}
        className="ml-auto rounded-md px-2 py-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>Debug {debugEnabled ? '开' : '关'}</button>
      {debugEnabled && <button type="button" role="switch" aria-checked={showSource} aria-label="查看来源" data-testid="memory-show-source"
        onClick={() => setShowSource(!showSource)} className="rounded-md px-2 py-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>查看来源</button>}
      {onNavigate && <button type="button" data-testid="memory-open-settings" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px]"
        style={{ color: 'var(--text-muted)' }} onClick={() => { onNavigate('settings'); onOpenMemorySettings?.() }}>去设置 <ArrowRight size={11} /></button>}
    </div>
    <div className="playground-memory-candidate" data-testid="memory-surface-candidate">
      <MemoryPanel key={scenario} onClose={noop} previewMemories={memories} previewEvidence={MEMORY_PREVIEW_EVIDENCE}
        previewCompact previewManagement previewGroup={group} onPreviewGroupChange={setGroup}
        previewShowSource={debugEnabled && showSource} previewEditingId={scenario === 'editing' ? editingId : undefined}
        previewEditable previewHideFooter />
    </div>
  </div>
}
type SettingsScenario = 'settings' | 'memory-management' | 'role-shelf'

interface SurfaceBaselinePanelProps {
  initialSurface?: SurfaceId
  persona?: PlaygroundPersona
  onPersonaChange?: (personaId: string) => void
  settingsScenario?: SettingsScenario
  onSettingsScenarioChange?: (scenario: SettingsScenario) => void
  onNavigate?: (tab: PlaygroundTabId) => void
}

export function SurfaceBaselinePanel({ initialSurface, persona, onPersonaChange, settingsScenario, onSettingsScenarioChange, onNavigate }: SurfaceBaselinePanelProps = {}) {
  const activePersona = persona ?? PLAYGROUND_PERSONAS[0]
  const handlePersonaChange = onPersonaChange ?? noop
  const activeSettingsScenario = settingsScenario ?? 'settings'
  const handleSettingsScenarioChange = onSettingsScenarioChange ?? noop
  const [surface, setSurface] = useState<SurfaceId>(initialSurface ?? 'chat')
  const fixedSurface = initialSurface !== undefined

  return (
    <div className="playground-experience-panel w-full space-y-4" data-testid="surface-baseline-panel">
      {!fixedSurface && <div data-playground-switcher role="tablist" aria-label="页面基线分区">
        {SURFACES.map((item) => {
          const selected = item.id === surface
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSurface(item.id)}
              className="rounded-t-md px-3 py-2 text-xs transition"
            >
              {item.label}
            </button>
          )
        })}
      </div>}

      <div className="min-w-0">
        {surface === 'chat' && <ChatSurface persona={activePersona} onNavigate={onNavigate} onOpenRoleShelf={() => { onNavigate?.('settings'); handleSettingsScenarioChange('role-shelf') }} />}
        {surface === 'sidebar' && <SidebarSurface />}
        {surface === 'dock' && <DockSurface />}
        {surface === 'world' && <WorldSurface persona={activePersona} onNavigate={onNavigate} />}
        {surface === 'memory' && <MemorySurface onNavigate={onNavigate} onOpenMemorySettings={() => handleSettingsScenarioChange('memory-management')} />}
        {surface === 'settings' && <SettingsSurface persona={activePersona} onPersonaChange={handlePersonaChange} scenario={activeSettingsScenario} onScenarioChange={handleSettingsScenarioChange} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}
