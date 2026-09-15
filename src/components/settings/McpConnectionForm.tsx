import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SegmentedControl } from '../foundation/SegmentedControl'
import { TextField } from '../foundation/TextField'
import { SettingCard } from './SettingsFields'
import type { McpConnectionInput } from '../../shared/types'

type Kind = 'remote' | 'local'

interface Props {
  onCancel: () => void
  onSaved: () => Promise<void>
}

function parseEnv(raw: string): Record<string, string> | undefined {
  const entries = raw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const index = line.indexOf('=')
    return index > 0 ? [line.slice(0, index).trim(), line.slice(index + 1)] as const : null
  })
  if (!entries.length) return undefined
  if (entries.some((entry) => !entry)) throw new Error('环境变量每行使用 NAME=value 格式。')
  return Object.fromEntries(entries as Array<readonly [string, string]>)
}

/**
 * 背景：正式 MCP 添加必须先测试、再选择工具、最后保存，旧表单把连接和保存混成一次动作。
 * 设计意图：组件只持有本次草稿和 requestId，真实执行交给主进程测试会话；不复制服务管理或凭据存储。
 * 关键约束：取消 / 卸载都发送 cancel；测试成功前不能保存；保存只提交发现工具的允许名单，令牌不进入 React 外部状态。
 */
export function McpConnectionForm({ onCancel, onSaved }: Props) {
  const requestId = useRef(`mcp-test-${crypto.randomUUID()}`).current
  const [kind, setKind] = useState<Kind>('remote')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('https://')
  const [auth, setAuth] = useState<'none' | 'bearer'>('none')
  const [token, setToken] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')
  const [phase, setPhase] = useState<'editing' | 'testing' | 'ready' | 'saving'>('editing')
  const [tools, setTools] = useState<Array<{ name: string; description: string }>>([])
  const [allowed, setAllowed] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (phase === 'testing' || phase === 'ready') void window.electronAPI?.mcp.cancelTest(requestId)
  }, [phase, requestId])

  const input = (): McpConnectionInput => {
    if (!name.trim()) throw new Error('请输入连接名称。')
    if (kind === 'remote') {
      if (!url.trim()) throw new Error('请输入服务 URL。')
      try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error() } catch { throw new Error('请输入不含账号密码的 HTTP 或 HTTPS 地址。') }
      if (auth === 'bearer' && !token.trim()) throw new Error('请输入访问令牌。')
      return { name: name.trim(), transport: 'streamable-http', command: '', args: [], url: url.trim(), ...(auth === 'bearer' ? { bearerToken: token } : {}) }
    }
    if (!command.trim()) throw new Error('请输入启动命令。')
    return { name: name.trim(), transport: 'stdio', command: command.trim(), args: args.split('\n').map((item) => item.trim()).filter(Boolean), env: parseEnv(env) }
  }

  const test = async () => {
    setError('')
    try {
      setPhase('testing')
      const result = await window.electronAPI?.mcp.testConnection(requestId, input())
      if (!result) throw new Error('当前环境不支持 MCP 连接测试。')
      if (!result.ok) throw new Error(result.error)
      setTools(result.tools); setAllowed(result.tools.map((tool) => tool.name)); setPhase('ready')
    } catch (cause) { setPhase('editing'); setError(cause instanceof Error ? cause.message : '连接测试失败，请重试。') }
  }

  const cancel = async () => { if (phase === 'testing' || phase === 'ready') await window.electronAPI?.mcp.cancelTest(requestId); onCancel() }
  const save = async () => {
    setPhase('saving'); setError('')
    try {
      const result = await window.electronAPI?.mcp.saveTested(requestId, allowed)
      if (!result?.ok) throw new Error(result?.error || '连接未保存，请重试。')
      await onSaved()
    } catch (cause) { setPhase('ready'); setError(cause instanceof Error ? cause.message : '连接未保存，请重试。') }
  }
  const disabled = phase === 'testing' || phase === 'saving'
  return <SettingCard testId="mcp-connection-form">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[13px] font-medium">添加连接</h3><button type="button" aria-label="关闭添加连接" title="关闭添加连接" disabled={disabled} onClick={() => void cancel()} className="h-7 w-7 shrink-0"><X size={14} /></button></div>
    <SegmentedControl ariaLabel="MCP 连接类型" value={kind} onChange={(value) => { setKind(value as Kind); setPhase('editing'); setError('') }} items={[{ id: 'remote', label: '远程服务' }, { id: 'local', label: '本地服务' }]} className="mt-4" />
    <div className="mt-4 grid min-w-0 gap-3 text-[11px]">
      <label>连接名称<TextField value={name} maxLength={200} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>
      {kind === 'remote' ? <>
        <label>服务 URL<TextField value={url} maxLength={4096} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>
        <span style={{ color: 'var(--text-muted)' }}>Streamable HTTP</span>
        <label>认证方式<select value={auth} disabled={disabled} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setAuth(event.target.value as 'none' | 'bearer'); setToken('') }} className="theme-input mt-1 w-full rounded border px-2 py-2"><option value="none">无需认证</option><option value="bearer">访问令牌（Bearer）</option></select></label>
        {auth === 'bearer' && <label>访问令牌<TextField type="password" autoComplete="off" value={token} maxLength={4096} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setToken(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>}
      </> : <>
        <label>启动命令<TextField value={command} maxLength={4096} disabled={disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => setCommand(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>
        <label>参数（每行一个）<TextField multiline rows={3} value={args} maxLength={8192} disabled={disabled} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setArgs(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>
        <label>环境变量（每行 NAME=value）<TextField multiline rows={2} value={env} maxLength={16384} disabled={disabled} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEnv(event.target.value)} className="mt-1 w-full rounded border px-2 py-2" /></label>
      </>}
    </div>
    {error && <p role="alert" className="mt-3 text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    {phase === 'testing' && <div role="status" className="mt-4 flex min-h-7 items-center gap-2 text-[12px]"><RefreshCw size={14} className="animate-spin" />正在连接并获取工具…<ActionButton className="ml-auto" onClick={() => void cancel()}>取消测试</ActionButton></div>}
    {phase === 'ready' && <div className="mt-4 max-h-64 overflow-y-auto border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}><p role="status" className="mb-2 text-[12px]" style={{ color: 'var(--success)' }}>已获取 {tools.length} 个工具</p>{tools.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>服务未提供工具，仍可保存连接。</p> : tools.map((tool) => <label key={tool.name} className="flex min-h-8 items-center justify-between gap-3 py-1 text-[12px]"><span className="min-w-0 break-words">{tool.name}<small className="ml-2" style={{ color: 'var(--text-muted)' }}>{tool.description}</small></span><input type="checkbox" aria-label={`允许${tool.name}`} checked={allowed.includes(tool.name)} onChange={(event) => setAllowed((current) => event.target.checked ? [...current, tool.name] : current.filter((name) => name !== tool.name))} /></label>)}</div>}
    <div className="mt-4 flex min-h-8 justify-end gap-2"><ActionButton disabled={disabled} onClick={() => void cancel()}>取消</ActionButton><ActionButton disabled={disabled || phase === 'ready'} onClick={() => void test()} tone="accent">测试连接</ActionButton><ActionButton disabled={phase !== 'ready'} onClick={() => void save()} tone="accent">{phase === 'saving' ? '正在保存' : '保存连接'}</ActionButton></div>
  </SettingCard>
}
