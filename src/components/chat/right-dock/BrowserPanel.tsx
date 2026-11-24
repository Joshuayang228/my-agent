import { Globe, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, FormEvent, KeyboardEvent } from 'react'
import { IconButton } from '../../foundation/IconButton'
import { Button } from '../../foundation/Button'
import { EmptyState } from '../../foundation/EmptyState'
import { ErrorState } from '../../foundation/ErrorState'
import { TextField } from '../../foundation/TextField'

export type BrowserPanelPreviewResolution =
  | { ok: true; address: string; state: 'ready' | 'empty'; documentHtml?: string; emptyDescription?: string }
  | { ok: false; error: string }

export interface BrowserPanelPreviewData {
  initialAddress: string
  initialState: 'ready' | 'loading' | 'error' | 'empty'
  documentHtml: string
  maxFrameWidth?: number
  iframeTitle?: string
  emptyDescription?: string
  errorTitle?: string
  errorDescription?: string
  resolveAddress?: (raw: string) => BrowserPanelPreviewResolution
}

function toSandboxDocument(source: string): string {
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:;">'
  if (source.includes('<head')) return source.replace('<head>', `<head>${policy}`)
  if (source.includes('<html')) return source.replace('<html>', `<html><head>${policy}</head>`)
  const escaped = source.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c))
  return `<!doctype html><html><head>${policy}</head><body><pre>${escaped}</pre></body></html>`
}

export function BrowserPanel({ previewData }: { previewData?: BrowserPanelPreviewData } = {}) {
  const [address, setAddress] = useState(() => previewData?.initialAddress ?? 'https://example.com/')
  const [draft, setDraft] = useState(() => previewData?.initialAddress ?? 'https://example.com/')
  const [document, setDocument] = useState<string | null>(() =>
    previewData ? (previewData.initialState === 'ready' ? previewData.documentHtml : null) : null,
  )
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() =>
    previewData?.initialState === 'error' ? (previewData.errorDescription ?? '无法打开此页面') : null,
  )
  const [addressError, setAddressError] = useState<string | null>(null)
  const [emptyDescription, setEmptyDescription] = useState<string>(() =>
    previewData?.emptyDescription ?? '输入地址后加载网页',
  )
  const [loading, setLoading] = useState(() => previewData?.initialState === 'loading')
  const [revision, setRevision] = useState(0)
  const mountedRef = useRef(true)
  const requestIdRef = useRef<string | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const requestId = requestIdRef.current
      if (!previewData && requestId) void window.electronAPI.browser.cancel(requestId)
    }
  }, [previewData])

  const load = async (forceReload = false) => {
    if (previewData) {
      if (forceReload && error) {
        setAddressError(null)
        setError(null)
        setLoading(false)
        setDocument(previewData.documentHtml)
        setRevision((value) => value + 1)
        return
      }
      if (previewData.resolveAddress) {
        const res = previewData.resolveAddress(draft)
        if (!res.ok) {
          setAddressError(res.error)
          return
        }
        setAddressError(null)
        setError(null)
        setLoading(false)
        setAddress(res.address)
        setDraft(res.address)
        if (res.state === 'empty') {
          setDocument(null)
          setEmptyDescription(res.emptyDescription ?? '没有可显示的本地页面样张。')
        } else {
          setDocument(res.documentHtml ?? previewData.documentHtml)
          setRevision((value) => value + 1)
        }
        return
      }
      setAddressError(null)
      setError(null)
      setLoading(false)
      setDocument(previewData.documentHtml)
      setRevision((value) => value + 1)
      return
    }
    const value = draft.trim()
    if (!value || loading) return
    const requestId = crypto.randomUUID()
    requestIdRef.current = requestId
    setAddressError(null)
    setLoading(true); setError(null)
    setRemoteUrl(null)
    try {
      const result = await window.electronAPI.browser.load(value, requestId)
      if (!mountedRef.current || requestIdRef.current !== requestId) return
      if (!result.ok) { if (result.error !== '网页加载已取消') setError(result.error); return }
      setAddress(result.url); setDraft(result.url); setDocument(result.body); setRemoteUrl(result.url); setRevision((r) => r + 1)
    } catch {
      if (mountedRef.current && requestIdRef.current === requestId) setError('网页加载失败，请重试')
    } finally {
      if (requestIdRef.current === requestId) { requestIdRef.current = null; if (mountedRef.current) setLoading(false) }
    }
  }

  return <div className="workspace-surface-paper flex h-full min-h-0 flex-col" data-testid="workspace-browser-panel">
    <form className="workspace-subtoolbar flex shrink-0 select-none items-center gap-2 border-b px-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void load() }}>
      <div className="flex flex-1 items-center gap-2 rounded-[var(--radius-input)] border px-2.5 py-1 transition focus-within:border-[var(--accent)]" style={{ borderColor: addressError ? 'color-mix(in srgb, var(--danger) 60%, var(--border-color))' : 'color-mix(in srgb, var(--border-color) 75%, transparent)', background: 'var(--card-bg)' }}>
        <Globe size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        <TextField
          appearance="embedded"
          aria-label="浏览器地址"
          aria-invalid={Boolean(addressError)}
          value={draft}
          maxLength={2048}
          spellCheck={false}
          autoComplete="off"
          onFocus={(event: FocusEvent<HTMLInputElement>) => event.target.select()}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              setDraft(address)
              setAddressError(null)
              event.currentTarget.blur()
            }
          }}
          className="flex-1 text-[12px]"
        />
      </div>
      <IconButton type="submit" label={loading ? '正在加载' : '刷新页面'} size={28} disabled={loading} className="disabled:opacity-50" style={{ color: 'var(--text-muted)' }}>
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      </IconButton>
    </form>
    {addressError && (
      <p role="alert" className="shrink-0 border-b px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--danger)' }}>
        {addressError}
      </p>
    )}
    {error ? (
      <div className="workspace-surface-stage flex min-h-0 flex-1 flex-col p-4">
        <ErrorState
          className="m-auto w-full max-w-md"
          title={previewData?.errorTitle ?? '网页加载失败'}
          description={error}
          action={<Button tone="accent" onClick={() => { void load(true) }}>重新加载</Button>}
        />
      </div>
    ) : loading && document == null ? (
      <div className="flex flex-1 items-center justify-center gap-2 text-[12px]" role="status" style={{ color: 'var(--text-secondary)' }}>
        <LoaderCircle size={16} className="animate-spin" />
        正在加载页面
      </div>
    ) : document == null ? (
      <div className="workspace-surface-stage flex min-h-0 flex-1 flex-col">
        <EmptyState
          variant="minimal"
          icon={<Globe size={18} />}
          title="还没有网页内容"
          description={emptyDescription}
        />
      </div>
    ) : (
      <iframe
        key={revision}
        title={previewData?.iframeTitle ?? '网页内容'}
        sandbox={previewData ? '' : 'allow-scripts'}
        referrerPolicy="no-referrer"
        src={remoteUrl ?? undefined}
        srcDoc={previewData ? document : undefined}
        onError={!previewData ? () => setError('网页无法在内置隔离框架中显示，请尝试用系统浏览器打开') : undefined}
        className="mx-auto min-h-0 w-full flex-1 border-0"
        style={{ maxWidth: previewData?.maxFrameWidth ?? '100%' }}
      />
    )}
  </div>
}
