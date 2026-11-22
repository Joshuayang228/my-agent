import { useEffect, useState } from 'react'
import { ImageOff, LoaderCircle, RefreshCw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ImageViewer } from '../foundation/ImageViewer'
import type { GeneratedImageReadResult, GeneratedImageReference, GeneratedImageRevealResult } from '../../shared/types'

export interface WorldRecordImageProps {
  assetId: string
  image: GeneratedImageReference
  alt: string
  mode?: 'preview' | 'thumbnail'
  readImage: (assetId: string, imageId: string) => Promise<GeneratedImageReadResult>
  /** 保留可选签名以兼容既有调用方；人物世界生活面不再在图片角标暴露本地文件夹定位按钮。 */
  revealImage?: (assetId: string, imageId: string) => Promise<GeneratedImageRevealResult>
}

/**
 * 背景：生活画廊的固定比例图片不能嵌套 Chat 的文件信息卡，也不能直接读取 payload 路径；
 * 此前图片右下角叠放的「在文件夹中定位」按钮破坏了生活画廊的纯净观感，且与 Playground 样张不一致。
 * 设计意图：只使用受控资产媒体接口，图片状态与 Foundation 预览复用而展示保持纯粹无角标。
 * 关键约束：资产 / 图片切换必须卸载旧内容；失败可重试，解码完成前不允许预览。
 */
export function WorldRecordImage(props: WorldRecordImageProps) {
  return <RecordImageContent key={`${props.assetId}:${props.image.id}`} {...props} />
}

function RecordImageContent({ assetId, image, alt, readImage, mode = 'preview' }: WorldRecordImageProps) {
  const [result, setResult] = useState<GeneratedImageReadResult | null>(null)
  const [decoded, setDecoded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let current = true
    setResult(null)
    setDecoded(false)
    void Promise.resolve().then(() => current ? readImage(assetId, image.id) : null).then(value => { if (current && value) setResult(value) }).catch(() => {
      if (current) setResult({ ok: false, error: '图片暂时无法读取，请重试。' })
    })
    return () => { current = false }
  }, [assetId, image.id, readImage, attempt])
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
    {result?.ok && <ImageViewer items={[{ src: result.dataUrl, alt }]} open={open} onClose={() => setOpen(false)} />}
  </div>
}
