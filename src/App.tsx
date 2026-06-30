import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, AgentStreamEvent, ImageAttachment } from './shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { SettingsPanel } from './components/SettingsPanel'
import { DevPanel } from './components/DevPanel'
import { MemoryPanel } from './components/MemoryPanel'
import { ToastProvider, useToast } from './components/Toast'
import { SkillsPanel } from './components/SkillsPanel'
import { FileBrowser } from './components/FileBrowser'
import MentionPopup from './components/MentionPopup'
import {
  Sun, Moon, MessageCircle, Wrench, Settings, Globe,
  Volume2, Paperclip, Shield, RefreshCw, Zap, Mic,
  Folder, FolderOpen, Ban, AlertTriangle, User,
  Plug, ChevronDown, ChevronRight, Square,
  Copy, Check, X, Pencil, RotateCcw, GitBranch, Trash2,
  Plus, Search, Cpu, Menu, ArrowDown, Brain, Code, Send,
  Pin, File,
} from 'lucide-react'

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
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
  streamingArgs?: string
  collapsed?: boolean
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
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolStatus[]>([])
  const [activeView, setActiveView] = useState<'chat' | 'skills' | 'memory' | 'settings'>('chat')
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || 'dark'
  })
  const [currentModel, setCurrentModel] = useState('gpt-4o')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [approvalMode, setApprovalMode] = useState<'confirm-all' | 'auto' | 'full-access'>('confirm-all')
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<{ path: string; name: string } | null>(null)
  const [recentProjects, setRecentProjects] = useState<{ path: string; name: string }[]>([])
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
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
  // showMemoryPanel / showSkillsPanel 已合并为 activeView
  const [eventLog, setEventLog] = useState<Array<{ time: number; type: string; detail: string }>>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([])
  const [dragOver, setDragOver] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sessionFilterRef = useRef<HTMLInputElement>(null)
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionAnchor, setMentionAnchor] = useState({ top: 0, left: 0 })
  const [mentionStartPos, setMentionStartPos] = useState(-1)
  const [mentionedFiles, setMentionedFiles] = useState<Array<{ name: string; path: string }>>([])
  const [bgStreamingSessionId, setBgStreamingSessionId] = useState<string | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [isListening, setIsListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
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
      if (s.executionMode) setApprovalMode(s.executionMode as 'confirm-all' | 'auto' | 'full-access')
      if (!s.llmApiKey) {
        setActiveView('settings')
        setTimeout(() => toast('欢迎！请先配置 API Key 以开始使用', 'warning'), 500)
      }
      try {
        const pinned = JSON.parse(s.pinnedSessions || '[]')
        if (Array.isArray(pinned)) setPinnedIds(pinned)
      } catch { /* ignore */ }
    })
    window.electronAPI.persona.getCurrent().then((p) => {
      if (p?.name) setCurrentPersonaName(p.name)
    })
    window.electronAPI.project.get().then((p) => {
      if (p) setCurrentProject(p)
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
    streamingSessionRef.current = null
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
        setActiveView('chat')
        createNewSession()
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setActiveView(v => v === 'settings' ? 'chat' : 'settings')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setActiveView(v => v === 'memory' ? 'chat' : 'memory')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        setActiveView(v => v === 'skills' ? 'chat' : 'skills')
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(v => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 50)
          else setSearchQuery('')
          return !v
        })
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        setSidebarOpen(v => !v)
      }
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); setSearchQuery('') }
        else if (activeView !== 'chat') { setActiveView('chat') }
        else {
          setShowDevPanel(false)
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [createNewSession, searchOpen])

  useEffect(() => {
    if (!modelMenuOpen && !approvalMenuOpen && !projectMenuOpen) return
    const handler = () => { setModelMenuOpen(false); setApprovalMenuOpen(false); setProjectMenuOpen(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [modelMenuOpen, approvalMenuOpen, projectMenuOpen])

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

      case 'tool_call_delta':
        setActiveTools((prev) => {
          const existing = prev.find((_, i) => i === ev.index)
          if (!existing) {
            return [...prev, {
              callId: ev.id || `pending-${ev.index}`,
              name: ev.name || '',
              args: {},
              status: 'pending' as const,
              streamingArgs: ev.argumentsDelta,
            }]
          }
          return prev.map((t, i) =>
            i === ev.index
              ? { ...t, streamingArgs: (t.streamingArgs || '') + ev.argumentsDelta, name: ev.name || t.name, callId: ev.id || t.callId }
              : t
          )
        })
        break

      case 'tool_calls':
        setMessages((prev) => [...prev, {
          id: genId(),
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
          toolCalls: ev.calls,
        }])
        break

      case 'tool_start':
        setActiveTools((prev) => [
          ...prev.filter(t => t.status !== 'pending' || t.callId !== ev.callId),
          { callId: ev.callId, name: ev.name, args: ev.args, status: 'running' },
        ])
        break

      case 'tool_end':
        setActiveTools((prev) =>
          prev.map((t) =>
            t.callId === ev.callId
              ? { ...t, status: ev.isError ? 'error' : 'done', result: ev.result, collapsed: true }
              : t,
          ),
        )
        setMessages((prev) => [...prev, {
          id: `tool-${ev.callId}`,
          role: 'tool' as const,
          content: ev.result,
          timestamp: Date.now(),
          toolCallId: ev.callId,
        }])
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

  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast?.('当前浏览器不支持语音识别', 'warning')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)()
    recognition.lang = 'zh-CN'
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }, [isListening, toast])

  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1.1
    window.speechSynthesis.speak(utterance)
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

    if (mentionedFiles.length > 0) {
      const fileContents: string[] = []
      for (const f of mentionedFiles) {
        try {
          const result = await window.electronAPI.project.readFile(f.path)
          if (result.content) {
            const truncated = result.content.length > 50000
              ? result.content.slice(0, 50000) + '\n\n[... 文件内容已截断，共 ' + result.content.length + ' 字符 ...]'
              : result.content
            fileContents.push(`<file path="${f.name}">\n${truncated}\n</file>`)
          } else if (result.error) {
            fileContents.push(`<file path="${f.name}">\n[读取失败: ${result.error}]\n</file>`)
          }
        } catch {
          fileContents.push(`<file path="${f.name}">\n[读取失败]\n</file>`)
        }
      }
      if (fileContents.length > 0) {
        fullContent = `<context>\n${fileContents.join('\n')}\n</context>\n\n${fullContent}`
      }
      setMentionedFiles([])
    }

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: fullContent,
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setPendingImages([])
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
      // IPC 竞态兜底：invoke resolve 可能先于最后一个 send 事件到达
      setIsStreaming(false)
      streamingSessionRef.current = null
      setBgStreamingSessionId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        if (file.size > 5 * 1024 * 1024) {
          toast('图片超过 5MB 限制', 'warning')
          continue
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          setPendingImages(prev => [...prev, {
            dataUrl,
            mimeType: file.type,
            fileName: file.name || 'pasted-image.png',
          }])
        }
        reader.readAsDataURL(file)
      }
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
  const pinnedSessions = filteredSessions.filter(s => pinnedIds.includes(s.id))
  const unpinnedSessions = filteredSessions.filter(s => !pinnedIds.includes(s.id))
  const sessionGroups = [
    ...(pinnedSessions.length > 0 ? [{ label: '置顶', items: pinnedSessions }] : []),
    ...groupSessionsByDate(unpinnedSessions),
  ]

  const togglePin = async (sessionId: string) => {
    const next = pinnedIds.includes(sessionId)
      ? pinnedIds.filter(id => id !== sessionId)
      : [...pinnedIds, sessionId]
    setPinnedIds(next)
    await window.electronAPI?.settings.set('pinnedSessions', JSON.stringify(next))
  }

  const regenerateTitle = async (sessionId: string) => {
    const result = await window.electronAPI?.session.regenerateTitle(sessionId)
    if (result?.success) {
      await loadSessions()
      toast('标题已重新生成', 'success')
    } else {
      toast(result?.error || '生成失败', 'error')
    }
  }

  const visibleMessages = messages.filter(m => {
    if (m.role === 'tool') return false
    if (m.role === 'assistant' && m.toolCalls?.length && !m.content) return false
    return true
  })

  const closeSettings = useCallback(() => {
    setActiveView('chat')
    if (window.electronAPI) {
      window.electronAPI.persona.getCurrent().then((p) => {
        if (p?.name) setCurrentPersonaName(p.name)
      })
      window.electronAPI.settings.get().then((s) => {
        if (s.llmModel) setCurrentModel(s.llmModel)
        if (s.executionMode) setApprovalMode(s.executionMode as 'confirm-all' | 'auto' | 'full-access')
      })
    }
  }, [])

  /* ── 设置独立全屏 ── */
  if (activeView === 'settings') {
    return (
      <div className="view-transition flex h-screen select-none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <SettingsPanel onClose={closeSettings} onOpenDevPanel={() => setShowDevPanel(true)} currentTheme={theme} onThemeChange={setTheme} />
      </div>
    )
  }

  return (
    <div className="flex h-screen select-none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── 侧边栏 ── */}
      {sidebarOpen && (
        <div className="flex w-[260px] shrink-0 flex-col border-r" style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--border-color)' }}>
          {/* 侧边栏顶部功能区 */}
          <div className="flex flex-col gap-0.5 px-2 pb-1 pt-3">
            <SidebarNavBtn onClick={createNewSession} icon={<Plus size={16} />} label="新对话" shortcut="Ctrl+N" />
            <SidebarNavBtn onClick={() => { setSidebarSearchOpen(v => !v); setTimeout(() => sessionFilterRef.current?.focus(), 50) }} icon={<Search size={16} />} label="搜索" />
            <SidebarNavBtn
              onClick={() => setActiveView(v => v === 'skills' ? 'chat' : 'skills')}
              icon={<Cpu size={16} />}
              label="技能"
              shortcut="Ctrl+Shift+K"
              active={activeView === 'skills'}
            />
          </div>

          <div className="mx-3 my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />

          {/* 会话列表标题 + 搜索 */}
          <div className="flex items-center justify-between px-4 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>对话</span>
          </div>
          {sidebarSearchOpen && (
            <div className="px-3 pb-2">
              <input
                ref={sessionFilterRef}
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { setSidebarSearchOpen(false); setSessionFilter('') } }}
                placeholder="搜索对话..."
                className="theme-input w-full rounded-md border px-2.5 py-1 text-xs outline-none"
              />
            </div>
          )}

          {/* 会话列表 */}
          <div className="scrollbar-thin flex-1 overflow-y-auto px-2">
            {sessionGroups.map((group) => (
              <div key={group.label}>
                <div className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  {group.label}
                </div>
                {group.items.map((s) => (
                  <div
                    key={s.id}
                    className="group mb-0.5 flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition"
                    style={{
                      background: s.id === activeSessionId ? 'var(--sidebar-active)' : 'transparent',
                      color: s.id === activeSessionId ? 'var(--accent-fg)' : 'var(--text-secondary)',
                    }}
                    onClick={() => { setActiveView('chat'); switchSession(s.id) }}
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.title) }}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, sessionId: s.id }) }}
                    onMouseEnter={(e) => { if (s.id !== activeSessionId) (e.currentTarget as HTMLDivElement).style.background = 'var(--sidebar-hover)' }}
                    onMouseLeave={(e) => { if (s.id !== activeSessionId) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    {renamingId === s.id ? (
                      <input
                        className="theme-input w-full rounded border px-1.5 py-0.5 text-[13px] outline-none"
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
                          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} title="AI 正在回复..." />
                        )}
                        {pinnedIds.includes(s.id) && <Pin size={10} style={{ color: 'var(--accent)' }} />}
                        {s.title}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                      className="ml-1 hidden shrink-0 transition group-hover:block"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {sessions.length === 0 && (
              <p className="px-2 pt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>暂无会话</p>
            )}
          </div>

          {/* 侧边栏底部 */}
          <div className="flex items-center justify-between border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <button
              onClick={() => setActiveView('settings')}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              title="设置 (Ctrl+,)"
            >
              <Settings size={16} style={{ color: 'var(--text-muted)' }} />
              设置
            </button>
            <div className="flex items-center gap-1">
              <SidebarBtn onClick={() => setActiveView(v => v === 'memory' ? 'chat' : 'memory')} title="记忆 (Ctrl+Shift+M)">
                <Brain size={14} />
              </SidebarBtn>
              <button
                onClick={() => {
                  const darkThemes = new Set(['dark', 'night-feast', 'blue-pool'])
                  setTheme(darkThemes.has(theme) ? 'light' : 'dark')
                }}
                className="flex h-7 w-7 items-center justify-center rounded text-xs transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                title="切换深色/浅色"
              >
                {['dark', 'night-feast', 'blue-pool'].includes(theme) ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 会话右键菜单 */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div
            className="absolute rounded-lg border py-1 shadow-lg"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              minWidth: 160,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: '重命名', action: () => { const s = sessions.find(s => s.id === contextMenu.sessionId); if (s) { setRenamingId(s.id); setRenameValue(s.title) }; setContextMenu(null) } },
              { label: pinnedIds.includes(contextMenu.sessionId) ? '取消置顶' : '置顶', action: () => { togglePin(contextMenu.sessionId); setContextMenu(null) } },
              { label: '重新生成标题', action: () => { regenerateTitle(contextMenu.sessionId); setContextMenu(null) } },
              { label: '删除', action: () => { deleteSession(contextMenu.sessionId); setContextMenu(null) }, danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="flex w-full items-center px-3 py-1.5 text-left text-[13px] transition"
                style={{ color: 'danger' in item && item.danger ? 'var(--danger)' : 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 主区域 ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶栏 */}
        <div className="flex h-12 shrink-0 items-center border-b px-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="mr-3 flex h-8 w-8 items-center justify-center rounded-md transition"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              title="展开侧边栏 (Ctrl+B)"
            >
              <Menu size={16} />
            </button>
          )}
          <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {sessions.find((s) => s.id === activeSessionId)?.title || 'My Agent'}
          </span>
          {currentProject && (
            <button
              onClick={() => setShowFileBrowser(v => !v)}
              className="mr-2 flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition"
              style={{
                color: showFileBrowser ? 'var(--accent-fg)' : 'var(--text-muted)',
                background: showFileBrowser ? 'var(--accent-subtle)' : undefined,
              }}
              onMouseEnter={(e) => { if (!showFileBrowser) e.currentTarget.style.background = 'var(--hover-overlay)' }}
              onMouseLeave={(e) => { if (!showFileBrowser) e.currentTarget.style.background = '' }}
              title="项目文件"
            >
              <Folder size={13} />
            </button>
          )}
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{currentPersonaName}</span>
        </div>

        {/* Tab 视图 — 技能/记忆等非聊天页 */}
        {activeView !== 'chat' && (
          <div className="view-transition flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg-primary)' }}>
              {activeView === 'skills' && (
                <SkillsPanel visible={true} onClose={() => setActiveView('chat')} />
              )}
              {activeView === 'memory' && (
                <MemoryPanel onClose={() => setActiveView('chat')} />
              )}
            </div>
          </div>
        )}

        {/* 搜索栏 */}
        {activeView === 'chat' && searchOpen && (
          <div className="flex h-9 items-center gap-2 border-b px-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索消息..."
              className="flex-1 bg-transparent text-[13px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {searchQuery && (
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {visibleMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).length} 条
              </span>
            )}
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} className="rounded p-0.5 text-xs transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}><X size={14} /></button>
          </div>
        )}

        {/* 消息列表 */}
        {activeView === 'chat' && <div
          ref={chatContainerRef}
          data-testid="chat-messages"
          className={`scrollbar-thin relative flex-1 select-text overflow-y-auto ${dragOver ? 'ring-2 ring-inset' : ''}`}
          style={dragOver ? { ['--tw-ring-color' as string]: 'var(--accent)' } as React.CSSProperties : {}}
          onScroll={(e) => {
            const el = e.currentTarget
            setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFileAttach(e.dataTransfer.files) }}
        >
          <div className="mx-auto max-w-3xl px-6 py-8">
            {/* 欢迎屏 */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-32 text-center">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                  我们应该构建什么？
                </h1>
                <div className="mt-10 flex flex-wrap justify-center gap-2">
                  {[
                    { icon: <MessageCircle size={14} />, label: '聊聊天', prompt: '你好，介绍一下你自己' },
                    { icon: <Wrench size={14} />, label: '试工具', prompt: '现在几点了？' },
                    { icon: <Settings size={14} />, label: '配置', action: () => setActiveView('settings') },
                    { icon: <Globe size={14} />, label: '搜索', prompt: '帮我搜索一下最近的AI新闻' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action || (() => sendMessage(item.prompt!))}
                      className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] transition"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 消息流 — Codex 风格 */}
            <div className="space-y-6">
              {visibleMessages.map((msg) => {
                const isSearchMatch = searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                const dimmed = searchQuery && !isSearchMatch
                const isUser = msg.role === 'user'

                return (
                  <div
                    key={msg.id}
                    className={`animate-fade-in-up group ${dimmed ? 'opacity-20' : ''} ${isSearchMatch ? 'rounded-md ring-1' : ''} ${isUser ? 'flex justify-end' : ''}`}
                    style={isSearchMatch ? { ['--tw-ring-color' as string]: 'var(--accent)', ['--tw-ring-opacity' as string]: '0.3' } as React.CSSProperties : {}}
                  >
                    {isUser ? (
                      /* ── 用户消息：右对齐气泡 ── */
                      <div className="relative max-w-[85%]">
                        {editingMsgId === msg.id ? (
                          <div className="flex flex-col gap-2 rounded-2xl border px-4 py-3" style={{ background: 'var(--msg-user-bg)', borderColor: 'var(--border-color)' }}>
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="theme-input w-full resize-none rounded border px-2 py-1 text-[13px] outline-none"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <button onClick={() => setEditingMsgId(null)} className="rounded px-2 py-0.5 text-xs transition" style={{ color: 'var(--text-secondary)' }}>取消</button>
                              <button onClick={() => submitEditedMessage(msg.id)} className="rounded px-2 py-0.5 text-xs font-medium text-white" style={{ background: 'var(--accent-emphasis)' }}>提交</button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed" style={{ background: 'var(--msg-user-bg)' }}>
                            {msg.images && msg.images.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {msg.images.map((img, i) => (
                                  <img key={i} src={img.dataUrl} alt={img.fileName || 'image'} className="max-h-48 max-w-xs rounded border" style={{ borderColor: 'var(--border-color)' }} />
                                ))}
                              </div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        )}
                        {/* hover 操作 */}
                        <div className="absolute -bottom-5 right-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          {!isStreaming && editingMsgId !== msg.id && (
                            <MsgBtn onClick={() => { setEditingMsgId(msg.id); setEditingContent(msg.content) }} title="编辑"><Pencil size={12} /></MsgBtn>
                          )}
                          {!isStreaming && (
                            <>
                              <MsgBtn onClick={async () => {
                                if (!activeSessionId) return
                                const forked = await window.electronAPI?.session.fork(activeSessionId, msg.id)
                                if (forked) {
                                  const list = await window.electronAPI?.session.list() || []
                                  setSessions(list)
                                  setActiveSessionId(forked.id)
                                  setMessages(forked.messages)
                                }
                              }} title="分支"><GitBranch size={12} /></MsgBtn>
                              <MsgBtn onClick={async () => {
                                setMessages(prev => prev.filter(m => m.id !== msg.id))
                                await window.electronAPI?.session.deleteMessage(msg.id)
                              }} title="删除" danger><Trash2 size={12} /></MsgBtn>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ── AI 消息：左对齐纯文本 ── */
                      <div className="relative max-w-full">
                        <div className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          <MarkdownRenderer content={msg.content} />
                          {isStreaming && msg === messages[messages.length - 1] && (
                            <span className="animate-typing-cursor ml-0.5 inline-block h-4 w-0.5" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                        {/* hover 操作 */}
                        <div className="absolute -bottom-5 left-0 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          {msg.content && (
                            <>
                              <MsgBtn onClick={() => copyToClipboard(msg.content, msg.id)} title="复制">
                                {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                              </MsgBtn>
                              <MsgBtn onClick={() => speakText(msg.content)} title="朗读"><Volume2 size={12} /></MsgBtn>
                              {messages[messages.length - 1]?.id === msg.id && !isStreaming && (
                                <MsgBtn onClick={() => regenerateLastResponse()} title="重新生成"><RotateCcw size={12} /></MsgBtn>
                              )}
                            </>
                          )}
                          {!isStreaming && (
                            <>
                              <MsgBtn onClick={async () => {
                                if (!activeSessionId) return
                                const forked = await window.electronAPI?.session.fork(activeSessionId, msg.id)
                                if (forked) {
                                  const list = await window.electronAPI?.session.list() || []
                                  setSessions(list)
                                  setActiveSessionId(forked.id)
                                  setMessages(forked.messages)
                                }
                              }} title="分支"><GitBranch size={12} /></MsgBtn>
                              <MsgBtn onClick={async () => {
                                setMessages(prev => prev.filter(m => m.id !== msg.id))
                                await window.electronAPI?.session.deleteMessage(msg.id)
                              }} title="删除" danger><Trash2 size={12} /></MsgBtn>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Thinking */}
            {thinking.length > 0 && (
              <div className="mt-4 rounded-md border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <button
                  onClick={() => setThinkingExpanded(!thinkingExpanded)}
                  className="flex w-full items-center gap-2 text-[11px] font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronRight size={12} className={`transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`} />
                  <span>思考过程</span>
                  {isStreaming && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />}
                </button>
                {thinkingExpanded && (
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {thinking.map((t) => t.content).join('')}
                  </pre>
                )}
              </div>
            )}

            {/* 工具卡片 — 可折叠 */}
            {activeTools.length > 0 && (
              <div className="mt-4 space-y-1">
                {activeTools.map((tool) => (
                  <div key={tool.callId} className="rounded-md border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <button
                      onClick={() => setActiveTools(prev => prev.map(t => t.callId === tool.callId ? { ...t, collapsed: !t.collapsed } : t))}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[12px]"
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                        tool.status === 'pending' ? 'animate-pulse' : ''
                      }`} style={{
                        background: tool.status === 'pending' || tool.status === 'running' ? 'var(--accent)'
                          : tool.status === 'error' ? 'var(--danger)' : 'var(--success)',
                      }} />
                      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{tool.name || '...'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {tool.status === 'pending' ? '解析参数...'
                          : tool.status === 'running' ? '执行中...'
                          : tool.status === 'error' ? '失败' : '完成'}
                      </span>
                      <ChevronRight size={12} className={`ml-auto transition-transform ${tool.collapsed ? '' : 'rotate-90'}`} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    {!tool.collapsed && (
                      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                        {tool.status === 'pending' && tool.streamingArgs && (
                          <pre className="max-h-24 overflow-auto font-mono text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {tool.streamingArgs}
                          </pre>
                        )}
                        {tool.result && (
                          <pre className="max-h-32 overflow-auto text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {tool.result.slice(0, 500)}
                          </pre>
                        )}
                      </div>
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
              className="absolute bottom-3 right-4 z-10 rounded-full border p-1.5 shadow transition"
              style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              title="回到底部"
            >
              <ArrowDown size={16} />
            </button>
          )}
        </div>}

        {/* 输入区 — Codex 风格居中卡片 */}
        {activeView === 'chat' && <div className="relative shrink-0 px-4 pb-4 pt-2" style={{ background: 'var(--bg-primary)' }}>
          <div className="mx-auto max-w-2xl">
            {/* 附件预览 */}
            {attachedFiles.length > 0 && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {attachedFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    <Paperclip size={11} /> {f.name}
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} className="transition" style={{ color: 'var(--text-muted)' }} onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')} onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            {pendingImages.length > 0 && (
              <div className="mb-1.5 flex gap-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="group relative">
                    <img src={img.dataUrl} alt={img.fileName || 'image'} className="h-14 w-14 rounded-lg border object-cover" style={{ borderColor: 'var(--border-color)' }} />
                    <button
                      onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] text-white group-hover:flex"
                      style={{ background: 'var(--danger)' }}
                    ><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {/* @mention 弹窗 */}
            {mentionOpen && (
              <MentionPopup
                query={mentionQuery}
                anchor={mentionAnchor}
                onSelect={(entry) => {
                  const before = input.slice(0, mentionStartPos - 1)
                  const after = input.slice(inputRef.current?.selectionStart ?? input.length)
                  const tag = `@${entry.name} `
                  setInput(before + tag + after)
                  setMentionedFiles(prev => {
                    if (prev.some(f => f.path === entry.path)) return prev
                    return [...prev, { name: entry.name, path: entry.path }]
                  })
                  setMentionOpen(false)
                  setTimeout(() => inputRef.current?.focus(), 0)
                }}
                onClose={() => setMentionOpen(false)}
              />
            )}

            {/* 输入卡片 */}
            <div className="relative rounded-xl border shadow-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--card-bg)' }}>
              {/* 引用文件标签 */}
              {mentionedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                  {mentionedFiles.map(f => (
                    <span
                      key={f.path}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]"
                      style={{ background: 'var(--hover-bg)', color: 'var(--accent-color)' }}
                    >
                      <File size={11} />
                      {f.name}
                      <button
                        onClick={() => setMentionedFiles(prev => prev.filter(x => x.path !== f.path))}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* 文本输入区 */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  const val = e.target.value
                  setInput(val)
                  const pos = e.target.selectionStart ?? val.length
                  const charBefore = val[pos - 1]
                  const charBeforeThat = pos >= 2 ? val[pos - 2] : ' '
                  if (charBefore === '@' && (charBeforeThat === ' ' || charBeforeThat === '\n' || pos === 1)) {
                    const rect = e.target.getBoundingClientRect()
                    const popupHeight = 260
                    setMentionAnchor({ top: Math.max(8, rect.top - popupHeight - 8), left: rect.left })
                    setMentionStartPos(pos)
                    setMentionQuery('')
                    setMentionOpen(true)
                  } else if (mentionOpen && mentionStartPos > 0) {
                    const query = val.slice(mentionStartPos, pos)
                    if (query.includes(' ') || query.includes('\n') || pos < mentionStartPos) {
                      setMentionOpen(false)
                    } else {
                      setMentionQuery(query)
                    }
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  handlePaste(e)
                  const files = e.clipboardData?.files
                  if (files && files.length > 0) {
                    const hasNonImage = Array.from(files).some(f => !f.type.startsWith('image/'))
                    if (hasNonImage) {
                      e.preventDefault()
                      handleFileAttach(Array.from(files).filter(f => !f.type.startsWith('image/')))
                    }
                  }
                }}
                placeholder={attachedFiles.length > 0 ? '描述附件内容或输入问题...' : '随心输入'}
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none bg-transparent px-4 pb-1 pt-3 text-[13.5px] outline-none disabled:opacity-50"
                style={{ color: 'var(--text-primary)', maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
              />

              {/* 工具栏 */}
              <div className="flex items-center justify-between px-3 pb-2 pt-0.5">
                <div className="flex items-center gap-1">
                  {/* 附件 */}
                  <button
                    onClick={() => {
                      const inp = document.createElement('input')
                      inp.type = 'file'
                      inp.multiple = true
                      inp.onchange = () => { if (inp.files) handleFileAttach(inp.files) }
                      inp.click()
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    title="添加附件"
                    ><Plus size={14} /></button>

                  <span className="mx-0.5 h-4 w-px" style={{ background: 'var(--border-subtle)' }} />

                  {/* 审批模式 */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setApprovalMenuOpen(!approvalMenuOpen) }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <span>{approvalMode === 'confirm-all' ? <Shield size={12} /> : approvalMode === 'auto' ? <RefreshCw size={12} /> : <Zap size={12} />}</span>
                      <span>{approvalMode === 'confirm-all' ? '请求批准' : approvalMode === 'auto' ? '替我审批' : '完全访问'}</span>
                      <ChevronDown size={9} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    {approvalMenuOpen && (
                      <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border py-1.5 shadow-lg" style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}>
                        <div className="px-3 pb-1.5 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>应如何批准操作？</div>
                        {([
                          { mode: 'confirm-all' as const, icon: <Shield size={14} />, label: '请求批准', desc: '编辑外部文件和使用互联网时始终询问' },
                          { mode: 'auto' as const, icon: <RefreshCw size={14} />, label: '替我审批', desc: '仅对检测到的风险操作请求批准' },
                          { mode: 'full-access' as const, icon: <Zap size={14} />, label: '完全访问权限', desc: '可不受限制地访问互联网和文件' },
                        ]).map((opt) => (
                          <button
                            key={opt.mode}
                            onClick={async (e) => {
                              e.stopPropagation()
                              setApprovalMode(opt.mode)
                              await window.electronAPI?.settings.set('executionMode', opt.mode)
                              setApprovalMenuOpen(false)
                            }}
                            className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition"
                            style={{ background: approvalMode === opt.mode ? 'var(--accent-subtle)' : undefined }}
                            onMouseEnter={(e) => { if (approvalMode !== opt.mode) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-overlay)' }}
                            onMouseLeave={(e) => { if (approvalMode !== opt.mode) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                          >
                            <span className="mt-0.5 text-sm">{opt.icon}</span>
                            <div>
                              <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                                {opt.label}
                                {approvalMode === opt.mode && <Check size={12} style={{ color: 'var(--accent-fg)' }} />}
                              </div>
                              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{opt.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* 模型选择 */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModelMenuOpen(!modelMenuOpen) }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      {MODEL_PRESETS.find((p) => p.model === currentModel)?.label || currentModel}
                      <ChevronDown size={9} style={{ color: 'var(--text-muted)' }} />
                    </button>
                    {modelMenuOpen && (
                      <div className="absolute bottom-full right-0 z-50 mb-1 w-44 rounded-lg border py-1 shadow-lg" style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}>
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
                            className="w-full px-3 py-1.5 text-left text-[12px] transition"
                            style={{
                              color: currentModel === p.model ? 'var(--accent-fg)' : 'var(--text-secondary)',
                              background: currentModel === p.model ? 'var(--accent-subtle)' : undefined,
                            }}
                            onMouseEnter={(e) => { if (currentModel !== p.model) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-overlay)' }}
                            onMouseLeave={(e) => { if (currentModel !== p.model) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 语音 */}
                  <button
                    onClick={toggleVoiceInput}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-sm transition ${isListening ? 'animate-pulse text-white' : ''}`}
                    style={isListening ? { background: 'var(--danger)' } : { color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => { if (!isListening) e.currentTarget.style.background = 'var(--hover-overlay)' }}
                    onMouseLeave={(e) => { if (!isListening) e.currentTarget.style.background = '' }}
                    title={isListening ? '停止录音' : '语音输入'}
                  ><Mic size={14} /></button>

                  {/* 发送/停止 */}
                  {isStreaming ? (
                    <button
                      onClick={() => window.electronAPI.chat.abort(activeSessionId || undefined)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white transition"
                      style={{ background: 'var(--danger)' }}
                      title="停止"
                    ><Square size={10} fill="currentColor" /></button>
                  ) : (
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                      style={{ background: 'var(--accent-emphasis)' }}
                      title="发送"
                    >
                      <Send size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 输入框下方信息栏：项目选择器 + Token 用量 */}
            <div className="mt-1.5 flex items-center justify-between px-1">
              {/* 项目选择器 */}
              <div className="relative">
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!projectMenuOpen) {
                      const list = await window.electronAPI?.project.list()
                      if (list) setRecentProjects(list)
                    }
                    setProjectMenuOpen(!projectMenuOpen)
                  }}
                  className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] transition"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <Folder size={12} style={{ color: 'var(--text-muted)' }} />
                  <span>{currentProject?.name || 'New project'}</span>
                  <ChevronDown size={9} style={{ color: 'var(--text-muted)' }} />
                </button>

                {projectMenuOpen && (
                  <div
                    className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border py-1 shadow-lg"
                    style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
                  >
                    <div className="px-3 pb-1.5 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>项目目录</div>

                    {recentProjects.map((proj) => (
                      <button
                        key={proj.path}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await window.electronAPI.project.set(proj.path)
                          setCurrentProject(proj)
                          setProjectMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition"
                        style={{
                          color: currentProject?.path === proj.path ? 'var(--accent-fg)' : 'var(--text-secondary)',
                          background: currentProject?.path === proj.path ? 'var(--accent-subtle)' : undefined,
                        }}
                        onMouseEnter={(e) => { if (currentProject?.path !== proj.path) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-overlay)' }}
                        onMouseLeave={(e) => { if (currentProject?.path !== proj.path) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                        title={proj.path}
                      >
                        <Folder size={12} />
                        <span className="truncate">{proj.name}</span>
                        {currentProject?.path === proj.path && <Check size={12} style={{ color: 'var(--accent-fg)' }} />}
                      </button>
                    ))}

                    <div className="mx-2 my-1 h-px" style={{ background: 'var(--border-subtle)' }} />

                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const result = await window.electronAPI.project.browse()
                        if (result) {
                          setCurrentProject(result)
                          const list = await window.electronAPI.project.list()
                          if (list) setRecentProjects(list)
                        }
                        setProjectMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <FolderOpen size={12} />
                      <span>添加新项目</span>
                    </button>

                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        await window.electronAPI.project.set(null)
                        setCurrentProject(null)
                        setProjectMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <Ban size={12} />
                      <span>不使用项目</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Token 用量（hover 显示） */}
              {usage && (
                <div className="flex gap-2 text-[10px] opacity-0 transition-opacity hover:opacity-100" style={{ color: 'var(--text-muted)' }}>
                  <span>↑{(usage.promptTokens / 1000).toFixed(1)}k</span>
                  <span>↓{(usage.completionTokens / 1000).toFixed(1)}k</span>
                  <span>Σ{((usage.promptTokens + usage.completionTokens) / 1000).toFixed(1)}k</span>
                </div>
              )}
            </div>
          </div>
        </div>}
      </div>

      {/* 文件浏览器面板 */}
      {showFileBrowser && (
        <div className="animate-slide-in-right w-[320px] shrink-0 border-l overflow-hidden" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          <FileBrowser projectPath={currentProject?.path || null} onClose={() => setShowFileBrowser(false)} />
        </div>
      )}

      {/* DevPanel 保留侧推（调试面板适合侧边查看） */}
      {showDevPanel && (
        <div className="animate-slide-in-right w-[380px] shrink-0 border-l overflow-y-auto" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          <DevPanel onClose={() => setShowDevPanel(false)} eventLog={eventLog} />
        </div>
      )}

      {/* Memory 和 Skills 已改为主区域 tab 视图，不再使用侧推面板 */}

      {/* 确认对话框 */}
      {confirmDialog?.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border p-5 shadow-2xl" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--warning)' }}><AlertTriangle size={14} /> 操作确认</h3>
            <p className="mb-3 text-[13px]" style={{ color: 'var(--text-secondary)' }}>AI 请求执行以下操作：</p>
            <div className="mb-4 rounded-md border px-3 py-2" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
              <div className="font-mono text-[13px]" style={{ color: 'var(--accent)' }}>{confirmDialog.name}</div>
              <pre className="mt-1.5 max-h-36 overflow-auto text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {JSON.stringify(confirmDialog.args, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { window.electronAPI.chat.confirmResponse(confirmDialog.requestId, false); setConfirmDialog(null) }}
                className="rounded-md border px-3 py-1.5 text-[13px] transition"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
              >拒绝</button>
              <button
                onClick={() => { window.electronAPI.chat.confirmResponse(confirmDialog.requestId, true); setConfirmDialog(null) }}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white transition"
                style={{ background: 'var(--warning)' }}
              >允许执行</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarNavBtn({ onClick, icon, label, shortcut, active }: { onClick: () => void; icon: React.ReactNode; label: string; shortcut?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition"
      style={{
        color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
        background: active ? 'var(--sidebar-active)' : undefined,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sidebar-hover)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = '' }}
      title={shortcut}
    >
      <span style={{ color: active ? 'var(--accent-fg)' : 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}

function SidebarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded transition"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--hover-overlay)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
      title={title}
    >{children}</button>
  )
}

function MsgBtn({ onClick, title, children, danger }: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-1 text-[10px] transition"
      style={{ color: 'var(--text-muted)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = danger ? 'var(--danger)' : 'var(--accent-fg)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
      title={title}
    >{children}</button>
  )
}

function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}

export default AppWithToast
