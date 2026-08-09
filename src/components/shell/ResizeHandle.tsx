/**
 * 面板分界拖动手柄（宽/高）
 */

import { useCallback, useRef } from 'react'

type Orientation = 'vertical' | 'horizontal'

interface ResizeHandleProps {
  /** vertical = 调宽度（左右拖）；horizontal = 调高度（上下拖） */
  orientation: Orientation
  /**
   * 指针移动增量（px）。
   * vertical：向右为正；horizontal：向下为正。
   */
  onDelta: (delta: number) => void
  className?: string
  title?: string
}

export function ResizeHandle({
  orientation,
  onDelta,
  className = '',
  title,
}: ResizeHandleProps) {
  const last = useRef<number | null>(null)
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    last.current = orientation === 'vertical' ? e.clientX : e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [orientation])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || last.current == null) return
    const pos = orientation === 'vertical' ? e.clientX : e.clientY
    const delta = pos - last.current
    if (delta === 0) return
    last.current = pos
    onDelta(delta)
  }, [orientation, onDelta])

  const end = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    last.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch { /* ignore */ }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const isVertical = orientation === 'vertical'

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      title={title || (isVertical ? '拖动调整宽度' : '拖动调整高度')}
      className={`resize-handle ${isVertical ? 'resize-handle-v' : 'resize-handle-h'} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    />
  )
}
