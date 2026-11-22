/**
 * Tool 通道 UI：极简留白步骤流（无横线、无灰绿条、不写「已完成」、默认不摊开 JSON）。
 *
 * 背景：带框灰底手风琴表格与双色硬拼药丸在对话流中均过重；真实阅读时用户只想扫一眼自然语言步骤。
 * 设计意图：每一步只保留「柔和图标 + 一句自然人话」（仅进行中/失败标状态，朋友圈/生活资料右侧轻链接 `去查看`），
 * 行与行之间纯靠留白呼吸；点击某一行时在下方安静滑出紧凑输入/输出代码块；生成图片通过 `imagesOnly` 留在过程外展示。
 * 关键约束：保留 `data-callback="tool"`、`data-testid="tool-callback-list"`、`tool-moment-card`、`tool-asset-card`
 * 与 Foundation `ActionButton`。
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

interface ToolDisplayMeta {
  label: string
  icon: ReactNode
}

function getToolDisplayMeta(name: string): ToolDisplayMeta {
  switch (name) {
    case 'file_read':
      return { label: '读取了', icon: <FileText size={12} /> }
    case 'file_write':
    case 'file_edit':
      return { label: '修改了', icon: <FileText size={12} /> }
    case 'file_search':
    case 'grep_search':
    case 'list_dir':
      return { label: '检索了', icon: <FileSearch size={12} /> }
    case 'shell_exec':
      return { label: '执行了', icon: <Terminal size={12} /> }
    case 'web_search':
    case 'web_fetch':
      return { label: '检索网页', icon: <Globe size={12} /> }
    case 'image_generate':
      return { label: '生成了图片', icon: <ImageIcon size={12} /> }
    case 'companion_take_photo':
      return { label: '拍了一张照片', icon: <Camera size={12} /> }
    case 'companion_post_moment':
      return { label: '发布了朋友圈', icon: <Newspaper size={12} /> }
    case 'companion_comment_moment':
      return { label: '评论了朋友圈', icon: <Newspaper size={12} /> }
    case 'companion_read_world':
      return { label: '查看了生活世界', icon: <Sparkles size={12} /> }
    case 'companion_create_asset':
    case 'companion_add_reading_note':
      return { label: '记录了生活资料', icon: <BookOpen size={12} /> }
    case 'companion_change_wardrobe':
      return { label: '更换了穿搭', icon: <Shirt size={12} /> }
    case 'companion_receive_gift':
      return { label: '收下了礼物', icon: <Gift size={12} /> }
    case 'remember':
      return { label: '记下了记忆', icon: <Sparkles size={12} /> }
    case 'recall':
      return { label: '回忆了记忆', icon: <Sparkles size={12} /> }
    case 'forget':
      return { label: '遗忘了记忆', icon: <Sparkles size={12} /> }
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

export function ToolCallbackList({
  tools,
  onToggleCollapse,
  className = '',
  sessionId,
  readGeneratedImage,
  revealGeneratedImage,
  onNavigateToWorld,
  imagesOnly = false,
  embedded = false,
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
  /** 内嵌在多轮过程浅底容器内时，省略自身外底色 */
  embedded?: boolean
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
    <div
      className={`space-y-0.5 ${className}`}
      data-callback="tool"
      data-testid="tool-callback-list"
    >
      {tools.map((tool) => {
        const phase = toolItemPhase(tool.status)
        const collapsed = tool.collapsed !== false
        const meta = getToolDisplayMeta(tool.name)
        const argSummary = summarizeToolArgs(tool.args)
        const isActive = tool.status === 'pending' || tool.status === 'running'
        const isError = tool.status === 'error'
        const isMomentDone = tool.name === 'companion_post_moment' && tool.status === 'done'
        const isAssetDone = tool.name === 'companion_create_asset' && tool.status === 'done'
        const showWorldLink = Boolean(onNavigateToWorld && (isMomentDone || isAssetDone))
        const hasArgs = Object.keys(tool.args).length > 0
        const hasStreamingArgs = tool.status === 'pending' && Boolean(tool.streamingArgs)
        const hasResult = Boolean(tool.result)
        const handleWorldNavigate = () => {
          if (!onNavigateToWorld) return
          if (isMomentDone) {
            onNavigateToWorld('moments')
            return
          }
          onNavigateToWorld(
            tool.args?.kind === 'culture' || tool.args?.kind === 'bookshelf'
              ? 'culture'
              : tool.args?.kind === 'wardrobe'
                ? 'wardrobe'
                : 'home',
          )
        }

        return (
          <div
            key={tool.callId}
            data-phase={phase}
            data-testid={isMomentDone ? 'tool-moment-card' : isAssetDone ? 'tool-asset-card' : undefined}
          >
            <div className="group/row flex items-center">
              <ActionButton
                variant="plain"
                onClick={() => onToggleCollapse(tool.callId)}
                aria-expanded={!collapsed}
                className="-mx-1.5 min-w-0 flex-1 !min-h-0 !justify-start gap-2 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-0.5 text-left text-[12px] leading-5 hover:bg-[var(--hover-overlay)]"
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
                  <span className="min-w-0 truncate text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    {argSummary}
                  </span>
                )}
                {isActive && (
                  <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--accent-fg)' }}>
                    {tool.status === 'pending' ? '准备中…' : '进行中…'}
                  </span>
                )}
                {isError && (
                  <span className="ml-auto shrink-0 text-[11px]" style={{ color: 'var(--danger)' }}>
                    未通过
                  </span>
                )}
                <span
                  className={`${isActive || isError ? '' : 'ml-auto'} flex h-4 w-4 shrink-0 items-center justify-center transition-opacity ${
                    collapsed
                      ? 'opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100'
                      : 'opacity-100'
                  }`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}
                  />
                </span>
              </ActionButton>
            </div>
            {!collapsed && (hasStreamingArgs || hasArgs || hasResult || showWorldLink) && (
              <div
                className="scrollbar-thin mt-1 mb-2 space-y-2 rounded-[var(--radius-md)] border px-3 py-2 font-mono text-[11px] leading-5 backdrop-blur-[2px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'color-mix(in srgb, var(--card-bg) 40%, transparent)',
                  color: 'var(--text-secondary)',
                }}
              >
                {hasStreamingArgs && (
                  <pre className="scrollbar-thin max-h-24 overflow-auto" style={{ color: 'var(--text-muted)' }}>
                    {tool.streamingArgs}
                  </pre>
                )}
                {hasArgs && (
                  <pre className="scrollbar-thin max-h-28 overflow-auto" style={{ color: 'var(--text-muted)' }}>
                    {JSON.stringify(tool.args, null, 2)}
                  </pre>
                )}
                {hasResult && (
                  <pre
                    className={`scrollbar-thin max-h-32 overflow-auto whitespace-pre-wrap break-words ${hasArgs || hasStreamingArgs ? 'border-t pt-2' : ''}`}
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: isError ? 'var(--danger)' : 'var(--text-secondary)',
                    }}
                  >
                    {tool.result!.slice(0, 2000)}
                  </pre>
                )}
                {showWorldLink && (
                  <div
                    className={`flex justify-end font-sans ${hasStreamingArgs || hasArgs || hasResult ? 'border-t pt-1.5' : ''}`}
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <ActionButton
                      variant="plain"
                      onClick={handleWorldNavigate}
                      className="!min-h-0 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-0.5 text-[11px] hover:bg-[var(--hover-overlay)]"
                      style={{ color: 'var(--accent-fg)' }}
                    >
                      {isMomentDone ? '去朋友圈查看 →' : '去人物世界查看 →'}
                    </ActionButton>
                  </div>
                )}
              </div>
            )}
            {tool.generatedImages?.map((image) => (
              <div key={image.id} className="mt-2">
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
