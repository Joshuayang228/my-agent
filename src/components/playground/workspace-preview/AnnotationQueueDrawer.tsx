import { useState } from 'react'
import { ChevronDown, ChevronUp, Layers, Send, Trash2, X } from 'lucide-react'
import { ActionButton } from '../../foundation/ActionButton'
import { Badge } from '../../foundation/Badge'
import { IconButton } from '../../foundation/IconButton'
import type { AnnotationQueueItem } from './annotation-format'

interface AnnotationQueueDrawerProps {
  items: AnnotationQueueItem[]
  onRemove: (id: string) => void
  onClear: () => void
  onSendAll: () => void
}

/**
 * 背景：用户审阅多页文档或页面时经常需要连续标出 3~5 处问题再一次性发给 AI 集中处理（对标 Codex 批量批注）。
 * 设计意图：当队列为空时完全隐藏不占空间；存在暂存批注时在预览区顶部显示紧凑汇总条，支持展开查看、单条删除、清空与一键汇总发送。
 * 关键约束：仅负责展示与分发回调，不直接耦合主会话状态或 IPC。
 */
export function AnnotationQueueDrawer({
  items,
  onRemove,
  onClear,
  onSendAll,
}: AnnotationQueueDrawerProps) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  return (
    <div
      className="shrink-0 border-b"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      data-testid="workspace-annotation-queue"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[11px]">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 font-medium"
          style={{ color: 'var(--text-primary)' }}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <Layers size={13} style={{ color: 'var(--accent-fg)' }} />
          <span>批注草稿篮</span>
          <Badge tone="accent">{items.length} 条</Badge>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <IconButton
            label="清空批注草稿篮"
            size={24}
            style={{ color: 'var(--text-muted)' }}
            onClick={onClear}
          >
            <Trash2 size={12} />
          </IconButton>
          <ActionButton
            size="sm"
            tone="accent"
            className="gap-1"
            data-testid="workspace-annotation-queue-send-all"
            onClick={() => {
              onSendAll()
              setExpanded(false)
            }}
          >
            <Send size={12} />
            汇总发送到对话
          </ActionButton>
        </div>
      </div>

      {expanded && (
        <ul
          className="max-h-40 space-y-1.5 overflow-auto border-t px-3 py-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
        >
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-[var(--radius-control)] border px-2 py-1.5 text-[11px]"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
            >
              <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                #{idx + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="accent">{item.anchorLabel}</Badge>
                  <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }} title={item.filePath}>
                    {item.filePath.split(/[/\\]/).pop() || item.filePath}
                  </span>
                </div>
                <p className="break-words text-[11px]" style={{ color: 'var(--text-primary)' }}>
                  {item.comment}
                </p>
              </div>
              <IconButton
                label={`删除批注 #${idx + 1}`}
                size={24}
                style={{ color: 'var(--text-muted)' }}
                onClick={() => onRemove(item.id)}
              >
                <X size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
