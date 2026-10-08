import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { IconButton } from '../foundation/IconButton'
import { ImageViewer } from '../foundation/ImageViewer'
import type { GeneratedImageReadResult } from '../../shared/types'

export function MomentImageGrid({ momentId, imageIds, enabled }: { momentId: string; imageIds: readonly string[]; enabled: boolean }) {
  return <MomentImages key={`${momentId}:${imageIds.join(':')}`} momentId={momentId} imageIds={imageIds.slice(0, 9)} enabled={enabled} />
}

function MomentImages({ momentId, imageIds, enabled }: { momentId: string; imageIds: readonly string[]; enabled: boolean }) {
  const [results, setResults] = useState<Record<string, GeneratedImageReadResult>>({})
  const [decoded, setDecoded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const live = useRef(false)
  const grid = useRef<HTMLDivElement>(null)
  const pending = useRef(new Set<string>())
  const read = async (imageId: string) => {
    if (pending.current.has(imageId)) return
    pending.current.add(imageId)
    setResults(current => { const next = { ...current }; delete next[imageId]; return next })
    setDecoded(current => ({ ...current, [imageId]: false }))
    try {
      const result = await window.electronAPI.companion.readMomentImage(momentId, imageId)
      if (live.current) setResults(current => ({ ...current, [imageId]: result }))
    } catch {
      if (live.current) setResults(current => ({ ...current, [imageId]: { ok: false, error: '图片暂时无法读取，请重试。' } }))
    } finally { pending.current.delete(imageId) }
  }
  useEffect(() => {
    live.current = true
    let started = false
    const start = () => {
      if (started) return
      started = true
      for (const imageId of imageIds) void read(imageId)
    }
    // 动态可有多组原图；接近可见区域才读取，避免整页把所有 base64 同时留在内存。
    // ID 变化由外层 key 卸载旧请求，本轮只读固定集合，不触发生图或写入。
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { start(); observer?.disconnect() }
    }, { rootMargin: '200px' })
    if (observer && grid.current) observer.observe(grid.current)
    else start()
    return () => { live.current = false; observer?.disconnect() }
  }, [])
  const ready = imageIds.flatMap(id => {
    const result = results[id]
    return result?.ok && decoded[id] ? [{ id, src: result.dataUrl, alt: `动态图片 ${imageIds.indexOf(id) + 1}` }] : []
  })
  return <>
    <div ref={grid} className={`moments-alice-media mt-2.5 grid gap-1.5 ${imageIds.length === 1 ? 'grid-cols-1' : imageIds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} data-testid="moment-media">
      {imageIds.map((id, index) => {
        const result = results[id]
        return <div key={id} className="moments-alice-media-image relative w-full overflow-hidden" data-testid="moment-image-frame" aria-busy={!result || (result.ok && !decoded[id])}>
          {result?.ok && <button type="button" className="group block h-full w-full appearance-none border-0 bg-transparent p-0" disabled={!enabled || !decoded[id]} aria-label={`预览图片：动态图片 ${index + 1}`} onClick={() => setSelected(id)}>
            <img src={result.dataUrl} alt={`动态图片 ${index + 1}`} className="block h-full w-full object-cover" data-testid="moment-media-image" onLoad={() => setDecoded(current => ({ ...current, [id]: true }))} onError={() => setResults(current => ({ ...current, [id]: { ok: false, error: '图片无法显示，请重试。' } }))} />
            <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15 group-focus-visible:bg-black/15" />
          </button>}
          {!result || (result.ok && !decoded[id]) ? <span role="status" className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>正在读取图片</span> : !result.ok && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1 overflow-auto p-2 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span>{result.error}</span><IconButton label={`重新读取动态图片 ${index + 1}`} onClick={() => void read(id)}><RefreshCw size={14} /></IconButton>
          </div>}
        </div>
      })}
    </div>
    <ImageViewer items={ready} initialIndex={Math.max(0, ready.findIndex(item => item.id === selected))} open={selected !== null && ready.some(item => item.id === selected)} onClose={() => setSelected(null)} />
  </>
}
