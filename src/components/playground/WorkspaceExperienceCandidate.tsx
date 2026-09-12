import { useRef, useState } from 'react'
import { ArrowUp, Globe, GitCompare, FileText, TerminalSquare, MessageCircle, RefreshCw, Square, LoaderCircle, PanelRight, Plus, X } from 'lucide-react'
import { FileBrowser, type FileBrowserPreviewData, type FileBrowserPreviewState } from '../FileBrowser'
import { MarkdownRenderer } from '../MarkdownRenderer'
import teaImage from '../../assets/playground/moment-tea-by-window.jpg'

const VIEWS = [
  { id: 'review', label: '审阅', icon: GitCompare, scenes: ['行内差异', '并排差异', '多文件', '无变更'] },
  { id: 'browser', label: '浏览器', icon: Globe, scenes: ['网页', '窄屏网页', '加载中', '加载失败'] },
  { id: 'files', label: '文件', icon: FileText, scenes: ['Markdown', '代码', '图片', '空目录', '无法预览'] },
  { id: 'terminal', label: '终端', icon: TerminalSquare, scenes: ['输出', '运行中', '报错', '多终端'] },
  { id: 'chat', label: '侧边聊天', icon: MessageCircle, scenes: ['空态', '对话', '生成中', '发送失败'] },
] as const
type View = typeof VIEWS[number]['id']
type WorkspaceTab = { id: number; view: View; scene: string; ordinal: number }
const markdown = '# 项目笔记\n\n## 本周安排\n\n- 整理资料\n- 核对页面细节\n\n| 文件 | 内容 |\n| --- | --- |\n| notes.md | 项目说明 |\n| theme.ts | 主题配置 |'
const fileData: FileBrowserPreviewData = {
  projectLabel: 'my-agent',
  tree: ['notes.md', 'theme.ts', 'window.jpg', 'report.pdf'].map((name) => ({ name, path: name, isDir: false })),
  files: {
    'notes.md': { path: 'notes.md', kind: 'text', content: markdown, languageHint: 'markdown' },
    'theme.ts': { path: 'theme.ts', kind: 'text', content: "export const theme = {\n  name: 'mist',\n  spacing: 16,\n}\n", languageHint: 'typescript' },
    'window.jpg': { path: 'window.jpg', kind: 'image', dataUrl: teaImage, mimeType: 'image/jpeg' },
    'report.pdf': { path: 'report.pdf', kind: 'unsupported', reason: '此文件暂不支持内嵌预览。' },
  },
}
const before = "export const theme = {\n  name: 'dark',\n  spacing: 12,\n}"
const after = "export const theme = {\n  name: 'mist',\n  spacing: 16,\n}"
const browserDocument = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0;font:14px system-ui;color:#25312d;background:#fff}header{padding:18px 22px;border-bottom:1px solid #ddd}main{padding:24px;max-width:680px;margin:auto}h1{font-size:24px}img{width:100%;max-height:240px;object-fit:cover;border-radius:6px}p{line-height:1.8;color:#59635e}a{color:#167250}</style><header>日常笔记</header><main><h1>窗边的一杯茶</h1><p>周五，整理手边的资料，也给自己留一点空白。</p><img src="${new URL(teaImage, window.location.href).href}" alt="窗边的茶与笔记"><h2>今天的记录</h2><p>把想法记下来，慢慢整理成可以回看的笔记。</p><a href="#reading">继续阅读</a><h2 id="reading">下一页</h2><p>用更简单的方式保留日常。</p></main></html>`

/**
 * 背景：工作区用于检查内容，任务进度和结束状态不属于这五个工具的导航。
 * 设计意图：固定功能与直接场景选择分层，正式组件仅通过只读夹具参与预览。
 * 关键约束：样张选择重置实例；实例切换与收起仅隐藏内容，保留本地状态；没有真实调用。
 */
export function WorkspaceExperienceCandidate() {
  const [view, setView] = useState<View>('review')
  const [scene, setScene] = useState<string>('行内差异')
  const [narrow, setNarrow] = useState(false)
  const [open, setOpen] = useState(true)
  const [menu, setMenu] = useState(false)
  const [tabs, setTabs] = useState<WorkspaceTab[]>([{ id: 0, view: 'review', scene: '行内差异', ordinal: 1 }])
  const [active, setActive] = useState(0)
  const nextId = useRef(1)
  const addButton = useRef<HTMLButtonElement>(null)
  const resetScene = (nextView: View, nextScene: string) => {
    const id = nextId.current++
    setView(nextView); setScene(nextScene); setTabs([{ id, view: nextView, scene: nextScene, ordinal: 1 }]); setActive(id); setOpen(true); setMenu(false)
  }
  const addTab = (nextView: View) => {
    const id = nextId.current++
    const nextScene = nextView === 'files' ? '文件列表' : VIEWS.find((item) => item.id === nextView)!.scenes[0]
    setTabs((current) => [...current, { id, view: nextView, scene: nextScene, ordinal: Math.max(0, ...current.filter((tab) => tab.view === nextView).map((tab) => tab.ordinal)) + 1 }]); setActive(id); setMenu(false)
    addButton.current?.focus()
  }
  const selected = VIEWS.find((item) => item.id === view)!
  const closeTab = (id: number) => {
    const remaining = tabs.filter((tab) => tab.id !== id)
    setTabs(remaining)
    if (active === id) setActive(remaining.at(-1)?.id ?? -1)
  }
  return <div className="space-y-3" data-testid="workspace-dock-candidate">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap gap-1" data-playground-switcher role="tablist" aria-label="工作区功能">
        {VIEWS.map(({ id, label, icon: Icon, scenes }) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => resetScene(id, scenes[0])} className="settings-option inline-flex items-center gap-1.5 px-3 py-2 text-[12px]" data-selected={view === id ? 'true' : undefined}><Icon size={14} />{label}</button>)}
      </div>
      <div className="flex gap-1" data-playground-switcher role="group" aria-label="工作区宽度">{[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={narrow === value} onClick={() => setNarrow(value)} className="settings-option px-2 py-1 text-[11px]" data-selected={narrow === value ? 'true' : undefined}>{value ? '窄栏' : '展开'}</button>)}</div>
    </div>
    <div className="flex flex-wrap items-center gap-1" data-playground-switcher role="tablist" aria-label="工作区形态样张">
      {selected.scenes.map((label) => <button key={label} type="button" role="tab" aria-selected={scene === label} onClick={() => resetScene(view, label)} className="settings-option px-2.5 py-1.5 text-[11px]" data-selected={scene === label ? 'true' : undefined}>{label}</button>)}
      <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>隔离样张</span>
    </div>
    <div className="flex h-[580px] min-w-0 overflow-hidden rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
      <div className={narrow || !open ? 'flex min-w-0 flex-1 flex-col' : 'hidden'} data-testid="workspace-main-chat">
        <div className="flex items-center justify-between gap-2 border-b p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)' }}><span>Chat</span><button type="button" title={open ? '收起工作区' : '打开工作区'} aria-label={open ? '收起工作区' : '打开工作区'} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded p-1"><PanelRight size={16} /></button></div>
        <WorkspaceChatShell />
      </div>
      <div className={open ? 'flex min-w-0 flex-col border-l' : 'hidden'} style={{ width: narrow ? 'min(380px, 65%)' : '100%', borderColor: 'var(--border-subtle)' }} data-testid="workspace-tool-panel">
        <div className="relative flex shrink-0 items-center gap-1 border-b p-2" style={{ borderColor: 'var(--border-subtle)' }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false) }} onKeyDown={(event) => { if (event.key === 'Escape' && menu) { event.stopPropagation(); setMenu(false); addButton.current?.focus() } }}>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="已打开的工作区">
            {tabs.map((tab) => {
              const meta = VIEWS.find((item) => item.id === tab.view)!
              const Icon = meta.icon
              const label = `${meta.label} ${tab.ordinal}`
              return <div key={tab.id} className="flex shrink-0 items-center gap-1 rounded-md px-1 hover:bg-[var(--bg-secondary)]" style={{ background: active === tab.id ? 'var(--bg-secondary)' : undefined }} data-testid="workspace-open-tab">
                <button type="button" role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)} className="inline-flex items-center gap-2 rounded px-2 py-2 text-[12px]"><Icon size={14} />{label}</button>
                <button type="button" aria-label={`关闭${label}`} title={`关闭${label}`} className="shrink-0 rounded p-1 hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} onClick={() => closeTab(tab.id)}><X size={14} /></button>
              </div>
            })}
          </div>
          <button ref={addButton} type="button" aria-label="添加工作区内容" title="添加工作区内容" aria-haspopup="menu" aria-expanded={menu} className="shrink-0 rounded p-1" onClick={() => setMenu(!menu)}><Plus size={16} /></button>
          {menu && <div role="menu" aria-label="添加工作区内容" className="absolute right-2 top-full z-20 mt-1 w-40 rounded-md border p-1 shadow-lg" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }} onKeyDown={(event) => { const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')); const index = items.indexOf(document.activeElement as HTMLButtonElement); if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus() } }}>
            {VIEWS.map(({ id, label, icon: Icon }, index) => <button key={id} autoFocus={index === 0} type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] hover:bg-[var(--bg-secondary)] focus-visible:bg-[var(--bg-secondary)]" onClick={() => addTab(id)}><Icon size={14} />{label}</button>)}
          </div>}
        </div>
        {!tabs.length && <p className="m-auto text-[12px]" style={{ color: 'var(--text-muted)' }}>没有打开的内容</p>}
        {tabs.map((tab) => <div key={tab.id} role="tabpanel" aria-label={`${VIEWS.find((item) => item.id === tab.view)!.label} ${tab.ordinal}`} className={active === tab.id ? 'flex min-h-0 min-w-0 flex-1 flex-col' : 'hidden'}>
          {tab.view === 'review' && <ReviewSample scene={tab.scene} />}
          {tab.view === 'browser' && <BrowserSample scene={tab.scene} />}
          {tab.view === 'files' && <FilesSample scene={tab.scene} />}
          {tab.view === 'terminal' && <TerminalSample scene={tab.scene} />}
          {tab.view === 'chat' && <SideChatSample scene={tab.scene} />}
        </div>)}
      </div>
    </div>
  </div>
}

function ReviewSample({ scene }: { scene: string }) {
  const [file, setFile] = useState('theme.ts')
  if (scene === '无变更') return <div className="m-auto text-[12px]" style={{ color: 'var(--text-muted)' }}>没有文件变更</div>
  const oldText = file === 'theme.ts' ? before : '# 项目笔记\n\n整理资料。'
  const newText = file === 'theme.ts' ? after : '# 项目笔记\n\n整理资料，并核对页面。'
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b p-3 text-[12px]" style={{ borderColor: 'var(--border-subtle)' }}>
      {scene === '多文件' ? <select className="theme-input min-w-0 rounded border p-1" aria-label="审阅文件" value={file} onChange={(event) => setFile(event.target.value)}><option>theme.ts</option><option>notes.md</option></select> : <span>{file}</span>}
      <span className="ml-auto" style={{ color: 'var(--success)' }}>+{file === 'theme.ts' ? 2 : 1}</span><span style={{ color: 'var(--danger)' }}>−{file === 'theme.ts' ? 2 : 1}</span>
    </div>
    <div className="min-h-0 overflow-auto p-3" data-testid="workspace-diff">
      {scene === '并排差异' ? <div className="grid grid-cols-2 gap-3"><div className="min-w-0"><p className="mb-2 text-[11px]">修改前</p><MarkdownRenderer content={'```typescript\n' + oldText + '\n```'} /></div><div className="min-w-0"><p className="mb-2 text-[11px]">修改后</p><MarkdownRenderer content={'```typescript\n' + newText + '\n```'} /></div></div> : <MarkdownRenderer content={'```diff\n--- ' + file + '\n+++ ' + file + '\n' + (file === 'theme.ts' ? " export const theme = {\n-  name: 'dark',\n-  spacing: 12,\n+  name: 'mist',\n+  spacing: 16,\n }" : ' # 项目笔记\n \n-整理资料。\n+整理资料，并核对页面。') + '\n```'} />}
    </div>
  </>
}

function BrowserSample({ scene }: { scene: string }) {
  const [state, setState] = useState(scene)
  const [revision, setRevision] = useState(0)
  const [address, setAddress] = useState('https://notes.example.com/')
  const [draft, setDraft] = useState(address)
  const [error, setError] = useState('')
  // 地址仅匹配本地夹具；输入不得进入 srcDoc 或触发外站导航，避免样张越过隔离边界。
  const navigate = () => {
    try {
      const url = new URL(draft.includes('://') ? draft : `https://${draft}`)
      if (!draft.trim() || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid address')
      setAddress(url.href); setDraft(url.href); setError('')
      setState(url.origin === 'https://notes.example.com' && url.pathname === '/' ? '网页' : '无样张')
      setRevision((value) => value + 1)
    } catch { setError('请输入有效的 HTTP 或 HTTPS 地址。') }
  }
  return <>
    <form className="flex items-center gap-2 border-b p-2" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event) => { event.preventDefault(); navigate() }}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center"><Globe size={14} /></span>
      <input aria-label="浏览器地址" aria-invalid={Boolean(error)} value={draft} maxLength={2048} spellCheck={false} autoComplete="off" className="h-7 min-w-0 flex-1 rounded border-0 bg-transparent px-2 text-center text-[11px] focus:bg-[var(--bg-secondary)]" onFocus={(event) => event.target.select()} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setDraft(address); setError(''); event.currentTarget.blur() } }} />
      <button type="button" aria-label="刷新页面" title="刷新页面" className="flex h-6 w-6 shrink-0 items-center justify-center rounded" onClick={navigate}><RefreshCw size={14} /></button>
    </form>
    {error && <p role="alert" className="px-3 py-2 text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    {state === '无样张' ? <p className="m-auto p-4 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>此地址没有本地页面样张。</p> : state === '加载中' ? <div className="m-auto flex items-center gap-2 text-[12px]" role="status"><LoaderCircle size={16} className="animate-spin" />正在加载页面</div> : state === '加载失败' ? <div className="m-auto space-y-3 text-center text-[12px]"><p>无法打开此页面</p><button type="button" onClick={() => setState('网页')} className="settings-option px-3 py-1.5">重新加载</button></div> : <iframe key={revision} title="浏览器网页样张" sandbox="" referrerPolicy="no-referrer" srcDoc={browserDocument} className="mx-auto min-h-0 w-full flex-1 border-0" style={{ maxWidth: scene === '窄屏网页' ? 320 : '100%' }} />}
  </>
}

/**
 * 背景：用户需要左树右预览，并在多个文件之间来回核对。
 * 设计意图：复用正式文件树的受控选择，预览标签由候选持有，避免修改生产上下布局。
 * 关键约束：文件路径仅索引静态夹具；重复选择不新增标签，关闭后移至剩余预览。
 */
function FilesSample({ scene }: { scene: string }) {
  const initialPath = ({ Markdown: 'notes.md', 代码: 'theme.ts', 图片: 'window.jpg', 无法预览: 'report.pdf' } as Record<string, string>)[scene]
  const [data] = useState<FileBrowserPreviewData>(() => scene === '空目录' ? { projectLabel: 'my-agent', tree: [], files: {} } : { ...fileData, initialPath })
  const [paths, setPaths] = useState<string[]>(initialPath ? [initialPath] : [])
  const [activePath, setActivePath] = useState<string | null>(initialPath ?? null)
  const preview = activePath ? data.files[activePath] : null
  const openFile = (next: FileBrowserPreviewState) => {
    if (!next) return
    setPaths((current) => current.includes(next.path) ? current : [...current, next.path]); setActivePath(next.path)
  }
  return <div className="flex min-h-0 min-w-0 flex-1" data-testid="workspace-files-layout">
    <div className="min-w-0 shrink-0 overflow-hidden border-r" style={{ width: paths.length ? '32%' : '100%', borderColor: 'var(--border-subtle)' }} data-testid="workspace-file-tree"><FileBrowser projectPath={null} embedded mode="files" previewData={data} previewState={preview} onPreviewStateChange={openFile} onClose={() => {}} /></div>
    {paths.length > 0 && <div className="flex min-w-0 flex-1 flex-col" data-testid="workspace-file-preview">
      <div className="flex items-center border-b p-1" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="文件预览">
        {paths.map((path) => {
          const closePreview = () => {
            const remaining = paths.filter((item) => item !== path)
            setPaths(remaining)
            setActivePath((current) => current === path ? remaining.at(-1) ?? null : current)
          }
          return <div key={path} className="flex shrink-0 items-center gap-0.5 rounded-md px-1" style={{ background: path === activePath ? 'var(--bg-secondary)' : undefined }}>
            <button type="button" role="tab" aria-selected={path === activePath} onClick={() => setActivePath(path)} className="settings-option shrink-0 px-2 py-1 text-[11px]" data-selected={path === activePath ? 'true' : undefined}>{path}</button>
            <button type="button" title={`关闭${path}`} aria-label={`关闭${path}`} className="shrink-0 rounded p-1 hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }} onClick={closePreview}><X size={12} /></button>
          </div>
        })}
      </div></div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3" role="tabpanel" aria-label={activePath ?? '文件预览'}>
        {preview?.kind === 'text' && <MarkdownRenderer content={preview.languageHint === 'markdown' ? preview.content : '```' + (preview.languageHint ?? '') + '\n' + preview.content + '\n```'} />}
        {preview?.kind === 'image' && <img src={preview.dataUrl} alt={preview.path} className="mx-auto max-h-full max-w-full object-contain" />}
        {preview?.kind === 'unsupported' && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{preview.reason}</p>}
        {preview?.kind === 'error' && <p role="alert" className="text-[12px]">{preview.message}</p>}
      </div>
    </div>}
  </div>
}

function WorkspaceChatShell() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(['帮我看看 theme.ts 的间距调整。'])
  return <>
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3 text-[12px] leading-6">{messages.map((message, index) => <p key={index} className="break-words">{message}</p>)}<p style={{ color: 'var(--text-muted)' }}>可以打开右侧审阅，查看修改前后的内容。</p></div>
    <form className="flex items-end gap-1 border-t p-2" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event) => { event.preventDefault(); if (input.trim()) { setMessages((current) => [...current, input.trim()]); setInput('') } }}><textarea aria-label="主对话样张消息" rows={3} className="theme-input min-w-0 flex-1 resize-none rounded border p-2 text-[12px]" placeholder="继续对话…" value={input} onChange={(event) => setInput(event.target.value)} /><button type="submit" aria-label="发送主对话样张" title="发送主对话样张" disabled={!input.trim()} className="p-1 disabled:opacity-40"><ArrowUp size={14} /></button></form>
  </>
}

function TerminalSample({ scene }: { scene: string }) {
  const [active, setActive] = useState('1')
  const [running, setRunning] = useState(scene === '运行中')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<Record<string, string>>({
    '1': scene === '报错' ? '$ npm run check\nError: missing script: check\n退出码 1' : scene === '运行中' ? '$ npm run dev\nVITE ready\nLocal: http://127.0.0.1:5174/' : '$ npm run test\nTest Files  4 passed\nTests       12 passed\n退出码 0',
    '2': '$ git status --short\n M src/theme.ts',
  })
  const submit = () => {
    const command = input.trim()
    if (!command) return
    setOutput((current) => ({ ...current, [active]: command === 'clear' ? '' : `${current[active]}\n$ ${command}\n${command === 'help' ? '样张命令：help、pwd、clear' : command === 'pwd' ? '/workspace/my-agent' : '隔离样张不执行系统命令。'}` }))
    setInput('')
  }
  return <>
    <div className="flex items-center gap-2 border-b p-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)' }}>{(scene === '多终端' ? ['1', '2'] : ['1']).map((id) => <button key={id} type="button" className="settings-option px-2 py-1" aria-pressed={active === id} onClick={() => setActive(id)} data-selected={active === id ? 'true' : undefined}>终端 {id}</button>)}{running && <button className="ml-auto p-1" type="button" aria-label="停止运行" title="停止运行" onClick={() => { setRunning(false); setOutput((current) => ({ ...current, [active]: current[active] + '\n^C\n已停止' })) }}><Square size={13} /></button>}</div>
    <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-6" data-testid="workspace-terminal-output">{output[active]}{running && <span className="animate-pulse"> ▌</span>}</pre>
    <form className="flex items-center gap-2 border-t p-3" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event) => { event.preventDefault(); submit() }}><span>$</span><input aria-label="终端样张命令" placeholder="help" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" value={input} disabled={running} onChange={(event) => setInput(event.target.value)} /><button type="submit" disabled={running || !input.trim()} title="运行样张命令" aria-label="运行样张命令" className="p-1 disabled:opacity-40"><ArrowUp size={14} /></button></form>
  </>
}

function SideChatSample({ scene }: { scene: string }) {
  const [input, setInput] = useState('')
  const [state, setState] = useState(scene)
  const [messages, setMessages] = useState(() => scene === '空态' ? [] : [
    { role: 'user', text: '这里的 spacing 变化会影响哪里？' },
    ...(scene === '发送失败' ? [] : [{ role: 'assistant', text: '从 12 调整到 16，会增加使用该间距值的元素之间的留白。' }]),
  ])
  const send = () => { if (!input.trim()) return; setMessages((current) => [...current, { role: 'user', text: input.trim() }, { role: 'assistant', text: '样张回复：可以结合右侧内容继续讨论这一处调整。' }]); setInput(''); setState('对话') }
  return <>
    <div className="border-b p-3 text-[11px]" style={{ borderColor: 'var(--border-subtle)' }}>关于 theme.ts</div>
    <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4" data-testid="workspace-sidechat-messages">
      {messages.length === 0 && <p className="py-12 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>还没有消息</p>}
      {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-auto max-w-[90%] rounded-lg px-3 py-2 text-[12px]' : 'text-[12px] leading-6'} style={{ background: message.role === 'user' ? 'var(--bg-secondary)' : undefined }}><MarkdownRenderer content={message.text} /></div>)}
      {state === '生成中' && <span className="inline-flex items-center gap-2 text-[11px]" role="status"><LoaderCircle size={13} className="animate-spin" />正在生成</span>}
      {state === '发送失败' && <div className="flex items-center gap-3 text-[11px]"><span style={{ color: 'var(--danger)' }}>消息未发送</span><button type="button" onClick={() => { setMessages((current) => [...current, { role: 'assistant', text: '样张回复：这处变化影响布局留白。' }]); setState('对话') }}>重试</button></div>}
    </div>
    <form className="flex items-end gap-2 border-t p-3" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event) => { event.preventDefault(); send() }}><textarea aria-label="侧边聊天消息" rows={2} placeholder="继续聊聊…" className="theme-input min-w-0 flex-1 resize-none rounded border p-2 text-[12px]" value={input} onChange={(event) => setInput(event.target.value)} />{state === '生成中' ? <button type="button" aria-label="停止生成" title="停止生成" className="p-2" onClick={() => setState('对话')}><Square size={15} /></button> : <button type="submit" aria-label="发送消息" title="发送消息" disabled={!input.trim()} className="p-2 disabled:opacity-40"><ArrowUp size={16} /></button>}</form>
  </>
}
