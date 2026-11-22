/**
 * Tool 通道 UI：轻量过程折叠卡（挂在 assistant 回合内，与 ReasoningCallback 共用同一套视觉规范）。
 *
 * 背景：此前工具卡直接裸露英文等宽工具名，朋友圈/生活记录回执条又叠了一块高饱和底色，与思考过程卡视觉割裂。
 * 设计意图：将内置/伙伴工具映射为自然中文动作名与语义图标，副信息轻量展示关键目标，展开后再查看原始工具名、参数 JSON 与输出；
 * 卡片圆角、头部高度、状态点与右侧折叠箭头与 `ReasoningCallback` 保持像素级一致。
 * 关键约束：保留 `data-callback="tool"`、`data-testid="tool-callback-list"`、`tool-moment-card`、`tool-asset-card` 与 Foundation `ActionButton`。
 */

import {
  BookOpen,
  Camera,
  ChevronRight,
  FileSearch,
  FileText,
  Gift,
  Globe,
  Image as ImageIcon,
  Newspaper,
  Shirt,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { useCallback, type ReactNode } from 'react'
import { GeneratedImageResult, type GeneratedImageReader, type GeneratedImageRevealer } from './GeneratedImageResult'
import type { ToolCallbackItem } from './types'
import { toolItemPhase } from './types'
import { ActionButton } from '../../foundation/ActionButton'

const STATUS_LABEL: Record<ToolCallbackItem['status'], string> = {
  pending: '准备中',
  running: '执行中',
  done: '已完成',
  error: '失败',
}

interface ToolDisplayMeta {
  label: string
  icon: ReactNode
}

function getToolDisplayMeta(name: string): ToolDisplayMeta {
  switch (name) {
    case 'file_read':
      return { label: '读取文件', icon: <FileText size={13} /> }
    case 'file_write':
    case 'file_edit':
      return { label: '修改文件', icon: <FileText size={13} /> }
    case 'file_search':
    case 'grep_search':
    case 'list_dir':
      return { label: '检索文件', icon: <FileSearch size={13} /> }
    case 'shell_exec':
      return { label: '执行命令', icon: <Terminal size={13} /> }
    case 'web_search':
    case 'web_fetch':
      return { label: '检索网页', icon: <Globe size={13} /> }
    case 'image_generate':
      return { label: '生成图片', icon: <ImageIcon size={13} /> }
    case 'companion_take_photo':
      return { label: '拍一张照片', icon: <Camera size={13} /> }
    case 'companion_post_moment':
      return { label: '发布朋友圈', icon: <Newspaper size={13} /> }
    case 'companion_comment_moment':
      return { label: '评论朋友圈', icon: <Newspaper size={13} /> }
    case 'companion_read_world':
      return { label: '查看生活世界', icon: <Sparkles size={13} /> }
    case 'companion_create_asset':
    case 'companion_add_reading_note':
      return { label: '记录生活资料', icon: <BookOpen size={13} /> }
    case 'companion_change_wardrobe':
      return { label: '更换穿搭', icon: <Shirt size={13} /> }
    case 'companion_receive_gift':
      return { label: '收下礼物', icon: <Gift size={13} /> }
    case 'remember':
      return { label: '记下记忆', icon: <Sparkles size={13} /> }
    case 'recall':
      return { label: '回忆记忆', icon: <Sparkles size={13} /> }
    case 'forget':
      return { label: '遗忘记忆', icon: <Sparkles size={13} /> }
    default:
      return { label: name || '调用工具', icon: <Wrench size={13} /> }
  }
}

function summarizeToolArgs(args: Record<string, unknown>): string {
  const candidate = args.name ?? args.giftName ?? args.path ?? args.pattern ?? args.command ?? args.query ?? args.prompt ?? args.text ?? args.view
  if (typeof candidate !== 'string' || !candidate.trim()) return ''
  const trimmed = candidate.trim()
  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}…` : trimmed
}

export function ToolCallbackList({
  tools,
  onToggleCollapse,
  className = '',
  sessionId,
  readGeneratedImage,
  revealGeneratedImage,
  onNavigateToWorld,
  imagesOnly = false,
}: {
  tools: ToolCallbackItem[]
  onToggleCollapse: (callId: string) => void
  className?: string
  sessionId?: string | null
  readGeneratedImage?: GeneratedImageReader
  revealGeneratedImage?: GeneratedImageRevealer
  onNavigateToWorld?: (tab: 'moments' | 'culture' | 'wardrobe' | 'home' | 'footprints') => void
  /** 仅渲染工具产出的图片（用于多轮任务收起过程后把生成图直接留在终答外展示） */
  imagesOnly?: boolean
}) {
  const readImage = useCallback<GeneratedImageReader>(async (imageId) => {
    if (readGeneratedImage) return readGeneratedImage(imageId)
    if (!sessionId || !window.electronAPI?.session.readGeneratedImage) return { ok: false, error: '当前会话无法读取图片。' }
    return window.electronAPI.session.readGeneratedImage(sessionId, imageId)
  }, [sessionId, readGeneratedImage])
  const revealImage = useCallback<GeneratedImageRevealer>(async (imageId) => {
    if (revealGeneratedImage) return revealGeneratedImage(imageId)
    if (!sessionId || !window.electronAPI?.session.revealGeneratedImage) return { ok: false, error: '当前会话无法定位图片。' }
    return window.electronAPI.session.revealGeneratedImage(sessionId, imageId)
  }, [sessionId, revealGeneratedImage])
  if (tools.length === 0) return null

  if (imagesOnly) {
    const images = tools.flatMap((tool) => tool.generatedImages ?? [])
    if (images.length === 0) return null
    return (
      <div className={`space-y-2 ${className}`} data-testid="tool-generated-images">
        {images.map((image) => (
          <GeneratedImageResult
            key={image.id}
            image={image}
            readImage={readImage}
            revealImage={sessionId || revealGeneratedImage ? revealImage : undefined}
            scope={sessionId ?? 'preview'}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`space-y-0.5 ${className}`} data-callback="tool" data-testid="tool-callback-list">
      {tools.map((tool) => {
        const phase = toolItemPhase(tool.status)
        const collapsed = tool.collapsed !== false
        const meta = getToolDisplayMeta(tool.name)
        const argSummary = summarizeToolArgs(tool.args)
        const isActive = tool.status === 'pending' || tool.status === 'running'
        const isError = tool.status === 'error'
        return (
          <div key={tool.callId} data-phase={phase}>
            <ActionButton
              variant="plain"
              onClick={() => onToggleCollapse(tool.callId)}
              aria-expanded={!collapsed}
              className="-mx-1.5 w-[calc(100%+0.75rem)] !min-h-0 !justify-start gap-1.5 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-1 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
            >
              <span
                className={`shrink-0 ${isActive ? 'animate-pulse' : ''}`}
                style={{ color: isError ? 'var(--danger)' : isActive ? 'var(--accent-fg)' : 'var(--text-muted)' }}
              >
                {meta.icon}
              </span>
              <span
                className="shrink-0"
                style={{ color: isError ? 'var(--danger)' : 'var(--text-secondary)' }}
              >
                {meta.label}
              </span>
              {argSummary && (
                <span className="min-w-0 truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {argSummary}
                </span>
              )}
              {(isActive || isError) && (
                <span
                  className="ml-auto shrink-0 text-[11px]"
                  style={{ color: isError ? 'var(--danger)' : 'var(--accent-fg)' }}
                >
                  {STATUS_LABEL[tool.status]}
                </span>
              )}
              <ChevronRight
                size={12}
                className={`${isActive || isError ? '' : 'ml-auto'} shrink-0 transition-transform ${collapsed ? '' : 'rotate-90'}`}
                style={{ color: 'var(--text-muted)' }}
              />
            </ActionButton>
            {!collapsed && (
              <div
                className="mt-1 mb-2 space-y-2 rounded-[var(--radius-md)] px-3 py-2"
                style={{ background: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)' }}
              >
                {tool.name && tool.name !== meta.label && (
                  <div className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {tool.name}
                  </div>
                )}
                {tool.status === 'pending' && tool.streamingArgs && (
                  <pre
                    className="max-h-24 overflow-auto font-mono text-[11px] leading-5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {tool.streamingArgs}
                  </pre>
                )}
                {Object.keys(tool.args).length > 0 && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>参数</div>
                    <pre
                      className="max-h-28 overflow-auto font-mono text-[11px] leading-5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {JSON.stringify(tool.args, null, 2)}
                    </pre>
                  </div>
                )}
                {tool.result && (
                  <div>
                    <div className="mb-1 text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>结果</div>
                    <pre
                      className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5"
                      style={{ color: isError ? 'var(--danger)' : 'var(--text-secondary)' }}
                    >
                      {tool.result.slice(0, 2000)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {tool.name === 'companion_post_moment' && tool.status === 'done' && (
              <div
                className="my-1 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px]"
                style={{ background: 'color-mix(in srgb, var(--bg-secondary) 45%, transparent)' }}
                data-testid="tool-moment-card"
              >
                <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
                  {typeof tool.args?.text === 'string'
                    ? `「${tool.args.text.slice(0, 32)}${tool.args.text.length > 32 ? '…' : ''}」`
                    : '已发布一条新动态'}
                </span>
                {onNavigateToWorld && (
                  <ActionButton
                    variant="plain"
                    size="sm"
                    tone="accent"
                    onClick={() => onNavigateToWorld('moments')}
                    className="shrink-0"
                  >
                    去朋友圈查看
                  </ActionButton>
                )}
              </div>
            )}
            {tool.name === 'companion_create_asset' && tool.status === 'done' && (
              <div
                className="my-1 flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px]"
                style={{ background: 'color-mix(in srgb, var(--bg-secondary) 45%, transparent)' }}
                data-testid="tool-asset-card"
              >
                <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
                  {typeof tool.args?.name === 'string' ? `已收录《${tool.args.name}》` : '已存入人物世界'}
                </span>
                {onNavigateToWorld && (
                  <ActionButton
                    variant="plain"
                    size="sm"
                    tone="accent"
                    onClick={() => onNavigateToWorld(tool.args?.kind === 'culture' || tool.args?.kind === 'bookshelf' ? 'culture' : tool.args?.kind === 'wardrobe' ? 'wardrobe' : 'home')}
                    className="shrink-0"
                  >
                    去人物世界查看
                  </ActionButton>
                )}
              </div>
            )}
            {tool.generatedImages?.map((image) => (
              <div key={image.id} className="mt-1.5 mb-2">
                <GeneratedImageResult
                  image={image}
                  readImage={readImage}
                  revealImage={sessionId || revealGeneratedImage ? revealImage : undefined}
                  scope={sessionId ?? 'preview'}
                />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
