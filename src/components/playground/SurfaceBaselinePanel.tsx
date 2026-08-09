/**
 * 页面级基线故事：把正式壳层组件放进固定视口，先确认组合态的比例与层级。
 * 该展厅只提供静态 props，不创建会话、不发送模型请求，也不保存设置。
 */

import { useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowUp, Folder, Menu, Paperclip } from 'lucide-react'
import { SettingsPanel } from '../SettingsPanel'
import { CompanionStatusBar } from '../CompanionStatusBar'
import { ChatRightDock } from '../chat/right-dock/ChatRightDock'
import { PrimarySidebar, type SidebarSession } from '../shell/PrimarySidebar'
import { WorldHub } from '../shell/WorldHub'
import { StoryBlock } from './StoryBlock'

type SurfaceId = 'chat' | 'sidebar' | 'dock' | 'world' | 'settings'

const SURFACES: { id: SurfaceId; label: string; description: string; adopted: boolean; source: string }[] = [
  { id: 'chat', label: 'Chat 壳', description: '身份、消息流与输入区的组合态', adopted: false, source: 'Playground story' },
  { id: 'sidebar', label: 'Primary Sidebar', description: '伙伴身份、会话与底栏入口', adopted: true, source: 'src/components/shell/PrimarySidebar.tsx' },
  { id: 'dock', label: 'Right Dock', description: '文件、审阅、终端与 Debug 层级', adopted: true, source: 'src/components/chat/right-dock/ChatRightDock.tsx' },
  { id: 'world', label: '人物世界', description: '生活面 tab 与内容节奏', adopted: true, source: 'src/components/shell/WorldHub.tsx' },
  { id: 'settings', label: '设置', description: '设置分组与详情区的整体密度', adopted: true, source: 'src/components/SettingsPanel.tsx' },
]

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
  return (
    <SurfaceViewport>
      <div className="flex h-full min-h-[620px] flex-col">
        <div
          className="flex h-12 shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button type="button" className="rounded-md p-1.5" style={{ color: 'var(--text-muted)' }} title="展开侧边栏">
            <Menu size={16} />
          </button>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>小林</span>
        </div>
        <CompanionStatusBar
          roleName="小林"
          roleId="surface-demo"
          onOpenMoments={noop}
          onOpenAssets={noop}
          onOpenShelf={noop}
          onOpenCast={noop}
        />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-8">
          <div className="flex justify-end">
            <div className="max-w-[72%] rounded-2xl px-4 py-2.5 text-[13px]" style={{ background: 'var(--accent-subtle)', color: 'var(--text-primary)' }}>
              帮我把今天的事情理一下。
            </div>
          </div>
          <div className="max-w-[78%] text-[14px] leading-7" style={{ color: 'var(--text-primary)' }}>
            好。先把必须今天完成的挑出来，再看哪些可以往后放。
          </div>
        </div>
        <div className="mx-auto mb-5 w-[min(680px,calc(100%-32px))]">
          <div className="rounded-[var(--radius-xl)] border px-3 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--input-bg)' }}>
            <textarea className="w-full resize-none bg-transparent px-1 py-2 text-[13px] outline-none" rows={2} placeholder="和小林说说…" />
            <div className="flex items-center justify-between pt-1">
              <button type="button" className="rounded-md p-1.5" style={{ color: 'var(--text-muted)' }} title="添加附件"><Paperclip size={14} /></button>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}><Folder size={11} /> New project</span>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: 'var(--accent-emphasis)' }} title="发送"><ArrowUp size={14} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SurfaceViewport>
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
        {surface === 'settings' && <SettingsSurface />}
      </StoryBlock>
    </div>
  )
}
