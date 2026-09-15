import { Check, RefreshCw, Server, Trash2 } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { SettingCard, SettingSwitch } from './SettingsFields'

export type McpServiceState = 'connected' | 'connecting' | 'confirm' | 'disabled' | 'error' | 'auth' | 'disconnected'
export interface McpServiceTool { id: string; name: string; description?: string; allowed: boolean }

const labels: Record<McpServiceState, string> = {
  connected: '已连接', connecting: '连接中', confirm: '待确认', disabled: '已停用',
  error: '连接失败', auth: '需要登录', disconnected: '未连接',
}

/**
 * 背景：正式 MCP 与候选独立维护服务卡片，状态、工具清单与操作布局出现漂移。
 * 设计意图：共享纯展示组合，连接、确认和持久化由调用方持有，基础按钮统一操作槽。
 * 关键约束：未知工具清单用 null，不伪装为零；不读取 IPC 或执行服务描述；忙时不移除操作槽。
 */
export function McpServiceCard({ id, name, transport, status, enabled, tools, address, error, busy = false,
  testId, onEnabledChange, onToolChange, onRetry, onCancel, onConfirm, onRemove }: {
  id: string; name: string; transport: string; status: McpServiceState; enabled: boolean
  tools: readonly McpServiceTool[] | null; address?: string; error?: string; busy?: boolean; testId: string
  onEnabledChange: (enabled: boolean) => void; onToolChange?: (toolId: string, allowed: boolean) => void
  onRetry?: () => void; onCancel?: () => void; onConfirm?: () => void; onRemove?: () => void
}) {
  const confirming = status === 'confirm'
  const ready = status === 'connected'
  return <SettingCard testId={testId}>
    <div className="flex items-center gap-3" data-mcp-card-header>
      <Server size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
      <h3 className="min-w-0 flex-1 [overflow-wrap:anywhere] text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{name}</h3>
      <div className="flex shrink-0 items-center gap-2">
        {!confirming && <SettingSwitch compact checked={enabled} disabled={busy || status === 'connecting'} label={`启用${name}`} description="" testId={`mcp-enabled-${id}`} onChange={onEnabledChange} />}
        {onRemove && <IconButton label={`删除${name}`} size={28} disabled={busy || status === 'connecting'} onClick={onRemove}><Trash2 size={14} /></IconButton>}
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <span>{transport}</span><span className="inline-flex items-center gap-1" role="status" style={{ color: ready ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--text-secondary)' }}>
        {status === 'connecting' && <RefreshCw size={12} className="animate-spin" aria-hidden="true" />}{labels[status]}
      </span>
    </div>
    {confirming && <div className="mt-4 space-y-1 text-[11px] leading-5" style={{ color: 'var(--text-secondary)' }}><p>允许伙伴连接此服务，并使用选中的工具？</p>{address && <code className="block break-all text-[10px]" style={{ color: 'var(--text-muted)' }}>{address}</code>}</div>}
    {(ready || confirming) && <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
      {tools === null ? <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>工具清单尚未获取</p> : <>
        <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}><span>{tools.length} 个工具</span>{tools.length > 0 && <span>{tools.filter((tool) => tool.allowed).length} 个{confirming ? '已选择' : '已允许'}</span>}</div>
        {tools.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>已连接，服务未提供工具。</p> : <ul className="scrollbar-thin max-h-80 space-y-2 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {tools.map((tool) => <li key={tool.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2 text-[11px]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} data-testid="mcp-tool-row">
            <div className="min-w-0 [overflow-wrap:anywhere]"><span style={{ color: 'var(--text-primary)' }}>{tool.name}</span>{tool.id !== tool.name && <code className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.id}</code>}{tool.description && <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{tool.description}</p>}</div>
            {onToolChange ? <input type="checkbox" className="h-4 w-4 shrink-0" aria-label={`允许${tool.name}`} disabled={busy} checked={tool.allowed} onChange={(event) => onToolChange(tool.id, event.target.checked)} /> : !tool.allowed && <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>未允许</span>}
          </li>)}
        </ul>}
      </>}
    </div>}
    {(status === 'connecting' || status === 'error' || status === 'disconnected') && <div className="mt-4 flex items-center justify-between gap-3 text-[11px]">
      <span className="min-w-0 [overflow-wrap:anywhere]" style={{ color: 'var(--text-secondary)' }}>{status === 'connecting' ? '正在连接并获取工具清单…' : error || (status === 'error' ? '连接失败，请检查服务后重试。' : '配置已保留，服务尚未连接。')}</span>
      {status === 'connecting' ? onCancel && <ActionButton onClick={onCancel}>取消</ActionButton> : onRetry && <ActionButton disabled={busy} className="gap-1" onClick={onRetry}><RefreshCw size={12} />重试</ActionButton>}
    </div>}
    {status === 'auth' && <p className="mt-4 text-[11px]" style={{ color: 'var(--text-secondary)' }}>登录后才能获取此服务的工具清单。</p>}
    {status === 'disabled' && <p className="mt-4 text-[11px]" style={{ color: 'var(--text-muted)' }}>配置已保留，伙伴暂不使用此服务。</p>}
    {confirming && <div className="mt-4 flex justify-end gap-3">{onCancel && <ActionButton disabled={busy} onClick={onCancel}>取消</ActionButton>}{onConfirm && <ActionButton disabled={busy} onClick={onConfirm} className="gap-1"><Check size={13} />确认连接</ActionButton>}</div>}
  </SettingCard>
}
