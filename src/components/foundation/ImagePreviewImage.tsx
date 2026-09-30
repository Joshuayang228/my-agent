import { useState, type CSSProperties } from 'react'
import { ImageViewer, type ImageViewerItem } from './ImageViewer'

interface ImagePreviewImageProps {
  src: string
  alt: string
  className?: string
  buttonClassName?: string
  style?: CSSProperties
  width?: number
  height?: number
}

/**
 * 背景：正式 Chat、朋友圈和人物世界中的静态图片原先各自只是裸 img，点击行为无法统一回流。
 * 设计意图：Foundation 提供一个不改变图片尺寸的触发器，把预览状态和 ImageViewer 绑定在同一处，业务层只提供真实图片地址与替代文本。
 * 关键约束：按钮必须是 block 且保留图片原有尺寸；预览层只在点击后挂载，不能为图片列表增加额外高度或改变布局。
 */
export function ImagePreviewImage({ src, alt, className = '', buttonClassName = '', style, width, height }: ImagePreviewImageProps) {
  const [open, setOpen] = useState(false)
  const item: ImageViewerItem = { src, alt }
  return (
    <>
      <button
        type="button"
        aria-label={`预览图片：${alt}`}
        className={`group block min-w-0 appearance-none border-0 bg-transparent p-0 text-left ${buttonClassName}`}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} width={width} height={height} className={className} style={style} />
      </button>
      <ImageViewer items={[item]} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
