/**
 * Chat 附件展示与输入托盘（图片缩略图 + 结构化文件卡片）
 *
 * 背景：此前待发送的图片与文件飘在 `ChatComposer` 白色卡片外面且缩略图右上角常驻白底大删除圆钮，
 * 同时用户发出的文件消息没有结构化文件卡片样式，与 Alice 的卡片内一体化附件托盘存在明显落差。
 * 设计意图：借鉴 Alice 的「输入卡片内 `prefix` 一体化附件托盘 + 紧凑文件卡片」结构，
 * 结合本项目语义 token 与 Foundation `IconButton` / `ImagePreviewImage`：
 * 1. 图片缩略图（52×52）与文件卡片（同高 52px，左扩展名徽章 + 右两行文件名/大小）并排收纳在输入卡顶部；
 * 2. 移除按钮默认隐藏，仅在 hover / focus-within 时柔和浮现，不破坏画面纯净度；
 * 3. `ChatFileChip` 同时复用于「输入区待发」与「用户已发消息气泡」，保持收发视觉完全同源。
 * 关键约束：全部交互动作复用 Foundation `IconButton` 与 `ImagePreviewImage`；不硬编码品牌色或引入新依赖。
 */

import { FileCode2, FileSpreadsheet, FileText, X } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ImagePreviewImage } from '../foundation/ImagePreviewImage'

export interface ChatFileAttachmentView {
  id?: string
  name: string
  sizeBytes?: number
  ext?: string
}

export interface ChatImageAttachmentView {
  id?: string
  src: string
  fileName: string
}

function resolveExt(name: string, explicitExt?: string): string {
  if (explicitExt?.trim()) return explicitExt.trim().replace(/^\./, '').toUpperCase().slice(0, 4)
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return 'FILE'
  return name.slice(dot + 1).toUpperCase().slice(0, 4)
}

function formatByteSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileKindIcon(ext: string) {
  if (['TS', 'TSX', 'JS', 'JSX', 'JSON', 'PY', 'RS', 'GO', 'CSS', 'HTML'].includes(ext)) {
    return <FileCode2 size={15} aria-hidden="true" />
  }
  if (['CSV', 'XLS', 'XLSX'].includes(ext)) {
    return <FileSpreadsheet size={15} aria-hidden="true" />
  }
  return <FileText size={15} aria-hidden="true" />
}

/**
 * 统一文件附件卡片：
 * - 传入 `onRemove` 时为输入区待发态（右侧 hover/focus 浮现移除按钮）；
 * - 不传 `onRemove` 时为用户消息气泡内的已发只读态。
 */
export function ChatFileChip({
  file,
  onRemove,
  surface = 'composer',
}: {
  file: ChatFileAttachmentView
  onRemove?: () => void
  surface?: 'composer' | 'bubble'
}) {
  const ext = resolveExt(file.name, file.ext)
  const sizeText = formatByteSize(file.sizeBytes)
  const metaText = sizeText ? `${ext} · ${sizeText}` : ext

  return (
    <div
      className="group/file relative flex h-[52px] max-w-[220px] items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 transition-colors"
      style={{
        borderColor: 'var(--border-subtle)',
        background: surface === 'bubble' ? 'var(--bg-primary)' : 'var(--bg-secondary)',
      }}
      data-testid="chat-file-chip"
      title={file.name}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)]"
        style={{
          background: 'var(--accent-subtle)',
          color: 'var(--accent-fg)',
        }}
      >
        {fileKindIcon(ext)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium leading-4" style={{ color: 'var(--text-primary)' }}>
          {file.name}
        </div>
        <div className="mt-0.5 truncate text-[10px] leading-3.5" style={{ color: 'var(--text-muted)' }}>
          {metaText}
        </div>
      </div>
      {onRemove && (
        <IconButton
          label={`移除文件 ${file.name}`}
          size={24}
          onClick={onRemove}
          className="shrink-0 opacity-0 transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={12} />
        </IconButton>
      )}
    </div>
  )
}

/**
 * 输入区待发送图片缩略图（与 ChatFileChip 等高 52×52，移除角标仅 hover/focus 浮现）。
 */
export function ChatImageThumb({
  image,
  onRemove,
}: {
  image: ChatImageAttachmentView
  onRemove?: () => void
}) {
  return (
    <div
      className="group/img relative h-[52px] w-[52px] shrink-0"
      data-testid="chat-image-thumb"
      title={image.fileName}
    >
      <ImagePreviewImage
        src={image.src}
        alt={image.fileName}
        className="h-[52px] w-[52px] rounded-[var(--radius-md)] border object-cover"
        style={{ borderColor: 'var(--border-subtle)' }}
      />
      {onRemove && (
        <IconButton
          label={`移除图片 ${image.fileName}`}
          size={24}
          onClick={onRemove}
          className="!h-4 !w-4 !min-h-0 !min-w-0 absolute -right-1 -top-1 rounded-full opacity-0 shadow-sm transition-opacity group-hover/img:opacity-100 focus-visible:opacity-100"
          style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
        >
          <X size={10} />
        </IconButton>
      )}
    </div>
  )
}

/**
 * 输入卡片内部的统一附件托盘（放在 ChatComposer 的 `prefix` 槽内）。
 */
export function ChatAttachmentTray({
  images,
  files,
  onRemoveImage,
  onRemoveFile,
  testId = 'chat-attachment-tray',
}: {
  images: readonly ChatImageAttachmentView[]
  files: readonly ChatFileAttachmentView[]
  onRemoveImage?: (index: number) => void
  onRemoveFile?: (index: number) => void
  testId?: string
}) {
  if (images.length === 0 && files.length === 0) return null
  return (
    <div
      className="mb-1.5 flex flex-wrap items-center gap-2 border-b pb-2 pt-0.5"
      style={{ borderColor: 'var(--border-subtle)' }}
      data-testid={testId}
    >
      {images.map((img, idx) => (
        <ChatImageThumb
          key={img.id ?? `${img.fileName}-${idx}`}
          image={img}
          onRemove={onRemoveImage ? () => onRemoveImage(idx) : undefined}
        />
      ))}
      {files.map((file, idx) => (
        <ChatFileChip
          key={file.id ?? `${file.name}-${idx}`}
          file={file}
          onRemove={onRemoveFile ? () => onRemoveFile(idx) : undefined}
        />
      ))}
    </div>
  )
}
