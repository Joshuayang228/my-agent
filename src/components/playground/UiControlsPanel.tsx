/**
 * UI 控件故事矩阵（Alice components + Storybook 隔离/边缘态思路）。
 * 渲染正式 class / ToolCallbackList；不另造皮肤。
 */

import { useMemo, useState } from 'react'
import { LoaderCircle, Search, Sparkles, WandSparkles } from 'lucide-react'
import { ToolCallbackList } from '../chat/callbacks/ToolCallbackList'
import type { ToolCallbackItem } from '../chat/callbacks/types'
import { MemoryCitationChips } from '../chat/MemoryCitationChips'
import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import { CompanionStatusBar } from '../CompanionStatusBar'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ToastPreview, type ToastPreviewItem } from '../Toast'
import { UI_CONTROLS_SUBTABS, type UiControlsSubId } from './catalog'
import { StoryBlock } from './StoryBlock'
import { ComponentInventoryPanel } from './ComponentInventoryPanel'
import { ICON_ASSETS, ICON_CATEGORIES, ICON_REGISTRY, type IconKey, type IconCategoryId } from '../../shared/icon-registry'

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

const TOAST_STORIES: ToastPreviewItem[] = [
  { id: 1, type: 'info', message: '后台任务已开始，完成后会在这里告诉你。' },
  { id: 2, type: 'success', message: '已更新这条记忆。' },
  { id: 3, type: 'warning', message: '模型连接暂时不可用，请检查设置后重试。' },
  { id: 4, type: 'error', message: '文件没有保存成功，原内容没有被覆盖。' },
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

function FixtureError({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: 'color-mix(in srgb, var(--danger) 35%, var(--border-color))', background: 'var(--bg-secondary)' }}
    >
      <div className="text-[12px] font-medium" style={{ color: 'var(--danger)' }}>{title}</div>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <button type="button" className="mt-2 rounded border px-2 py-0.5 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>{action}</button>
    </div>
  )
}

export function UiControlsPanel({ initialSub }: { initialSub?: UiControlsSubId } = {}) {
  const [sub, setSub] = useState<UiControlsSubId>(initialSub ?? 'component-catalog')
  const effectiveSub = initialSub ?? sub
  const [collapse, setCollapse] = useState<Record<string, boolean>>({})
  const [iconQuery, setIconQuery] = useState('')
  const [iconCategory, setIconCategory] = useState<IconCategoryId | 'all'>('all')

  const filteredIconAssets = useMemo(() => {
    const query = iconQuery.trim().toLocaleLowerCase('zh-CN')
    return ICON_ASSETS.filter((asset) => {
      const matchesCategory = iconCategory === 'all' || asset.category === iconCategory
      if (!matchesCategory) return false
      if (!query) return true
      return [asset.key, asset.label, asset.english, asset.usage].some((value) => value.toLocaleLowerCase('zh-CN').includes(query))
    })
  }, [iconCategory, iconQuery])

  const tools = TOOL_STORIES.map((t) => ({
    ...t,
    collapsed: Object.prototype.hasOwnProperty.call(collapse, t.callId)
      ? collapse[t.callId]
      : t.collapsed,
  }))

  return (
    <div className={initialSub ? 'min-h-0' : 'flex min-h-0 flex-col gap-4 sm:flex-row'} data-testid="ui-controls-panel">
      {!initialSub && <div className="w-full shrink-0 space-y-3 sm:w-[120px]">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            基础组件样式
          </h2>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            组件索引与隔离故事：先确认基础样式，再由产品体验引用。
          </p>
        </div>
        <div className="scrollbar-hover flex gap-0.5 overflow-x-auto sm:flex-col sm:overflow-x-visible">
          {UI_CONTROLS_SUBTABS.map((t) => {
            const active = sub === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSub(t.id)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-left text-xs transition"
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
      </div>}

      <div className={initialSub ? 'min-w-0 space-y-4' : 'min-w-0 max-w-2xl flex-1 space-y-4'}>
      {effectiveSub === 'component-catalog' && <ComponentInventoryPanel />}

      {effectiveSub === 'buttons' && (
        <div className="space-y-3">
          <StoryBlock title="主要 / 次要" source="index.css · .settings-option" adopted>
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
          <StoryBlock title="禁用" source="disabled:opacity-50" edge adopted>
            <button type="button" disabled className="settings-option px-3 py-1.5 text-xs disabled:opacity-50">
              不可点
            </button>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'inputs' && (
        <div className="space-y-3">
          <StoryBlock title="theme-input 默认" source=".theme-input" adopted>
            <input
              className="theme-input w-full max-w-sm rounded-lg border px-2 py-1.5 text-xs outline-none"
              placeholder="输入…"
              defaultValue="示例"
            />
          </StoryBlock>
          <StoryBlock title="超长占位 / 窄宽" source=".theme-input" edge adopted>
            <input
              className="theme-input w-28 rounded-lg border px-2 py-1.5 text-xs outline-none"
              defaultValue="这是一段故意超长的输入内容用来看截断与溢出"
            />
          </StoryBlock>
          <StoryBlock title="带图标输入" source="Playground story">
            <label className="relative block max-w-sm">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                className="theme-input h-9 w-full border pl-9 pr-3 text-xs outline-none"
                placeholder="搜索会话、文件或能力"
              />
            </label>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'tool-cards' && (
        <div className="space-y-3">
          <StoryBlock title="工具卡三态" source="src/components/chat/callbacks/ToolCallbackList.tsx" adopted>
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
          <StoryBlock title="错误态展开" source="ToolCallbackList · status=error" edge adopted>
            <ToolCallbackList
              tools={[TOOL_STORIES[2]]}
              onToggleCollapse={() => undefined}
            />
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'empty' && (
        <div className="space-y-3">
          <StoryBlock title="Chat 空态" source="Chat 空态 / Fixtures 同源视觉">
            <ChatEmptyFixture />
          </StoryBlock>
          <StoryBlock title="长说明文案" source="空态文案边缘" edge>
            <ChatEmptyFixture long />
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'confirm' && (
        <div className="space-y-3">
          <StoryBlock title="权限确认" source="src/components/chat/PermissionConfirmCard.tsx" adopted>
            <PermissionConfirmCard
              toolName="shell_exec"
              args={{ command: 'npm test' }}
            />
          </StoryBlock>
          <StoryBlock title="队列 >1" source="PermissionConfirmCard · queueLength" edge adopted>
            <PermissionConfirmCard
              toolName="write_file"
              args={{ path: 'a.ts', content: 'x'.repeat(80) }}
              queueLength={3}
            />
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'memory-chips' && (
        <div className="space-y-3">
          <StoryBlock title="引用芯片 + 纠错" source="src/components/chat/MemoryCitationChips.tsx" adopted>
            <MemoryCitationChips
              citations={[
                { id: 'm1', category: 'preference', summary: '喜欢简洁回答' },
                { id: 'm2', category: 'fact', summary: '在做 Electron Agent' },
              ]}
              showActions
            />
          </StoryBlock>
          <StoryBlock title="超长摘要截断" source="MemoryCitationChips truncate" edge adopted>
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

      {effectiveSub === 'status-bar' && (
        <div className="space-y-3">
          <StoryBlock title="伴侣状态条" source="src/components/CompanionStatusBar.tsx" adopted>
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
          <StoryBlock title="超长角色名" source="CompanionStatusBar truncate" edge adopted>
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

      {effectiveSub === 'icons' && (
        <div className="space-y-3" data-testid="icon-inventory">
          <StoryBlock title="操作图标阶梯" source="lucide-react · 12 / 14 / 16 / 20" adopted>
            <div className="flex flex-wrap items-end gap-5">
              {(['navigation.search', 'developer.sliders', 'navigation.panel-right', 'navigation.settings', 'conversation.send'] as IconKey[]).map((key, index) => {
                const asset = ICON_REGISTRY[key]
                const Icon = asset.icon
                return (
                  <div key={asset.key} className="flex min-w-12 flex-col items-center gap-1.5">
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md" style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }} title={`${asset.label} · ${asset.english}`}>
                      <Icon size={[12, 14, 16, 20, 16][index]} strokeWidth={1.6} />
                    </button>
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{asset.label}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
              生产只使用 Lucide；尺寸阶梯固定为 12 / 14 / 16 / 20，语义 key 统一从图标注册表发现。
            </p>
          </StoryBlock>

          <StoryBlock title="Lucide 语义图标目录" source="src/shared/icon-registry.ts" adopted>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">搜索图标</span>
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={iconQuery}
                    onChange={(event) => setIconQuery(event.target.value)}
                    placeholder="搜索中文、English、语义 key 或用途"
                    className="h-8 w-full rounded-md border pl-8 pr-2 text-xs outline-none"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </label>
                <span className="inline-flex h-8 items-center rounded-md px-2.5 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {filteredIconAssets.length} / {ICON_ASSETS.length} 个候选
                </span>
              </div>

              <div className="scrollbar-hover flex gap-1 overflow-x-auto pb-1" aria-label="图标分类">
                <button
                  type="button"
                  onClick={() => setIconCategory('all')}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] transition"
                  style={{ background: iconCategory === 'all' ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: iconCategory === 'all' ? 'var(--accent-fg)' : 'var(--text-muted)' }}
                >
                  全部
                </button>
                {ICON_CATEGORIES.map((category) => {
                  const active = iconCategory === category.id
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setIconCategory(category.id)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] transition"
                      style={{ background: active ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}
                      title={category.description}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredIconAssets.map((asset) => {
                  const Icon = asset.icon
                  return (
                    <div key={asset.key} className="flex min-w-0 items-start gap-2.5 rounded-lg border p-2.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }} title={asset.usage}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        <Icon size={18} strokeWidth={1.65} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{asset.label}</span>
                          <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{asset.english}</span>
                          <span className="ml-auto shrink-0 text-[9px] font-mono" style={{ color: asset.priority === 'P0' ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{asset.priority}</span>
                        </div>
                        <code className="mt-0.5 block truncate text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{asset.key}</code>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4" style={{ color: 'var(--text-secondary)' }}>{asset.usage}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              {filteredIconAssets.length === 0 && (
                <div className="rounded-lg border px-3 py-5 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  没找到匹配的图标。试试中文名、英文名或 `navigation.search`。
                </div>
              )}
            </div>
          </StoryBlock>

          <StoryBlock title="生成动作" source="Playground story">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                <Sparkles size={14} />生成
              </button>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-white" style={{ background: 'var(--accent-emphasis)' }}>
                <WandSparkles size={14} />重新生成
              </button>
              <button type="button" disabled className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs opacity-60" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                <LoaderCircle size={14} className="animate-spin" />生成中
              </button>
            </div>
          </StoryBlock>
        </div>
      )}
      {effectiveSub === 'feedback' && (
        <div className="space-y-3">
          <StoryBlock title="错误反馈（常用 3 态）" source="Playground fixture · merged" edge>
            <div className="space-y-2">
              <FixtureError title="未配置 API Key" body="请在设置 → 模型里填写密钥后再试。" action="打开设置" />
              <FixtureError title="操作被权限策略拒绝" body="可以切换审批模式，或让 Agent 换更安全的替代方案。" action="查看权限" />
              <FixtureError title="请求暂时失败" body="可能是限流或上游抖动。稍后再试，或检查网络 / Base URL。" action="重试" />
            </div>
          </StoryBlock>
          <StoryBlock title="Toast 四态" source="src/components/Toast.tsx" adopted>
            <div className="playground-toast-preview w-full max-w-md">
              <ToastPreview items={TOAST_STORIES} />
            </div>
          </StoryBlock>
          <StoryBlock title="长文与窄宽" source="ToastBubble · responsive max-width" edge adopted>
            <div className="max-w-[280px]">
              <ToastPreview items={[{
                id: 5,
                type: 'warning',
                message: '当前请求已完成，但有两个后台步骤仍在处理。你可以继续对话，结果回来后会再次通知。',
              }]} />
            </div>
          </StoryBlock>
          <StoryBlock title="正文与内心独白" source="src/components/MarkdownRenderer.tsx" adopted>
            <div className="max-w-xl text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>
              <MarkdownRenderer content={'先把今天必须完成的两件事挑出来，剩下的明天再看。<aside>他看起来有点累，别一次塞太多。</aside>'} />
            </div>
          </StoryBlock>
          <StoryBlock title="长独白边缘" source="MarkdownRenderer · aside guard" edge adopted>
            <div className="max-w-xl text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>
              <MarkdownRenderer content={'我先给你一个可以直接执行的版本。<aside>这是一段故意拉长的内心独白，用来检查窄栏换行、正文层级和弱化后的可读性，不能盖过真正的回答。</aside>'} />
            </div>
          </StoryBlock>
        </div>
      )}
      </div>
    </div>
  )
}
