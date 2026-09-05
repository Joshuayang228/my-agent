/**
 * 页面级基线故事：把正式壳层组件放进固定视口，先确认组合态的比例与层级。
 * 该展厅只提供静态 props，不创建会话、不发送模型请求，也不保存设置。
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowRight, ArrowUp, BookOpen, Bot, Camera, CheckCircle2, Coffee, ChevronDown, CircleAlert, Clapperboard, FileCode2, Folder, Home, Image, Lightbulb, LoaderCircle, MapPin, MessageCircle, Music, Newspaper, PanelLeftOpen, Paperclip, RotateCcw, Shirt, Shield, UserRound, Users } from 'lucide-react'
import { SettingsExperienceCandidate } from './SettingsExperienceCandidate'
import { MemoryPanel, type MemoryPreviewEvidence } from '../MemoryPanel'
import { ChatRightDock } from '../chat/right-dock/ChatRightDock'
import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import type { FileBrowserPreviewData } from '../FileBrowser'
import type { MomentItem, MomentsPreviewData } from '../MomentsPanel'
import { PrimarySidebar, type SidebarSession } from '../shell/PrimarySidebar'
import { WorldHub, type WorldTab, type WorldTabDefinition } from '../shell/WorldHub'
import type { MemoryEntry } from '../../shared/types'
import type { PlaygroundTabId } from './catalog'
import { PLAYGROUND_PERSONAS, type PlaygroundPersona } from '../../shared/playground-journey-fixtures'
import momentTeaByWindow from '../../assets/playground/moment-tea-by-window.jpg'

type SurfaceId = 'chat' | 'sidebar' | 'dock' | 'world' | 'memory' | 'settings'

const SURFACES: { id: SurfaceId; label: string; description: string; adopted: boolean }[] = [
  { id: 'chat', label: 'Chat 壳', description: 'Sidebar 底部开发入口候选、会话标题、居中欢迎区与紧凑输入卡', adopted: false },
  { id: 'sidebar', label: 'Primary Sidebar', description: '伙伴身份、会话与底栏入口', adopted: true },
  { id: 'dock', label: 'Right Dock', description: '文件、审阅、终端与 Debug 层级', adopted: true },
  { id: 'world', label: '人物世界', description: '生活面 tab 与内容节奏', adopted: true },
  { id: 'memory', label: '记忆', description: '四类长期记忆、紧凑列表、敏感项与编辑态', adopted: true },
  { id: 'settings', label: '设置', description: '设置分组与详情区的整体密度', adopted: true },
]

const NOW = Date.now()
type MemoryPreviewGroup = 'identity' | 'collaboration' | 'communication' | 'relationship'

interface MemoryPreviewGroupDefinition {
  id: MemoryPreviewGroup
  label: string
  description: string
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
    description: '稳定背景、角色与长期关注。',
    memories: [
      { id: 'memory-user-identity', category: 'identity', content: '正在做一款人格化桌面 Agent。', createdAt: NOW - 12 * 86_400_000, updatedAt: NOW - 12 * 86_400_000 },
      { id: 'memory-user-background', category: 'identity', content: '既懂产品，也愿意亲自理解工程实现。', createdAt: NOW - 10 * 86_400_000, updatedAt: NOW - 10 * 86_400_000 },
      { id: 'memory-user-focus', category: 'preference', content: '长期关注人格化体验，以及产品设计与工程落地之间的关系。', createdAt: NOW - 3 * 86_400_000, updatedAt: NOW - 3 * 86_400_000 },
    ],
  },
  {
    id: 'collaboration',
    label: '协作习惯',
    description: '推进工作、决策与验收的稳定方式。',
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
    description: '表达、提醒与信息层级的偏好。',
    memories: [
      { id: 'memory-user-voice', category: 'voice', content: '偏好直接、清楚、有判断依据的回答。', createdAt: NOW - 5 * 86_400_000, updatedAt: NOW - 5 * 86_400_000 },
      { id: 'memory-relationship-purpose', category: 'feedback', content: '希望新增卡片和入口前，先说明它解决什么问题。', createdAt: NOW - 6 * 86_400_000, updatedAt: NOW - 6 * 86_400_000 },
      { id: 'memory-relationship-density', category: 'preference', content: '不喜欢无意义的层级、重复说明和打扰式提示。', createdAt: NOW - 4 * 86_400_000, updatedAt: NOW - 4 * 86_400_000 },
    ],
  },
  {
    id: 'relationship',
    label: '我们之间',
    description: '共同约定、重要纠正与持续影响未来的共识。',
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
  content: '最近在调整睡眠和用药安排。',
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

const FILE_PREVIEW_FIXTURES: FileBrowserPreviewData = {
  projectLabel: 'my-agent · 样张项目',
  initialPath: 'src/components/AppShell.tsx',
  tree: [
    {
      name: 'src',
      path: 'src',
      isDir: true,
      children: [
        { name: 'components', path: 'src/components', isDir: true, children: [
          { name: 'AppShell.tsx', path: 'src/components/AppShell.tsx', isDir: false },
          { name: 'PrimarySidebar.tsx', path: 'src/components/PrimarySidebar.tsx', isDir: false },
        ] },
        { name: 'shared', path: 'src/shared', isDir: true, children: [
          { name: 'types.ts', path: 'src/shared/types.ts', isDir: false },
        ] },
      ],
    },
    { name: 'AGENTS.md', path: 'AGENTS.md', isDir: false },
    { name: 'README.md', path: 'README.md', isDir: false },
  ],
  files: {
    'src/components/AppShell.tsx': {
      path: 'src/components/AppShell.tsx',
      kind: 'text',
      languageHint: 'typescript',
      content: `export function AppShell() {\n  return <div className="app-shell">{children}</div>\n}\n`,
    },
    'src/components/PrimarySidebar.tsx': {
      path: 'src/components/PrimarySidebar.tsx',
      kind: 'text',
      languageHint: 'typescript',
      content: `export function PrimarySidebar() {\n  return <aside data-testid="primary-sidebar" />\n}\n`,
    },
    'src/shared/types.ts': {
      path: 'src/shared/types.ts',
      kind: 'text',
      languageHint: 'typescript',
      content: `export type Surface = 'chat' | 'world' | 'settings'\n`,
    },
    'AGENTS.md': {
      path: 'AGENTS.md',
      kind: 'text',
      languageHint: 'markdown',
      content: `# AGENTS.md\n\n先在 Playground 验收 UI，再回流正式页面。\n`,
    },
    'README.md': {
      path: 'README.md',
      kind: 'text',
      languageHint: 'markdown',
      content: `# my-agent\n\n人格化桌面 AI Agent。\n`,
    },
  },
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
 * 关键约束：只有 work 状态显示隔离工作区；确认由舞台级全局层承载，完成回到普通回复，失败保留恢复动作。
 */
function ChatTaskJourney({ journey, onJourneyChange }: { journey: ChatJourney; onJourneyChange: (journey: ChatJourney) => void }) {
  if (journey === 'work') {
    return (
      <div className="rounded-[var(--radius-lg)] border p-3.5" data-testid="chat-surface-task-card" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2"><FileCode2 size={15} style={{ color: 'var(--accent-fg)' }} /><span className="truncate text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>整理项目结构</span></div>
          <span className="flex shrink-0 items-center gap-1 text-[10px]" style={{ color: 'var(--success)' }}><CheckCircle2 size={12} />进行中</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-tertiary)' }}><div className="h-full w-2/3 rounded-full" style={{ background: 'var(--accent-emphasis)' }} /></div>
        <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>正在梳理文件结构，右侧只显示这次任务需要的材料。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onJourneyChange('confirmation')} className="rounded-md border px-2.5 py-1.5 text-[10px] transition" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} data-testid="chat-surface-open-confirmation">需要确认时</button>
          <button type="button" onClick={() => onJourneyChange('completed')} className="rounded-md px-2.5 py-1.5 text-[10px] transition" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }} data-testid="chat-surface-complete-task">标记完成</button>
          <button type="button" onClick={() => onJourneyChange('conversation')} className="rounded-md px-2.5 py-1.5 text-[10px] transition" style={{ color: 'var(--text-muted)' }} data-testid="chat-surface-return-to-conversation">回到对话</button>
        </div>
      </div>
    )
  }

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
  const [journey, setJourney] = useState<ChatJourney>('welcome')
  const handleContextMenu = (event: MouseEvent, sessionId: string) => {
    event.preventDefault()
    void sessionId
  }
  const isWelcome = journey === 'welcome'
  const isWork = journey === 'work'
  const isTaskJourney = journey === 'work' || journey === 'confirmation' || journey === 'completed' || journey === 'failed'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2" data-testid="chat-surface-toolbar" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex min-w-0 items-center gap-2" role="tablist" aria-label="Chat 主旅程">
          <span className="shrink-0 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>主旅程</span>
          <div className="flex min-w-0 overflow-x-auto rounded-[var(--radius-md)] border p-0.5 scrollbar-thin" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            {CHAT_JOURNEYS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={journey === item.id}
                onClick={() => setJourney(item.id)}
                className="shrink-0 rounded px-2 py-1 text-[10px] transition"
                title={item.description}
                style={{
                  color: journey === item.id ? 'var(--accent-fg)' : 'var(--text-muted)',
                  background: journey === item.id ? 'var(--accent-subtle)' : 'transparent',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 rounded-[var(--radius-md)] border p-0.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
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
              className="rounded px-2 py-1 text-[10px] transition"
              style={{
                color: viewport === item.id ? 'var(--accent-fg)' : 'var(--text-muted)',
                background: viewport === item.id ? 'var(--accent-subtle)' : 'transparent',
              }}
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
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-y-auto px-6 py-8">
                  {isWelcome ? (
                    <div className="m-auto max-w-lg text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
                        <Bot size={22} strokeWidth={1.5} />
                      </div>
                      <h3 className="mt-5 font-display text-[1.9rem] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        嗨，我是{persona.name}
                      </h3>
                      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {persona.blurb}
                      </p>
                      <div className="mt-8 flex flex-wrap justify-center gap-2">
                        {[
                          { label: '打个招呼', action: () => setJourney('conversation') },
                          { label: '今天想怎么过？', action: () => setJourney('conversation') },
                          { label: '看看朋友圈', action: () => onNavigate?.('world') },
                        ].map((item, index) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={item.action}
                            className="rounded-full border px-3.5 py-1.5 text-[12px] transition"
                            style={{
                              borderColor: index === 0 ? 'var(--companion-accent-warm)' : 'var(--border-color)',
                              color: index === 0 ? 'var(--accent-fg)' : 'var(--text-secondary)',
                              background: index === 0 ? 'var(--accent-subtle)' : 'var(--card-bg)',
                            }}
                            data-testid="chat-journey-quick-action"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto w-full max-w-[800px] space-y-7 py-4" data-testid="chat-surface-message-flow">
                      <div className="flex items-start justify-end gap-2.5">
                        <div className="max-w-[75%] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[13px] leading-6" style={{ background: 'var(--msg-user-bg)', color: 'var(--text-primary)' }}>
                          帮我把今天的事情理一下，先做最重要的。
                        </div>
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}><UserRound size={14} aria-hidden="true" /></span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}><Bot size={14} aria-hidden="true" /></span>
                        <div className="min-w-0 max-w-[82%]">
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}><span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{persona.name}</span><span>刚刚</span></div>
                          <p className="mt-1.5 text-[14px] leading-7" data-testid={journey === 'completed' ? 'chat-surface-completed-reply' : undefined} style={{ color: 'var(--text-primary)' }}>{journey === 'completed' ? '已经整理好优先顺序。今天先处理最重要的三件事，剩下的我先放在会话里，之后可以继续接着排。' : '可以。我们先把今天必须完成的事情挑出来，再给剩下的留一点喘息的空间。'}</p>
                          <div className="mt-3 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}><MessageCircle size={12} aria-hidden="true" />上下文会跟着当前会话保留</div>
                        </div>
                      </div>
                      {isTaskJourney && <ChatTaskJourney journey={journey} onJourneyChange={setJourney} />}
                    </div>
                  )}
                </div>
                <div className="shrink-0 px-5 pb-5 pt-2">
                  <div className="mx-auto max-w-[800px]">
                    <div className="rounded-[var(--radius-xl)] border px-3 py-2 shadow-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)', boxShadow: '0 6px 22px color-mix(in srgb, var(--text-primary) 5%, transparent)' }}>
                      <textarea className="min-h-[64px] w-full resize-none bg-transparent px-1 py-2 text-[13px] outline-none" rows={2} placeholder={isWelcome ? `和${persona.name}说说…` : `继续和${persona.name}聊聊…`} data-testid="chat-surface-input" />
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1"><button type="button" className="rounded-md p-1.5" style={{ color: 'var(--text-muted)' }} title="添加附件"><Paperclip size={14} /></button><span className="h-4 w-px" style={{ background: 'var(--border-subtle)' }} /><button type="button" className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px]" style={{ color: 'var(--text-secondary)' }}><Shield size={12} />确认模式<ChevronDown size={9} /></button></div>
                        <div className="flex items-center gap-1.5"><span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>当前模型</span><button type="button" className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--accent-emphasis)', color: 'var(--accent-fg)' }} title="发送"><ArrowUp size={14} /></button></div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><span className="flex items-center gap-1"><Folder size={11} /> my-agent · 样张项目</span><span>{isWork ? '工作区已打开' : journey === 'confirmation' ? '等待确认' : journey === 'completed' ? '任务已完成' : journey === 'failed' ? '可以重试或继续聊聊' : isWelcome ? '准备开始' : '对话进行中'}</span></div>
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
            {isWork && <div className="hidden shrink-0 md:block" data-testid="chat-surface-workspace"><ChatRightDock projectPath={null} sessionId={null} showFiles filesPreview={FILE_PREVIEW_FIXTURES} playgroundTabs onCloseFiles={() => setJourney('conversation')} width={viewport === 'split' ? 290 : 360} /></div>}
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

type WorkspaceFixtureState = 'idle' | 'working' | 'confirmation' | 'review' | 'completed' | 'failed'

const WORKSPACE_FIXTURE_STATES: Array<{ id: WorkspaceFixtureState; label: string }> = [
  { id: 'idle', label: '无任务' },
  { id: 'working', label: '处理中' },
  { id: 'confirmation', label: '等待确认' },
  { id: 'review', label: '待审阅' },
  { id: 'completed', label: '已完成' },
  { id: 'failed', label: '未完成' },
]

function DockSurface() {
  const [state, setState] = useState<WorkspaceFixtureState>('working')
  const isActive = state !== 'idle' && state !== 'completed'
  const stateLabel = WORKSPACE_FIXTURE_STATES.find((item) => item.id === state)?.label ?? '无任务'
  const statusCopy: Record<WorkspaceFixtureState, string> = {
    idle: '当前没有任务；工作区只在 Chat 发起文件或项目任务后出现。',
    working: '正在整理项目结构，文件和预览会在任务需要时出现。',
    confirmation: '有一项需要你决定的操作，当前任务仍保持在原模型上。',
    review: '任务已经产生变更，先查看文件差异，再决定是否回到对话。',
    completed: '任务已经完成，结果默认回到对话，不把工作区变成第二个首页。',
    failed: '这次没有完成；错误原因和恢复动作留在任务现场。',
  }
  return (
    <SurfaceViewport>
      <div className="flex h-full min-h-[620px] flex-col">
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--accent-fg)' }}><Folder size={13} />任务工作区</div>
              <h3 className="mt-1 text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>整理项目结构</h3>
              <p className="mt-1 max-w-xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{statusCopy[state]}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2"><span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: state === 'failed' ? 'var(--danger)' : 'var(--text-secondary)' }}>{stateLabel}</span><button type="button" onClick={() => setState('idle')} className="rounded-[var(--radius-sm)] border px-2.5 py-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>回到对话</button></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="状态样张">{WORKSPACE_FIXTURE_STATES.map((item) => <button key={item.id} type="button" aria-pressed={state === item.id} onClick={() => setState(item.id)} className="settings-option px-2 py-1 text-[10px]" data-testid={`workspace-state-${item.id}`} data-selected={state === item.id ? 'true' : undefined}>{item.label}</button>)}</div>
        </div>
        <div className="flex min-h-0 flex-1 items-stretch justify-end">
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5"><div className="mx-auto max-w-2xl space-y-4">
            {isActive && <section className="rounded-[var(--radius-md)] border px-4 py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }} data-testid="workspace-task-context"><div className="flex items-center justify-between gap-3"><div className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>本次任务使用</div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>启动时固定</span></div><div className="mt-2 grid gap-2 text-[10px] sm:grid-cols-3"><div><div style={{ color: 'var(--text-muted)' }}>连接</div><div className="mt-1 truncate" title="OpenAI Compatible" style={{ color: 'var(--text-secondary)' }}>OpenAI Compatible</div></div><div><div style={{ color: 'var(--text-muted)' }}>模型</div><div className="mt-1 truncate font-mono" title="account-model-id" style={{ color: 'var(--text-secondary)' }}>account-model-id</div></div><div><div style={{ color: 'var(--text-muted)' }}>来源</div><div className="mt-1" style={{ color: 'var(--text-secondary)' }}>Chat</div></div></div></section>}
            {state === 'idle' && <div className="flex min-h-[250px] items-center justify-center text-center"><div><div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>还没有进行中的任务</div><p className="mt-1 max-w-sm text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>Chat 负责沟通和进度；工作区负责文件预览、写入确认和变更审阅。</p><div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}><span>文件预览</span><span>写入确认</span><span>变更审阅</span></div></div></div>}
            {state === 'working' && <section className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><LoaderCircle size={14} className="animate-spin" style={{ color: 'var(--accent-fg)' }} />正在处理文件</div><div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg-tertiary)' }}><div className="h-full w-2/3 rounded-full" style={{ background: 'var(--accent-emphasis)' }} /></div><div className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>读取 3 个文件 · 已完成 2 个步骤</div></section>}
            {state === 'confirmation' && <section className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--warning)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><Shield size={14} style={{ color: 'var(--warning)' }} />需要你的确认</div><p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>AI 请求写入 2 个文件。模型信息保留在上方，确认内容只描述这一次具体操作。</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setState('working')} className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[10px]" style={{ background: 'var(--accent-emphasis)', color: 'var(--accent-fg)' }}>批准</button><button type="button" onClick={() => setState('failed')} className="rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>拒绝</button></div></section>}
            {state === 'review' && <section className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><FileCode2 size={14} style={{ color: 'var(--accent-fg)' }} />待审阅的变更</div><div className="mt-3 space-y-2 text-[10px]" style={{ color: 'var(--text-secondary)' }}><div className="flex justify-between"><span>src/components/</span><span>2 个文件</span></div><div className="flex justify-between"><span>新增</span><span style={{ color: 'var(--success)' }}>+18 行</span></div></div></section>}
            {state === 'completed' && <section className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--success)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><CheckCircle2 size={14} style={{ color: 'var(--success)' }} />任务已完成</div><p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>结果会回到对话；工作区保留为查看文件和审阅变更的现场。</p></section>}
            {state === 'failed' && <section className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--danger)', background: 'var(--card-bg)' }}><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}><CircleAlert size={14} style={{ color: 'var(--danger)' }} />这次没有完成</div><p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}>模型连接失败；没有写入文件。可以重试，或回到对话重新决定。</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setState('working')} className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[10px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>重试</button><button type="button" onClick={() => setState('idle')} className="rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>回到对话</button></div></section>}
          </div></div>
          <ChatRightDock projectPath={null} sessionId={null} showFiles={isActive} filesPreview={FILE_PREVIEW_FIXTURES} playgroundTabs onCloseFiles={() => setState('idle')} />
        </div>
      </div>
    </SurfaceViewport>
  )
}
function MomentsProfileHero({ persona, onOpenMemory }: { persona: PlaygroundPersona; onOpenMemory?: () => void }) {
  return (
    <section className="moments-profile-hero relative shrink-0 overflow-hidden" data-testid="playground-moments-profile">
      <div className="moments-profile-hero-wash absolute inset-0" aria-hidden="true">
        <div className="moments-profile-hero-orbit absolute -right-10 -top-20 h-48 w-48 rounded-full" />
        <div className="moments-profile-hero-orbit moments-profile-hero-orbit-secondary absolute -left-16 -bottom-28 h-56 w-56 rounded-full" />
        <div className="moments-profile-hero-vignette absolute inset-x-0 bottom-0 h-20" />
      </div>
      <div className="relative flex min-h-[9.5rem] items-end gap-3 px-5 pb-4 pt-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border-4 text-lg font-semibold shadow-sm" style={{ borderColor: 'var(--card-bg)', background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
          小
        </div>
        <div className="min-w-0 flex-1 pb-0.5">
          <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{persona.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]" style={{ color: 'color-mix(in srgb, var(--text-primary) 78%, transparent)' }}>
            <span>沉稳体贴的数字伙伴</span>
            <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden="true" />生活在此刻</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onOpenMemory && (
            <button
              type="button"
              onClick={onOpenMemory}
              className="hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition sm:inline-flex"
              style={{ borderColor: 'color-mix(in srgb, var(--text-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', color: 'color-mix(in srgb, var(--text-primary) 86%, transparent)' }}
              data-testid="world-open-memory"
            >
              看记忆 <ArrowRight size={11} aria-hidden="true" />
            </button>
          )}
          <span className="hidden items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] sm:inline-flex" style={{ borderColor: 'color-mix(in srgb, var(--text-primary) 28%, transparent)', background: 'color-mix(in srgb, var(--text-primary) 12%, transparent)', color: 'color-mix(in srgb, var(--text-primary) 86%, transparent)' }}>
            <Image size={11} aria-hidden="true" /> 近期生活
          </span>
        </div>
      </div>
    </section>
  )
}

const PLAYGROUND_WORLD_TABS: readonly WorldTabDefinition[] = [
  { id: 'moments', label: '朋友圈', icon: <Newspaper size={14} strokeWidth={1.5} /> },
  { id: 'wardrobe', label: '衣柜', icon: <Shirt size={14} strokeWidth={1.5} /> },
  { id: 'culture', label: '文化角', icon: <BookOpen size={14} strokeWidth={1.5} /> },
  { id: 'home', label: '家居', icon: <Home size={14} strokeWidth={1.5} /> },
  { id: 'cast', label: '通讯录', icon: <Users size={14} strokeWidth={1.5} /> },
  { id: 'footprints', label: '足迹', icon: <MapPin size={14} strokeWidth={1.5} /> },
]

function WorldSurface({ persona, onNavigate, onOpenMemory }: { persona: PlaygroundPersona; onNavigate?: (tab: PlaygroundTabId) => void; onOpenMemory?: () => void }) {
  const [tab, setTab] = useState<WorldTab>('moments')
  const isLin = persona.id === 'lin'
  const wardrobe = isLin
    ? [['灰蓝薄外套', '最近常穿 · 适合傍晚散步'], ['深蓝帆布包', '常带着电脑和一本随手记。'], ['旧相机', '散步时偶尔带上。']]
    : [['米白针织衫', '最近常穿 · 适合安静的下午'], ['灰绿帆布包', '出门时装着耳机和一本随手记。'], ['折叠伞', '天气不确定时总会带上。']]
  const cast = isLin
    ? [[persona.name, '当前主角'], ['阿遥', '偶尔联系的朋友'], ['许叔', '楼下咖啡店老板']]
    : [[persona.name, '当前主角'], ['小林', '偶尔联系的朋友'], ['阿禾', '一起散步的朋友']]
  const previewPanels: Partial<Record<WorldTab, ReactNode>> = {
    wardrobe: (
      <div className="grid gap-3 p-5 sm:grid-cols-2" data-testid="world-wardrobe-fixture" data-persona-id={persona.id}>
        <article className="rounded-[var(--radius-xl)] border p-4 sm:col-span-2" style={{ borderColor: 'var(--companion-accent-warm)', background: 'var(--companion-surface)' }}>
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}><Shirt size={13} />当前穿着</div>
          <div className="mt-2 text-[17px] font-medium" style={{ color: 'var(--text-primary)' }}>{wardrobe[0][0]}</div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{wardrobe[0][1]}</p>
        </article>
        {wardrobe.slice(1).map(([name, detail]) => (
          <article key={name} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{detail}</p>
          </article>
        ))}
      </div>
    ),
    culture: (
      <div className="space-y-3 p-5" data-testid="world-culture-fixture" data-persona-id={persona.id}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: '读书', title: '《瓦尔登湖》', detail: '正在读 · 留下 3 条笔记', icon: <BookOpen size={16} /> },
            { label: '音乐', title: '旅行的意义', detail: '最近常听 · 傍晚散步', icon: <Music size={16} /> },
            { label: '电影', title: '《海街日记》', detail: '喜欢的电影 · 看过两次', icon: <Clapperboard size={16} /> },
            { label: '摄影', title: '窗边的光', detail: '自己的作品 · 2026 年 8 月', icon: <Camera size={16} /> },
          ].map((item) => (
            <article key={item.label} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}>{item.icon}{item.label}</div>
              <div className="mt-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
            </article>
          ))}
        </div>
        <blockquote className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}><BookOpen size={13} />读书笔记</div>
          <p className="mt-2 text-[12px] leading-6" style={{ color: 'var(--text-secondary)' }}>有时候不是事情太多，而是没有给自己留下足够的空白。</p>
        </blockquote>
      </div>
    ),
    home: (
      <div className="space-y-3 p-5" data-testid="world-home-fixture" data-persona-id={persona.id}>
        <div className="rounded-[var(--radius-xl)] border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
          <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}><Home size={13} />当前空间</div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>下午 · 家中</span></div>
          <div className="mt-2 text-[17px] font-medium" style={{ color: 'var(--text-primary)' }}>书桌</div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>窗帘拉开了一点，桌面留出了一块安静的空白。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { name: '台灯', detail: '暖光 · 已打开', icon: <Lightbulb size={16} /> },
            { name: '乌龙茶', detail: '刚泡好 · 还温着', icon: <Coffee size={16} /> },
            { name: '旧相机', detail: '放在桌角', icon: <Camera size={16} /> },
          ].map((item) => (
            <article key={item.name} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
              <span style={{ color: 'var(--companion-accent-warm)' }}>{item.icon}</span>
              <div className="mt-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
              <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
            </article>
          ))}
        </div>
      </div>
    ),
    cast: (
      <div className="space-y-2 p-5" data-testid="world-cast-fixture" data-persona-id={persona.id}>
        {cast.map(([name, relation]) => (
          <div key={name} className="flex items-center justify-between rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{relation}</span>
          </div>
        ))}
      </div>
    ),
    footprints: (
      <div className="space-y-3 p-5" data-testid="world-footprints-fixture" data-persona-id={persona.id}>
        <div className="rounded-[var(--radius-xl)] border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}><MapPin size={13} />最近去过</div>
          <div className="mt-2 text-[17px] font-medium" style={{ color: 'var(--text-primary)' }}>杭州 · 西湖边</div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>和阿遥一起散步，记下了一段慢下来的下午。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {['楼下咖啡店', '河边步道', '想去：北海'].map((place) => (
            <article key={place} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}>
              <MapPin size={15} style={{ color: 'var(--companion-accent-warm)' }} />
              <div className="mt-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{place}</div>
            </article>
          ))}
        </div>
      </div>
    ),
  }
  return (
    <SurfaceViewport>
      <div className="flex h-full min-h-0 flex-col" data-testid="playground-world-experience" data-persona-id={persona.id}>
        <MomentsProfileHero persona={persona} onOpenMemory={onOpenMemory ?? (() => onNavigate?.('settings'))} />
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
            tabs={PLAYGROUND_WORLD_TABS}
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
      <div className="flex justify-end" data-testid="settings-scene-actions">
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition"
            style={{ color: 'var(--text-muted)' }}
            data-testid="settings-return-to-chat"
          >
            回到 Chat <ArrowRight size={11} aria-hidden="true" />
          </button>
        )}
      </div>      <SurfaceViewport>
        <div aria-label="设置隔离预览" data-testid="settings-surface-candidate">
          <SettingsExperienceCandidate
            memoryDetail={<MemorySurface />}
            companionDetail={scenario === 'role-shelf' ? <RoleShelfFixture persona={persona} onPersonaChange={onPersonaChange} /> : undefined}
            initialSection={scenario === 'memory-management' ? 'memory' : scenario === 'role-shelf' ? 'companion' : undefined}
            onOpenMemory={() => onNavigate?.('settings')}
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

type MemoryScenario = 'list' | 'empty' | 'sensitive' | 'editing'

/**
 * 预览态只演示长期记忆的用户信息架构；Debug 开关和来源全部停留在 Renderer fixture。
 * 生产记忆仍不具备可展示 provenance，不能借这个候选伪造生产事实。
 */
function MemorySurface({ onNavigate, onOpenMemorySettings }: { onNavigate?: (tab: PlaygroundTabId) => void; onOpenMemorySettings?: () => void }) {
  const [scenario, setScenario] = useState<MemoryScenario>('list')
  const [group, setGroup] = useState<MemoryPreviewGroup>('identity')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [showSource, setShowSource] = useState(false)
  const scenarios: Array<{ id: MemoryScenario; label: string }> = [
    { id: 'list', label: '清单' },
    { id: 'empty', label: '空态' },
    { id: 'sensitive', label: '敏感项' },
    { id: 'editing', label: '纠正记忆' },
  ]
  const activeGroup = MEMORY_PREVIEW_GROUPS.find((item) => item.id === group) ?? MEMORY_PREVIEW_GROUPS[0]
  const memories = scenario === 'empty'
    ? []
    : scenario === 'sensitive'
      ? [...activeGroup.memories, SENSITIVE_MEMORY_FIXTURE]
      : activeGroup.memories
  const editingId = activeGroup.memories[0]?.id

  const toggleDebug = () => {
    setDebugEnabled((enabled) => {
      if (enabled) setShowSource(false)
      return !enabled
    })
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2" data-testid="memory-surface-toolbar">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1" role="tablist" aria-label="记忆分类" data-testid="memory-group-tabs">
            {MEMORY_PREVIEW_GROUPS.map((item) => {
              const active = group === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setGroup(item.id)}
                  className="settings-option px-2.5 py-1 text-[10px]"
                  data-testid={`memory-group-${item.id}`}
                  data-selected={active ? 'true' : undefined}
                >
                  {item.label} <span className="opacity-60">{item.memories.length}</span>
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {debugEnabled && (
              <button
                type="button"
                role="switch"
                aria-checked={showSource}
                aria-label="查看来源"
                onClick={() => setShowSource((visible) => !visible)}
                className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', background: 'var(--card-bg)' }}
                data-testid="memory-show-source"
              >
                <span className="relative h-3.5 w-6 rounded-full" style={{ background: showSource ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }}>
                  <span className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition" style={{ left: showSource ? 'calc(100% - 0.75rem)' : '0.125rem' }} />
                </span>
                查看来源
              </button>
            )}
            {onNavigate && (
              <button
                type="button"
                onClick={() => {
                  onNavigate('settings')
                  onOpenMemorySettings?.()
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition"
                style={{ color: 'var(--text-muted)' }}
                data-testid="memory-open-settings"
              >
                去设置 <ArrowRight size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }} data-testid="memory-group-description">
          {activeGroup.description}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }} data-testid="memory-boundary-note">
          这里保留会影响未来相处的长期信息；正在做什么和系统做过什么，分别留在 Chat / Debug。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>状态样张</span>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="记忆页面场景">
            {scenarios.map((item) => {
              const active = scenario === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScenario(item.id)}
                  className="settings-option px-2.5 py-1 text-[10px]"
                  data-selected={active ? 'true' : undefined}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={debugEnabled}
            aria-label="Debug 模式"
            onClick={toggleDebug}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition"
            style={{ color: debugEnabled ? 'var(--accent-fg)' : 'var(--text-muted)', background: debugEnabled ? 'var(--accent-subtle)' : 'transparent' }}
            data-testid="memory-debug-mode"
          >
            Debug {debugEnabled ? '开' : '关'}
          </button>
        </div>
      </div>
      <SurfaceViewport>
        <style>{PAGE_CANDIDATE_STYLE}</style>
        <div className="playground-memory-candidate" data-testid="memory-surface-candidate">
          <MemoryPanel
            key={`${scenario}-${group}`}
            onClose={noop}
            previewMemories={memories}
            previewEvidence={MEMORY_PREVIEW_EVIDENCE}
            previewCompact
            previewShowSource={debugEnabled && showSource}
            previewEditingId={scenario === 'editing' ? editingId : undefined}
            previewEditable={scenario === 'editing' || scenario === 'sensitive'}
            readOnly={scenario !== 'editing' && scenario !== 'sensitive'}
          />
        </div>
      </SurfaceViewport>
    </div>
  )
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
      {!fixedSurface && <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-color)' }} role="tablist" aria-label="页面基线分区">
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
              style={{
                color: selected ? 'var(--accent-fg)' : 'var(--text-muted)',
                background: selected ? 'var(--accent-subtle)' : 'transparent',
                fontWeight: selected ? 600 : 400,
              }}
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
        {surface === 'world' && <WorldSurface persona={activePersona} onNavigate={onNavigate} onOpenMemory={() => { onNavigate?.('settings'); handleSettingsScenarioChange('memory-management') }} />}
        {surface === 'memory' && <MemorySurface onNavigate={onNavigate} onOpenMemorySettings={() => handleSettingsScenarioChange('memory-management')} />}
        {surface === 'settings' && <SettingsSurface persona={activePersona} onPersonaChange={handlePersonaChange} scenario={activeSettingsScenario} onScenarioChange={handleSettingsScenarioChange} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}
