import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Copy, Download, X } from 'lucide-react'
import { IconButton } from './IconButton'

export interface ImageViewerItem {
  src: string
  alt: string
}

interface ImageViewerProps {
  items: readonly ImageViewerItem[]
  initialIndex?: number
  open: boolean
  onClose: () => void
}

const MIN_SCALE = 0.2
const MAX_SCALE = 10

/**
 * 背景：Chat、朋友圈和人物世界资产都会展示图片，若各自实现放大层，工具栏、键盘和遮罩行为会逐渐分叉。
 * 设计意图：Foundation 只提供统一的图片查看器；调用方只注入图片列表和关闭动作，不承载业务语义或数据读取。
 * 关键约束：图片容器必须先占位，预览层不影响底层布局；工具栏固定在底部，缩放和平移只改变图片变换。
 */
export function ImageViewer({ items, initialIndex = 0, open, onClose }: ImageViewerProps) {
  const [index, setIndex] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle')
  const [downloadState, setDownloadState] = useState<'idle' | 'success' | 'error'>('idle')
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const hasNavigation = items.length > 1

  useEffect(() => {
    if (!open) return
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)))
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setCopyState('idle')
    setDownloadState('idle')
  }, [initialIndex, items.length, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'ArrowLeft' && hasNavigation) {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (current - 1 + items.length) % items.length)
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }
      if (event.key === 'ArrowRight' && hasNavigation) {
        event.preventDefault()
        event.stopPropagation()
        setIndex((current) => (current + 1) % items.length)
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }
    }
    // 背景：图片预览打开时仍会收到 App 的全局 Escape，若由页面壳层先处理，关闭预览会连底层 Playground 样张一起卸载。
    // 设计意图：让 Foundation 预览器在捕获阶段消费自己的快捷键，而不是要求每个业务页面额外维护“预览已打开”的全局状态。
    // 关键约束：必须使用捕获阶段并在 Escape / 左右键上阻止后续传播；否则全局导航会抢先执行，导致预览关闭后的页面状态丢失。
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [hasNavigation, items.length, onClose, open])

  const move = useCallback((offsetValue: number) => {
    setIndex((current) => (current + offsetValue + items.length) % items.length)
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [items.length])

  const copy = useCallback(async () => {
    const item = items[index]
    if (!item) return
    try {
      const response = await fetch(item.src)
      const blob = await response.blob()
      if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('clipboard unavailable')
      // 背景：不同浏览器对 JPEG/WebP 的 ClipboardItem 支持不一致，图片来自生图、附件和 IPC 时格式也不固定。
      // 设计意图：复制动作统一转成 PNG，避免“预览能看但复制失败”依赖源文件 MIME；不另造业务侧格式分支。
      // 关键约束：转换失败必须进入可见失败态，不能把原始二进制伪装成 PNG 静默写入剪贴板。
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      bitmap.close()
      if (!png) throw new Error('image conversion failed')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      setCopyState('success')
    } catch {
      setCopyState('error')
    }
    window.setTimeout(() => setCopyState('idle'), 2000)
  }, [index, items])

  const download = useCallback(async () => {
    const item = items[index]
    if (!item) return
    try {
      const anchor = document.createElement('a')
      anchor.href = item.src
      anchor.download = item.alt || 'image'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      setDownloadState('success')
    } catch {
      setDownloadState('error')
    }
    window.setTimeout(() => setDownloadState('idle'), 2000)
  }, [index, items])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const multiplier = event.deltaY < 0 ? 1.1 : 0.9
    setScale((current) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, current * multiplier)))
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y }
    setDragging(true)
  }, [offset.x, offset.y])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setOffset({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY })
  }, [])

  const stopDragging = useCallback(() => {
    dragRef.current = null
    setDragging(false)
  }, [])

  if (!open || !items.length) return null
  const current = items[index] ?? items[0]

  const viewer = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/80 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      data-testid="image-viewer"
      onClick={onClose}
      onWheel={handleWheel}
    >
      <IconButton
        size={40}
        label="关闭图片预览"
        className="absolute right-4 top-4 z-10 rounded-full border border-white/15 bg-black/30 text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={onClose}
      >
        <X size={19} aria-hidden="true" />
      </IconButton>

      {hasNavigation && (
        <>
          <IconButton
            size={40}
            label="上一张图片"
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/30 text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={(event) => { event.stopPropagation(); move(-1) }}
          >
            <ChevronLeft size={23} aria-hidden="true" />
          </IconButton>
          <IconButton
            size={40}
            label="下一张图片"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 bg-black/30 text-white transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={(event) => { event.stopPropagation(); move(1) }}
          >
            <ChevronRight size={23} aria-hidden="true" />
          </IconButton>
        </>
      )}

      <div className="pointer-events-none relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden">
        <img
          src={current.src}
          alt={current.alt}
          className="pointer-events-auto max-h-[85vh] max-w-[85vw] select-none rounded-xl object-contain shadow-2xl"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: 'center center', transition: dragging ? 'none' : 'transform 100ms ease', cursor: dragging ? 'grabbing' : 'grab' }}
          draggable={false}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onPointerLeave={stopDragging}
          data-testid="image-viewer-image"
          onClick={(event) => event.stopPropagation()}
        />
        {hasNavigation && <div className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white/85">{index + 1} / {items.length}</div>}
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <div
          className="pointer-events-auto flex items-center gap-2 rounded-full border px-2 py-1.5 shadow-xl"
          style={{ borderColor: 'rgb(255 255 255 / 0.22)', background: 'rgb(24 24 27 / 0.94)' }}
          data-testid="image-viewer-toolbar"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={(event) => { event.stopPropagation(); void copy() }} className="flex h-8 w-[92px] select-none items-center justify-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/20 hover:text-white" data-testid="image-viewer-copy">
            {copyState === 'success' ? <><Check size={13} aria-hidden="true" />已复制</> : copyState === 'error' ? <><AlertCircle size={13} aria-hidden="true" />复制失败</> : <><Copy size={13} aria-hidden="true" />复制图片</>}
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); void download() }} className="flex h-8 w-[92px] select-none items-center justify-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/20 hover:text-white" data-testid="image-viewer-download">
            {downloadState === 'success' ? <><Check size={13} aria-hidden="true" />已保存</> : downloadState === 'error' ? <><AlertCircle size={13} aria-hidden="true" />保存失败</> : <><Download size={13} aria-hidden="true" />下载图片</>}
          </button>
        </div>
        <span className="select-none text-[11px] text-white/45">滚轮缩放 · 拖动移动 · Esc 或点击背景关闭</span>
      </div>
    </div>
  )
  return typeof document === 'undefined' ? null : createPortal(viewer, document.body)
}
