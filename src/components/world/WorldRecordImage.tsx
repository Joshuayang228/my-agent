import { useEffect, useRef, useState } from 'react'
import { FolderOpen, ImageOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ImageViewer } from '../foundation/ImageViewer'
import type { GeneratedImageReadResult, GeneratedImageReference, GeneratedImageRevealResult } from '../../shared/types'

export interface WorldRecordImageProps {
  assetId: string
  image: GeneratedImageReference
  alt: string
  mode?: 'preview' | 'thumbnail'
  readImage: (assetId: string, imageId: string) => Promise<GeneratedImageReadResult>
  revealImage?: (assetId: string, imageId: string) => Promise<GeneratedImageRevealResult>
}

/**
 * 背景：生活画廊的固定比例图片不能嵌套 Chat 的文件信息卡，也不能直接读取 payload 路径。
 * 设计意图：只使用受控资产媒体接口，图片状态与 Foundation 预览复用而展示保持无框。
 * 关键约束：资产 / 图片切换必须卸载旧内容；失败可重试，解码完成前不允许预览。
 */
export function WorldRecordImage(props: WorldRecordImageProps) {
  return <RecordImageContent key={`${props.assetId}:${props.image.id}`} {...props} />
}

function RecordImageContent({ assetId, image, alt, readImage, revealImage, mode = 'preview' }: WorldRecordImageProps) {
  const [result, setResult] = useState<GeneratedImageReadResult | null>(null)
  const [decoded, setDecoded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [revealing, setRevealing] = useState(false)
  const pending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let current = true
    setResult(null)
    setDecoded(false)
    void Promise.resolve().then(() => current ? readImage(assetId, image.id) : null).then(value => { if (current && value) setResult(value) }).catch(() => {
      if (current) setResult({ ok: false, error: '图片暂时无法读取，请重试。' })
    })
    return () => { current = false }
  }, [assetId, image.id, readImage, attempt])
  const reveal = async () => {
    if (!revealImage || pending.current) return
    pending.current = true
    setRevealing(true)
    try {
      const value = await revealImage(assetId, image.id)
      if (mounted.current) setNotice(value.ok ? '已请求在文件夹中定位。' : value.error)
    } catch { if (mounted.current) setNotice('无法定位图片，请重试。') }
    finally { pending.current = false; if (mounted.current) setRevealing(false) }
  }
  if (mode === 'thumbnail') return <div className="relative h-full w-full" data-testid="world-record-thumbnail">
    {result?.ok ? <img src={result.dataUrl} alt="" className="block h-full w-full object-cover" onError={() => setResult({ ok: false, error: '图片无法显示' })} />
      : <span className="absolute inset-0 flex items-center justify-center text-xs">{result ? '配图未能显示' : '正在读取图片'}</span>}
  </div>
  return <div className="relative h-full w-full" data-testid="world-record-image" aria-busy={!result || (result.ok && !decoded)}>
    {result?.ok && <button type="button" aria-label={`预览图片：${alt}`} disabled={!decoded} className="block h-full w-full appearance-none border-0 bg-transparent p-0" onClick={() => setOpen(true)}>
      <img src={result.dataUrl} alt={alt} className="block h-full w-full object-contain" style={{ opacity: decoded ? 1 : 0 }} onLoad={() => setDecoded(true)} onError={() => setResult({ ok: false, error: '图片无法显示，请重新读取。' })} />
    </button>}
    {!result || (result.ok && !decoded) ? <div role="status" className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}><LoaderCircle className="animate-spin" size={16} aria-label="正在读取图片" /></div> : !result.ok && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-auto p-2 text-center text-[11px]" style={{ color: 'var(--text-secondary)' }}>
      <ImageOff size={18} /><span>{result.error}</span><IconButton label="重新读取图片" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={14} /></IconButton>
    </div>}
    {decoded && result?.ok && revealImage && <IconButton label="在文件夹中定位" disabled={revealing} onClick={() => void reveal()} className="absolute bottom-1 right-1" style={{ background: 'var(--card-bg)' }}><FolderOpen size={14} /></IconButton>}
    {notice && <span role="status" className="absolute bottom-0 left-0 max-w-full bg-[var(--card-bg)] p-1 text-[10px]">{notice}</span>}
    {result?.ok && <ImageViewer items={[{ src: result.dataUrl, alt }]} open={open} onClose={() => setOpen(false)} />}
  </div>
}
