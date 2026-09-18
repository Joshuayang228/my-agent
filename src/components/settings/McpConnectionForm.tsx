import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { SegmentedControl } from '../foundation/SegmentedControl'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { SettingCard } from './SettingsFields'
import type { McpConnectionActions, McpConnectionInput, McpConnectionSaveResult, McpDiscoveredTool } from '../../shared/types'

export interface McpConnectionDraft {
  kind: 'remote' | 'local'
  name: string
  url: string
  auth: 'none' | 'bearer'
  token: string
  command: string
  args: string
  env: string
}
type Phase = 'editing' | 'testing' | 'ready' | 'saving' | 'cancelling' | 'cleanup-error' | 'saved'
interface Props {
  actions: McpConnectionActions
  onCancel: () => void
  onSaved: (result: McpConnectionSaveResult) => Promise<void>
  initialDraft?: Partial<McpConnectionDraft>
  /** 仅隔离故事使用显式初始态；正式入口必须通过 actions 获取结果。 */
  preview?: { phase: 'editing' | 'testing' | 'ready'; tools?: McpDiscoveredTool[]; error?: string }
}
const EMPTY: McpConnectionDraft = { kind: 'remote', name: '', url: '', auth: 'none', token: '', command: '', args: '', env: '' }

/**
 * 背景：本地命令可能使用带空格路径或包含等号的环境值。
 * 设计意图：按行拆参数、按第一个等号拆变量，不使用 shell 分词或 trim 值。
 * 关键约束：重复与非法环境键必须拒绝；只提交当前连接模式的字段。
 */
export function parseMcpConnectionDraft(draft: McpConnectionDraft): McpConnectionInput {
  if (!draft.name.trim()) throw new Error('请输入连接名称。')
  if (draft.kind === 'remote') {
    try {
      const url = new URL(draft.url.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
    } catch { throw new Error('请输入不含账号密码的 HTTP 或 HTTPS 地址。') }
    if (draft.auth === 'bearer' && !draft.token.trim()) throw new Error('请输入访问令牌，或选择无需认证。')
    return { name: draft.name.trim(), transport: 'streamable-http', command: '', args: [], url: draft.url.trim(),
      ...(draft.auth === 'bearer' ? { bearerToken: draft.token } : {}) }
  }
  if (!draft.command.trim()) throw new Error('请输入启动命令。')
  const entries: Array<[string, string]> = []
  for (const line of draft.env.split(/\r?\n/)) {
    if (!line.trim()) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    if (index < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || entries.some(([name]) => name === key)) {
      throw new Error('环境变量每行使用 NAME=value 格式，名称不能重复。')
    }
    entries.push([key, line.slice(index + 1)])
  }
  return { name: draft.name.trim(), transport: 'stdio', command: draft.command.trim(),
    args: draft.args.split(/\r?\n/).filter((line) => line.trim()), ...(entries.length ? { env: Object.fromEntries(entries) } : {}) }
}

/**
 * 背景：测试连接跨多个 UI 状态，phase effect 清理曾把成功结果提前取消。
 * 设计意图：按 requestId 持有会话，用 actions 注入生产 IPC 或隔离夹具；不再复制候选表单。
 * 关键约束：每次测试新 id，旧响应不得回写；取消确认后才能重测，保存完成后仅刷新，不重复保存。
 */
export function McpConnectionForm({ actions, onCancel, onSaved, initialDraft, preview }: Props) {
  const [draft, setDraft] = useState<McpConnectionDraft>(() => ({ ...EMPTY, ...initialDraft }))
  const [phase, setPhase] = useState<Phase>(preview?.phase ?? 'editing')
  const phaseRef = useRef(phase)
  const [tools, setTools] = useState<McpDiscoveredTool[]>(preview?.tools ?? [])
  const [allowed, setAllowed] = useState<string[]>(preview?.tools?.map((tool) => tool.name) ?? [])
  const [error, setError] = useState(preview?.error ?? '')
  const [refreshBusy, setRefreshBusy] = useState(false)
  const request = useRef<string | null>(preview?.phase !== undefined && preview.phase !== 'editing' ? `fixture-${crypto.randomUUID()}` : null)
  const mounted = useRef(false)
  const version = useRef(0)
  const api = useRef(actions)
  api.current = actions
  const saved = useRef<McpConnectionSaveResult | null>(null)
  const refreshing = useRef(false)
  const transition = (next: Phase) => { phaseRef.current = next; setPhase(next) }

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      version.current++
      if (request.current) {
        // 卸载没有 UI 可重试；主进程到期与窗口清理兜底，通道失败必须留下无敏感信息诊断。
        void api.current.cancelTest(request.current).then((result) => {
          if (!result.ok) console.warn('MCP test cleanup not confirmed')
        }).catch(() => console.warn('MCP test cleanup channel failed'))
      }
    }
  }, [])

  const cleanup = async (close: boolean) => {
    if (['saving', 'cancelling'].includes(phaseRef.current)) return
    version.current++
    transition('cancelling')
    setError('')
    try {
      if (request.current) {
        const result = await api.current.cancelTest(request.current)
        if (!result.ok) throw new Error()
      }
      request.current = null
      if (!mounted.current) return
      setTools([]); setAllowed([]); transition('editing')
      if (close) onCancel()
    } catch {
      if (mounted.current) { transition('cleanup-error'); setError('未能确认测试连接关闭，请重试取消。') }
    }
  }
  const change = <K extends keyof McpConnectionDraft>(key: K, value: McpConnectionDraft[K]) => {
    if (!['editing', 'ready'].includes(phaseRef.current)) return
    setDraft((current) => ({ ...current, [key]: value, ...(key === 'auth' ? { token: '' } : {}) }))
    setError('')
    if (request.current) void cleanup(false)
  }
  const test = async () => {
    if (phaseRef.current === 'ready') await cleanup(false)
    if (!mounted.current || phaseRef.current !== 'editing') return
    let config: McpConnectionInput
    try { config = parseMcpConnectionDraft(draft) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '连接配置无效。'); return }
    const id = `mcp-test-${crypto.randomUUID()}`
    const epoch = ++version.current
    request.current = id
    setError(''); transition('testing')
    try {
      const result = await api.current.testConnection(id, config)
      if (!mounted.current || epoch !== version.current) return
      if (!result.ok) { request.current = null; transition('editing'); setError(result.error); return }
      setTools(result.tools); setAllowed(result.tools.map((tool) => tool.name)); transition('ready')
    } catch {
      if (!mounted.current || epoch !== version.current) return
      // IPC 拒绝不证明主进程没有启动；先确认清理，再允许新测试。
      transition('cleanup-error'); setError('测试状态未确认，请取消后重试。')
    }
  }
  const refresh = async (result: McpConnectionSaveResult) => {
    if (refreshing.current) return
    refreshing.current = true
    setRefreshBusy(true)
    try { await onSaved(result) }
    catch { if (mounted.current) setError('连接已保存，但列表刷新失败，请重试刷新。') }
    finally { refreshing.current = false; if (mounted.current) setRefreshBusy(false) }
  }
  const save = async () => {
    if (phaseRef.current !== 'ready' || !request.current) return
    transition('saving'); setError('')
    try {
      const result = await api.current.saveTested(request.current, allowed)
      if (result.ok || result.savedServerId) {
        request.current = null
        saved.current = result
        if (!mounted.current) return
        setDraft((current) => ({ ...current, token: '', env: '' }))
        transition('saved')
        await refresh(result)
      } else if (mounted.current) { transition('ready'); setError(result.error) }
    } catch { if (mounted.current) { transition('ready'); setError('保存状态未确认，请重试。') } }
  }
  const editable = phase === 'editing' || phase === 'ready'
  const closingDisabled = phase === 'saving' || phase === 'cancelling' || refreshBusy
  const fieldClass = 'theme-input mt-1 w-full min-w-0 rounded-md border px-2 py-2 text-[12px]'
  const field = (key: 'name' | 'url' | 'token' | 'command' | 'args' | 'env', label: string, maxLength: number, rows?: number) => <label>{label}<TextField
    multiline={Boolean(rows)} rows={rows} type={key === 'token' ? 'password' : 'text'} autoComplete="off"
    value={draft[key]} maxLength={maxLength} disabled={!editable} className={fieldClass}
    onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(key, event.target.value)} /></label>

  return <SettingCard testId="mcp-connection-form">
    <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-[13px] font-medium">添加连接</h3><IconButton label="关闭添加连接" disabled={closingDisabled} onClick={() => void cleanup(true)}><X size={14} /></IconButton></div>
    <SegmentedControl ariaLabel="MCP 连接类型" value={draft.kind} onChange={(value) => change('kind', value as McpConnectionDraft['kind'])}
      items={[{ id: 'remote', label: '远程服务', disabled: !editable }, { id: 'local', label: '本地服务', disabled: !editable }]} />
    <form onSubmit={(event) => { event.preventDefault(); void test() }}>
      <fieldset disabled={!editable} className="mt-4 grid min-w-0 gap-3 text-[11px]">
        {field('name', '连接名称', 200)}
        {draft.kind === 'remote' ? <>
          {field('url', '服务 URL', 4096)}
          <span style={{ color: 'var(--text-muted)' }}>Streamable HTTP</span>
          <label>认证方式<SelectField className="mt-1" value={draft.auth} onChange={(event) => change('auth', event.target.value as McpConnectionDraft['auth'])}><option value="none">无需认证</option><option value="bearer">访问令牌（Bearer）</option></SelectField></label>
          {draft.auth === 'bearer' && field('token', '访问令牌', 4096)}
        </> : <>
          {field('command', '启动命令', 4096)}
          {field('args', '参数（每行一个）', 8192, 3)}
          {field('env', '环境变量（每行 NAME=value）', 16384, 2)}
        </>}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
      {['testing', 'cancelling', 'cleanup-error'].includes(phase) && <div role="status" className="mt-4 flex min-h-8 items-center gap-2 text-[12px]">
        <RefreshCw size={14} className={phase === 'cleanup-error' ? '' : 'animate-spin'} />{phase === 'testing' ? '正在连接并获取工具…' : phase === 'cancelling' ? '正在取消测试…' : '测试关闭状态未确认'}
        <ActionButton className="ml-auto h-8 w-24" disabled={phase === 'cancelling'} onClick={() => void cleanup(false)}>取消测试</ActionButton>
      </div>}
      {(phase === 'ready' || phase === 'saving') && <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <p role="status" className="mb-2 text-[12px]" style={{ color: 'var(--success)' }}>已获取 {tools.length} 个工具{preview ? '（样张）' : ''}</p>
        <div className="max-h-64 overflow-y-auto">{tools.map((tool) => <label key={tool.name} className="flex min-h-8 items-center justify-between gap-3 py-1 text-[12px]">
          <span className="min-w-0 [overflow-wrap:anywhere]">{tool.name}<small className="ml-2" style={{ color: 'var(--text-muted)' }}>{tool.description}</small></span>
          <input type="checkbox" className="h-4 w-4 shrink-0" disabled={phase !== 'ready'} aria-label={`允许${tool.name}`} checked={allowed.includes(tool.name)}
            onChange={(event) => setAllowed((current) => event.target.checked ? [...current, tool.name] : current.filter((name) => name !== tool.name))} />
        </label>)}</div>
      </div>}
      {preview && <p className="mt-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>隔离样张，不会连接服务或保存凭据。</p>}
      <div className="mt-4 flex min-h-8 flex-wrap justify-end gap-2">
        <ActionButton className="h-8 w-16" disabled={closingDisabled} onClick={() => void cleanup(true)}>取消</ActionButton>
        <ActionButton className="h-8 w-24" type="submit" disabled={!editable} >测试连接</ActionButton>
        <ActionButton className="h-8 w-24" tone="accent" disabled={phase !== 'ready' && !(phase === 'saved' && !refreshBusy)}
          onClick={() => { if (phase === 'saved' && saved.current) void refresh(saved.current); else void save() }}>
          {phase === 'saved' ? '刷新列表' : phase === 'saving' ? '正在保存' : '保存连接'}
        </ActionButton>
      </div>
    </form>
  </SettingCard>
}
