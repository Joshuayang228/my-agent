import { useEffect, useRef, useState } from 'react'
import { FolderOpen, ImageOff, LoaderCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { ActionButton } from '../../foundation/ActionButton'
import { IconButton } from '../../foundation/IconButton'
import type { GeneratedImageReadResult, GeneratedImageReference, GeneratedImageRevealResult } from '../../../shared/types'

export type GeneratedImageReader = (imageId: string) => Promise<GeneratedImageReadResult>
export type GeneratedImageRevealer = (imageId: string) => Promise<GeneratedImageRevealResult>

type ImageState = { source: string; fileName: string; error?: never } | { error: string; source?: never; fileName?: never }

function ImageContent({ image, readImage, revealImage }: { image: GeneratedImageReference; readImage: GeneratedImageReader; revealImage?: GeneratedImageRevealer }) {
  const [result, setResult] = useState<ImageState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [decoded, setDecoded] = useState(false)
  const [original, setOriginal] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [revealNotice, setRevealNotice] = useState('')
  const revealPending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const reveal = async () => {
    if (!revealImage || revealPending.current) return
    revealPending.current = true
    setRevealing(true)
    setRevealNotice('')
    try {
      const value = await revealImage(image.id)
      if (mounted.current) setRevealNotice(value.ok ? '已请求在文件夹中定位。' : value.error)
    } catch { if (mounted.current) setRevealNotice('无法定位图片，请稍后重试。') }
    finally { revealPending.current = false; if (mounted.current) setRevealing(false) }
  }
  useEffect(() => {
    let active = true
    setResult(null)
    setDecoded(false)
    setOriginal(false)
    void Promise.resolve().then(() => active ? readImage(image.id) : null).then(value => {
      if (active && value) setResult(value.ok ? { source: value.dataUrl, fileName: value.fileName } : { error: value.error })
    }).catch(() => {
      if (active) setResult({ error: '图片暂时无法读取，请重试。' })
    })
    return () => { active = false }
  }, [image.id, readImage, attempt])

  const ratio = Number.isFinite(image.width) && Number.isFinite(image.height) && image.width > 0 && image.height > 0
    ? Math.min(4, Math.max(0.5, image.width / image.height)) : 1
  const loading = !result || (!!result.source && !decoded)
  return <figure className="min-w-0 border-t p-3" style={{ borderColor: 'var(--border-subtle)' }} data-testid="generated-image-result">
    <div className="relative w-full overflow-auto rounded" style={{ aspectRatio: ratio, minHeight: 128, maxHeight: 360, background: 'var(--bg-tertiary)' }} data-testid="generated-image-viewport" aria-busy={loading}>
      {result?.source && <img src={result.source} alt="生成的图片" width={image.width} height={image.height}
        className={original ? 'block max-w-none' : 'absolute inset-0 h-full w-full object-contain'}
        style={{ opacity: decoded ? 1 : 0 }}
        onLoad={() => setDecoded(true)} onError={() => { setDecoded(false); setResult({ error: '图片无法显示，请重新读取。' }) }} />}
      {loading && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}><LoaderCircle size={16} className="animate-spin" />正在读取图片</div>}
      {result?.error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-auto p-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
        <ImageOff size={20} /><p className="max-w-full break-words">{result.error}</p>
        <ActionButton onClick={() => setAttempt(value => value + 1)}><RefreshCw size={12} className="mr-1" />重新读取</ActionButton>
      </div>}
    </div>
    <figcaption className="mt-2 flex min-w-0 items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      <span className="min-w-0 flex-1 truncate" title={result?.fileName}>{result?.fileName || '生成图片'}</span>
      <span className="shrink-0">{image.width} × {image.height}</span>
      {revealImage && <IconButton label="在文件夹中定位" disabled={revealing || !result?.source || !decoded} onClick={() => { void reveal() }} className="disabled:opacity-40" aria-busy={revealing}>
        {revealing ? <LoaderCircle size={14} className="animate-spin" /> : <FolderOpen size={14} />}
      </IconButton>}
      <IconButton label={original ? '适应窗口' : '查看原图'} disabled={!result?.source || !decoded} onClick={() => setOriginal(value => !value)} aria-pressed={original} className="disabled:opacity-40">
        {original ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </IconButton>
    </figcaption>
    {revealNotice && <p role="status" className="mt-1 break-words text-[11px]" style={{ color: 'var(--text-muted)' }}>{revealNotice}</p>}
  </figure>
}

/** 会话切换必须卸载旧图片状态；不能在新引用首次 render 时闪现上一会话的图片。 */
export function GeneratedImageResult(props: { image: GeneratedImageReference; readImage: GeneratedImageReader; revealImage?: GeneratedImageRevealer; scope: string }) {
  return <ImageContent key={`${props.scope}:${props.image.id}`} image={props.image} readImage={props.readImage} revealImage={props.revealImage} />
}
