/**
 * UI 控件故事矩阵（Alice components + Storybook 隔离/边缘态思路）。
 * 渲染正式 class / ToolCallbackList；不另造皮肤。
 */

import { useState } from 'react'
import { ToolCallbackList } from '../chat/callbacks/ToolCallbackList'
import type { ToolCallbackItem } from '../chat/callbacks/types'
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
    <div className="mx-auto max-w-2xl space-y-4" data-testid="ui-controls-panel">
      <div>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          UI 控件
        </h2>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          正式样式/组件的变体矩阵（一状态一格）。改组件先改这里再集成——产品内轻量展厅，不装 Storybook。
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border-color)' }}>
        {UI_CONTROLS_SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className="px-3 py-1.5 text-xs transition"
            style={{
              color: sub === t.id ? 'var(--accent-fg)' : 'var(--text-muted)',
              borderBottom: sub === t.id ? '2px solid var(--accent-fg)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

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
    </div>
  )
}
