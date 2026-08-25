/**
 * 页面级基线故事：把正式壳层组件放进固定视口，先确认组合态的比例与层级。
 * 该展厅只提供静态 props，不创建会话、不发送模型请求，也不保存设置。
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowUp, ChevronDown, Folder, PanelLeftOpen, Paperclip, Quote, Shield } from 'lucide-react'
import { SettingsPanel } from '../SettingsPanel'
import { MemoryPanel } from '../MemoryPanel'
import { ChatRightDock } from '../chat/right-dock/ChatRightDock'
import type { FileBrowserPreviewData } from '../FileBrowser'
import type { MomentItem, MomentsPreviewData } from '../MomentsPanel'
import { PrimarySidebar, type SidebarSession } from '../shell/PrimarySidebar'
import { WorldHub, type WorldTab } from '../shell/WorldHub'
import type { MemoryEntry } from '../../shared/types'

type SurfaceId = 'chat' | 'sidebar' | 'dock' | 'world' | 'memory' | 'settings'

const SURFACES: { id: SurfaceId; label: string; description: string; adopted: boolean; source: string }[] = [
  { id: 'chat', label: 'Chat 壳', description: 'Sidebar 底部开发入口候选、会话标题、居中欢迎区与紧凑输入卡', adopted: false, source: 'src/App.tsx · src/components/shell/PrimarySidebar.tsx' },
  { id: 'sidebar', label: 'Primary Sidebar', description: '伙伴身份、会话与底栏入口', adopted: true, source: 'src/components/shell/PrimarySidebar.tsx' },
  { id: 'dock', label: 'Right Dock', description: '文件、审阅、终端与 Debug 层级', adopted: true, source: 'src/components/chat/right-dock/ChatRightDock.tsx' },
  { id: 'world', label: '人物世界', description: '生活面 tab 与内容节奏', adopted: true, source: 'src/components/shell/WorldHub.tsx' },
  { id: 'memory', label: '记忆', description: '结构化记忆的列表、空态、敏感项与编辑态', adopted: true, source: 'src/components/MemoryPanel.tsx' },
  { id: 'settings', label: '设置', description: '设置分组与详情区的整体密度', adopted: true, source: 'src/components/SettingsPanel.tsx' },
]

const NOW = Date.now()
const MEMORY_FIXTURES: MemoryEntry[] = [
  { id: 'memory-identity', category: 'identity', content: '正在做一款人格化桌面 Agent。', createdAt: NOW - 5 * 86_400_000, updatedAt: NOW - 5 * 86_400_000 },
  { id: 'memory-workflow', category: 'workflow', content: '先在 Playground 确认页面基线，再回流正式 UI。', createdAt: NOW - 2 * 86_400_000, updatedAt: NOW - 86_400_000 },
  { id: 'memory-voice', category: 'voice', content: '偏好直接、清楚、有判断依据的回答。', createdAt: NOW - 86_400_000, updatedAt: NOW - 86_400_000 },
]
const SENSITIVE_MEMORY_FIXTURES: MemoryEntry[] = [
  ...MEMORY_FIXTURES,
  { id: 'memory-sensitive', category: 'fact', content: '最近在调整睡眠和用药安排。', createdAt: NOW, updatedAt: NOW },
]
const EMPTY_MEMORY_FIXTURES: MemoryEntry[] = []
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
    },
    {
      id: 'playground-moment-2', roleId: 'lin', eventId: 'fixture-notes',
      publishedAt: NOW - 3 * 3_600_000, text: '路过河边的时候记下了一个想法：慢一点，反而能看见今天真正想做的事。',
      meta: { type: 'mood', location: '河边', interactions: [{ kind: 'coframe', castName: '阿禾' }] },
    },
  ] satisfies MomentItem[],
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
    <div
      className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-xl border"
      data-testid={testId}
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
    >
      {children}
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
      flex: 1;
    }
    .playground-sidebar-candidate [data-testid="primary-sidebar"] button[title="记忆"] { display: none; }
    .playground-sidebar-candidate [data-testid="primary-sidebar"] .grid:has(> button[title="记忆"]) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .playground-sidebar-candidate [data-testid="sidebar-developer-nav"] > :first-child,
    .playground-sidebar-candidate [data-testid="sidebar-developer-nav"] + div > :first-child {
      display: none;
    }
    .playground-memory-candidate [data-testid="memory-category-filters"] button {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      white-space: nowrap;
    }
  `

function ChatSurface({ source }: { source: string }) {
  const sessionFilterRef = useRef<HTMLInputElement>(null)
  const [viewport, setViewport] = useState<'standard' | 'split'>('standard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const handleContextMenu = (event: MouseEvent, sessionId: string) => {
    event.preventDefault()
    void sessionId
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2" data-testid="chat-surface-toolbar" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex min-w-0 items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
          <code className="truncate font-mono">{source}</code>
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
          <div className="flex h-full min-h-[620px]">
            {sidebarOpen && (
              <div className="playground-sidebar-candidate shrink-0" data-testid="surface-sidebar-candidate">
                <PrimarySidebar
                  personaName="小林"
                  personaBlurb="沉稳体贴的数字伙伴"
                  activeView="chat"
                  activeSessionId={null}
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
                  onCollapse={() => setSidebarOpen(false)}
                  width={248}
                />
              </div>
            )}

              <div className="relative flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg-primary)' }} data-testid="chat-surface-main">
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
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-8 text-center">
                    <div className="max-w-lg pb-3">
                      <h3 className="font-display text-[1.9rem] font-medium tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        嗨，我是小林
                      </h3>
                      <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        沉稳体贴的数字伙伴
                      </p>
                      <blockquote
                        className="mx-auto mt-3 flex max-w-sm items-start gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left text-[11.5px] leading-5"
                        style={{ color: 'var(--text-muted)', background: 'var(--bg-inset)' }}
                      >
                        <Quote className="mt-0.5 shrink-0" size={13} strokeWidth={1.6} aria-hidden="true" />
                        <span>聊天、朋友圈和衣柜都跟着当前主角；对话进行中不能换人。</span>
                      </blockquote>
                      <div className="mt-8 flex flex-wrap justify-center gap-2">
                        {['打个招呼', '今天想怎么过？', '看看朋友圈'].map((label, index) => (
                          <button
                            key={label}
                            type="button"
                            className="rounded-full border px-3.5 py-1.5 text-[12px]"
                            style={{
                              borderColor: index === 0 ? 'var(--companion-accent-warm)' : 'var(--border-color)',
                              color: index === 0 ? 'var(--accent-fg)' : 'var(--text-secondary)',
                              background: index === 0 ? 'var(--accent-subtle)' : 'var(--card-bg)',
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button type="button" className="mt-3 rounded px-2 py-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        换个主角 →
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 px-5 pb-5 pt-2">
                    <div className="mx-auto max-w-[800px]">
                      <div
                        className="rounded-[var(--radius-xl)] border px-3 py-2 shadow-sm"
                        style={{
                          borderColor: 'var(--border-color)',
                          background: 'var(--card-bg)',
                          boxShadow: '0 6px 22px color-mix(in srgb, var(--text-primary) 5%, transparent)',
                        }}
                      >
                        <textarea className="min-h-[64px] w-full resize-none bg-transparent px-1 py-2 text-[13px] outline-none" rows={2} placeholder="和小林说说…" />
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1">
                            <button type="button" className="rounded-md p-1.5" style={{ color: 'var(--text-muted)' }} title="添加附件"><Paperclip size={14} /></button>
                            <span className="h-4 w-px" style={{ background: 'var(--border-subtle)' }} />
                            <button type="button" className="flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px]" style={{ color: 'var(--text-secondary)' }}>
                              <Shield size={12} />确认模式<ChevronDown size={9} />
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>GPT-4o</span>
                            <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: 'var(--accent-emphasis)' }} title="发送"><ArrowUp size={14} /></button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between px-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1"><Folder size={11} /> my-agent · 样张项目</span>
                        <span>结构预览</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
  return (
    <SurfaceViewport>
      <div className="flex h-full min-h-[620px] items-stretch justify-end">
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>任务工作区</div>
          <div className="max-w-xs text-xs leading-5" style={{ color: 'var(--text-muted)' }}>右侧能力坞出现后，主对话仍保持可读和可继续。</div>
        </div>
        <ChatRightDock
          projectPath={null}
          sessionId={null}
          showFiles
          conversationDebug={false}
          persistedCalls={[]}
          persistedLoading={false}
          filesPreview={FILE_PREVIEW_FIXTURES}
          playgroundTabs
          onCloseFiles={noop}
          onCloseDebug={noop}
        />
      </div>
    </SurfaceViewport>
  )
}

function WorldSurface() {
  const [tab, setTab] = useState<WorldTab>('moments')
  const previewPanels: Partial<Record<WorldTab, ReactNode>> = {
    assets: (
      <div className="grid gap-3 p-5 sm:grid-cols-2" data-testid="world-assets-fixture">
        {[['深蓝帆布包', '常带着电脑和一本随手记。'], ['乌龙茶', '下午工作时会泡一壶。'], ['旧相机', '散步时偶尔带上。']].map(([name, detail]) => (
          <article key={name} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</div>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{detail}</p>
          </article>
        ))}
      </div>
    ),
    cast: (
      <div className="space-y-2 p-5" data-testid="world-cast-fixture">
        {[['小林', '当前主角'], ['阿遥', '偶尔联系的朋友'], ['许叔', '楼下咖啡店老板']].map(([name, relation]) => (
          <div key={name} className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{relation}</span>
          </div>
        ))}
      </div>
    ),
    shelf: (
      <div className="grid gap-3 p-5 sm:grid-cols-2" data-testid="world-shelf-fixture">
        <article className="rounded-lg border p-4" style={{ borderColor: 'var(--companion-accent-warm)', background: 'var(--bg-secondary)' }}>
          <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>小林</div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>沉稳、体贴，正在陪你推进这款 Agent。</p>
          <span className="mt-3 inline-flex rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>当前主角</span>
        </article>
        <article className="rounded-lg border p-4" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>新角色占位</div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>后续人物故事确认后再补正式角色。</p>
        </article>
      </div>
    ),
  }
  return (
    <SurfaceViewport>
      <WorldHub
        tab={tab}
        onTabChange={setTab}
        onClose={noop}
        onOpenSession={noop}
        onSwitched={noop}
        recentByRole={{}}
        momentsPreview={MOMENTS_PREVIEW_FIXTURES}
        momentsAppearance="social-feed"
        hideMomentsHeader
        previewPanels={previewPanels}
      />
    </SurfaceViewport>
  )
}

function SettingsSurface() {
  return (
    <SurfaceViewport>
      <div className="pointer-events-none" aria-label="设置静态预览">
        <SettingsPanel onClose={noop} />
      </div>
    </SurfaceViewport>
  )
}

type MemoryScenario = 'list' | 'empty' | 'sensitive' | 'editing'

/** 静态场景只驱动正式 MemoryPanel 的 preview props，不访问 memory IPC。 */
function MemorySurface() {
  const [scenario, setScenario] = useState<MemoryScenario>('list')
  const scenarios: Array<{ id: MemoryScenario; label: string }> = [
    { id: 'list', label: '列表' },
    { id: 'empty', label: '空态' },
    { id: 'sensitive', label: '敏感项' },
    { id: 'editing', label: '编辑态' },
  ]
  const memories = scenario === 'empty'
    ? EMPTY_MEMORY_FIXTURES
    : scenario === 'sensitive'
      ? SENSITIVE_MEMORY_FIXTURES
      : MEMORY_FIXTURES

  return (
    <div className="space-y-2">
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
      <SurfaceViewport>
        <style>{PAGE_CANDIDATE_STYLE}</style>
        <div className="playground-memory-candidate" data-testid="memory-surface-candidate">
          <MemoryPanel
            key={scenario}
            onClose={noop}
            previewMemories={memories}
            previewEditingId={scenario === 'editing' ? 'memory-workflow' : undefined}
            readOnly
          />
        </div>
      </SurfaceViewport>
    </div>
  )
}

export function SurfaceBaselinePanel({ initialSurface }: { initialSurface?: SurfaceId } = {}) {
  const [surface, setSurface] = useState<SurfaceId>(initialSurface ?? 'chat')
  const fixedSurface = initialSurface !== undefined

  return (
    <div className="w-full space-y-4" data-testid="surface-baseline-panel">
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
        {surface === 'chat' && <ChatSurface source={SURFACES.find((item) => item.id === 'chat')?.source ?? ''} />}
        {surface === 'sidebar' && <SidebarSurface />}
        {surface === 'dock' && <DockSurface />}
        {surface === 'world' && <WorldSurface />}
        {surface === 'memory' && <MemorySurface />}
        {surface === 'settings' && <SettingsSurface />}
      </div>
    </div>
  )
}
