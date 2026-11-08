/**
 * Tool 通道 UI：紧凑行内卡片（挂在 assistant 回合下，对齐 Alice）。
 */

import { ChevronRight, Newspaper, Sparkles, Wrench } from 'lucide-react'
import { useCallback } from 'react'
import { GeneratedImageResult, type GeneratedImageReader, type GeneratedImageRevealer } from './GeneratedImageResult'
import type { ToolCallbackItem } from './types'
import { toolItemPhase } from './types'
import { ActionButton } from '../../foundation/ActionButton'

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
  sessionId,
  readGeneratedImage,
  revealGeneratedImage,
  onNavigateToWorld,
}: {
  tools: ToolCallbackItem[]
  onToggleCollapse: (callId: string) => void
  className?: string
  sessionId?: string | null
  readGeneratedImage?: GeneratedImageReader
  revealGeneratedImage?: GeneratedImageRevealer
  onNavigateToWorld?: (tab: 'moments' | 'culture' | 'wardrobe' | 'home' | 'footprints') => void
}) {
  const readImage = useCallback<GeneratedImageReader>(async imageId => {
    if (readGeneratedImage) return readGeneratedImage(imageId)
    if (!sessionId || !window.electronAPI?.session.readGeneratedImage) return { ok: false, error: '当前会话无法读取图片。' }
    return window.electronAPI.session.readGeneratedImage(sessionId, imageId)
  }, [sessionId, readGeneratedImage])
  const revealImage = useCallback<GeneratedImageRevealer>(async imageId => {
    if (revealGeneratedImage) return revealGeneratedImage(imageId)
    if (!sessionId || !window.electronAPI?.session.revealGeneratedImage) return { ok: false, error: '当前会话无法定位图片。' }
    return window.electronAPI.session.revealGeneratedImage(sessionId, imageId)
  }, [sessionId, revealGeneratedImage])
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
            <ActionButton
              onClick={() => onToggleCollapse(tool.callId)}
              className="w-full !min-h-0 !justify-start gap-2 rounded-none border-0 !px-3 !py-2 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
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
            </ActionButton>
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
                        {tool.name === 'companion_post_moment' && tool.status === 'done' && (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[12px]" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-subtle)' }} data-testid="tool-moment-card">
                <div className="flex items-center gap-2 min-w-0">
                  <Newspaper size={14} style={{ color: 'var(--accent-fg)' }} />
                  <span className="truncate" style={{ color: 'var(--accent-fg)' }}>
                    伙伴发布了动态：{typeof tool.args?.text === 'string' ? `「${tool.args.text.slice(0, 30)}${tool.args.text.length > 30 ? '...' : ''}」` : '生活记录'}
                  </span>
                </div>
                {onNavigateToWorld && (
                  <ActionButton
                    variant="plain"
                    size="sm"
                    onClick={() => onNavigateToWorld('moments')}
                    className="shrink-0"
                  >
                    去朋友圈查看
                  </ActionButton>
                )}
              </div>
            )}
            {tool.name === 'companion_create_asset' && tool.status === 'done' && (
              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[12px]" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-subtle)' }} data-testid="tool-asset-card">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles size={14} style={{ color: 'var(--accent-fg)' }} />
                  <span className="truncate" style={{ color: 'var(--accent-fg)' }}>
                    生活记录已存入：{typeof tool.args?.name === 'string' ? `《${tool.args.name}》` : '新记录'}
                  </span>
                </div>
                {onNavigateToWorld && (
                  <ActionButton
                    variant="plain"
                    size="sm"
                    onClick={() => onNavigateToWorld(tool.args?.kind === 'culture' || tool.args?.kind === 'bookshelf' ? 'culture' : tool.args?.kind === 'wardrobe' ? 'wardrobe' : 'home')}
                    className="shrink-0"
                  >
                    去人物世界查看
                  </ActionButton>
                )}
              </div>
            )}
            {tool.generatedImages?.map(image => <GeneratedImageResult key={image.id} image={image} readImage={readImage} revealImage={sessionId || revealGeneratedImage ? revealImage : undefined} scope={sessionId ?? 'preview'} />)}
          </div>
        )
      })}
    </div>
  )
}
