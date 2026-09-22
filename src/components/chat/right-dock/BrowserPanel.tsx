import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { IconButton } from '../../foundation/IconButton'
import { Button } from '../../foundation/Button'
import { EmptyState } from '../../foundation/EmptyState'
import { ErrorState } from '../../foundation/ErrorState'
import { TextField } from '../../foundation/TextField'

function toSandboxDocument(source: string): string {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:;">'
  if (source.includes('<head')) return source.replace('<head>', `<head>${policy}`)
  if (source.includes('<html')) return source.replace('<html>', `<html><head>${policy}</head>`)
  const escaped = source.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))
  return `<!doctype html><html><head>${policy}</head><body><pre>${escaped}</pre></body></html>`
}

export function BrowserPanel() {
  const [address, setAddress] = useState('https://example.com/')
  const [draft, setDraft] = useState(address)
  const [document, setDocument] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  const requestIdRef = useRef<string | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const requestId = requestIdRef.current
      if (requestId) void window.electronAPI.browser.cancel(requestId)
    }
  }, [])
  const load = async () => {
    const value = draft.trim()
    if (!value || loading) return
    const requestId = crypto.randomUUID()
    requestIdRef.current = requestId
    setLoading(true); setError(null)
    try {
      const result = await window.electronAPI.browser.load(value, requestId)
      if (!mountedRef.current || requestIdRef.current !== requestId) return
      if (!result.ok) { if (result.error !== '网页加载已取消') setError(result.error); return }
      setAddress(result.url); setDraft(result.url); setDocument(result.body)
    } catch {
      if (mountedRef.current && requestIdRef.current === requestId) setError('网页加载失败，请重试')
    } finally {
      if (requestIdRef.current === requestId) { requestIdRef.current = null; if (mountedRef.current) setLoading(false) }
    }
  }
  return <div className="flex h-full min-h-0 flex-col" data-testid="workspace-browser-panel">
    <form className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void load() }}>
      <TextField aria-label="浏览器地址" value={draft} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Escape') { setDraft(address); event.currentTarget.blur() } }} className="flex-1 text-center text-[11px]" />
      <IconButton type="submit" label={loading ? '正在加载' : '刷新页面'} size={24} disabled={loading} className="disabled:opacity-50" style={{ color: 'var(--text-muted)' }}>{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}</IconButton>
    </form>
    {error ? <ErrorState className="m-auto" title="网页加载失败" description={error} action={<Button tone="accent" onClick={() => { void load() }}>重新加载</Button>} /> : document == null ? <EmptyState className="m-auto" title="还没有网页内容" description="输入地址后加载网页" /> : <iframe title="网页内容" sandbox="" referrerPolicy="no-referrer" srcDoc={toSandboxDocument(document)} className="min-h-0 w-full flex-1 border-0" />}
  </div>
}
