import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, AgentStreamEvent } from './shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { SettingsPanel } from './components/SettingsPanel'

let messageIdCounter = 0
function genId() {
  return `msg-${Date.now()}-${++messageIdCounter}`
}

interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

interface ToolStatus {
  callId: string
  name: string
  args: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  result?: string
}

function App() {
  // ── 会话状态 ──
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── 聊天状态 ──
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [currentModel, setCurrentModel] = useState('gpt-4o')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean
    requestId: string
    name: string
    args: Record<string, unknown>
  } | null>(null)
  const [currentPersonaName, setCurrentPersonaName] = useState('温暖伙伴')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const MODEL_PRESETS = [
    { label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    { label: 'GPT-4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    { label: 'DeepSeek V4 Flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  ]

  // ── 初始化：加载会话列表 + 当前模型 ──
  useEffect(() => {
    if (!window.electronAPI) return
    loadSessions()
    window.electronAPI.settings.get().then((s) => {
      if (s.llmModel) setCurrentModel(s.llmModel)
    })
    window.electronAPI.persona.getCurrent().then((p) => {
      if (p?.name) setCurrentPersonaName(p.name)
    })
  }, [])

  const loadSessions = async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.session.list()
    setSessions(list)
  }

  const createNewSession = async () => {
    const session = await window.electronAPI.session.create()
    await loadSessions()
    switchSession(session.id)
  }

  const switchSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return
    setActiveSessionId(sessionId)
    setMessages([])
    setActiveTools([])
    setInput('')
    setIsStreaming(false)

    const session = await window.electronAPI.session.get(sessionId)
    if (session) {
      setMessages(session.messages)
    }
  }

  const deleteSession = async (sessionId: string) => {
    await window.electronAPI.session.delete(sessionId)
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
    await loadSessions()
  }

  // ── 点击外部关闭菜单 ──
  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = () => setModelMenuOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [modelMenuOpen])

  // ── 滚动 & 焦点 ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, activeTools, scrollToBottom])

  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus()
  }, [isStreaming])

  // ── 事件处理 ──
  const handleEvent = useCallback((ev: AgentStreamEvent) => {
    switch (ev.type) {
      case 'text':
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role !== 'assistant') {
            return [...prev, { id: genId(), role: 'assistant', content: ev.content, timestamp: Date.now() }]
          }
          return [...prev.slice(0, -1), { ...last, content: last.content + ev.content }]
        })
        break

      case 'tool_start':
        setActiveTools((prev) => [
          ...prev,
          { callId: ev.callId, name: ev.name, args: ev.args, status: 'running' },
        ])
        break

      case 'tool_end':
        setActiveTools((prev) =>
          prev.map((t) =>
            t.callId === ev.callId
              ? { ...t, status: ev.isError ? 'error' : 'done', result: ev.result }
              : t,
          ),
        )
        break

      case 'error':
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            return [...prev.slice(0, -1), { ...last, content: `⚠️ ${ev.message}` }]
          }
          return [...prev, { id: genId(), role: 'assistant', content: `⚠️ ${ev.message}`, timestamp: Date.now() }]
        })
        setIsStreaming(false)
        break

      case 'done':
        setIsStreaming(false)
        setActiveTools([])
        break
    }
  }, [])

  // ── 发送消息 ──
  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    // 没有活跃会话则自动创建
    let sid = activeSessionId
    if (!sid) {
      const session = await window.electronAPI.session.create()
      sid = session.id
      setActiveSessionId(sid)
      await loadSessions()
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setIsStreaming(true)
    setActiveTools([])

    const cleanup = window.electronAPI.chat.onEvent((ev) => {
      handleEvent(ev)
      if (ev.type === 'done') {
        loadSessions()
      }
    })

    const cleanupConfirm = window.electronAPI.chat.onConfirmRequest((data) => {
      setConfirmDialog({ ...data, visible: true })
    })

    try {
      await window.electronAPI.chat.send(sid, updatedMessages)
    } finally {
      cleanup()
      cleanupConfirm()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      {/* ── 侧边栏 ── */}
      {sidebarOpen && (
        <div className="flex w-64 flex-col border-r border-slate-700/50 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-slate-300">会话列表</span>
            <button
              onClick={createNewSession}
              className="rounded-lg px-2 py-1 text-xs text-cyan-400 transition hover:bg-slate-800"
            >
              + 新建
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                  s.id === activeSessionId
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
                onClick={() => switchSession(s.id)}
              >
                <span className="truncate">{s.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                  className="hidden text-xs text-slate-600 transition hover:text-red-400 group-hover:block"
                >
                  ✕
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="px-3 pt-4 text-center text-xs text-slate-600">暂无会话</p>
            )}
          </div>
        </div>
      )}

      {/* ── 主聊天区 ── */}
      <div className="flex flex-1 flex-col">
        {/* 顶栏 */}
        <div className="flex items-center border-b border-slate-700/50 px-4 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-3 rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ☰
          </button>
          <span className="flex-1 text-sm text-slate-400">
            {sessions.find((s) => s.id === activeSessionId)?.title || 'My Agent'}
          </span>
          {/* 人格标识 */}
          <span className="mr-3 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-400">
            {currentPersonaName}
          </span>
          {/* 模型切换 */}
          <div className="relative mr-2">
            <button
              onClick={(e) => { e.stopPropagation(); setModelMenuOpen(!modelMenuOpen) }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-300"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {MODEL_PRESETS.find((p) => p.model === currentModel)?.label || currentModel}
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor"><path d="M3 5l3 3 3-3" /></svg>
            </button>
            {modelMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
                {MODEL_PRESETS.map((p) => (
                  <button
                    key={p.model}
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.electronAPI.settings.set('llmModel', p.model)
                      await window.electronAPI.settings.set('llmBaseUrl', p.baseUrl)
                      setCurrentModel(p.model)
                      setModelMenuOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs transition ${
                      currentModel === p.model
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            title="设置"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-32 text-center">
                <h1 className="text-3xl font-bold text-white">My Agent</h1>
                <p className="mt-2 text-slate-400">有性格、有记忆、能成长的数字伙伴</p>
                <p className="mt-6 text-sm text-slate-600">输入消息开始对话</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 text-slate-200'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <>
                    <MarkdownRenderer content={msg.content} />
                    {isStreaming && msg === messages[messages.length - 1] && !msg.content && (
                      <span className="inline-block h-4 w-1.5 animate-pulse bg-cyan-400" />
                    )}
                  </>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              </div>
            ))}

            {activeTools.length > 0 && (
              <div className="space-y-2">
                {activeTools.map((tool) => (
                  <div
                    key={tool.callId}
                    className="rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        tool.status === 'running' ? 'animate-pulse bg-amber-400'
                        : tool.status === 'error' ? 'bg-red-400'
                        : 'bg-emerald-400'
                      }`} />
                      <span className="font-mono text-slate-300">{tool.name}</span>
                      <span className="text-slate-500">
                        {tool.status === 'running' ? '执行中...' : tool.status === 'error' ? '失败' : '完成'}
                      </span>
                    </div>
                    {tool.result && (
                      <pre className="mt-2 overflow-x-auto text-xs text-slate-400">
                        {tool.result.slice(0, 500)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-slate-700/50 bg-slate-900/80 px-4 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
              style={{ maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
            />
            {isStreaming ? (
              <button
                onClick={() => window.electronAPI.chat.abort()}
                className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-red-500"
              >
                停止
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                发送
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && <SettingsPanel onClose={() => {
        setShowSettings(false)
        if (window.electronAPI) {
          window.electronAPI.persona.getCurrent().then((p) => {
            if (p?.name) setCurrentPersonaName(p.name)
          })
          window.electronAPI.settings.get().then((s) => {
            if (s.llmModel) setCurrentModel(s.llmModel)
          })
        }
      }} />}

      {/* 工具确认弹窗 */}
      {confirmDialog?.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-semibold text-amber-400">⚠ 操作确认</h3>
            <p className="mb-3 text-sm text-slate-300">
              AI 请求执行以下操作：
            </p>
            <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-3">
              <div className="text-sm font-mono text-cyan-400">{confirmDialog.name}</div>
              <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-400">
                {JSON.stringify(confirmDialog.args, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  window.electronAPI.chat.confirmResponse(confirmDialog.requestId, false)
                  setConfirmDialog(null)
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                拒绝
              </button>
              <button
                onClick={() => {
                  window.electronAPI.chat.confirmResponse(confirmDialog.requestId, true)
                  setConfirmDialog(null)
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500"
              >
                允许执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
