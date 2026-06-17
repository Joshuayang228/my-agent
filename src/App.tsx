import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, AgentStreamEvent } from './shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { SettingsPanel } from './components/SettingsPanel'
import { DevPanel } from './components/DevPanel'
import { MemoryPanel } from './components/MemoryPanel'
import { ToastProvider, useToast } from './components/Toast'
import { SkillsPanel } from './components/SkillsPanel'

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

interface ThinkingChunk {
  content: string
}

interface UsageInfo {
  promptTokens: number
  completionTokens: number
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function groupSessionsByDate(sessions: SessionSummary[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000

  const groups: { label: string; items: SessionSummary[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '更早', items: [] },
  ]

  for (const s of sessions) {
    if (s.updatedAt >= today) groups[0].items.push(s)
    else if (s.updatedAt >= yesterday) groups[1].items.push(s)
    else groups[2].items.push(s)
  }

  return groups.filter((g) => g.items.length > 0)
}

function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  })
  const [currentModel, setCurrentModel] = useState('gpt-4o')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean
    requestId: string
    name: string
    args: Record<string, unknown>
  } | null>(null)
  const [currentPersonaName, setCurrentPersonaName] = useState('温暖伙伴')
  const [thinking, setThinking] = useState<ThinkingChunk[]>([])
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showDevPanel, setShowDevPanel] = useState(false)
  const [showMemoryPanel, setShowMemoryPanel] = useState(false)
  const [showSkillsPanel, setShowSkillsPanel] = useState(false)
  const [eventLog, setEventLog] = useState<Array<{ time: number; type: string; detail: string }>>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([])
  const [dragOver, setDragOver] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [bgStreamingSessionId, setBgStreamingSessionId] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingSessionRef = useRef<string | null>(null)
  const { toast } = useToast()

  const MODEL_PRESETS = [
    { label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    { label: 'GPT-4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    { label: 'DeepSeek V4 Flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  ]

  useEffect(() => {
    if (!window.electronAPI) return
    loadSessions()
    window.electronAPI.settings.get().then((s) => {
      if (s.llmModel) setCurrentModel(s.llmModel)
      if (!s.llmApiKey) {
        setShowSettings(true)
        setTimeout(() => toast('欢迎！请先配置 API Key 以开始使用', 'warning'), 500)
      }
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
    setThinking([])
    setUsage(null)

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

  const commitRename = async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null)
      return
    }
    await window.electronAPI.session.rename(renamingId, renameValue.trim())
    setRenamingId(null)
    await loadSessions()
  }

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setShowDevPanel(v => !v)
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        createNewSession()
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setShowSettings(v => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setShowMemoryPanel(v => !v)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        setShowSkillsPanel(v => !v)
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(v => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 50)
          else setSearchQuery('')
          return !v
        })
      }
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); setSearchQuery('') }
        else {
          setShowDevPanel(false)
          setShowMemoryPanel(false)
          setShowSkillsPanel(false)
          setShowSettings(false)
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [createNewSession, searchOpen])

  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = () => setModelMenuOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [modelMenuOpen])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(scrollToBottom, [messages, activeTools, scrollToBottom])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus()
  }, [isStreaming])

  const handleEvent = useCallback((ev: AgentStreamEvent) => {
    const detail = ev.type === 'text' ? ev.content.slice(0, 80)
      : ev.type === 'tool_start' ? `${ev.name}(${JSON.stringify(ev.args).slice(0, 60)})`
      : ev.type === 'tool_end' ? `${ev.name} → ${ev.isError ? 'ERR' : 'OK'}`
      : ev.type === 'error' ? ev.message
      : ev.type === 'usage' ? `in:${ev.promptTokens} out:${ev.completionTokens}`
      : ev.type === 'thinking' ? ev.content.slice(0, 80)
      : ''
    setEventLog(prev => [...prev.slice(-500), { time: Date.now(), type: ev.type, detail }])

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

      case 'thinking':
        setThinking((prev) => [...prev, { content: ev.content }])
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

      case 'usage':
        setUsage({ promptTokens: ev.promptTokens, completionTokens: ev.completionTokens })
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

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || isStreaming) return

    let sid = activeSessionId
    if (!sid) {
      const session = await window.electronAPI.session.create()
      sid = session.id
      setActiveSessionId(sid)
      await loadSessions()
    }

    let fullContent = text
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => `\n\n--- 附件: ${f.name} ---\n${f.content}`).join('')
      fullContent = text + fileContext
      setAttachedFiles([])
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: fullContent,
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    streamingSessionRef.current = sid
    setBgStreamingSessionId(sid)
    setIsStreaming(true)
    setActiveTools([])
    setThinking([])
    setUsage(null)
    setThinkingExpanded(false)

    const cleanup = window.electronAPI.chat.onEvent((ev) => {
      const evSessionId = (ev as AgentStreamEvent & { sessionId?: string }).sessionId
      if (evSessionId && evSessionId !== streamingSessionRef.current) return
      handleEvent(ev)
      if (ev.type === 'done') {
        streamingSessionRef.current = null
        setBgStreamingSessionId(null)
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

  const handleFileAttach = async (files: FileList | File[]) => {
    const newFiles: Array<{ name: string; content: string }> = []
    for (const file of Array.from(files)) {
      if (file.size > 1024 * 1024) {
        toast(`文件 ${file.name} 超过 1MB 限制`, 'warning')
        continue
      }
      try {
        const text = await file.text()
        newFiles.push({ name: file.name, content: text })
      } catch {
        toast(`无法读取 ${file.name}`, 'error')
      }
    }
    if (newFiles.length > 0) setAttachedFiles(prev => [...prev, ...newFiles])
  }

  const submitEditedMessage = async (msgId: string) => {
    if (isStreaming || !editingContent.trim()) { setEditingMsgId(null); return }
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx < 0) { setEditingMsgId(null); return }
    const trimmed = messages.slice(0, idx)
    setEditingMsgId(null)
    setMessages(trimmed)
    sendMessage(editingContent.trim())
  }

  const regenerateLastResponse = async () => {
    if (isStreaming || !activeSessionId) return
    const lastAssistantIdx = messages.length - 1
    if (lastAssistantIdx < 0 || messages[lastAssistantIdx].role !== 'assistant') return
    const previousMessages = messages.slice(0, lastAssistantIdx)
    const lastUserMsg = [...previousMessages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    setMessages(previousMessages)
    sendMessage(lastUserMsg.content)
  }

  const copyToClipboard = async (text: string, msgId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(msgId)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const filteredSessions = sessionFilter
    ? sessions.filter(s => s.title.toLowerCase().includes(sessionFilter.toLowerCase()))
    : sessions
  const sessionGroups = groupSessionsByDate(filteredSessions)

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── 侧边栏 ── */}
      {sidebarOpen && (
        <div className="flex w-64 flex-col border-r" style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--sidebar-bg)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>会话列表</span>
              <button
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                className="rounded p-1 text-xs transition hover:bg-slate-700/50"
                style={{ color: 'var(--text-muted)' }}
                title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
            <button
              onClick={createNewSession}
              className="rounded-lg px-2 py-1 text-xs text-cyan-400 transition hover:bg-slate-800"
            >
              + 新建
            </button>
          </div>

          {sessions.length > 3 && (
            <div className="px-3 pb-2">
              <input
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                placeholder="搜索会话..."
                className="w-full rounded-md bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none ring-1 ring-slate-700 focus:ring-cyan-600/50"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2">
            {sessionGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {group.label}
                </div>
                {group.items.map((s) => (
                  <div
                    key={s.id}
                    className={`group mb-1 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                      s.id === activeSessionId
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                    onClick={() => switchSession(s.id)}
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.title) }}
                  >
                    {renamingId === s.id ? (
                      <input
                        className="w-full rounded bg-slate-700 px-1.5 py-0.5 text-sm text-white outline-none ring-1 ring-cyan-500/50"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="flex items-center gap-1.5 truncate">
                        {bgStreamingSessionId === s.id && s.id !== activeSessionId && (
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-400" title="AI 正在回复..." />
                        )}
                        {s.title}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      className="ml-1 hidden shrink-0 text-xs text-slate-600 transition hover:text-red-400 group-hover:block"
                    >
                      ✕
                    </button>
                  </div>
                ))}
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
          <span className="mr-3 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-400">
            {currentPersonaName}
          </span>
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

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSkillsPanel(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="Skill 管理 (Ctrl+Shift+K)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => setShowMemoryPanel(true)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="记忆管理"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6c0 1.887.87 3.568 2.23 4.668A2 2 0 017 14.562V16a2 2 0 002 2h2a2 2 0 002-2v-1.438a2 2 0 01.77-1.894A6 6 0 0010 2z" />
              </svg>
            </button>
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
        </div>

        {/* 搜索栏 */}
        {searchOpen && (
          <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/80 px-4 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索消息..."
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
            />
            {searchQuery && (
              <span className="text-xs text-slate-500">
                {messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length} 条匹配
              </span>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="text-slate-500 hover:text-slate-300">✕</button>
          </div>
        )}

        {/* 消息列表 */}
        <div
          ref={chatContainerRef}
          data-testid="chat-messages"
          className={`relative flex-1 overflow-y-auto px-4 py-6 ${dragOver ? 'ring-2 ring-inset ring-cyan-500/50' : ''}`}
          onScroll={(e) => {
            const el = e.currentTarget
            setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFileAttach(e.dataTransfer.files) }}
        >
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-24 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-3xl">
                  🤖
                </div>
                <h1 className="text-3xl font-bold text-white">My Agent</h1>
                <p className="mt-2 text-slate-400">有性格、有记忆、能成长的数字伙伴</p>

                <div className="mt-10 grid w-full max-w-md grid-cols-2 gap-3">
                  <button
                    onClick={sendQuickPrompt('你好，介绍一下你自己')}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800"
                  >
                    <span className="mb-1 block text-cyan-400">💬</span>
                    和我聊聊天
                  </button>
                  <button
                    onClick={sendQuickPrompt('现在几点了？')}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800"
                  >
                    <span className="mb-1 block text-cyan-400">🔧</span>
                    试试工具调用
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800"
                  >
                    <span className="mb-1 block text-cyan-400">⚙️</span>
                    配置模型
                  </button>
                  <button
                    onClick={sendQuickPrompt('帮我搜索一下最近的AI新闻')}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800"
                  >
                    <span className="mb-1 block text-cyan-400">🌐</span>
                    网页搜索
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isSearchMatch = searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase())
              const dimmed = searchQuery && !isSearchMatch
              return (
              <div
                key={msg.id}
                className={`animate-fade-in-up group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${dimmed ? 'opacity-25' : ''} ${isSearchMatch ? 'ring-1 ring-cyan-500/30 rounded-xl' : ''}`}
              >
                <div className="relative max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <>
                        <MarkdownRenderer content={msg.content} />
                        {isStreaming && msg === messages[messages.length - 1] && (
                          <span className="animate-typing-cursor ml-0.5 inline-block h-4 w-1 bg-cyan-400" />
                        )}
                      </>
                    ) : editingMsgId === msg.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          className="w-full resize-none rounded bg-cyan-700/50 px-2 py-1 text-sm text-white outline-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setEditingMsgId(null)} className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700">取消</button>
                          <button onClick={() => submitEditedMessage(msg.id)} className="rounded bg-cyan-500 px-2 py-0.5 text-xs text-white hover:bg-cyan-400">提交</button>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {/* 消息底部：时间戳 + 操作按钮 */}
                  <div className={`mt-1 flex items-center gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-[10px] text-slate-600">{formatTime(msg.timestamp)}</span>
                    {msg.role === 'user' && !isStreaming && editingMsgId !== msg.id && (
                      <button
                        onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content) }}
                        className="rounded px-1 py-0.5 text-[10px] text-slate-600 opacity-0 transition hover:text-slate-300 group-hover:opacity-100"
                        title="编辑"
                      >
                        ✎ 编辑
                      </button>
                    )}
                    {msg.role === 'assistant' && msg.content && (
                      <>
                        <button
                          onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="rounded px-1 py-0.5 text-[10px] text-slate-600 opacity-0 transition hover:text-slate-300 group-hover:opacity-100"
                          title="复制"
                        >
                          {copiedId === msg.id ? '✓ 已复制' : '复制'}
                        </button>
                        {messages[messages.length - 1]?.id === msg.id && !isStreaming && (
                          <button
                            onClick={() => regenerateLastResponse()}
                            className="rounded px-1 py-0.5 text-[10px] text-slate-600 opacity-0 transition hover:text-slate-300 group-hover:opacity-100"
                            title="重新生成"
                          >
                            ↻ 重新生成
                          </button>
                        )}
                      </>
                    )}
                    {!isStreaming && (
                      <button
                        onClick={async () => {
                          setMessages(prev => prev.filter(m => m.id !== msg.id))
                          await window.electronAPI?.session.deleteMessage(msg.id)
                        }}
                        className="rounded px-1 py-0.5 text-[10px] text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        title="删除此消息"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}

            {/* Thinking 区域 */}
            {thinking.length > 0 && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
                <button
                  onClick={() => setThinkingExpanded(!thinkingExpanded)}
                  className="flex w-full items-center gap-2 text-xs text-indigo-400"
                >
                  <span className={`transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`}>▶</span>
                  <span>思考过程</span>
                  {isStreaming && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />}
                </button>
                {thinkingExpanded && (
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-indigo-300/70">
                    {thinking.map((t) => t.content).join('')}
                  </pre>
                )}
              </div>
            )}

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

          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-6 z-10 rounded-full bg-slate-700/90 p-2 text-slate-300 shadow-lg transition hover:bg-slate-600 hover:text-white"
              title="回到底部"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 15.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* 底部信息栏 + 输入区域 */}
        <div className="border-t border-slate-700/50 bg-slate-900/80 px-4 py-4 backdrop-blur">
          {/* Token 用量 */}
          {usage && (
            <div className="mx-auto mb-2 flex max-w-3xl justify-end gap-3 text-[10px] text-slate-600">
              <span>输入 {(usage.promptTokens / 1000).toFixed(1)}k</span>
              <span>输出 {(usage.completionTokens / 1000).toFixed(1)}k</span>
              <span>合计 {((usage.promptTokens + usage.completionTokens) / 1000).toFixed(1)}k tokens</span>
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="mx-auto mb-1 flex max-w-3xl flex-wrap gap-1">
              {attachedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                  📎 {f.name}
                  <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(e) => {
                const files = e.clipboardData?.files
                if (files && files.length > 0) {
                  e.preventDefault()
                  handleFileAttach(files)
                }
              }}
              placeholder={attachedFiles.length > 0 ? '描述附件内容或输入问题...' : '输入消息... (Enter 发送, Shift+Enter 换行, 可拖拽/粘贴文件)'}
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
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                发送
              </button>
            )}
          </div>
        </div>
      </div>

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

      {showDevPanel && <DevPanel onClose={() => setShowDevPanel(false)} eventLog={eventLog} />}
      {showMemoryPanel && <MemoryPanel onClose={() => setShowMemoryPanel(false)} />}
      <SkillsPanel visible={showSkillsPanel} onClose={() => setShowSkillsPanel(false)} />

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

  function sendQuickPrompt(text: string) {
    return () => {
      setInput('')
      sendMessage(text)
    }
  }
}

function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

export default AppWithToast
