import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

/**
 * 背景：候选与正式 MCP 清单曾各自维护标题、添加按钮和空态，服务卡共享仍不能保证整页一致。
 * 设计意图：只统一列表呈现，连接表单与服务卡作为内容注入，避免复制业务状态机。
 * 关键约束：数量、空态和禁用由调用方决定；此组件不读取 IPC，添加按钮始终占位。
 */
export function McpServiceList({ count, onAdd, disabled = false, showEmpty, children, testIdPrefix = 'settings' }: {
  count: number
  onAdd: () => void
  disabled?: boolean
  showEmpty: boolean
  children: ReactNode
  testIdPrefix?: string
}) {
  return <div className="space-y-3" data-testid={`${testIdPrefix}-mcp-list`}>
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{count} 个服务</span>
      <ActionButton onClick={onAdd} disabled={disabled} size="md" className="h-8 gap-1"
        style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} data-testid={`${testIdPrefix}-mcp-add`}>
        <Plus size={14} aria-hidden="true" />添加连接
      </ActionButton>
    </div>
    {showEmpty && <div className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }} data-testid={`${testIdPrefix}-mcp-empty`}>还没有 MCP 服务</div>}
    {children}
  </div>
}
