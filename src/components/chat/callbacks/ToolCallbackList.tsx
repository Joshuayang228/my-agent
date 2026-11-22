/**
 * Tool 通道 UI：Alice 风格双段实底小胶囊 + 点击弹详情弹窗（与 ReasoningCallback 共用同一胶囊与弹窗规范）。
 *
 * 背景：在带氛围壁纸的 Chat 界面中，全宽大卡片过重、无框半透明字又会发虚发脏，原地展开大段 JSON 还会撑乱对话节奏。
 * 设计意图：每一步思考与工具调用均以自适应宽度的双段实底小胶囊呈现（左段动作名、右段单行摘要与可选跳转链接），
 * 点击胶囊弹出居中轻量详情弹窗（`Esc` 或点遮罩关闭）查看完整参数、输出或思考正文；
 * 生成的图片保留在折叠过程之外直接呈现。
 * 关键约束：保留 `data-callback="tool"`、`data-testid="tool-callback-list"`、`tool-moment-card`、`tool-asset-card`
 * 与 Foundation `ActionButton` / `IconButton`。
 */

import {
  BookOpen,
  Camera,
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
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GeneratedImageResult, type GeneratedImageReader, type GeneratedImageRevealer } from './GeneratedImageResult'
import type { ToolCallbackItem } from './types'
import { toolItemPhase } from './types'
import { ActionButton } from '../../foundation/ActionButton'
import { IconButton } from '../../foundation/IconButton'

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
      return { label: '读取文件', icon: <FileText size={12} /> }
    case 'file_write':
    case 'file_edit':
      return { label: '修改文件', icon: <FileText size={12} /> }
    case 'file_search':
    case 'grep_search':
    case 'list_dir':
      return { label: '检索文件', icon: <FileSearch size={12} /> }
    case 'shell_exec':
      return { label: '执行命令', icon: <Terminal size={12} /> }
    case 'web_search':
    case 'web_fetch':
      return { label: '检索网页', icon: <Globe size={12} /> }
    case 'image_generate':
      return { label: '生成图片', icon: <ImageIcon size={12} /> }
    case 'companion_take_photo':
      return { label: '拍一张照片', icon: <Camera size={12} /> }
    case 'companion_post_moment':
      return { label: '发布朋友圈', icon: <Newspaper size={12} /> }
    case 'companion_comment_moment':
      return { label: '评论朋友圈', icon: <Newspaper size={12} /> }
    case 'companion_read_world':
      return { label: '查看生活世界', icon: <Sparkles size={12} /> }
    case 'companion_create_asset':
    case 'companion_add_reading_note':
      return { label: '记录生活资料', icon: <BookOpen size={12} /> }
    case 'companion_change_wardrobe':
      return { label: '更换穿搭', icon: <Shirt size={12} /> }
    case 'companion_receive_gift':
      return { label: '收下礼物', icon: <Gift size={12} /> }
    case 'remember':
      return { label: '记下记忆', icon: <Sparkles size={12} /> }
    case 'recall':
      return { label: '回忆记忆', icon: <Sparkles size={12} /> }
    case 'forget':
      return { label: '遗忘记忆', icon: <Sparkles size={12} /> }
    default:
      return { label: name || '调用工具', icon: <Wrench size={12} /> }
  }
}

function summarizeToolArgs(args: Record<string, unknown>): string {
  const candidate = args.name ?? args.giftName ?? args.path ?? args.pattern ?? args.command ?? args.query ?? args.prompt ?? args.text ?? args.view
  if (typeof candidate !== 'string' || !candidate.trim()) return ''
  const trimmed = candidate.trim()
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed
}

/**
 * 统一的双段实底过程小胶囊（左段：图标 + 动作名；右段：单行摘要 + 可选状态/轻跳转）。
 * 与 `ReasoningCallback` 和 `ToolCallbackList` 共用，保证单轮与多轮视觉语言完全一致。
 */
export function ProcessStepCapsule({
  icon,
  label,
  preview,
  statusText,
  tone = 'normal',
  active = false,
  actionLabel,
  onAction,
  onClick,
  title,
  testId,
  dataPhase,
  dataCallback,
}: {
  icon: ReactNode
  label: string
  preview?: string
  statusText?: string
  tone?: 'normal' | 'error'
  active?: boolean
  actionLabel?: string
  onAction?: () => void
  onClick: () => void
  title?: string
  testId?: string
  dataPhase?: string
  dataCallback?: string
}) {
  const isError = tone === 'error'
  const hasRight = Boolean(preview || statusText || actionLabel)

  return (
    <div
      className="inline-flex max-w-full items-stretch overflow-hidden rounded-[15px] border transition-colors"
      style={{
        borderColor: isError ? 'color-mix(in srgb, var(--danger) 35%, var(--border-subtle))' : 'var(--border-subtle)',
        background: 'var(--card-bg)',
      }}
      data-testid={testId}
      data-phase={dataPhase}
      data-callback={dataCallback}
    >
      <ActionButton
        variant="plain"
        onClick={onClick}
        title={title}
        className="min-w-0 !min-h-0 !justify-start gap-0 rounded-none border-0 !p-0 text-left hover:brightness-[0.97]"
      >
        <span
          className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium"
          style={{
            background: isError
              ? 'color-mix(in srgb, var(--danger) 10%, var(--bg-secondary))'
              : 'var(--bg-secondary)',
            color: isError ? 'var(--danger)' : 'var(--text-secondary)',
          }}
        >
          <span className={`shrink-0 ${active ? 'animate-pulse' : ''}`} style={{ color: isError ? 'var(--danger)' : active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>
            {icon}
          </span>
          <span className="whitespace-nowrap">{label}</span>
        </span>
        {hasRight && (
          <span className="inline-flex min-w-0 items-center gap-2 px-2.5 py-1 text-[12px]">
            {preview && (
              <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>
                {preview}
              </span>
            )}
            {statusText && (
              <span
                className="shrink-0 text-[11px]"
                style={{ color: isError ? 'var(--danger)' : 'var(--accent-fg)' }}
              >
                {statusText}
              </span>
            )}
          </span>
        )}
      </ActionButton>
      {actionLabel && onAction && (
        <ActionButton
          variant="plain"
          onClick={onAction}
          className="shrink-0 !min-h-0 rounded-none border-0 border-l !px-2.5 !py-1 text-[11px] hover:bg-[var(--hover-overlay)]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--accent-fg)' }}
        >
          {actionLabel}
        </ActionButton>
      )}
    </div>
  )
}

/**
 * 居中轻量过程详情弹窗（用于查看完整思考过程或单步工具参数与结果）。
 */
export function ProcessDetailModal({
  open,
  title,
  subtitle,
  icon,
  statusText,
  tone = 'normal',
  onClose,
  children,
}: {
  open: boolean
  title: string
  subtitle?: string
  icon: ReactNode
  statusText?: string
  tone?: 'normal' | 'error'
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null
  const isError = tone === 'error'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="process-detail-modal"
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative flex max-h-[80vh] w-[600px] max-w-[92vw] flex-col overflow-hidden rounded-[var(--radius-lg)] border shadow-xl"
        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      >
        <div
          className="flex shrink-0 items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="shrink-0" style={{ color: isError ? 'var(--danger)' : 'var(--text-muted)' }}>
            {icon}
          </span>
          <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {title}
          </span>
          {subtitle && (
            <code
              className="truncate rounded px-1.5 py-0.5 font-mono text-[11px]"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              {subtitle}
            </code>
          )}
          {statusText && (
            <span
              className="shrink-0 text-[11px]"
              style={{ color: isError ? 'var(--danger)' : 'var(--text-muted)' }}
            >
              {statusText}
            </span>
          )}
          <div className="ml-auto">
            <IconButton label="关闭详情" size={28} onClick={onClose} style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
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
  onToggleCollapse?: (callId: string) => void
  className?: string
  sessionId?: string | null
  readGeneratedImage?: GeneratedImageReader
  revealGeneratedImage?: GeneratedImageRevealer
  onNavigateToWorld?: (tab: 'moments' | 'culture' | 'wardrobe' | 'home' | 'footprints') => void
  /** 仅渲染工具产出的图片（用于多轮任务收起过程后把生成图直接留在终答外展示） */
  imagesOnly?: boolean
}) {
  const [selectedTool, setSelectedTool] = useState<ToolCallbackItem | null>(null)
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

  const activeDetailMeta = selectedTool ? getToolDisplayMeta(selectedTool.name) : null

  return (
    <div className={`flex flex-col items-start gap-1.5 ${className}`} data-callback="tool" data-testid="tool-callback-list">
      {tools.map((tool) => {
        const phase = toolItemPhase(tool.status)
        const meta = getToolDisplayMeta(tool.name)
        const argSummary = summarizeToolArgs(tool.args)
        const isActive = tool.status === 'pending' || tool.status === 'running'
        const isError = tool.status === 'error'
        const isMomentDone = tool.name === 'companion_post_moment' && tool.status === 'done'
        const isAssetDone = tool.name === 'companion_create_asset' && tool.status === 'done'
        const actionLabel = isMomentDone && onNavigateToWorld
          ? '去查看'
          : isAssetDone && onNavigateToWorld
            ? '去查看'
            : undefined
        const handleAction = isMomentDone && onNavigateToWorld
          ? () => onNavigateToWorld('moments')
          : isAssetDone && onNavigateToWorld
            ? () => onNavigateToWorld(tool.args?.kind === 'culture' || tool.args?.kind === 'bookshelf' ? 'culture' : tool.args?.kind === 'wardrobe' ? 'wardrobe' : 'home')
            : undefined

        return (
          <div key={tool.callId} className="max-w-full space-y-2">
            <ProcessStepCapsule
              icon={meta.icon}
              label={meta.label}
              preview={argSummary || (tool.status === 'pending' && tool.streamingArgs ? tool.streamingArgs.slice(0, 40) : undefined)}
              statusText={isActive || isError ? STATUS_LABEL[tool.status] : undefined}
              tone={isError ? 'error' : 'normal'}
              active={isActive}
              actionLabel={actionLabel}
              onAction={handleAction}
              onClick={() => {
                onToggleCollapse?.(tool.callId)
                setSelectedTool(tool)
              }}
              title={argSummary ? `${meta.label} · ${argSummary}` : meta.label}
              testId={isMomentDone ? 'tool-moment-card' : isAssetDone ? 'tool-asset-card' : undefined}
              dataPhase={phase}
            />
            {tool.generatedImages?.map((image) => (
              <div key={image.id} className="w-full max-w-md">
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

      <ProcessDetailModal
        open={Boolean(selectedTool)}
        title={activeDetailMeta?.label ?? '工具详情'}
        subtitle={selectedTool && selectedTool.name !== activeDetailMeta?.label ? selectedTool.name : undefined}
        icon={activeDetailMeta?.icon ?? <Wrench size={14} />}
        statusText={selectedTool ? STATUS_LABEL[selectedTool.status] : undefined}
        tone={selectedTool?.status === 'error' ? 'error' : 'normal'}
        onClose={() => setSelectedTool(null)}
      >
        {selectedTool && (
          <div className="space-y-3">
            {selectedTool.status === 'pending' && selectedTool.streamingArgs && (
              <div>
                <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>流式参数</div>
                <pre
                  className="max-h-40 overflow-auto rounded-[var(--radius-md)] p-3 font-mono text-[12px] leading-5"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  {selectedTool.streamingArgs}
                </pre>
              </div>
            )}
            {Object.keys(selectedTool.args).length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>参数</div>
                <pre
                  className="max-h-60 overflow-auto rounded-[var(--radius-md)] p-3 font-mono text-[12px] leading-5"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  {JSON.stringify(selectedTool.args, null, 2)}
                </pre>
              </div>
            )}
            {selectedTool.result && (
              <div>
                <div className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>结果</div>
                <pre
                  className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] p-3 font-mono text-[12px] leading-5"
                  style={{
                    background: 'var(--bg-secondary)',
                    color: selectedTool.status === 'error' ? 'var(--danger)' : 'var(--text-secondary)',
                  }}
                >
                  {selectedTool.result.slice(0, 4000)}
                </pre>
              </div>
            )}
            {!selectedTool.result && Object.keys(selectedTool.args).length === 0 && !selectedTool.streamingArgs && (
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>暂无更多详情。</p>
            )}
          </div>
        )}
      </ProcessDetailModal>
    </div>
  )
}
