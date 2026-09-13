import { ArrowUp, LoaderCircle, MessageCircle, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { AgentStreamEvent, ChatMessage, WorkspaceChatFocus } from '../../../shared/types'
import { MarkdownRenderer } from '../../MarkdownRenderer'
import { PermissionConfirmCard } from '../PermissionConfirmCard'
import { IconButton } from '../../foundation/IconButton'
import { TextField } from '../../foundation/TextField'

interface SideChatPanelProps {
  parentSessionId: string | null
  projectPath: string | null
  workspaceFocus?: WorkspaceChatFocus
}

export function SideChatPanel({ parentSessionId, projectPath, workspaceFocus }: SideChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [initializationAttempt, setInitializationAttempt] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<ChatMessage | null>(null)
  const [confirmRequest, setConfirmRequest] = useState<{ requestId: string; name: string; args: Record<string, unknown> } | null>(null)
  const sessionRef = useRef<string | null>(null)
  const draftRef = useRef(input)
  const lastSentRef = useRef<ChatMessage | null>(null)

  useEffect(() => { draftRef.current = input }, [input])

  useEffect(() => {
    let disposed = false
    let cleanup: (() => void) | undefined
    const start = async () => {
      try {
        const session = await window.electronAPI.session.createWorkspace()
        if (disposed) { await window.electronAPI.session.delete(session.id); return }
        sessionRef.current = session.id
        setSessionId(session.id)
        setLoading(false)
        cleanup = window.electronAPI.chat.onEvent((event) => {
          const streamEvent = event as AgentStreamEvent & { sessionId?: string }
          if (streamEvent.sessionId !== session.id) return
          if (streamEvent.type === 'text') setMessages((current) => appendAssistant(current, streamEvent.content))
          if (streamEvent.type === 'error') {
            setError(streamEvent.message)
            setRetryMessage(lastSentRef.current)
            setSending(false)
          }
          if (streamEvent.type === 'done') setSending(false)
        })
        const cleanupConfirm = window.electronAPI.chat.onConfirmRequest((data) => {
          if (data.sessionId === session.id) setConfirmRequest({ requestId: data.requestId, name: data.name, args: data.args })
        })
        const eventCleanup = cleanup
        cleanup = () => { eventCleanup?.(); cleanupConfirm() }
      } catch { if (!disposed) { setLoading(false); setError('侧边聊天暂时无法打开，请重试') } }
    }
    void start()
    return () => {
      disposed = true
      cleanup?.()
      const id = sessionRef.current
      sessionRef.current = null
      // 卸载不能等待 React 回调；由主进程负责取消并等候完整收尾，再删除临时会话。
      // 删除失败保留存储记录并记录诊断，不冒险在仍有写盘时强删。
      if (id) void window.electronAPI.session.delete(id).catch(() => {
        console.warn('侧边聊天清理失败，临时会话已保留')
      })
    }
  }, [parentSessionId, initializationAttempt])

  const send = async (messageToRetry?: ChatMessage) => {
    const id = sessionRef.current
    const content = messageToRetry?.content || draftRef.current.trim()
    if (!id || !content || sending) return
    const message = messageToRetry ?? { id: crypto.randomUUID(), role: 'user' as const, content, timestamp: Date.now() }
    lastSentRef.current = message
    if (!messageToRetry) setMessages((current) => [...current, message])
    setRetryMessage(null)
    setInput(''); draftRef.current = ''; setError(null); setSending(true)
    try { await window.electronAPI.chat.send(id, message, { parentSessionId: parentSessionId || undefined, projectPath: projectPath || undefined, focus: workspaceFocus }) }
    catch {
      if (sessionRef.current !== id) return
      setError('消息发送失败，请重试'); setRetryMessage(message); setSending(false)
    }
  }

  const stop = () => { const id = sessionRef.current; if (id) void window.electronAPI.chat.abort(id) }

  const retry = () => {
    if (loading) return
    setError(null)
    if (!sessionRef.current) {
      setLoading(true)
      setInitializationAttempt((attempt) => attempt + 1)
    } else void send(retryMessage ?? undefined)
  }

  return <div className="relative flex h-full min-h-0 flex-col" data-testid="workspace-sidechat-panel">
    <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <MessageCircle size={14} style={{ color: 'var(--text-muted)' }} /><span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>关于当前工作区</span>
    </div>
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3" data-testid="workspace-sidechat-messages">
      {loading && <div className="flex items-center gap-2 text-[11px]" role="status"><LoaderCircle size={13} className="animate-spin" />正在打开侧边聊天</div>}
      {!loading && messages.length === 0 && !error && <p className="py-10 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>从当前工作区开始聊聊</p>}
      {messages.map((message) => <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[90%] rounded-lg px-3 py-2 text-[12px]' : 'text-[12px] leading-6'} style={{ background: message.role === 'user' ? 'var(--bg-tertiary)' : undefined }}><MarkdownRenderer content={message.content} /></div>)}
      {sending && <div className="flex items-center gap-2 text-[11px]" role="status"><LoaderCircle size={13} className="animate-spin" />正在生成</div>}
      {error && <div className="flex items-center gap-2 text-[11px]" role="alert" style={{ color: 'var(--danger)' }}><span>{error}</span><button type="button" onClick={retry}>重试</button></div>}
    </div>
    <form className="flex items-end gap-2 border-t p-3" style={{ borderColor: 'var(--border-subtle)' }} onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void send() }}>
      <TextField multiline aria-label="侧边聊天消息" rows={2} placeholder="继续聊聊…" className="flex-1 resize-none" value={input} disabled={loading || !sessionId} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInput(event.target.value)} />
      <IconButton type="button" label={sending ? '停止生成' : '发送消息'} size={28} className="disabled:opacity-40" style={{ color: sending ? 'var(--danger)' : 'var(--accent-fg)', background: 'var(--accent-subtle)' }} disabled={loading || !sessionId || (!sending && !input.trim())} onClick={() => { if (sending) stop(); else void send() }}>{sending ? <Square size={14} /> : <ArrowUp size={14} />}</IconButton>
    </form>
    {confirmRequest && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-3">
      <PermissionConfirmCard
        toolName={confirmRequest.name}
        args={confirmRequest.args}
        queueLength={1}
        onDeny={() => { window.electronAPI.chat.confirmResponse(confirmRequest.requestId, false); setConfirmRequest(null) }}
        onAllow={() => { window.electronAPI.chat.confirmResponse(confirmRequest.requestId, true); setConfirmRequest(null) }}
      />
    </div>}
  </div>
}

function appendAssistant(messages: ChatMessage[], content: string): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (last?.role === 'assistant') return [...messages.slice(0, -1), { ...last, content: last.content + content }]
  return [...messages, { id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() }]
}
