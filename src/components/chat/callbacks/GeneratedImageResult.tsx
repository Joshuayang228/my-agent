import { useEffect, useState } from 'react'
import { ImageOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { ActionButton } from '../../foundation/ActionButton'
import { ImageViewer } from '../../foundation/ImageViewer'
import type { GeneratedImageReadResult, GeneratedImageReference, GeneratedImageRevealResult } from '../../../shared/types'

export type GeneratedImageReader = (imageId: string) => Promise<GeneratedImageReadResult>
export type GeneratedImageRevealer = (imageId: string) => Promise<GeneratedImageRevealResult>

type ImageState = { source: string; fileName: string; error?: never } | { error: string; source?: never; fileName?: never }

function ImageContent({ image, readImage }: { image: GeneratedImageReference; readImage: GeneratedImageReader; revealImage?: GeneratedImageRevealer }) {
  const [result, setResult] = useState<ImageState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [decoded, setDecoded] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  useEffect(() => {
    let active = true
    setResult(null)
    setDecoded(false)
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
  return <figure className="min-w-0 max-w-md overflow-hidden rounded-[var(--radius-md)]" data-testid="generated-image-result">
    <div className="relative w-full overflow-hidden rounded-[var(--radius-md)]" style={{ aspectRatio: ratio, minHeight: 128, maxHeight: 360, background: 'var(--bg-tertiary)' }} data-testid="generated-image-viewport" aria-busy={loading}>
      {result?.source && <button type="button" aria-label="预览生成的图片" className="absolute inset-0 block min-w-0 cursor-zoom-in appearance-none border-0 bg-transparent p-0 text-left" disabled={!decoded} onClick={() => setViewerOpen(true)}>
        <img src={result.source} alt="生成的图片" width={image.width} height={image.height}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: decoded ? 1 : 0 }}
          onLoad={() => setDecoded(true)} onError={() => { setDecoded(false); setResult({ error: '图片无法显示，请重新读取。' }) }} />
      </button>}
      {loading && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}><LoaderCircle size={16} className="animate-spin" />正在读取图片</div>}
      {result?.error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-auto p-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
        <ImageOff size={20} /><p className="max-w-full break-words">{result.error}</p>
        <ActionButton onClick={() => setAttempt(value => value + 1)}><RefreshCw size={12} className="mr-1" />重新读取</ActionButton>
      </div>}
    </div>
    {result?.source && <ImageViewer items={[{ src: result.source, alt: '生成的图片' }]} open={viewerOpen} onClose={() => setViewerOpen(false)} />}
  </figure>
}

/** 会话切换必须卸载旧图片状态；不能在新引用首次 render 时闪现上一会话的图片。 */
export function GeneratedImageResult(props: { image: GeneratedImageReference; readImage: GeneratedImageReader; revealImage?: GeneratedImageRevealer; scope: string }) {
  return <ImageContent key={`${props.scope}:${props.image.id}`} image={props.image} readImage={props.readImage} revealImage={props.revealImage} />
}
