/**
 * Tool 通道 UI：每个工具卡片独立 Start(pending) / Progress(running) / Complete。
 */

import { ChevronRight } from 'lucide-react'
import type { ToolCallbackItem } from './types'
import { toolItemPhase } from './types'

const STATUS_LABEL: Record<ToolCallbackItem['status'], string> = {
  pending: '解析参数...',
  running: '执行中...',
  done: '完成',
  error: '失败',
}

export function ToolCallbackList({
  tools,
  onToggleCollapse,
}: {
  tools: ToolCallbackItem[]
  onToggleCollapse: (callId: string) => void
}) {
  if (tools.length === 0) return null

  return (
    <div className="mt-4 space-y-1" data-callback="tool">
      {tools.map((tool) => {
        const phase = toolItemPhase(tool.status)
        return (
          <div
            key={tool.callId}
            className="rounded-md border"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
            data-phase={phase}
          >
            <button
              type="button"
              onClick={() => onToggleCollapse(tool.callId)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px]"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  tool.status === 'pending' ? 'animate-pulse' : ''
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
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                {tool.name || '...'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{STATUS_LABEL[tool.status]}</span>
              <ChevronRight
                size={12}
                className={`ml-auto transition-transform ${tool.collapsed ? '' : 'rotate-90'}`}
                style={{ color: 'var(--text-muted)' }}
              />
            </button>
            {!tool.collapsed && (
              <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
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
                    <div className="mb-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>args</div>
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
                    <div className="mb-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>result</div>
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
