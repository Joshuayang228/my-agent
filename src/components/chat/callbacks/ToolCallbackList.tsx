/**
 * Tool 通道 UI：紧凑行内卡片（挂在 assistant 回合下，对齐 Alice）。
 */

import { ChevronRight, Wrench } from 'lucide-react'
import type { ToolCallbackItem } from './types'
import { toolItemPhase } from './types'

const STATUS_LABEL: Record<ToolCallbackItem['status'], string> = {
  pending: '准备中',
  running: '执行中',
  done: '完成',
  error: '失败',
}

export function ToolCallbackList({
  tools,
  onToggleCollapse,
  className = '',
}: {
  tools: ToolCallbackItem[]
  onToggleCollapse: (callId: string) => void
  className?: string
}) {
  if (tools.length === 0) return null

  return (
    <div className={`space-y-1.5 ${className}`} data-callback="tool" data-testid="tool-callback-list">
      {tools.map((tool) => {
        const phase = toolItemPhase(tool.status)
        const collapsed = tool.collapsed !== false
        return (
          <div
            key={tool.callId}
            className="overflow-hidden rounded-[var(--radius-md)] border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
            data-phase={phase}
          >
            <button
              type="button"
              onClick={() => onToggleCollapse(tool.callId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px]"
            >
              <Wrench size={12} style={{ color: 'var(--text-muted)' }} />
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  tool.status === 'pending' || tool.status === 'running' ? 'animate-pulse' : ''
                }`}
                style={{
                  background:
                    tool.status === 'pending' || tool.status === 'running'
                      ? 'var(--accent)'
                      : tool.status === 'error'
                        ? 'var(--danger)'
                        : 'var(--success)',
                }}
              />
              <span className="truncate font-mono" style={{ color: 'var(--text-primary)' }}>
                {tool.name || '...'}
              </span>
              <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
                {STATUS_LABEL[tool.status]}
              </span>
              <ChevronRight
                size={12}
                className={`ml-auto shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
            {!collapsed && (
              <div className="space-y-2 border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {tool.status === 'pending' && tool.streamingArgs && (
                  <pre
                    className="max-h-24 overflow-auto font-mono text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {tool.streamingArgs}
                  </pre>
                )}
                {Object.keys(tool.args).length > 0 && (
                  <div>
                    <div className="mb-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>参数</div>
                    <pre
                      className="max-h-28 overflow-auto font-mono text-[11px] leading-relaxed"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {JSON.stringify(tool.args, null, 2)}
                    </pre>
                  </div>
                )}
                {tool.result && (
                  <div>
                    <div className="mb-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>结果</div>
                    <pre className="max-h-32 overflow-auto text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {tool.result.slice(0, 2000)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
