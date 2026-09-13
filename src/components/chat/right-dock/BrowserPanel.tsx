import { Globe, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'

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
  const load = async () => {
    const value = draft.trim()
    if (!value || loading) return
    setLoading(true); setError(null)
    try {
      const result = await window.electronAPI.browser.load(value)
      if (!result.ok) { setError(result.error); return }
      setAddress(result.url); setDraft(result.url); setDocument(result.body)
    } catch { setError('网页加载失败，请重试') }
    finally { setLoading(false) }
  }
  return <div className="flex h-full min-h-0 flex-col" data-testid="workspace-browser-panel">
    <form className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event) => { event.preventDefault(); void load() }}>
      <Globe size={14} style={{ color: 'var(--text-muted)' }} />
      <input aria-label="浏览器地址" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setDraft(address); event.currentTarget.blur() } }} className="min-w-0 flex-1 bg-transparent text-center text-[11px] outline-none" />
      <button type="submit" aria-label={loading ? '正在加载' : '刷新页面'} title={loading ? '正在加载' : '刷新页面'} disabled={loading} className="flex h-6 w-6 shrink-0 items-center justify-center rounded disabled:opacity-50" style={{ color: 'var(--text-muted)' }}>{loading ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
    </form>
    {error ? <div className="m-auto flex flex-col items-center gap-2 p-6 text-center"><p role="alert" className="text-[12px]" style={{ color: 'var(--danger)' }}>{error}</p><button type="button" className="rounded px-2 py-1 text-[11px]" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }} onClick={() => { void load() }}>重新加载</button></div> : document == null ? <div className="m-auto p-6 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>输入地址后加载网页</div> : <iframe title="网页内容" sandbox="" referrerPolicy="no-referrer" srcDoc={toSandboxDocument(document)} className="min-h-0 w-full flex-1 border-0" />}
  </div>
}
