/**
 * UI 控件故事矩阵（Alice components + Storybook 隔离/边缘态思路）。
 * 渲染正式 class / ToolCallbackList；不另造皮肤。
 */

import { useState } from 'react'
import { ToolCallbackList } from '../chat/callbacks/ToolCallbackList'
import type { ToolCallbackItem } from '../chat/callbacks/types'
import { MemoryCitationChips } from '../chat/MemoryCitationChips'
import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import { CompanionStatusBar } from '../CompanionStatusBar'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { StoryBlock } from './StoryBlock'

const TOOL_STORIES: ToolCallbackItem[] = [
  {
    callId: 'demo-running',
    name: 'read_file',
    args: { path: 'src/App.tsx' },
    status: 'running',
    collapsed: false,
  },
  {
    callId: 'demo-done',
    name: 'grep',
    args: { pattern: 'TODO', path: '.' },
    status: 'done',
    result: 'src/App.tsx:12: // TODO',
    collapsed: true,
  },
  {
    callId: 'demo-error',
    name: 'shell_exec',
    args: { command: 'rm -rf /' },
    status: 'error',
    result: '⚠️ 权限策略拒绝',
    collapsed: false,
  },
]

function ChatEmptyFixture({ long }: { long?: boolean }) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border px-6 py-10 text-center"
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>还没有话题</p>
      <p className="mt-1 max-w-xs text-[12px]" style={{ color: 'var(--text-muted)' }}>
        {long
          ? '打个招呼，或从侧栏开一个新会话。伙伴在这儿等你。这是一段刻意拉长的说明文案，用来检查空态在窄栏下是否换行难看、是否把下方 pill 挤出可视区。'
          : '打个招呼，或从侧栏开一个新会话。伙伴在这儿等你。'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {['今天怎么样？', '帮我理一下待办', '随便聊聊'].map((t) => (
          <span
            key={t}
            className="rounded-full px-3 py-1 text-[11px]"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

export function UiControlsPanel() {
  const [sub, setSub] = useState<UiControlsSubId>('buttons')
  const [collapse, setCollapse] = useState<Record<string, boolean>>({})

  const tools = TOOL_STORIES.map((t) => ({
    ...t,
    collapsed: Object.prototype.hasOwnProperty.call(collapse, t.callId)
      ? collapse[t.callId]
      : t.collapsed,
  }))

  return (
    <div className="flex min-h-0 gap-4" data-testid="ui-controls-panel">
      <div className="w-[120px] shrink-0 space-y-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            UI 控件
          </h2>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            变体矩阵；不装 Storybook。
          </p>
        </div>
        <div className="flex flex-col gap-0.5">
          {UI_CONTROLS_SUBTABS.map((t) => {
            const active = sub === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSub(t.id)}
                className="rounded-lg px-2.5 py-1.5 text-left text-xs transition"
                style={{
                  color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                  background: active ? 'var(--accent-subtle)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-w-0 max-w-2xl flex-1 space-y-4">
      {sub === 'buttons' && (
        <div className="space-y-3">
          <StoryBlock title="主要 / 次要" source="index.css · .settings-option">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="settings-option px-3 py-1.5 text-xs">主要操作</button>
              <button
                type="button"
                className="rounded-lg border px-3 py-1.5 text-xs"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >
                次要
              </button>
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-white"
                style={{ background: 'var(--danger)' }}
              >
                危险
              </button>
            </div>
          </StoryBlock>
          <StoryBlock title="禁用" source="disabled:opacity-50" edge>
            <button type="button" disabled className="settings-option px-3 py-1.5 text-xs disabled:opacity-50">
              不可点
            </button>
          </StoryBlock>
        </div>
      )}

      {sub === 'inputs' && (
        <div className="space-y-3">
          <StoryBlock title="theme-input 默认" source=".theme-input">
            <input
              className="theme-input w-full max-w-sm rounded-lg border px-2 py-1.5 text-xs outline-none"
              placeholder="输入…"
              defaultValue="示例"
            />
          </StoryBlock>
          <StoryBlock title="超长占位 / 窄宽" source=".theme-input" edge>
            <input
              className="theme-input w-28 rounded-lg border px-2 py-1.5 text-xs outline-none"
              defaultValue="这是一段故意超长的输入内容用来看截断与溢出"
            />
          </StoryBlock>
        </div>
      )}

      {sub === 'tool-cards' && (
        <div className="space-y-3">
          <StoryBlock title="工具卡三态" source="src/components/chat/callbacks/ToolCallbackList.tsx">
            <ToolCallbackList
              tools={tools}
              onToggleCollapse={(id) =>
                setCollapse((prev) => {
                  const cur = Object.prototype.hasOwnProperty.call(prev, id)
                    ? prev[id]
                    : (TOOL_STORIES.find((t) => t.callId === id)?.collapsed !== false)
                  return { ...prev, [id]: !cur }
                })
              }
            />
          </StoryBlock>
          <StoryBlock title="错误态展开" source="ToolCallbackList · status=error" edge>
            <ToolCallbackList
              tools={[TOOL_STORIES[2]]}
              onToggleCollapse={() => undefined}
            />
          </StoryBlock>
        </div>
      )}

      {sub === 'empty' && (
        <div className="space-y-3">
          <StoryBlock title="Chat 空态" source="Chat 空态 / Fixtures 同源视觉">
            <ChatEmptyFixture />
          </StoryBlock>
          <StoryBlock title="长说明文案" source="空态文案边缘" edge>
            <ChatEmptyFixture long />
          </StoryBlock>
        </div>
      )}

      {sub === 'confirm' && (
        <div className="space-y-3">
          <StoryBlock title="权限确认" source="src/components/chat/PermissionConfirmCard.tsx">
            <PermissionConfirmCard
              toolName="shell_exec"
              args={{ command: 'npm test' }}
            />
          </StoryBlock>
          <StoryBlock title="队列 >1" source="PermissionConfirmCard · queueLength" edge>
            <PermissionConfirmCard
              toolName="write_file"
              args={{ path: 'a.ts', content: 'x'.repeat(80) }}
              queueLength={3}
            />
          </StoryBlock>
        </div>
      )}

      {sub === 'memory-chips' && (
        <div className="space-y-3">
          <StoryBlock title="引用芯片 + 纠错" source="src/components/chat/MemoryCitationChips.tsx">
            <MemoryCitationChips
              citations={[
                { id: 'm1', category: 'preference', summary: '喜欢简洁回答' },
                { id: 'm2', category: 'fact', summary: '在做 Electron Agent' },
              ]}
              showActions
            />
          </StoryBlock>
          <StoryBlock title="超长摘要截断" source="MemoryCitationChips truncate" edge>
            <MemoryCitationChips
              citations={[
                {
                  id: 'm-long',
                  category: 'workflow',
                  summary: '这是一段故意写得很长的记忆摘要，用来检查芯片在窄栏下 max-w truncate 是否正常、会不会把同行挤爆。',
                },
              ]}
            />
          </StoryBlock>
        </div>
      )}

      {sub === 'status-bar' && (
        <div className="space-y-3">
          <StoryBlock title="伴侣状态条" source="src/components/CompanionStatusBar.tsx">
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <CompanionStatusBar
                roleName="白艾莉"
                roleId="playground-demo"
                onOpenMoments={() => undefined}
                onOpenAssets={() => undefined}
                onOpenShelf={() => undefined}
                onOpenCast={() => undefined}
              />
            </div>
          </StoryBlock>
          <StoryBlock title="超长角色名" source="CompanionStatusBar truncate" edge>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <CompanionStatusBar
                roleName="这是一个故意起得很长的角色名字用来测试状态条截断表现"
                roleId="playground-demo-long"
                onOpenMoments={() => undefined}
                onOpenAssets={() => undefined}
                onOpenShelf={() => undefined}
                onOpenCast={() => undefined}
              />
            </div>
          </StoryBlock>
        </div>
      )}
      </div>
    </div>
  )
}
