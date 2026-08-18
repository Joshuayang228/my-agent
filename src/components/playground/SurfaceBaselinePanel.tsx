/**
 * 页面级基线故事：把正式壳层组件放进固定视口，先确认组合态的比例与层级。
 * 该展厅只提供静态 props，不创建会话、不发送模型请求，也不保存设置。
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowUp, Brain, ChevronDown, Folder, PanelLeftOpen, Paperclip, Quote, Shield } from 'lucide-react'
import { SettingsPanel } from '../SettingsPanel'
import { MemoryPanel } from '../MemoryPanel'
import { ChatRightDock } from '../chat/right-dock/ChatRightDock'
import { PrimarySidebar, type SidebarSession } from '../shell/PrimarySidebar'
import { WorldHub } from '../shell/WorldHub'
import { StoryBlock } from './StoryBlock'
import type { MemoryEntry } from '../../shared/types'

type SurfaceId = 'chat' | 'sidebar' | 'dock' | 'world' | 'memory' | 'settings'

const SURFACES: { id: SurfaceId; label: string; description: string; adopted: boolean; source: string }[] = [
  { id: 'chat', label: 'Chat 壳', description: 'Sidebar 底部开发入口候选、二级页恢复入口、会话标题、居中欢迎区与紧凑输入卡', adopted: false, source: 'src/App.tsx · src/components/shell/PrimarySidebar.tsx' },
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

function SurfaceViewport({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-[620px] overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
    >
      {children}
    </div>
  )
}

function ChatSurface() {
  const sessionFilterRef = useRef<HTMLInputElement>(null)
  const [viewport, setViewport] = useState<'standard' | 'split' | 'collapsed'>('standard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const handleContextMenu = (event: MouseEvent, sessionId: string) => {
    event.preventDefault()
    void sessionId
  }

  const candidateStyle = `
    .playground-sidebar-candidate [data-testid="primary-sidebar"] button[title="记忆"] { display: none; }
    .playground-sidebar-candidate [data-testid="primary-sidebar"] .grid:has(> button[title="记忆"]) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          结构基线 · Playground 候选态 · 不连接真实会话
        </div>
        <div className="flex rounded-[var(--radius-md)] border p-0.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          {([
            { id: 'standard' as const, label: '标准宽度' },
            { id: 'split' as const, label: '分栏窄宽' },
            { id: 'collapsed' as const, label: '二级页收起' },
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
        <SurfaceViewport>
          <style>{candidateStyle}</style>
          <div className="flex h-full min-h-[620px]">
            {sidebarOpen && (
              <div className="playground-sidebar-candidate shrink-0" data-testid="surface-sidebar-candidate">
                <PrimarySidebar
                  personaName="小林"
                  personaBlurb="沉稳体贴的数字伙伴"
                  activeView={viewport === 'collapsed' ? 'memory' : 'chat'}
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

            {viewport === 'collapsed' ? (
              <div className="flex min-w-0 flex-1">
                <aside
                  className="flex w-[150px] shrink-0 flex-col border-r px-3 py-4"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                  data-testid="surface-secondary-nav"
                >
                  {!sidebarOpen && (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(true)}
                      className="mb-4 flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[11px] transition"
                      style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
                      data-testid="surface-sidebar-reopen"
                      title="重新展开主侧栏"
                    >
                      <PanelLeftOpen size={14} />
                      展开主侧栏
                    </button>
                  )}
                  <div className="px-2 pb-1 text-[9px] font-medium tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                    工具
                  </div>
                  <button type="button" className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-[12px] font-medium" style={{ color: 'var(--text-primary)', background: 'var(--sidebar-active)' }}>
                    <Brain size={14} />记忆
                  </button>
                  <button type="button" className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    Skills
                  </button>
                </aside>
                <div className="min-w-0 flex-1" style={{ background: 'var(--bg-primary)' }}>
                  <MemoryPanel onClose={noop} previewMemories={EMPTY_MEMORY_FIXTURES} readOnly />
                </div>
              </div>
            ) : (
              <div className="relative flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg-primary)' }}>
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
                <div className="flex h-[52px] shrink-0 items-center border-b px-4" style={{ borderColor: 'var(--border-subtle)' }}>
                  <span className="truncate text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>新对话</span>
                </div>
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
                        <span className="flex items-center gap-1"><Folder size={11} /> 未选择项目</span>
                        <span>结构预览</span>
                      </div>
                    </div>
                  </div>
                </div>
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
      <div className="flex h-full min-h-[620px]">
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
          onCloseFiles={noop}
          onCloseDebug={noop}
        />
      </div>
    </SurfaceViewport>
  )
}

function WorldSurface() {
  return (
    <SurfaceViewport>
      <WorldHub
        tab="moments"
        onTabChange={noop}
        onClose={noop}
        onOpenSession={noop}
        onSwitched={noop}
        recentByRole={{}}
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
        <MemoryPanel
          key={scenario}
          onClose={noop}
          previewMemories={memories}
          previewEditingId={scenario === 'editing' ? 'memory-workflow' : undefined}
          readOnly
        />
      </SurfaceViewport>
    </div>
  )
}

export function SurfaceBaselinePanel() {
  const [surface, setSurface] = useState<SurfaceId>('chat')
  const active = SURFACES.find((item) => item.id === surface) ?? SURFACES[0]

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="surface-baseline-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>页面基线</h2>
        <p className="mt-1 max-w-2xl text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>
          先确认 Alice 对齐的页面骨架、密度与组合态，再把规则回流到正式页面。这里的故事格只读，不写入会话、模型或设置。
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-color)' }} role="tablist" aria-label="页面基线分区">
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
      </div>

      <StoryBlock title={active.label} source={active.source} adopted={active.adopted}>
        <p className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>{active.description}</p>
        {surface === 'chat' && <ChatSurface />}
        {surface === 'sidebar' && <SidebarSurface />}
        {surface === 'dock' && <DockSurface />}
        {surface === 'world' && <WorldSurface />}
        {surface === 'memory' && <MemorySurface />}
        {surface === 'settings' && <SettingsSurface />}
      </StoryBlock>
    </div>
  )
}
