/**
 * Foundation 候选与补齐故事：把当前已使用或已批准探索的控件放进隔离样张。
 *
 * 背景：部分控件已经在产品中以原生元素或局部实现出现，但尚未形成统一生产组件；
 *       另一些控件还没有稳定产品契约，仍需要先确认交互形态。
 * 设计意图：这里提供可见、可点、可键盘理解的候选故事，不把候选样张伪装成正式依赖。
 * 关键约束：不调用 IPC、不写设置或会话；正式组件落地前，候选故事只作为 Playground 证据。
 */

import { useState } from 'react'
import { ChevronDown, Command, MoreHorizontal, Search, X } from 'lucide-react'
import { StoryBlock } from './StoryBlock'
import { type AdvancedFoundationStoryKey } from '../../shared/foundation-story-registry'

function SelectStory() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        <span>模型</span>
        <select className="theme-input h-9 w-full rounded-md border px-2 text-xs outline-none" defaultValue="balanced" aria-label="模型">
          <option value="balanced">平衡模式</option>
          <option value="quality">高质量模式</option>
          <option value="fast">快速模式</option>
        </select>
      </label>
      <label className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        <span>未选择</span>
        <select className="theme-input h-9 w-full rounded-md border px-2 text-xs outline-none" defaultValue="" aria-label="未选择">
          <option value="">请选择</option>
          <option value="one">选项一</option>
        </select>
      </label>
      <label className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        <span>禁用</span>
        <select className="theme-input h-9 w-full rounded-md border px-2 text-xs opacity-50 outline-none" defaultValue="locked" disabled aria-label="禁用选择">
          <option value="locked">当前不可修改</option>
        </select>
      </label>
    </div>
  )
}

function DialogStory() {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-3">
      <button type="button" className="settings-option px-3 py-1.5 text-xs" onClick={() => setOpen(true)}>打开对话框</button>
      {open && (
        <div className="rounded-lg border p-3" role="dialog" aria-modal="true" aria-labelledby="playground-dialog-title" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-2">
            <h5 id="playground-dialog-title" className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>确认清理样张</h5>
            <button type="button" className="ml-auto rounded p-1" aria-label="关闭对话框" onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>这里不会删除真实文件或修改生产数据。</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-md border px-2.5 py-1 text-[11px]" onClick={() => setOpen(false)} style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>取消</button>
            <button type="button" className="rounded-md px-2.5 py-1 text-[11px] text-white" onClick={() => setOpen(false)} style={{ background: 'var(--accent-emphasis)' }}>确认</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PopoverStory() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative max-w-sm">
      <button type="button" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs" onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        查看筛选说明 <ChevronDown size={13} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border p-3" role="dialog" aria-label="筛选说明" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>筛选说明</p>
          <p className="mt-1 text-[11px] leading-4" style={{ color: 'var(--text-muted)' }}>弹出层依附触发器出现，内容较短，不承担页面跳转。</p>
        </div>
      )}
    </div>
  )
}

function DropdownMenuStory() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative max-w-xs">
      <button type="button" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        更多操作 <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="mt-2 rounded-lg border p-1" role="menu" aria-label="更多操作菜单" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-[11px]" onClick={() => setOpen(false)} style={{ color: 'var(--text-secondary)' }}>复制</button>
          <button type="button" role="menuitem" disabled className="block w-full rounded px-2 py-1.5 text-left text-[11px] opacity-50" style={{ color: 'var(--text-muted)' }}>暂不可用</button>
          <button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-[11px]" onClick={() => setOpen(false)} style={{ color: 'var(--danger)' }}>删除样张</button>
        </div>
      )}
    </div>
  )
}

function ComboboxStory() {
  const [query, setQuery] = useState('')
  const options = ['小林 · 默认伙伴', '小林 · 沉稳体贴', '开发助手 · 样张']
  const filtered = options.filter((option) => option.toLocaleLowerCase('zh-CN').includes(query.toLocaleLowerCase('zh-CN')))
  return (
    <div className="max-w-sm">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input className="theme-input h-9 w-full rounded-md border pl-8 pr-3 text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索伙伴" aria-label="搜索伙伴" role="combobox" aria-expanded="true" aria-controls="playground-combobox-options" />
      </label>
      <div id="playground-combobox-options" className="mt-2 rounded-lg border p-1" role="listbox" aria-label="伙伴选项" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
        {filtered.length > 0 ? filtered.map((option) => <button type="button" role="option" aria-selected="false" key={option} className="block w-full rounded px-2 py-1.5 text-left text-[11px]" style={{ color: 'var(--text-secondary)' }}>{option}</button>) : <p className="px-2 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>没有匹配结果</p>}
      </div>
    </div>
  )
}

function CommandStory() {
  const [query, setQuery] = useState('')
  const commands = ['打开设置', '新建对话', '查看最近记忆', '运行质量检查']
  const filtered = commands.filter((command) => command.includes(query))
  return (
    <div className="max-w-md rounded-lg border p-2" role="search" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-2 border-b px-1 pb-2" style={{ borderColor: 'var(--border-subtle)' }}><Command size={14} style={{ color: 'var(--text-muted)' }} /><input className="min-w-0 flex-1 bg-transparent text-xs outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索动作…" aria-label="搜索动作" /></div>
      <div className="mt-1 space-y-0.5">{filtered.map((command, index) => <button type="button" key={command} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px]" style={{ color: index === 0 ? 'var(--accent-fg)' : 'var(--text-secondary)', background: index === 0 ? 'var(--accent-subtle)' : undefined }}>{command}<span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>Enter</span></button>)}</div>
    </div>
  )
}

function ContextMenuStory() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative max-w-md" onContextMenu={(event) => { event.preventDefault(); setOpen(true) }}>
      <div className="rounded-lg border border-dashed p-5 text-center text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>在这里右键，或点击下方按钮打开上下文菜单</div>
      <button type="button" className="mt-2 rounded-md border px-2.5 py-1.5 text-[11px]" onClick={() => setOpen((value) => !value)} style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>打开上下文菜单</button>
      {open && <div className="mt-2 rounded-lg border p-1" role="menu" aria-label="上下文菜单" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}><button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-[11px]" style={{ color: 'var(--text-secondary)' }} onClick={() => setOpen(false)}>复制路径</button><button type="button" role="menuitem" className="block w-full rounded px-2 py-1.5 text-left text-[11px]" style={{ color: 'var(--danger)' }} onClick={() => setOpen(false)}>删除条目</button></div>}
    </div>
  )
}

function ScrollAreaStory() {
  return <div className="max-w-md rounded-lg border p-2" style={{ borderColor: 'var(--border-color)' }}><div className="h-32 overflow-auto scrollbar-thin rounded-md p-2" tabIndex={0} aria-label="长内容滚动区域" style={{ background: 'var(--bg-tertiary)' }}>{Array.from({ length: 12 }, (_, index) => <p key={index} className="mb-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>第 {index + 1} 行：滚动区域保留触控板、键盘和系统滚动能力。</p>)}</div></div>
}

function TooltipStory() {
  return <div className="flex items-center gap-3"><button type="button" className="flex h-8 w-8 items-center justify-center rounded-md border" title="复制路径" aria-label="复制路径" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Command size={14} /></button><p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>低频图标操作保留可见标签或 title 辅助。</p></div>
}

function SkeletonStory() {
  return <div className="max-w-md space-y-2" aria-label="内容加载中"><div className="h-3 w-28 animate-pulse rounded" style={{ background: 'var(--bg-tertiary)' }} /><div className="h-3 w-full animate-pulse rounded" style={{ background: 'var(--bg-tertiary)' }} /><div className="h-3 w-4/5 animate-pulse rounded" style={{ background: 'var(--bg-tertiary)' }} /></div>
}

function ProgressStory() {
  return <div className="max-w-md space-y-3"><div><div className="mb-1 flex justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}><span>索引项目</span><span>64%</span></div><div className="h-2 overflow-hidden rounded-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={64} aria-label="索引项目进度" style={{ background: 'var(--bg-tertiary)' }}><div className="h-full w-[64%] rounded-full" style={{ background: 'var(--accent-emphasis)' }} /></div></div><div><div className="mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>等待后台阶段完成</div><div className="h-2 overflow-hidden rounded-full" role="progressbar" aria-label="后台任务进行中" style={{ background: 'var(--bg-tertiary)' }}><div className="h-full w-2/5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} /></div></div></div>
}

function DiffViewerStory() {
  return <div className="overflow-auto rounded-lg border font-mono text-[10px]" style={{ borderColor: 'var(--border-color)' }}><div className="grid min-w-[520px] grid-cols-2"><div className="border-r p-2" style={{ borderColor: 'var(--border-subtle)', background: 'color-mix(in srgb, var(--danger) 7%, var(--bg-primary))' }}><p style={{ color: 'var(--danger)' }}>- const mode = 'fast'</p><p style={{ color: 'var(--text-muted)' }}>  return streamChat()</p></div><div className="p-2" style={{ background: 'color-mix(in srgb, var(--success) 7%, var(--bg-primary))' }}><p style={{ color: 'var(--success)' }}>+ const mode = 'balanced'</p><p style={{ color: 'var(--text-muted)' }}>  return streamChat()</p></div></div></div>
}

function FormFieldStory() {
  const [enabled, setEnabled] = useState(true)
  return <div className="grid gap-3 md:grid-cols-2"><label className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}><span>显示名称</span><input className="theme-input h-9 w-full rounded-md border px-2 text-xs outline-none" defaultValue="小林" aria-label="显示名称" /><small className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>辅助说明与控件保持同一组。</small></label><label className="space-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}><span>错误字段</span><input className="theme-input h-9 w-full rounded-md border px-2 text-xs outline-none" defaultValue="" aria-label="错误字段" aria-invalid="true" style={{ borderColor: 'var(--danger)' }} /><small className="block text-[10px]" style={{ color: 'var(--danger)' }}>请输入有效内容。</small></label><label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}><input type="checkbox" defaultChecked aria-label="启用记忆" />启用记忆</label><button type="button" role="switch" aria-checked={enabled} onClick={() => setEnabled((value) => !value)} className="flex items-center gap-2 text-left text-[11px]" style={{ color: 'var(--text-secondary)' }}><span className="relative h-5 w-9 rounded-full" style={{ background: enabled ? 'var(--accent-emphasis)' : 'var(--bg-tertiary)' }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition" style={{ left: enabled ? 'calc(100% - 1.125rem)' : '0.125rem' }} /></span>自动保存</button></div>
}

function assertNever(value: never): never {
  throw new Error(`未注册的 Foundation advanced story renderer: ${String(value)}`)
}

function storyContent(story: AdvancedFoundationStoryKey) {
  switch (story) {
    case 'foundation.select': return <StoryBlock title="下拉选择" source="src/components/playground/FoundationAdvancedStories.tsx · native select"><SelectStory /></StoryBlock>
    case 'foundation.dialog': return <StoryBlock title="对话框" source="src/components/playground/FoundationAdvancedStories.tsx · Dialog candidate" edge><DialogStory /></StoryBlock>
    case 'foundation.popover': return <StoryBlock title="弹出层" source="src/components/playground/FoundationAdvancedStories.tsx · Popover candidate" edge><PopoverStory /></StoryBlock>
    case 'foundation.dropdown-menu': return <StoryBlock title="下拉菜单" source="src/components/chat/right-dock/ChatRightDock.tsx · add tab / candidate" edge><DropdownMenuStory /></StoryBlock>
    case 'foundation.combobox': return <StoryBlock title="可搜索选择" source="src/components/playground/FoundationAdvancedStories.tsx · Combobox candidate" edge><ComboboxStory /></StoryBlock>
    case 'foundation.command': return <StoryBlock title="命令面板" source="src/components/playground/FoundationAdvancedStories.tsx · Command candidate" edge><CommandStory /></StoryBlock>
    case 'foundation.context-menu': return <StoryBlock title="右键菜单" source="src/components/playground/FoundationAdvancedStories.tsx · Context Menu candidate" edge><ContextMenuStory /></StoryBlock>
    case 'foundation.scroll-area': return <StoryBlock title="滚动区域" source="src/components/playground/FoundationAdvancedStories.tsx · Scroll Area candidate" edge><ScrollAreaStory /></StoryBlock>
    case 'foundation.tooltip': return <StoryBlock title="提示浮层" source="src/components/playground/FoundationAdvancedStories.tsx · Tooltip candidate" edge><TooltipStory /></StoryBlock>
    case 'foundation.skeleton': return <StoryBlock title="骨架屏" source="src/components/playground/FoundationAdvancedStories.tsx · Skeleton candidate" edge><SkeletonStory /></StoryBlock>
    case 'foundation.progress': return <StoryBlock title="进度条" source="src/components/playground/FoundationAdvancedStories.tsx · Progress candidate" edge><ProgressStory /></StoryBlock>
    case 'foundation.diff-viewer': return <StoryBlock title="差异查看器" source="src/components/playground/FoundationAdvancedStories.tsx · Diff Viewer candidate" edge><DiffViewerStory /></StoryBlock>
    case 'foundation.form-field': return <StoryBlock title="表单字段" source="src/components/playground/FoundationAdvancedStories.tsx · Form Field" edge><FormFieldStory /></StoryBlock>
    case 'foundation.checkbox': return <StoryBlock title="复选框" source="Settings / PermissionRulesEditor"><FormFieldStory /></StoryBlock>
    case 'foundation.switch': return <StoryBlock title="开关" source="src/components/SettingsPanel.tsx · 自动保存 · candidate"><FormFieldStory /></StoryBlock>
    default: return assertNever(story)
  }
}

export function FoundationAdvancedStories({ story }: { story: AdvancedFoundationStoryKey }) {
  return <div className="space-y-3" data-testid={`foundation-story-${story.replace('foundation.', '')}`}>{storyContent(story)}</div>
}
