import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage, AgentStreamEvent, ImageAttachment, MemoryCitation } from './shared/types'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { SettingsPanel } from './components/SettingsPanel'
import { DevPanel } from './components/DevPanel'
import { PlaygroundPage } from './components/PlaygroundPage'
import { MemoryPanel } from './components/MemoryPanel'
import { CompanionSceneBackdrop } from './components/CompanionSceneBackdrop'
import { ToastProvider, useToast } from './components/Toast'
import { SkillsPanel } from './components/SkillsPanel'
import { FileBrowser } from './components/FileBrowser'
import MentionPopup from './components/MentionPopup'
import { MemoryCitationChips } from './components/chat/MemoryCitationChips'
import { PermissionConfirmCard } from './components/chat/PermissionConfirmCard'
import {
  Volume2, Paperclip, Shield, RefreshCw, Zap,
  Folder, FolderOpen, Ban,
  ChevronDown, Square,
  Copy, Check, X, Pencil, RotateCcw, GitBranch, Trash2,
  Plus, Search, Menu, Send, File,
} from 'lucide-react'
import { buildColdStartCopy } from './shared/companion-presence'
import {
  ReasoningCallback,
  ToolCallbackList,
  ContentCallbackCue,
  contentPhase,
  applyReasoningEvent,
  applyContentEvent,
  applyToolEvent,
  appendToolResultMessage,
  resetReasoning,
  completeReasoning,
  findLiveToolHostId,
  resolveToolsForAssistant,
  type ReasoningCallbackState,
  type ToolCallbackItem,
} from './components/chat/callbacks'
import { ConversationDebugOverlay } from './components/chat/ConversationDebugOverlay'
import { parseConversationDebugMode } from './components/chat/conversation-debug'
import {
  PrimarySidebar,
  SecondaryNav,
  WorldHub,
  isWorldView,
  worldTabFromView,
  formatSessionPreview,
  type ShellView,
  type WorldTab,
} from './components/shell'

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
  roleId?: string
  sessionKind?: 'main' | 'summon'
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
  const [activeTools, setActiveTools] = useState<ToolCallbackItem[]>([])
  const [activeView, setActiveView] = useState<ShellView>('chat')
  const [worldTab, setWorldTab] = useState<WorldTab>('moments')
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || 'mist'
  })
  const [currentModel, setCurrentModel] = useState('gpt-4o')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [approvalMode, setApprovalMode] = useState<'confirm-all' | 'auto' | 'full-access'>('confirm-all')
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false)
  const [modeChangeNotice, setModeChangeNotice] = useState<string | null>(null)
  const [currentProject, setCurrentProject] = useState<{ path: string; name: string } | null>(null)
  const [recentProjects, setRecentProjects] = useState<{ path: string; name: string }[]>([])
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  /** 确认请求串行队列（M12-C4）：并发 tool_confirm 不得互相覆盖 */
  const [confirmQueue, setConfirmQueue] = useState<Array<{
    requestId: string
    name: string
    args: Record<string, unknown>
  }>>([])
  const confirmDialog = confirmQueue[0] ?? null
  const [currentPersonaName, setCurrentPersonaName] = useState('小林')
  const [companionBlurb, setCompanionBlurb] = useState('沉稳体贴的数字伙伴')
  const [activeRoleId, setActiveRoleId] = useState('lin')
  const [protagonistNames, setProtagonistNames] = useState<Record<string, string>>({ lin: '小林' })
  const [reasoning, setReasoning] = useState<ReasoningCallbackState>(() => resetReasoning())
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  /** 对话内 debugMode（M32-G7）；与全页 Debug/Playground 无关 */
  const [conversationDebugMode, setConversationDebugMode] = useState(false)
  const conversationDebugModeRef = useRef(false)
  /** token 预算：优先 sessionTokenBudget，否则 llmMaxTokens；0=无上限 */
  const [debugTokenBudget, setDebugTokenBudget] = useState(0)
  // showMemoryPanel / showSkillsPanel / DevPanel 已合并为 activeView
  const [eventLog, setEventLog] = useState<Array<{ time: number; type: string; detail: string }>>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sessionId: string } | null>(null)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  /** 会话列表摘要（打开过的会话缓存最后一条可见消息） */
  const [sessionPreviews, setSessionPreviews] = useState<Record<string, string>>({})
  /** 工具卡折叠态（callId → collapsed）；未记录则 running/pending 展开、完成折叠 */
  const [toolCollapse, setToolCollapse] = useState<Record<string, boolean>>({})
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
  const [activeBgTaskCount, setActiveBgTaskCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const streamingSessionRef = useRef<string | null>(null)
  /** 本轮记忆引用芯片（done 后 session.reload 会丢本地字段，用 ref 补回） */
  const turnCitationsRef = useRef<MemoryCitation[]>([])
  const sessionsRef = useRef<SessionSummary[]>([])
  const activeSessionIdRef = useRef<string | null>(null)
  const { toast } = useToast()

  /** M29-G2：从消息与本轮 ref 去掉已纠错芯片 */
  const dropCitationChip = useCallback((citationId: string) => {
    turnCitationsRef.current = turnCitationsRef.current.filter((c) => c.id !== citationId)
    setMessages((prev) =>
      prev.map((m) => {
        if (!m.memoryCitations?.length) return m
        const next = m.memoryCitations.filter((c) => c.id !== citationId)
        if (next.length === m.memoryCitations.length) return m
        return { ...m, memoryCitations: next.length ? next : undefined }
      }),
    )
  }, [])

  const handleForgetCitation = useCallback(
    async (citationId: string) => {
      const r = await window.electronAPI?.memory.correctCitation(citationId)
      if (!r?.ok) {
        toast(r && 'error' in r ? r.error : '纠错失败', 'error')
        return
      }
      dropCitationChip(citationId)
      toast('已忘掉这条引用（库已清理）', 'success')
    },
    [dropCitationChip, toast],
  )

  const handleAmendCitation = useCallback(
    async (citationId: string, hint: string) => {
      const replacement = window.prompt('改正为（将写入事实记忆，并清掉错误引用）', hint)
      if (replacement == null) return
      if (!replacement.trim()) {
        toast('改正内容不能为空', 'error')
        return
      }
      const r = await window.electronAPI?.memory.correctCitation(citationId, replacement.trim())
      if (!r?.ok) {
        toast(r && 'error' in r ? r.error : '改正失败', 'error')
        return
      }
      dropCitationChip(citationId)
      toast(r.action === 'updated' ? '已更新这条记忆' : '已改正并写入新事实', 'success')
    },
    [dropCitationChip, toast],
  )

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { activeSessionIdRef.current = activeSessionId }, [activeSessionId])

  const MODEL_PRESETS = [
    { label: 'GPT-4o', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    { label: 'GPT-4o-mini', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { label: 'DeepSeek V3', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
    { label: 'DeepSeek V4 Flash', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  ]

  // ── M13：MCP Elicitation（服务端要补充信息）──
  useEffect(() => {
    if (!window.electronAPI?.mcp?.onElicitRequest) return
    return window.electronAPI.mcp.onElicitRequest((data) => {
      const answer = window.prompt(
        `[MCP ${data.serverId}] ${data.message}\n（可填 JSON 对象；取消则拒绝）`,
        '{}',
      )
      if (answer == null) {
        window.electronAPI.mcp.elicitResponse(data.requestId, null)
        return
      }
      try {
        const parsed = JSON.parse(answer) as Record<string, unknown>
        window.electronAPI.mcp.elicitResponse(data.requestId, parsed)
      } catch {
        window.electronAPI.mcp.elicitResponse(data.requestId, { value: answer })
      }
    })
  }, [])

  // ── M11：后台任务生命周期事件订阅 + M09 断线重连 sync ──
  useEffect(() => {
    if (!window.electronAPI?.tasks) return

    const applyTaskToast = (task: { name: string }, kind: 'completed' | 'failed') => {
      if (kind === 'completed' && task.name === 'profile-extract') {
        toast('已更新对你的了解 🧠', 'info')
      } else if (kind === 'failed') {
        toast(`后台任务失败（${task.name}），学习记录可能不完整`, 'warning')
      }
    }

    void window.electronAPI.tasks.sync().then((snap) => {
      setActiveBgTaskCount(snap.active.length)
      for (const t of snap.pendingNotify) {
        applyTaskToast(t, t.status === 'failed' ? 'failed' : 'completed')
      }
    }).catch(() => {})

    const cleanup = window.electronAPI.tasks.onEvent((ev) => {
      if (ev.type === 'task:started') {
        setActiveBgTaskCount(n => n + 1)
      } else if (ev.type === 'task:completed') {
        setActiveBgTaskCount(n => Math.max(0, n - 1))
        applyTaskToast(ev.task, 'completed')
      } else if (ev.type === 'task:failed') {
        setActiveBgTaskCount(n => Math.max(0, n - 1))
        applyTaskToast(ev.task, 'failed')
      }
    })
    return cleanup
  }, [toast])

  useEffect(() => {
    if (!window.electronAPI) return
    loadSessions()
    window.electronAPI.settings.get().then((s) => {
      if (s.llmModel) setCurrentModel(s.llmModel)
      if (s.executionMode) setApprovalMode(s.executionMode as 'confirm-all' | 'auto' | 'full-access')
      const debugOn = parseConversationDebugMode(s.conversationDebugMode)
      setConversationDebugMode(debugOn)
      conversationDebugModeRef.current = debugOn
      if (debugOn) setThinkingExpanded(true)
      const sessionBudget = Number.parseInt(s.sessionTokenBudget || '0', 10) || 0
      const modelMax = Number.parseInt(s.llmMaxTokens || '0', 10) || 0
      setDebugTokenBudget(sessionBudget > 0 ? sessionBudget : modelMax)
      if (!s.llmApiKey) {
        setActiveView('settings')
        setTimeout(() => toast('欢迎！请先配置 API Key 以开始使用', 'warning'), 500)
      }
      try {
        const pinned = JSON.parse(s.pinnedSessions || '[]')
        if (Array.isArray(pinned)) setPinnedIds(pinned)
      } catch { /* ignore */ }
    })
    window.electronAPI.companion.getActive().then((p) => {
      if (p?.name) setCurrentPersonaName(p.name)
      if (p?.description) setCompanionBlurb(p.description)
      if (p?.id) setActiveRoleId(p.id)
    })
    window.electronAPI.companion.listProtagonists().then((list) => {
      const map: Record<string, string> = {}
      for (const p of list) map[p.id] = p.name
      setProtagonistNames((prev) => ({ ...prev, ...map }))
    })
    window.electronAPI.companion.getRoster?.().then((data) => {
      const map: Record<string, string> = {}
      for (const c of data.cast) map[c.id] = c.name
      setProtagonistNames((prev) => ({ ...prev, ...map }))
    }).catch(() => { /* 旧 preload 无 getRoster */ })
    window.electronAPI.project.get().then((p) => {
      if (p) setCurrentProject(p)
    })
    const unsub = window.electronAPI.companion.onRoleChanged?.((payload) => {
      void window.electronAPI.companion.getActive().then((p) => {
        if (p?.name) setCurrentPersonaName(p.name)
        if (p?.description) setCompanionBlurb(p.description)
        if (p?.id) setActiveRoleId(p.id)
      })
      const sid = activeSessionIdRef.current
      const sess = sid ? sessionsRef.current.find((s) => s.id === sid) : undefined
      if (sess?.roleId && sess.roleId !== payload.roleId && sess.sessionKind !== 'summon') {
        toast('主角已切换。当前会话仍绑定旧主角，请新建对话开始新关系。', 'info')
      }
    })
    const unsubMilestone = window.electronAPI.companion.onMilestone?.((payload) => {
      if (payload.toast) toast(payload.toast, 'info')
    })
    const unsubMomentTip = window.electronAPI.companion.onMomentTip?.((payload) => {
      if (payload.toast) toast(payload.toast, 'info')
    })
    const unsubGreeting = window.electronAPI.companion.onProactiveGreeting?.((payload) => {
      if (payload.toast) toast(payload.toast, 'info')
    })
    return () => {
      unsub?.()
      unsubMilestone?.()
      unsubMomentTip?.()
      unsubGreeting?.()
    }
  }, [toast])

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
    setEventLog([])
    setInput('')
    setIsStreaming(false)
    setReasoning(resetReasoning())
    setUsage(null)
    setToolCollapse({})

    const session = await window.electronAPI.session.get(sessionId)
    if (session) {
      setMessages(session.messages)
    }
  }

  const setConversationDebug = useCallback(async (on: boolean) => {
    setConversationDebugMode(on)
    conversationDebugModeRef.current = on
    if (on) setThinkingExpanded(true)
    else setActiveTools([])
    await window.electronAPI?.settings.set('conversationDebugMode', on ? 'true' : 'false')
  }, [])

  const openSummonSession = async (sessionId: string) => {
    await loadSessions()
    setActiveView('chat')
    await switchSession(sessionId)
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
        setActiveView(v => v === 'debug' ? 'chat' : 'debug')
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setActiveView(v => v === 'playground' ? 'chat' : 'playground')
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
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setActiveView(v => v === 'moments' ? 'chat' : 'moments')
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
    const scale = localStorage.getItem('uiFontScale') || 'md'
    document.documentElement.dataset.fontScale = scale
  }, [theme])

  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus()
  }, [isStreaming])

  useEffect(() => {
    if (!activeSessionId) return
    const last = [...messages].reverse().find(
      (m) => m.role !== 'tool' && typeof m.content === 'string' && m.content.trim(),
    )
    if (!last) return
    const preview = formatSessionPreview(last.content)
    setSessionPreviews((prev) =>
      prev[activeSessionId] === preview ? prev : { ...prev, [activeSessionId]: preview },
    )
  }, [messages, activeSessionId])

  const handleEvent = useCallback((ev: AgentStreamEvent) => {
    const detail = ev.type === 'text' ? ev.content.slice(0, 80)
      : ev.type === 'tool_start' ? `${ev.name}(${JSON.stringify(ev.args).slice(0, 60)})`
      : ev.type === 'tool_end' ? `${ev.name} → ${ev.isError ? 'ERR' : 'OK'}`
      : ev.type === 'error' ? ev.message
      : ev.type === 'execution_mode_changed' ? `${ev.mode}: ${ev.reason}`
      : ev.type === 'compact' ? `${ev.level} ${ev.preTokens}→${ev.postTokens}t [${ev.trigger}${ev.usedLLM ? ' LLM' : ''}]`
      : ev.type === 'usage' ? `in:${ev.promptTokens} out:${ev.completionTokens}`
      : ev.type === 'thinking' ? ev.content.slice(0, 80)
      : ev.type === 'memory_citations' ? `${ev.items.length} refs`
      : ''
    setEventLog(prev => [...prev.slice(-500), { time: Date.now(), type: ev.type, detail }])

    // reasoning / content / tool 三通道（对照灵犀 Callback 组件化）
    if (ev.type === 'thinking') {
      setReasoning((prev) => applyReasoningEvent(prev, ev) ?? prev)
      return
    }

    if (ev.type === 'memory_citations' || ev.type === 'text' || ev.type === 'tool_calls') {
      if (ev.type === 'memory_citations') turnCitationsRef.current = ev.items
      setMessages((prev) =>
        applyContentEvent(prev, ev, { genId, citations: turnCitationsRef.current }) ?? prev,
      )
      return
    }

    if (ev.type === 'tool_call_delta' || ev.type === 'tool_start' || ev.type === 'tool_end') {
      setActiveTools(
        (prev) =>
          applyToolEvent(prev, ev, { keepExpanded: conversationDebugModeRef.current }) ?? prev,
      )
      if (ev.type === 'tool_end') {
        setMessages((prev) => appendToolResultMessage(prev, ev))
      }
      return
    }

    switch (ev.type) {
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
        if (ev.code === 'PERMISSION_DENIED') {
          setModeChangeNotice('操作被权限策略拒绝。可以在输入区切换审批模式，或让 Agent 尝试更安全的替代方案。')
        } else if (ev.code === 'LLM_RATE_LIMITED' || ev.code === 'LLM_REQUEST_FAILED' || ev.code === 'TOOL_TIMEOUT') {
          setModeChangeNotice('请求暂时失败，可以稍后重试。')
        }
        setIsStreaming(false)
        setReasoning((prev) => completeReasoning(prev))
        break

      case 'execution_mode_changed':
        setApprovalMode(ev.mode === 'plan-first' ? 'confirm-all' : ev.mode)
        setModeChangeNotice(ev.reason)
        toast(ev.reason, 'warning')
        break

      case 'done':
        setIsStreaming(false)
        // 对话 debug：保留本轮工具卡；产品态：清掉以免污染伙伴感
        if (!conversationDebugModeRef.current) setActiveTools([])
        setReasoning((prev) => completeReasoning(prev))
        break

      case 'compact':
        break
    }
  }, [toast])

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

    // 乐观更新 UI；真相源在主进程 session-store（会话 Runtime 中心化）
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingImages([])
    streamingSessionRef.current = sid
    turnCitationsRef.current = []
    setBgStreamingSessionId(sid)
    setIsStreaming(true)
    setActiveTools([])
    setToolCollapse({})
    setReasoning(resetReasoning())
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
        // 与主进程会话对齐，避免本地流式状态与库不一致
        void window.electronAPI.session.get(sid).then((session) => {
          if (session && streamingSessionRef.current === null) {
            const cites = turnCitationsRef.current
            if (!cites.length) {
              setMessages(session.messages)
              return
            }
            const msgs = session.messages.map(m => ({ ...m }))
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === 'assistant') {
                msgs[i] = { ...msgs[i], memoryCitations: cites }
                break
              }
            }
            setMessages(msgs)
          }
        })
      }
    })

    const cleanupConfirm = window.electronAPI.chat.onConfirmRequest((data) => {
      setConfirmQueue(q => [...q, { requestId: data.requestId, name: data.name, args: data.args }])
    })

    try {
      await window.electronAPI.chat.send(sid, userMsg)
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
    // tool 结果并入 assistant 行内卡片，顶层不再单独占行（Debug 也不拆行，避免双份）
    if (m.role === 'tool') return false
    if (
      m.role === 'assistant'
      && !m.content
      && !m.toolCalls?.length
      && !(m.memoryCitations && m.memoryCitations.length)
    ) {
      return false
    }
    return true
  })

  const liveToolHostId = findLiveToolHostId(messages, activeTools, isStreaming)

  const toggleToolCollapse = useCallback((callId: string) => {
    setToolCollapse((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, callId)) {
        return { ...prev, [callId]: !prev[callId] }
      }
      const live = activeTools.find((t) => t.callId === callId)
      const defaultCollapsed = live
        ? !(live.status === 'running' || live.status === 'pending')
        : true
      return { ...prev, [callId]: !defaultCollapsed }
    })
  }, [activeTools])

  const applyToolCollapse = useCallback(
    (tools: ToolCallbackItem[]): ToolCallbackItem[] =>
      tools.map((t) => {
        if (Object.prototype.hasOwnProperty.call(toolCollapse, t.callId)) {
          return { ...t, collapsed: toolCollapse[t.callId] }
        }
        if (t.status === 'running' || t.status === 'pending') {
          return { ...t, collapsed: false }
        }
        return { ...t, collapsed: true }
      }),
    [toolCollapse],
  )

  const coldStart = buildColdStartCopy({
    name: currentPersonaName,
    description: companionBlurb,
  })

  const closeSettings = useCallback(() => {
    setActiveView('chat')
    if (window.electronAPI) {
      window.electronAPI.companion.getActive().then((p) => {
        if (p?.name) setCurrentPersonaName(p.name)
        if (p?.description) setCompanionBlurb(p.description)
        if (p?.id) setActiveRoleId(p.id)
      })
      window.electronAPI.companion.listProtagonists().then((list) => {
        const map: Record<string, string> = {}
        for (const p of list) map[p.id] = p.name
        setProtagonistNames(map)
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
      <div className="app-shell view-transition flex h-screen min-w-0 select-none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col">
          <SettingsPanel
            onClose={closeSettings}
            onOpenDevPanel={() => setActiveView('debug')}
            onOpenPlayground={() => setActiveView('playground')}
            onOpenMemory={() => setActiveView('memory')}
            onOpenSkills={() => setActiveView('skills')}
            currentTheme={theme}
            onThemeChange={setTheme}
            conversationDebugMode={conversationDebugMode}
            onConversationDebugModeChange={(on) => { void setConversationDebug(on) }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell flex h-screen select-none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* ── Primary 侧栏（Alice 壳） ── */}
      {sidebarOpen && (
        <PrimarySidebar
          personaName={currentPersonaName}
          personaBlurb={companionBlurb || '越探索，越着迷。'}
          activeView={activeView}
          activeSessionId={activeSessionId}
          sessionGroups={sessionGroups}
          sessionPreviews={sessionPreviews}
          pinnedIds={pinnedIds}
          bgStreamingSessionId={bgStreamingSessionId}
          activeBgTaskCount={activeBgTaskCount}
          sidebarSearchOpen={sidebarSearchOpen}
          sessionFilter={sessionFilter}
          sessionFilterRef={sessionFilterRef}
          renamingId={renamingId}
          renameValue={renameValue}
          onOpenShelf={() => {
            setWorldTab('shelf')
            setActiveView('world')
          }}
          onCreateSession={() => { void createNewSession() }}
          onToggleSearch={() => {
            setSidebarSearchOpen((v) => !v)
            setTimeout(() => sessionFilterRef.current?.focus(), 50)
          }}
          onSessionFilterChange={setSessionFilter}
          onCloseSearch={() => { setSidebarSearchOpen(false); setSessionFilter('') }}
          onSelectSession={(id) => { setActiveView('chat'); void switchSession(id) }}
          onStartRename={(id, title) => { setRenamingId(id); setRenameValue(title) }}
          onRenameChange={setRenameValue}
          onCommitRename={() => { void commitRename() }}
          onCancelRename={() => setRenamingId(null)}
          onDeleteSession={(id) => { void deleteSession(id) }}
          onContextMenu={(e, sessionId) => {
            e.preventDefault()
            setContextMenu({ x: e.clientX, y: e.clientY, sessionId })
          }}
          onNavigate={(view) => {
            if (isWorldView(view) || view === 'world') {
              setWorldTab(worldTabFromView(view === 'world' ? 'world' : view))
              setActiveView('world')
              return
            }
            setActiveView(view)
          }}
          onCollapse={() => setSidebarOpen(false)}
        />
      )}

      <SecondaryNav
        activeView={activeView}
        onNavigate={(view) => {
          if (isWorldView(view) || view === 'world') {
            setWorldTab(worldTabFromView(view === 'world' ? 'world' : view))
            setActiveView('world')
            return
          }
          setActiveView(view)
        }}
      />

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
          {(() => {
            const sess = sessions.find((s) => s.id === activeSessionId)
            const sessRole = sess?.roleId
            const headerRole = sessRole || activeRoleId
            const headerName = protagonistNames[headerRole] || currentPersonaName
            const isSummon = sess?.sessionKind === 'summon'
            const mismatched = !!(sessRole && sessRole !== activeRoleId && !isSummon)
            const badge = isSummon ? ' · 召唤' : mismatched ? ' · 会话' : ''
            const title = isSummon
              ? '召唤子会话：已装载对方人设，不推进其生活世界'
              : mismatched
                ? '此会话绑定旧主角；生活世界已是新活跃主角'
                : undefined
            return (
              <span className="text-[11px]" style={{ color: (mismatched || isSummon) ? 'var(--warning)' : 'var(--text-muted)' }} title={title}>
                {headerName}{badge}
              </span>
            )
          })()}
        </div>

        {activeView !== 'chat' && (
          <div className="view-transition flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            {activeView === 'debug' ? (
              <DevPanel
                eventLog={eventLog}
                onClose={() => setActiveView('chat')}
              />
            ) : activeView === 'playground' ? (
              <PlaygroundPage onClose={() => setActiveView('chat')} />
            ) : isWorldView(activeView) ? (
              <WorldHub
                tab={activeView === 'world' ? worldTab : worldTabFromView(activeView)}
                onTabChange={(t) => {
                  setWorldTab(t)
                  setActiveView('world')
                }}
                onClose={() => setActiveView('chat')}
                onOpenSession={(sid) => { void openSummonSession(sid) }}
                onSwitched={(p) => {
                  setCurrentPersonaName(p.name)
                  setCompanionBlurb(p.description)
                  setActiveRoleId(p.id)
                }}
                recentByRole={Object.fromEntries(
                  sessions
                    .filter((s) => s.sessionKind === 'summon' && s.roleId)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .reduce<Array<[string, { sessionId: string; title: string; updatedAt: number }]>>((acc, s) => {
                      const rid = s.roleId!
                      if (acc.some(([id]) => id === rid)) return acc
                      acc.push([rid, { sessionId: s.id, title: s.title, updatedAt: s.updatedAt }])
                      return acc
                    }, []),
                )}
              />
            ) : (
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {activeView === 'skills' && (
                  <SkillsPanel visible={true} onClose={() => setActiveView('chat')} />
                )}
                {activeView === 'memory' && (
                  <MemoryPanel onClose={() => setActiveView('chat')} />
                )}
              </div>
            )}
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFileAttach(e.dataTransfer.files) }}
        >
          <CompanionSceneBackdrop roleId={activeRoleId} />
          <div className="relative z-[1] mx-auto max-w-3xl px-6 py-8">
            {/* 欢迎屏 — 衬线问候 + 建议 pill（Phase 3） */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-28 text-center">
                <h1
                  className="font-display text-[1.75rem] font-medium tracking-tight sm:text-[2rem]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {coldStart.title}
                </h1>
                <p className="mt-3 max-w-md text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {coldStart.subtitle}
                </p>
                <p className="mt-2 max-w-sm text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {coldStart.hint}
                </p>
                <div className="mt-12 flex max-w-lg flex-wrap justify-center gap-2">
                  {([
                    { label: '打个招呼', prompt: '你好，介绍一下你自己' },
                    { label: '今天打算怎么过', prompt: '今天打算怎么过？陪我想想。' },
                    { label: '看看朋友圈', view: 'moments' as const },
                    { label: '换个主角聊聊', view: 'shelf' as const },
                  ]).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        if ('view' in item && item.view) {
                          setWorldTab(worldTabFromView(item.view))
                          setActiveView('world')
                        } else if ('prompt' in item && item.prompt) void sendMessage(item.prompt)
                      }}
                      className="rounded-full border px-3.5 py-1.5 text-[12.5px] transition"
                      style={{
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-secondary)',
                        background: 'var(--card-bg)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--companion-accent-warm)'
                        e.currentTarget.style.color = 'var(--text-primary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 消息流 — Alice 壳 Phase B */}
            <div className="space-y-8">
              {visibleMessages.map((msg, msgIndex) => {
                const isSearchMatch = searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                const dimmed = searchQuery && !isSearchMatch
                const isUser = msg.role === 'user'
                const isLastMsg = msgIndex === visibleMessages.length - 1
                const showThinkingBeforeMsg = !isUser && isLastMsg && reasoning.chunks.length > 0

                return (
                  <div
                    key={msg.id}
                    className={`animate-fade-in-up group ${dimmed ? 'opacity-20' : ''} ${isSearchMatch ? 'rounded-md ring-1' : ''} ${isUser ? 'flex justify-end' : ''}`}
                    style={isSearchMatch ? { ['--tw-ring-color' as string]: 'var(--accent)', ['--tw-ring-opacity' as string]: '0.3' } as React.CSSProperties : {}}
                  >
                    {showThinkingBeforeMsg && (
                      <ReasoningCallback
                        chunks={reasoning.chunks}
                        expanded={thinkingExpanded}
                        onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                        streaming={isStreaming}
                        className="mb-3"
                      />
                    )}
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
                        {msg.memoryCitations && msg.memoryCitations.length > 0 && (
                          <MemoryCitationChips
                            citations={msg.memoryCitations}
                            showActions={!isStreaming}
                            onForget={(id) => void handleForgetCitation(id)}
                            onAmend={(id, summary) => void handleAmendCitation(id, summary)}
                          />
                        )}
                        {(msg.content || (isStreaming && isLastMsg)) && (
                        <div className="mb-3 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {msg.content ? <MarkdownRenderer content={msg.content} /> : null}
                          {isStreaming && msg.id === messages.filter(m => m.role === 'assistant').at(-1)?.id && (
                            <span className="animate-typing-cursor ml-0.5 inline-block h-4 w-0.5" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                        )}
                        {(() => {
                          // Alice：tool_call 跟在本回合 assistant 正文后；历史从 toolCalls+后续 tool 还原
                          const turnTools = applyToolCollapse(
                            resolveToolsForAssistant(msg, messages, {
                              liveHostId: liveToolHostId,
                              liveTools: activeTools,
                              expandHistoric: conversationDebugMode,
                            }),
                          )
                          return turnTools.length > 0 ? (
                            <ToolCallbackList
                              tools={turnTools}
                              onToggleCollapse={toggleToolCollapse}
                              className="mt-1"
                            />
                          ) : null
                        })()}
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

            {/* Reasoning：助手消息尚未出现时显示在消息流下方 */}
            {reasoning.chunks.length > 0 && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant' && (
              <ReasoningCallback
                chunks={reasoning.chunks}
                expanded={thinkingExpanded}
                onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                streaming={isStreaming}
                className="mt-4"
              />
            )}

            <ContentCallbackCue
              phase={contentPhase(
                Boolean(
                  messages[messages.length - 1]?.role === 'assistant'
                  && messages[messages.length - 1]?.content,
                ),
                isStreaming,
              )}
            />

            <div ref={messagesEndRef} />
          </div>

        </div>}

        {/* 输入区 — Codex 风格居中卡片 */}
        {activeView === 'chat' && <div className="relative shrink-0 px-4 pb-4 pt-2" style={{ background: 'var(--bg-primary)' }}>
          <div className="mx-auto max-w-3xl">
            {conversationDebugMode && (
              <ConversationDebugOverlay
                usage={usage}
                maxTokens={debugTokenBudget}
                events={eventLog}
              />
            )}
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
            {modeChangeNotice && (
              <div className="mb-2 flex items-center justify-between rounded-md border px-3 py-2 text-xs" style={{ borderColor: 'var(--warning)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                <span>{modeChangeNotice}</span>
                <button onClick={() => setModeChangeNotice(null)} title="关闭提示" style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
              </div>
            )}
            <div
              className="relative border shadow-sm"
              style={{
                borderColor: 'var(--border-color)',
                background: 'var(--card-bg)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
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
                placeholder={attachedFiles.length > 0 ? '描述附件内容或输入问题...' : `和${currentPersonaName || '伙伴'}说说…`}
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[14px] outline-none disabled:opacity-50"
                style={{ color: 'var(--text-primary)', maxHeight: '140px' }}
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

                  {/* 发送/停止 */}
                  {isStreaming ? (
                    <button
                      onClick={() => window.electronAPI.chat.abort(activeSessionId || undefined)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white transition"
                      style={{ background: 'var(--danger)' }}
                      title="停止"
                    ><Square size={10} fill="currentColor" /></button>
                  ) : (
                    <button
                      onClick={() => sendMessage()}
                      disabled={!input.trim()}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs text-white transition disabled:cursor-not-allowed disabled:opacity-30"
                      style={{ background: 'var(--accent-emphasis)' }}
                      title="发送"
                    >
                      <Send size={15} />
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

              {/* Token：产品态 hover 才见；对话 debug 时由上方 Overlay 常显 */}
              {usage && !conversationDebugMode && (
                <div className="flex gap-2 text-[10px] opacity-0 transition-opacity hover:opacity-100" style={{ color: 'var(--text-muted)' }}>
                  <span>↑{(usage.promptTokens / 1000).toFixed(1)}k</span>
                  <span>↓{(usage.completionTokens / 1000).toFixed(1)}k</span>
                  <span>Σ{((usage.promptTokens + usage.completionTokens) / 1000).toFixed(1)}k</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => { void setConversationDebug(!conversationDebugMode) }}
                className="rounded px-1.5 py-0.5 text-[10px] transition"
                style={{
                  color: conversationDebugMode ? 'var(--accent)' : 'var(--text-muted)',
                  background: conversationDebugMode ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                }}
                title="对话内调试信息（与全页 Debug 无关）"
                data-testid="conversation-debug-toggle"
              >
                {conversationDebugMode ? 'Debug ON' : 'Debug'}
              </button>
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

      {/* Memory / Skills / Debug / Playground 均为主区域全页视图 */}

      {/* 确认对话框（串行队列：一次只展示队首，应答后出队） */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <PermissionConfirmCard
            toolName={confirmDialog.name}
            args={confirmDialog.args}
            queueLength={confirmQueue.length}
            onDeny={() => {
              window.electronAPI.chat.confirmResponse(confirmDialog.requestId, false)
              setConfirmQueue(q => q.slice(1))
            }}
            onAllow={() => {
              window.electronAPI.chat.confirmResponse(confirmDialog.requestId, true)
              setConfirmQueue(q => q.slice(1))
            }}
          />
        </div>
      )}
    </div>
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
