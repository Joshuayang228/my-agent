/**
 * UI 控件故事矩阵（Alice components + Storybook 隔离/边缘态思路）。
 * 渲染正式 class / ToolCallbackList；不另造皮肤。
 */

import { useMemo, useState } from 'react'
import { LoaderCircle, Search, Sparkles, WandSparkles } from 'lucide-react'
import { ToolCallbackList } from '../chat/callbacks/ToolCallbackList'
import { FileBrowser, type FileBrowserPreviewData } from '../FileBrowser'
import { ResizeHandle } from '../shell/ResizeHandle'
import type { ToolCallbackItem } from '../chat/callbacks/types'
import { MemoryCitationChips } from '../chat/MemoryCitationChips'
import { PermissionConfirmCard } from '../chat/PermissionConfirmCard'
import { CompanionStatusBar } from '../CompanionStatusBar'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ToastPreview, type ToastPreviewItem } from '../Toast'
import type { UiControlsSubId } from './catalog'
import { StoryBlock } from './StoryBlock'
import { AdoptionMark } from './AdoptionMark'
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

const FILE_TREE_FIXTURE: FileBrowserPreviewData = {
  projectLabel: 'Foundation · 文件树样张',
  initialPath: 'src/agent/runtime.ts',
  tree: [
    { name: 'src', path: 'src', isDir: true, children: [
      { name: 'agent', path: 'src/agent', isDir: true, children: [
        { name: 'runtime.ts', path: 'src/agent/runtime.ts', isDir: false },
        { name: 'context.ts', path: 'src/agent/context.ts', isDir: false },
      ] },
      { name: 'shared', path: 'src/shared', isDir: true, children: [
        { name: 'types.ts', path: 'src/shared/types.ts', isDir: false },
      ] },
    ] },
    { name: 'AGENTS.md', path: 'AGENTS.md', isDir: false },
  ],
  files: {
    'src/agent/runtime.ts': { path: 'src/agent/runtime.ts', kind: 'text', languageHint: 'typescript', content: 'export async function runAgent() {\n  return streamChat();\n}\n' },
    'src/agent/context.ts': { path: 'src/agent/context.ts', kind: 'text', languageHint: 'typescript', content: 'export type ContextBlock = { kind: string; content: string }\n' },
    'src/shared/types.ts': { path: 'src/shared/types.ts', kind: 'text', languageHint: 'typescript', content: 'export type AssetKey = string\n' },
    'AGENTS.md': { path: 'AGENTS.md', kind: 'text', languageHint: 'markdown', content: '# Foundation\n\n这里是隔离样张，不读取真实项目文件。\n' },
  },
}

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

function ResizeStory() {
  const [width, setWidth] = useState(180)
  return (
    <div className="space-y-3">
      <StoryBlock title="分栏拖拽柄" source="src/components/shell/ResizeHandle.tsx" adopted>
        <div className="flex h-40 max-w-lg overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-center text-[11px]" style={{ width, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}>内容区</div>
          <ResizeHandle orientation="vertical" onDelta={(delta) => setWidth((value) => Math.min(320, Math.max(120, value + delta)))} title="调整内容区宽度" />
          <div className="flex min-w-0 flex-1 items-center justify-center text-[11px]" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>辅助区 · {width}px</div>
        </div>
      </StoryBlock>
      <StoryBlock title="最小 / 最大边界" source="ResizeHandle · LAYOUT_BOUNDS" edge adopted>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>拖动中保持 120–320px 范围，键盘和窄宽验收不能让主操作消失。</p>
      </StoryBlock>
    </div>
  )
}

export function UiControlsPanel({ initialSub }: { initialSub?: UiControlsSubId } = {}) {
  const effectiveSub = initialSub ?? 'buttons'
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
    <div className="min-h-0" data-testid="ui-controls-panel">
      <div className="w-full min-w-0 space-y-4">

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

      {effectiveSub === 'tabs' && (
        <div className="space-y-3">
          <StoryBlock title="标签切换" source="src/components/shell/WorldHub.tsx · role=tab" adopted>
            <div className="max-w-md rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div className="flex gap-1 border-b px-2" role="tablist" aria-label="Foundation 标签样张" style={{ borderColor: 'var(--border-subtle)' }}>
                {['基础', '产品体验', 'Agent 实验'].map((label, index) => (
                  <button key={label} type="button" role="tab" aria-selected={index === 0} className="border-b-2 px-2.5 py-2 text-[11px]" style={{ borderColor: index === 0 ? 'var(--accent-fg)' : 'transparent', color: index === 0 ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{label}</button>
                ))}
              </div>
              <div className="p-3 text-[11px]" style={{ color: 'var(--text-secondary)' }}>同一任务域内切换内容，不承担页面级跳转。</div>
            </div>
          </StoryBlock>
          <StoryBlock title="窄宽标签" source="Tabs · overflow-x-auto" edge adopted>
            <div className="max-w-[250px] overflow-x-auto rounded-lg border p-1" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex min-w-max gap-1">
                {['朋友圈', '物什', '名册', '角色架'].map((label, index) => <span key={label} className="rounded px-2 py-1 text-[10px]" style={{ background: index === 0 ? 'var(--accent-subtle)' : 'var(--bg-tertiary)', color: index === 0 ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{label}</span>)}
              </div>
            </div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'toast' && (
        <div className="space-y-3">
          <StoryBlock title="提示条四态" source="src/components/Toast.tsx" adopted>
            <div className="playground-toast-preview w-full max-w-md"><ToastPreview items={TOAST_STORIES} /></div>
          </StoryBlock>
          <StoryBlock title="长文与窄宽" source="ToastBubble · responsive max-width" edge adopted>
            <div className="max-w-[280px]"><ToastPreview items={[{ id: 5, type: 'warning', message: '当前请求已完成，但有两个后台步骤仍在处理。你可以继续对话，结果回来后会再次通知。' }]} /></div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'spinner' && (
        <div className="space-y-3">
          <StoryBlock title="加载指示器" source="src/components/playground/UiControlsPanel.tsx · LoaderCircle" adopted>
            <div className="flex flex-wrap items-center gap-4 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-flex items-center gap-1.5"><LoaderCircle size={16} className="animate-spin" />生成中</span>
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px]" style={{ borderColor: 'var(--border-color)' }}><LoaderCircle size={14} className="animate-spin" />读取中</span>
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><LoaderCircle size={12} />等待开始</span>
            </div>
          </StoryBlock>
          <StoryBlock title="减少动效替代" source="Spinner · 文本状态不能省略" edge adopted>
            <div className="rounded-md border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>正在检查模型连接，请稍候…</div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'markdown' && (
        <div className="space-y-3">
          <StoryBlock title="正文与代码块" source="src/components/MarkdownRenderer.tsx" adopted>
            <div className="max-w-xl text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>
              <MarkdownRenderer content={'## 今日计划\n\n先完成 **最重要的一件事**，再处理剩下的内容。\n\n```ts\nconst ready = true\n```'} />
            </div>
          </StoryBlock>
          <StoryBlock title="内心独白与长文" source="MarkdownRenderer · aside guard" edge adopted>
            <div className="max-w-xl text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>
              <MarkdownRenderer content={'我先给你一个可以直接执行的版本。<aside>这是一段故意拉长的内心独白，用来检查窄栏换行、正文层级和弱化后的可读性，不能盖过真正的回答。</aside>'} />
            </div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'asset-table' && (
        <div className="space-y-3">
          <StoryBlock title="资产目录表格" source="src/components/debug/PromptManagerPanel.tsx" adopted>
            <div className="max-w-xl overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b px-3 py-2 text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}><span>资产</span><span>状态</span><span>版本</span></div>
              {[['主对话 Prompt', '已采用', 'v3'], ['记忆策略', '实验', 'v2'], ['权限策略', '候选', 'v1']].map(([name, status, version]) => <div key={name} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b px-3 py-2 text-[11px] last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}><span style={{ color: 'var(--text-primary)' }}>{name}</span><span style={{ color: status === '已采用' ? 'var(--success)' : 'var(--text-muted)' }}>{status}</span><span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{version}</span></div>)}
            </div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'file-tree' && (
        <div className="space-y-3">
          <StoryBlock title="文件树" source="src/components/FileBrowser.tsx" adopted>
            <div className="h-[360px] max-w-md overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-color)' }}><FileBrowser projectPath={null} onClose={() => undefined} embedded previewData={FILE_TREE_FIXTURE} mode="files" /></div>
          </StoryBlock>
          <StoryBlock title="长路径与空目录" source="FileBrowser · tree fixture" edge adopted>
            <div className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>树节点需要可展开、键盘可达，长文件名截断但保留完整提示。</div>
          </StoryBlock>
        </div>
      )}

      {effectiveSub === 'resize-handle' && (
        <ResizeStory />
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
          <StoryBlock title="图标尺寸" source="lucide-react · 12 / 14 / 16 / 20">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {(['navigation.search', 'developer.sliders', 'navigation.panel-right', 'navigation.settings', 'conversation.send'] as IconKey[]).map((key, index) => {
                const asset = ICON_REGISTRY[key]
                const Icon = asset.icon
                return (
                  <div key={asset.key} className="flex min-w-0 flex-col items-center gap-1.5">
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

          <StoryBlock title="Lucide 语义图标目录" source="src/shared/icon-registry.ts">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">搜索图标</span>
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={iconQuery}
                    onChange={(event) => setIconQuery(event.target.value)}
                    placeholder="搜索中文或 English"
                    className="h-8 w-full rounded-md border pl-8 pr-2 text-xs outline-none"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </label>
                <span className="inline-flex h-8 items-center rounded-md px-2.5 text-[11px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {filteredIconAssets.length} / {ICON_ASSETS.length} 个图标
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

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {filteredIconAssets.map((asset) => {
                  const Icon = asset.icon
                  return (
                    <div key={asset.key} className="relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-center" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
                      {asset.adoptionStatus === 'adopted' && (
                        <span className="absolute right-2 top-2">
                          <AdoptionMark label="已在正式界面采用" />
                        </span>
                      )}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        <Icon size={15} strokeWidth={1.65} aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-col items-center gap-0.5">
                        <span className="truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.label}</span>
                        <span className="truncate text-[9px]" style={{ color: 'var(--text-muted)' }}>{asset.english}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {filteredIconAssets.length === 0 && (
                <div className="rounded-lg border px-3 py-5 text-center text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                  没找到匹配的图标。试试中文名或英文名。
                </div>
              )}
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
        </div>
      )}
      </div>
    </div>
  )
}
