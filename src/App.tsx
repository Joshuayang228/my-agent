import { buildImageDraftPrompt, buildWorldAssetImageDraftPrompt } from './shared/request-draft-prompts'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import type {
  ChatMessage,
  AgentStreamEvent,
  ImageAttachment,
  MemoryCitation,
  BackgroundTaskInfo,
  ModelConnectionProfile,
  ModelRouteProfile,
} from './shared/types'
import { enabledConnectionModelIds } from './shared/llm-model-fetch'
import { MarkdownRenderer } from './components/MarkdownRenderer'
import { SettingsPanel } from './components/SettingsPanel'
import { DevPanel } from './components/DevPanel'
import { PlaygroundPage } from './components/PlaygroundPage'
import { MemoryPanel } from './components/MemoryPanel'
import { CompanionSceneBackdrop } from './components/CompanionSceneBackdrop'
import { ToastProvider, useToast } from './components/Toast'
import { SkillsPanel } from './components/SkillsPanel'
import { ChatRightDock } from './components/chat/right-dock/ChatRightDock'
import MentionPopup from './components/MentionPopup'
import { PermissionConfirmCard } from './components/chat/PermissionConfirmCard'
import { ChatWelcome } from './components/chat/ChatWelcome'
import { ChatComposer } from './components/chat/ChatComposer'
import { ChatAttachmentTray } from './components/chat/ChatAttachments'
import { ChatApprovalControl } from './components/chat/ChatApprovalControl'
import { ChatMessageFrame } from './components/chat/ChatMessageFrame'
import { ActionButton } from './components/foundation/ActionButton'
import { IconButton } from './components/foundation/IconButton'
import { ImagePreviewImage } from './components/foundation/ImagePreviewImage'
import {
  Volume2, Paperclip,
  Folder, FolderOpen, Ban, PanelRight,
  ChevronDown, ChevronRight, Sparkles,
  Copy, Check, X, Pencil, RotateCcw, GitBranch, Trash2,
  Search, PanelLeftOpen, File,
} from 'lucide-react'
import { buildColdStartCopy } from './shared/companion-presence'
import { formatCompanionErrorBubble } from './shared/companion-error-voice'
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
  groupVisibleMessages,
  buildProcessSummaryText,
  type ReasoningCallbackState,
  type ToolCallbackItem,
} from './components/chat/callbacks'
import {
  PrimarySidebar,
  NavigationRail,
  loadRailWorldShortcuts,
  saveRailWorldShortcuts,
  WorldHub,
  isWorldView,
  worldTabFromView,
  formatSessionPreview,
  type ShellView,
  type WorldTab,
} from './components/shell'
import { ResizeHandle } from './components/shell/ResizeHandle'
import { ChatScrollToBottomButton, ChatTurnRail, formatTurnPreview } from './components/chat/ChatScrollNavigator'
import { LAYOUT_BOUNDS, LAYOUT_KEYS, usePersistedNumber } from './shared/panel-layout'
import { LAYOUT_CLASSES, layoutProfileStyle } from './shared/content-layout'
import { normalizeThemeId } from './shared/design-asset-registry'

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
  const [sidebarReopenReady, setSidebarReopenReady] = useState(false)
  const sidebarShellRef = useRef<HTMLDivElement>(null)
  const sidebarReopenRef = useRef<HTMLButtonElement>(null)

  /*
   * 背景：正式 Chat 侧栏收起和展开共用同一条工具栏，两个入口同时可见会发生重叠。
   * 设计意图：先完成退场计时，再显示浮动入口；反向展开立即清理等待状态，放弃同时保留两套入口的直觉做法。
   * 关键约束：计时必须与 --motion-normal 的 220ms 对齐，并在 effect 清理时取消旧计时器，否则快速反向操作会让旧按钮重新出现。
   */
  useLayoutEffect(() => {
    setSidebarReopenReady(false)
    if (sidebarOpen) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      setSidebarReopenReady(true)
      requestAnimationFrame(() => sidebarReopenRef.current?.focus())
    }, reducedMotion ? 0 : 220)
    return () => window.clearTimeout(timer)
  }, [sidebarOpen])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolCallbackItem[]>([])
  const [activeView, setActiveView] = useState<ShellView>('chat')
  const settingsSaveBeforeLeave = useRef<(() => Promise<boolean>) | null>(null)
  const settingsNavigationPending = useRef(false)
  const seenTaskNotifications = useRef(new Set<string>())
  const [settingsEntry, setSettingsEntry] = useState<'default' | 'role-shelf' | 'model'>('default')
  const settingsReturnView = useRef<ShellView>('chat')
  const [worldTab, setWorldTab] = useState<WorldTab>('moments')
  const [unreadMomentsCount, setUnreadMomentsCount] = useState(0)
  const activeViewRef = useRef(activeView)
  activeViewRef.current = activeView
  const worldTabRef = useRef(worldTab)
  worldTabRef.current = worldTab
  const [theme, setTheme] = useState<string>(() => {
    return normalizeThemeId(localStorage.getItem('theme'))
  })
  const [currentModel, setCurrentModel] = useState('')
  // 浏览器预览没有 preload 桥接，只能查看隔离的 Playground / Debug 壳；真实伙伴、设置和写入能力仍必须走 Electron。
  // 入口在浏览器中默认可见，避免把“没有桌面连接”和“没有开发入口”混成同一个故障；Electron 仍以持久化开发者设置为准。
  const [developerMode, setDeveloperMode] = useState(() => import.meta.env.MODE === 'ui-e2e' || !window.electronAPI)
  const [approvalMode, setApprovalMode] = useState<'confirm-all' | 'auto' | 'full-access'>('confirm-all')

  const [modeChangeNotice, setModeChangeNotice] = useState<string | null>(null)
  const [currentProject, setCurrentProject] = useState<{ path: string; name: string } | null>(null)
  const [recentProjects, setRecentProjects] = useState<{ path: string; name: string }[]>([])
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [availableChatModels, setAvailableChatModels] = useState<Array<{ connectionId: string; connectionName: string; model: string }>>([])
  /** 确认请求串行队列（M12-C4）：并发 tool_confirm 不得互相覆盖 */
  const [confirmQueue, setConfirmQueue] = useState<Array<{
    requestId: string
    name: string
    args: Record<string, unknown>
  }>>([])
  const confirmDialog = confirmQueue[0] ?? null
  const [currentPersonaName, setCurrentPersonaName] = useState('路飞')
  const [companionBlurb, setCompanionBlurb] = useState('自由、直率、重视伙伴的冒险伙伴')
  const [companionStatusSummary, setCompanionStatusSummary] = useState<string | undefined>()
  const [companionStatusMetrics, setCompanionStatusMetrics] = useState<{ mood: number; energy: number; socialNeed: number; relationshipSignal: number | null; relationshipPhase: string | null } | undefined>()
  const [companionFirstContact, setCompanionFirstContact] = useState<{ openingLine: string; quote?: string } | undefined>()
  const [latestWelcomeMoment, setLatestWelcomeMoment] = useState<{
    id: string
    text: string
    publishedAt: number
    thumbSrc?: string | null
    imageCount?: number
  } | null>(null)
  const [railWorldShortcuts, setRailWorldShortcuts] = useState<WorldTab[]>(() => loadRailWorldShortcuts())
  const [showFirstContact, setShowFirstContact] = useState(false)
  const [activeRoleId, setActiveRoleId] = useState('luffy')

  useEffect(() => {
    setLatestWelcomeMoment(null)
    if (activeView !== 'chat' || messages.length > 0) return
    const api = window.electronAPI?.companion
    if (!api?.getMoments) return
    let cancelled = false
    void api.getMoments().then(async (res) => {
      if (cancelled || !res || res.roleId !== activeRoleId) return
      const first = res.items.find((item) => item.roleId === activeRoleId && item.text.trim().length > 0)
      if (!first) {
        setLatestWelcomeMoment(null)
        return
      }
      const imageIds = first.imageIds ?? []
      let thumbSrc: string | null = null
      if (imageIds.length > 0 && api.readMomentImage) {
        try {
          const imgRes = await api.readMomentImage(first.id, imageIds[0])
          if (!cancelled && imgRes?.ok && imgRes.dataUrl) {
            thumbSrc = imgRes.dataUrl
          }
        } catch {
          // 缩略图读取失败时平滑降级为纯文本动态卡
        }
      }
      if (cancelled) return
      setLatestWelcomeMoment({
        id: first.id,
        text: first.text.trim(),
        publishedAt: first.publishedAt,
        thumbSrc,
        imageCount: imageIds.length,
      })
    }).catch(() => {
      // 首屏最新动态是轻增强，读取失败静默降级为不展示
    })
    return () => { cancelled = true }
  }, [activeRoleId, activeView, messages.length])
  const activeRoleIdRef = useRef(activeRoleId)
  activeRoleIdRef.current = activeRoleId
  const [companionAvatar, setCompanionAvatar] = useState<string | null>(null)
  const [companionBanner, setCompanionBanner] = useState<string | null>(null)
  const [roleAvatars, setRoleAvatars] = useState<Record<string, string>>({})
  const [roleBanners, setRoleBanners] = useState<Record<string, string>>({})
  const [chatBackdropEnabled, setChatBackdropEnabled] = useState(true)
  const [chatBackdropOpacity, setChatBackdropOpacity] = useState(12)

  const refreshAvailableChatModels = useCallback(async () => {
    const api = window.electronAPI?.settings
    if (!api?.get) return
    try {
      const s = await api.get()
      if (s.llmEffectiveModel) setCurrentModel(s.llmEffectiveModel)
      const connections = JSON.parse(s.modelConnections || '[]') as ModelConnectionProfile[]
      if (!Array.isArray(connections)) return
      const options: Array<{ connectionId: string; connectionName: string; model: string }> = []
      const seen = new Set<string>()
      for (const conn of connections) {
        if (!conn.enabled || !conn.baseUrl?.trim()) continue
        const modelIds = enabledConnectionModelIds(conn)
        for (const modelId of modelIds) {
          const trimmed = modelId.trim()
          if (!trimmed) continue
          const key = `${conn.id}::${trimmed}`
          if (seen.has(key)) continue
          seen.add(key)
          options.push({
            connectionId: conn.id,
            connectionName: conn.name || conn.id,
            model: trimmed,
          })
        }
      }
      setAvailableChatModels(options)
    } catch {
      // 模型清单读取异常时保持当前模型展示
    }
  }, [])

  useEffect(() => {
    if ((activeView === 'world' && worldTab === 'moments') || activeView === 'moments') {
      setUnreadMomentsCount(0)
    }
    if (activeView === 'chat') {
      void refreshAvailableChatModels()
      void window.electronAPI?.settings?.get?.().then((s) => {
        if (s && typeof s.companionChatBackdropEnabled === 'string') {
          setChatBackdropEnabled(s.companionChatBackdropEnabled !== 'false')
        }
        if (s && typeof s.companionChatBackdropOpacity === 'string') {
          const parsed = Number(s.companionChatBackdropOpacity)
          if (Number.isFinite(parsed)) setChatBackdropOpacity(Math.min(35, Math.max(0, parsed)))
        }
      }).catch(() => {})
    }
  }, [activeView, worldTab, refreshAvailableChatModels])
  const [protagonistNames, setProtagonistNames] = useState<Record<string, string>>({ luffy: '路飞' })
  const [reasoning, setReasoning] = useState<ReasoningCallbackState>(() => resetReasoning())
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
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
  /** 多轮任务过程展开态（finalMsg.id → expanded）；跑完默认收起只留最后一轮输出 */
  const [expandedProcessRuns, setExpandedProcessRuns] = useState<Record<string, boolean>>({})
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
  const [rightDockCollapsed, setRightDockCollapsed] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280))
  const sidebarAutoCollapsedRef = useRef(false)
  const manualSidebarWithDockRef = useRef(false)
  const [sidebarWidth, setSidebarWidth] = usePersistedNumber(
    LAYOUT_KEYS.sidebarWidth,
    LAYOUT_BOUNDS.sidebarWidth.fallback,
    LAYOUT_BOUNDS.sidebarWidth,
  )
  const [rightDockWidth, setRightDockWidth] = usePersistedNumber(
    LAYOUT_KEYS.rightDockWidth,
    LAYOUT_BOUNDS.rightDockWidth.fallback,
    LAYOUT_BOUNDS.rightDockWidth,
  )

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dockActive = activeView === 'chat' && showFileBrowser && !rightDockCollapsed
  useEffect(() => {
    if (!dockActive) {
      manualSidebarWithDockRef.current = false
      if (sidebarAutoCollapsedRef.current) {
        sidebarAutoCollapsedRef.current = false
        setSidebarOpen(true)
      }
      return
    }
    if (sidebarOpen && !manualSidebarWithDockRef.current) {
      const centerRemaining = viewportWidth - 54 - sidebarWidth - rightDockWidth
      if (centerRemaining < 440) {
        sidebarAutoCollapsedRef.current = true
        setSidebarOpen(false)
      }
    }
  }, [dockActive, viewportWidth, sidebarWidth, rightDockWidth, sidebarOpen])
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

  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { activeSessionIdRef.current = activeSessionId }, [activeSessionId])

  useEffect(() => {
    if (messages.length > 0 || !companionFirstContact || !window.electronAPI?.companion.claimFirstContact) {
      setShowFirstContact(false)
      return
    }
    void window.electronAPI.companion.claimFirstContact().then(setShowFirstContact).catch(() => setShowFirstContact(false))
  }, [messages.length, companionFirstContact])

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

    const activeIds = new Set<string>()
    const observedIds = new Set<string>()
    let disposed = false
    const applyTaskToast = (task: BackgroundTaskInfo, kind: 'completed' | 'failed') => {
      if (!seenTaskNotifications.current.has(task.id)) {
        if (kind === 'completed' && task.name === 'profile-extract') {
          toast('已更新对你的了解 🧠', 'info')
        } else if (kind === 'failed') {
          toast(`后台任务失败（${task.name}），学习记录可能不完整`, 'warning')
        }
        seenTaskNotifications.current.add(task.id)
      }
      void window.electronAPI.tasks.acknowledge(task.id).catch(() => {
        console.warn('后台任务通知确认失败，将在下次同步时重试。')
      })
    }

    // 先订阅再读取快照，事件覆盖快照中的旧状态，重复终态只确认一次展示。
    const cleanup = window.electronAPI.tasks.onEvent((ev) => {
      observedIds.add(ev.task.id)
      if (ev.type === 'task:started') activeIds.add(ev.task.id)
      else {
        activeIds.delete(ev.task.id)
        if (ev.type === 'task:completed' || ev.type === 'task:failed') {
          applyTaskToast(ev.task, ev.type === 'task:failed' ? 'failed' : 'completed')
        }
      }
      setActiveBgTaskCount(activeIds.size)
    })
    void window.electronAPI.tasks.sync().then((snap) => {
      if (disposed) return
      for (const task of snap.active) if (!observedIds.has(task.id)) activeIds.add(task.id)
      setActiveBgTaskCount(activeIds.size)
      for (const task of snap.pendingNotify) applyTaskToast(task, task.status === 'failed' ? 'failed' : 'completed')
    }).catch(() => {})

    return () => {
      disposed = true
      cleanup()
    }
  }, [toast])

  useEffect(() => {
    if (!window.electronAPI) return
    loadSessions()
    window.electronAPI.settings.get().then((s) => {
      setCurrentModel(s.llmEffectiveModel || '')
      if (s.executionMode) setApprovalMode(s.executionMode as 'confirm-all' | 'auto' | 'full-access')
      setDeveloperMode(import.meta.env.MODE === 'ui-e2e' || s.developerMode === 'true')
      if (s.llmConnectionReady !== 'true') {
        setActiveView('settings')
        setTimeout(() => toast('欢迎！请先配置模型连接以开始使用', 'warning'), 500)
      }
      try {
        const pinned = JSON.parse(s.pinnedSessions || '[]')
        if (Array.isArray(pinned)) setPinnedIds(pinned)
      } catch (error) {
        console.warn('[App] Failed to restore pinned sessions', {
          errorType: error instanceof Error ? error.name : 'unknown',
        })
      }
    })
    window.electronAPI.companion.getActive().then((p) => {
      if (p?.name) setCurrentPersonaName(p.name)
      if (p?.description) setCompanionBlurb(p.description)
      setCompanionStatusSummary(p?.statusSummary)
      setCompanionStatusMetrics(p?.statusMetrics)
      if (p?.id) setActiveRoleId(p.id)
      if (p?.avatarDataUrl) {
        setCompanionAvatar(p.avatarDataUrl)
        if (p.id) setRoleAvatars(prev => ({ ...prev, [p.id]: p.avatarDataUrl! }))
      }
      if (p?.bannerDataUrl) {
        setCompanionBanner(p.bannerDataUrl)
        if (p.id) setRoleBanners(prev => ({ ...prev, [p.id]: p.bannerDataUrl! }))
      }
      setCompanionFirstContact(p?.firstContact ? { openingLine: p.firstContact.openingLine, quote: p.firstContact.quote } : undefined)
    })
    window.electronAPI.companion.listProtagonists().then((list) => {
      const map: Record<string, string> = {}
      const avatars: Record<string, string> = {}
      const banners: Record<string, string> = {}
      for (const p of list) {
        map[p.id] = p.name
        if (p.avatarDataUrl) avatars[p.id] = p.avatarDataUrl
        if (p.bannerDataUrl) banners[p.id] = p.bannerDataUrl
      }
      setProtagonistNames((prev) => ({ ...prev, ...map }))
      setRoleAvatars((prev) => ({ ...prev, ...avatars }))
      setRoleBanners((prev) => ({ ...prev, ...banners }))
    })
    window.electronAPI.companion.getRoster?.().then((data) => {
      const map: Record<string, string> = {}
      for (const c of data.cast) {
        map[c.id] = c.name
        // 异步预热名册角色的头像与横幅
        void window.electronAPI.companion.getRoleVisuals?.(c.id).then(visuals => {
          if (visuals?.avatarDataUrl) setRoleAvatars(prev => ({ ...prev, [c.id]: visuals.avatarDataUrl! }))
          if (visuals?.bannerDataUrl) setRoleBanners(prev => ({ ...prev, [c.id]: visuals.bannerDataUrl! }))
        }).catch(() => {})
      }
      setProtagonistNames((prev) => ({ ...prev, ...map }))
    }).catch(() => { /* 旧 preload 无 getRoster */ })
    window.electronAPI.project.get().then((p) => {
      if (p) setCurrentProject(p)
    })
    const unsub = window.electronAPI.companion.onRoleChanged?.((payload) => {
      void window.electronAPI.companion.getActive().then((p) => {
        if (p?.name) setCurrentPersonaName(p.name)
        if (p?.description) setCompanionBlurb(p.description)
        setCompanionStatusSummary(p?.statusSummary)
        setCompanionStatusMetrics(p?.statusMetrics)
        if (p?.id) setActiveRoleId(p.id)
        if (p?.avatarDataUrl) {
          setCompanionAvatar(p.avatarDataUrl)
          if (p.id) setRoleAvatars(prev => ({ ...prev, [p.id]: p.avatarDataUrl! }))
        }
        if (p?.bannerDataUrl) {
          setCompanionBanner(p.bannerDataUrl)
          if (p.id) setRoleBanners(prev => ({ ...prev, [p.id]: p.bannerDataUrl! }))
        }
        setCompanionFirstContact(p?.firstContact ? { openingLine: p.firstContact.openingLine, quote: p.firstContact.quote } : undefined)
      })
      const sid = activeSessionIdRef.current
      const sess = sid ? sessionsRef.current.find((s) => s.id === sid) : undefined
      if (sess?.roleId && sess.roleId !== payload.roleId && sess.sessionKind !== 'summon') {
        toast('主角已切换。当前会话仍绑定旧主角，请新建对话开始新关系。', 'info')
      }
    })
    const unsubVisuals = window.electronAPI.companion.onVisualsUpdated?.((visuals) => {
      if (visuals.avatarDataUrl) {
        setRoleAvatars((prev) => ({ ...prev, [visuals.roleId]: visuals.avatarDataUrl! }))
        if (visuals.roleId === activeRoleId) setCompanionAvatar(visuals.avatarDataUrl)
      }
      if (visuals.bannerDataUrl) {
        setRoleBanners((prev) => ({ ...prev, [visuals.roleId]: visuals.bannerDataUrl! }))
        if (visuals.roleId === activeRoleId) setCompanionBanner(visuals.bannerDataUrl)
      }
    })
    const unsubMilestone = window.electronAPI.companion.onMilestone?.((payload) => {
      if (payload.toast) toast(payload.toast, 'info')
    })
    const unsubMomentTip = window.electronAPI.companion.onMomentTip?.((payload) => {
      if (payload.toast) {
        if (!((activeViewRef.current === 'world' && worldTabRef.current === 'moments') || activeViewRef.current === 'moments')) {
          setUnreadMomentsCount((c) => c + (payload.published || 1))
        }
        toast(payload.toast, 'info', {
          onClick: () => {
            setActiveView('world')
            setWorldTab('moments')
          },
        })
      }
    })
    const unsubMomentUpdated = window.electronAPI.companion.onMomentUpdated?.((payload) => {
      if (payload.reply) {
        if (!((activeViewRef.current === 'world' && worldTabRef.current === 'moments') || activeViewRef.current === 'moments')) {
          setUnreadMomentsCount((c) => c + 1)
        }
        toast(`${payload.reply.actorName} 回复了评论：“${payload.reply.text}”`, 'info', {
          onClick: () => {
            setActiveView('world')
            setWorldTab('moments')
          },
        })
      }
    })
    const unsubLifeResonance = window.electronAPI.companion.onLifeResonanceCreated?.((payload) => {
      if (payload.message) {
        toast(payload.message, 'info', {
          onClick: () => {
            setActiveView('world')
            if (payload.resonance.kind === 'culture_wish') {
              setWorldTab('culture')
            }
          },
        })
      }
    })
    const unsubResonanceCompleted = window.electronAPI.companion.onResonanceCompleted?.((payload) => {
      if (payload.message) {
        toast(payload.message, 'info', {
          onClick: () => {
            setActiveView('world')
            setWorldTab('culture')
          },
        })
      }
    })
    const unsubGreeting = window.electronAPI.companion.onProactiveGreeting?.((payload) => {
      if (payload.toast) {
        toast(payload.toast, 'info', {
          onPresented: () => {
            void window.electronAPI.companion.acknowledgeProactiveGreeting?.({ attemptId: payload.attemptId, receiptToken: payload.receiptToken })
              .catch(() => console.warn('[Companion] 问候呈现记录未保存'))
          },
          onClick: () => {
            if (payload.sessionId) {
              setActiveView('chat')
              void switchSession(payload.sessionId)
            }
          },
        })
        if (payload.sessionId && activeSessionId === payload.sessionId) {
          void window.electronAPI.session.get(payload.sessionId).then((s) => {
            if (s) setMessages(s.messages)
          })
        }
      }
    })
    const unsubSpontaneousImpulse = window.electronAPI.companion.onSpontaneousImpulse?.((payload) => {
      if (payload.toastMessage) {
        toast(payload.toastMessage, 'info', {
          onClick: () => {
            if (payload.sessionId) {
              setActiveView('chat')
              void switchSession(payload.sessionId)
            }
          },
        })
      }
      if (payload.sessionId && activeSessionId === payload.sessionId) {
        void window.electronAPI.session.get(payload.sessionId).then((s) => {
          if (s) setMessages(s.messages)
        })
      }
    })
    const unsubKeepsakeGifted = window.electronAPI.companion.onKeepsakeGifted?.((payload) => {
      if (payload.toastTitle) {
        toast(`🎁 ${payload.toastTitle}：${payload.keepsake.name}`, 'info', {
          onClick: () => {
            setActiveView('world')
            setWorldTab('keepsakes')
          },
        })
      }
    })
    return () => {
      unsub?.()
      unsubVisuals?.()
      unsubMilestone?.()
      unsubMomentTip?.()
      unsubMomentUpdated?.()
      unsubLifeResonance?.()
      unsubResonanceCompleted?.()
      unsubGreeting?.()
      unsubSpontaneousImpulse?.()
      unsubKeepsakeGifted?.()
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

  const openSummonSession = async (sessionId: string) => {
    await loadSessions()
    setActiveView('chat')
    await switchSession(sessionId)
  }

  const deleteSession = async (sessionId: string) => {
    await window.electronAPI.session.delete(sessionId)
    if (activeSessionId === sessionId) {
      streamingSessionRef.current = null
      setActiveSessionId(null)
      setMessages([])
      setActiveTools([])
      setIsStreaming(false)
      setReasoning(resetReasoning())
      setUsage(null)
      setToolCollapse({})
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

  // 角色架快捷入口属于设置；记录来源只用于返回，不能复活人物世界的隐藏角色架页。
  const openRoleShelf = () => {
    settingsReturnView.current = activeView
    setSettingsEntry('role-shelf')
    setActiveView('settings')
  }

  const openModelSettings = () => {
    settingsReturnView.current = activeView
    setSettingsEntry('model')
    setActiveView('settings')
  }

  const closeSettings = useCallback((nextView?: ShellView) => {
    setActiveView(nextView ?? settingsReturnView.current)
    settingsReturnView.current = 'chat'
    setSettingsEntry('default')
    if (window.electronAPI) {
      window.electronAPI.companion.getActive().then((p) => {
        if (p?.name) setCurrentPersonaName(p.name)
        if (p?.description) setCompanionBlurb(p.description)
        setCompanionStatusSummary(p?.statusSummary)
        setCompanionStatusMetrics(p?.statusMetrics)
        if (p?.id) setActiveRoleId(p.id)
        setCompanionFirstContact(p?.firstContact ? { openingLine: p.firstContact.openingLine, quote: p.firstContact.quote } : undefined)
      })
      window.electronAPI.companion.listProtagonists().then((list) => {
        const map: Record<string, string> = {}
        for (const p of list) map[p.id] = p.name
        setProtagonistNames(map)
      })
      window.electronAPI.settings.get().then((s) => {
        setCurrentModel(s.llmEffectiveModel || '')
        if (s.executionMode) setApprovalMode(s.executionMode as 'confirm-all' | 'auto' | 'full-access')
        setDeveloperMode(import.meta.env.MODE === 'ui-e2e' || s.developerMode === 'true')
      })
    }
  }, [])

  // 保存等待期间普通渲染不能撤销离页；只读取已提交回调，视图切换/卸载仍取消旧导航。
  // 用 layout effect 在页面可交互前更新，避免冻结会话状态或保留上一视图的快捷键。
  const shortcutContext = useRef({ createNewSession, searchOpen, toast })
  useLayoutEffect(() => {
    shortcutContext.current = { createNewSession, searchOpen, toast }
  })

  useLayoutEffect(() => {
    let navigationActive = true
    const canNavigate = async (target: ShellView) => {
      if (target !== 'debug' && target !== 'playground') return true
      if (import.meta.env.MODE === 'ui-e2e' || !window.electronAPI) return true
      try {
        const enabled = (await window.electronAPI.settings.get()).developerMode === 'true'
        if (!navigationActive) return false
        setDeveloperMode(enabled)
        return enabled
      } catch {
        if (navigationActive) shortcutContext.current.toast('无法读取开发者模式，请稍后重试', 'error')
        return false
      }
    }
    const navigate = async (target: ShellView, after?: () => void) => {
      if (activeView === 'settings') {
        if (settingsNavigationPending.current) return
        settingsNavigationPending.current = true
        try {
          if (!settingsSaveBeforeLeave.current || !(await settingsSaveBeforeLeave.current())) return
          if (!(await canNavigate(target)) || !navigationActive) return
          closeSettings(target)
          after?.()
        } finally {
          settingsNavigationPending.current = false
        }
      } else {
        if (!(await canNavigate(target)) || !navigationActive) return
        setActiveView(target)
        after?.()
      }
    }
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        void navigate(activeView === 'debug' ? 'chat' : 'debug')
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        void navigate(activeView === 'playground' ? 'chat' : 'playground')
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        void navigate('chat', () => { void shortcutContext.current.createNewSession() })
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        void navigate(activeView === 'settings' ? 'chat' : 'settings')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        void navigate(activeView === 'memory' ? 'chat' : 'memory')
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        void navigate(activeView === 'moments' ? 'chat' : 'moments')
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        void navigate(activeView === 'skills' ? 'chat' : 'skills')
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
        if (shortcutContext.current.searchOpen) { setSearchOpen(false); setSearchQuery('') }
        else if (activeView !== 'chat') { void navigate('chat') }
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => {
      navigationActive = false
      window.removeEventListener('keydown', handleGlobalKey)
    }
  }, [activeView, closeSettings])

  useEffect(() => {
    if (!projectMenuOpen) return
    const handler = () => { setProjectMenuOpen(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [projectMenuOpen])

  useEffect(() => {
    if (!modelMenuOpen) return
    const handler = () => { setModelMenuOpen(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [modelMenuOpen])

  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null)
  const isNearBottomRef = useRef(true)

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true
    setShowScrollToBottom(false)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, activeTools])

  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isNearBottomRef.current = distanceFromBottom <= 100
    setShowScrollToBottom(distanceFromBottom > 120)

    const nodes = el.querySelectorAll<HTMLElement>('[data-chat-turn-id]')
    if (nodes.length === 0) return
    const containerTop = el.getBoundingClientRect().top
    const anchorOffset = el.clientHeight * 0.35
    let currentId: string | null = nodes[0].dataset.chatTurnId ?? null
    for (const node of nodes) {
      if (node.getBoundingClientRect().top - containerTop <= anchorOffset) {
        currentId = node.dataset.chatTurnId ?? currentId
      } else {
        break
      }
    }
    setActiveTurnId((prev) => (prev === currentId ? prev : currentId))
  }, [])

  const jumpToTurn = useCallback((turnId: string) => {
    const el = chatContainerRef.current
    if (!el) return
    const target = el.querySelector<HTMLElement>(`[data-chat-turn-id="${CSS.escape(turnId)}"]`)
    if (!target) return
    isNearBottomRef.current = false
    setActiveTurnId(turnId)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    isNearBottomRef.current = true
    setShowScrollToBottom(false)
    setActiveTurnId(null)
  }, [activeSessionId])

  useEffect(() => {
    const normalizedTheme = normalizeThemeId(theme)
    if (normalizedTheme !== theme) setTheme(normalizedTheme)
    document.documentElement.setAttribute('data-theme', normalizedTheme)
    localStorage.setItem('theme', normalizedTheme)
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
      : ev.type === 'process' ? ev.message
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
          applyToolEvent(prev, ev, { keepExpanded: false }) ?? prev,
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

      case 'error': {
        const presentation = formatCompanionErrorBubble({
          code: ev.code,
          message: ev.message,
          roleId: activeRoleIdRef.current,
        })
        setMessages((prev) => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            return [...prev.slice(0, -1), { ...last, content: presentation.displayMarkdown }]
          }
          return [...prev, { id: genId(), role: 'assistant', content: presentation.displayMarkdown, timestamp: Date.now() }]
        })
        if (presentation.noticeText) {
          setModeChangeNotice(presentation.noticeText)
        }
        setReasoning((prev) => completeReasoning(prev))
        break
      }

      case 'execution_mode_changed':
        setApprovalMode(ev.mode === 'plan-first' ? 'confirm-all' : ev.mode)
        setModeChangeNotice(ev.reason)
        toast(ev.reason, 'warning')
        break

      case 'process':
        setModeChangeNotice(ev.message)
        break

      case 'done':
        // 工具卡属于当前流式回合；详细调用记录统一在全页 Debug 中查看。
        setActiveTools([])
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
    const hasAttachments = pendingImages.length > 0 || attachedFiles.length > 0 || mentionedFiles.length > 0
    if ((!text && !hasAttachments) || isStreaming) return

    let sid = activeSessionId
    if (!sid) {
      const session = await window.electronAPI.session.create()
      sid = session.id
      setActiveSessionId(sid)
      await loadSessions()
    }

    let fullContent = text
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles.map(f => `--- 附件: ${f.name} ---\n${f.content}`).join('\n\n')
      fullContent = text ? `${text}\n\n${fileContext}` : fileContext
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

    let finishEvents!: () => void
    const eventsCompleted = new Promise<void>((resolve) => { finishEvents = resolve })
    let turnFailed = false
    const cleanup = window.electronAPI.chat.onEvent((ev) => {
      const evSessionId = (ev as AgentStreamEvent & { sessionId?: string }).sessionId
      if (evSessionId && evSessionId !== sid) return
      if (ev.type === 'done') finishEvents()
      if (streamingSessionRef.current !== sid) return
      if (ev.type === 'error') turnFailed = true
      handleEvent(ev)
    })

    const cleanupConfirm = window.electronAPI.chat.onConfirmRequest((data) => {
      if (data.sessionId !== sid) return
      setConfirmQueue(q => [...q, { requestId: data.requestId, name: data.name, args: data.args }])
    })

    try {
      await window.electronAPI.chat.send(sid, userMsg)
      // 快速拒绝时 invoke 回执先于流事件；两者都完成后才解除监听和发送锁。
      // error 不一定写入会话库，不能用空历史覆盖；invoke 拒绝则不等待不会产生的 done。
      await eventsCompleted
      if (!turnFailed && streamingSessionRef.current === sid) {
        const session = await window.electronAPI.session.get(sid)
        if (session && streamingSessionRef.current === sid) {
          const cites = turnCitationsRef.current
          const msgs = session.messages.map(m => ({ ...m }))
          for (let i = msgs.length - 1; cites.length && i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], memoryCitations: cites }
              break
            }
          }
          setMessages(msgs)
        }
      }
    } catch {
      if (streamingSessionRef.current === sid) {
        handleEvent({ type: 'error', message: '发送未完成，请稍后重试。' })
      }
    } finally {
      cleanup()
      cleanupConfirm()
      if (streamingSessionRef.current === sid) {
        setIsStreaming(false)
        streamingSessionRef.current = null
        setBgStreamingSessionId(null)
      }
      void loadSessions()
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
    const newImages: ImageAttachment[] = []
    const imageExtRe = /\.(png|jpe?g|gif|webp|bmp)$/i
    const docExtRe = /\.(pdf|docx|xlsx|xls)$/i

    const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read failed'))
      reader.readAsDataURL(file)
    })

    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/') || imageExtRe.test(file.name)
      if (isImage) {
        if (file.size > 5 * 1024 * 1024) {
          toast(`图片 ${file.name} 超过 5MB 限制`, 'warning')
          continue
        }
        try {
          const dataUrl = await readAsDataUrl(file)
          newImages.push({
            dataUrl,
            mimeType: file.type || 'image/png',
            fileName: file.name || 'image.png',
          })
        } catch {
          toast(`无法读取图片 ${file.name}`, 'error')
        }
        continue
      }

      if (docExtRe.test(file.name)) {
        if (file.size > 10 * 1024 * 1024) {
          toast(`文档 ${file.name} 超过 10MB 限制`, 'warning')
          continue
        }
        try {
          const dataUrl = await readAsDataUrl(file)
          const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : ''
          const parsed = await window.electronAPI.chat.parseAttachment({
            fileName: file.name,
            dataBase64: base64,
          })
          if (parsed.ok) {
            newFiles.push({ name: file.name, content: parsed.text })
            if (parsed.truncated) {
              toast(`文档 ${file.name} 较长，已自动截取前 8 万字`, 'info')
            }
          } else {
            toast(`${file.name}：${parsed.error}`, 'warning')
          }
        } catch {
          toast(`无法解析文档 ${file.name}`, 'error')
        }
        continue
      }

      if (file.size > 1024 * 1024) {
        toast(`文件 ${file.name} 超过 1MB 限制`, 'warning')
        continue
      }
      try {
        const text = await file.text()
        if (text.includes('\u0000')) {
          toast(`暂不支持直接读取二进制文件 ${file.name}`, 'warning')
          continue
        }
        newFiles.push({ name: file.name, content: text })
      } catch {
        toast(`无法读取 ${file.name}`, 'error')
      }
    }
    if (newImages.length > 0) setPendingImages(prev => [...prev, ...newImages])
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
  const userTurns = useMemo(() => {
    const result: Array<{ id: string; preview: string; replyPreview?: string; timestamp?: number }> = []
    for (let i = 0; i < visibleMessages.length; i += 1) {
      const m = visibleMessages[i]
      if (m.role !== 'user') continue
      let replyPreview: string | undefined
      for (let j = i + 1; j < visibleMessages.length; j += 1) {
        if (visibleMessages[j].role === 'user') break
        if (visibleMessages[j].role === 'assistant' && visibleMessages[j].content.trim()) {
          replyPreview = formatTurnPreview(visibleMessages[j].content, 84)
        }
      }
      result.push({
        id: m.id,
        preview: formatTurnPreview(m.content, 68),
        replyPreview,
        timestamp: m.timestamp,
      })
    }
    return result
  }, [visibleMessages])

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

  const messageRoleId = sessions.find(session => session.id === activeSessionId)?.roleId
  const messagePersonaName = messageRoleId && messageRoleId !== activeRoleId
    ? protagonistNames[messageRoleId] || '伙伴'
    : currentPersonaName || '伙伴'

  const rawQuote = companionFirstContact?.quote
  const coldStart = buildColdStartCopy({
    name: currentPersonaName,
    description: companionBlurb,
    quote: rawQuote === '我要成为海贼王的男人！' ? '我是要成为海贼王的男人！' : rawQuote,
    firstContact: showFirstContact ? companionFirstContact : undefined,
  })

  // 全屏导航不能销毁项目工作区：保留固定位置的产品子树，仅隐藏；项目 key 才定义资源归属。
  const standaloneView = activeView === 'settings' || activeView === 'playground' || activeView === 'debug'

  // 空态首屏时将输入框居中嵌入 ChatWelcome，对话开始后落回底部；两处共享同一份输入区子树避免重复维护。
  const chatComposerInner = (
    <>
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
      <ChatComposer
        inputRef={inputRef}
        inputProps={{
          value: input,
          onChange: (e) => {
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
          },
          onKeyDown: handleKeyDown,
          onPaste: (e) => {
            handlePaste(e)
            const files = e.clipboardData?.files
            if (files && files.length > 0) {
              const hasNonImage = Array.from(files).some(f => !f.type.startsWith('image/'))
              if (hasNonImage) {
                e.preventDefault()
                handleFileAttach(Array.from(files).filter(f => !f.type.startsWith('image/')))
              }
            }
          },
          placeholder: attachedFiles.length > 0
            ? '描述附件内容或输入问题...'
            : currentProject
              ? `和${currentPersonaName || '伙伴'}说说，或输入 @ 引用项目文件…`
              : `和${currentPersonaName || '伙伴'}说说…`,
        }}
        streaming={isStreaming}
        sendDisabled={!input.trim() && pendingImages.length === 0 && attachedFiles.length === 0 && mentionedFiles.length === 0}
        modelLabel={currentModel || '未配置模型'}
        onSend={() => { void sendMessage() }}
        onStop={() => { void window.electronAPI.chat.abort(activeSessionId || undefined) }}
        onAttach={() => {
          const inp = document.createElement('input')
          inp.type = 'file'
          inp.multiple = true
          inp.onchange = () => { if (inp.files) void handleFileAttach(inp.files) }
          inp.click()
        }}
        onImageGenerate={() => {
          setInput((current) => current.trim() || buildImageDraftPrompt())
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        prefix={(
          <ChatAttachmentTray
            images={pendingImages.map((img, idx) => ({ id: `${img.fileName ?? 'image'}-${idx}`, src: img.dataUrl, fileName: img.fileName || 'image.png' }))}
            files={[
              ...attachedFiles.map((f, idx) => ({ id: `att-${f.name}-${idx}`, name: f.name, sizeBytes: f.content?.length })),
              ...mentionedFiles.map((f) => ({ id: `mention-${f.path}`, name: f.name })),
            ]}
            onRemoveImage={(idx) => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
            onRemoveFile={(idx) => {
              if (idx < attachedFiles.length) {
                setAttachedFiles(prev => prev.filter((_, i) => i !== idx))
              } else {
                const target = mentionedFiles[idx - attachedFiles.length]
                if (target) setMentionedFiles(prev => prev.filter(x => x.path !== target.path))
              }
            }}
          />
        )}
        approvalControl={<ChatApprovalControl value={approvalMode} onChange={async mode => {
          if (!window.electronAPI) throw new Error('Settings unavailable')
          await window.electronAPI.settings.set('executionMode', mode)
          setApprovalMode(mode)
        }} />}
        projectControl={(
          <div className="relative">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation()
                if (!projectMenuOpen) {
                  const list = await window.electronAPI?.project.list()
                  if (list) setRecentProjects(list)
                }
                setProjectMenuOpen(!projectMenuOpen)
              }}
              className={`flex h-6 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] transition hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)] ${currentProject ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)] opacity-75 hover:opacity-100'}`}
            >
              <Folder size={13} style={{ color: 'var(--text-muted)' }} />
              <span>{currentProject?.name || '选择工作区'}</span>
              <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
            </button>

            {projectMenuOpen && (
              <div
                className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-lg border p-1 shadow-lg"
                style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
              >
                <div className="px-2.5 pb-1.5 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>项目目录</div>

                {recentProjects.map((proj) => (
                  <button
                    key={proj.path}
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.electronAPI.project.set(proj.path)
                      setCurrentProject(proj)
                      setProjectMenuOpen(false)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition"
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

                <div className="mx-1.5 my-1 h-px" style={{ background: 'var(--border-subtle)' }} />

                <button
                  type="button"
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
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition hover:bg-[var(--hover-overlay)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <FolderOpen size={12} />
                  <span>添加新项目</span>
                </button>

                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation()
                    await window.electronAPI.project.set(null)
                    setCurrentProject(null)
                    setRightDockCollapsed(false)
                    setShowFileBrowser(false)
                    setProjectMenuOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition hover:bg-[var(--hover-overlay)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Ban size={12} />
                  <span>不使用项目</span>
                </button>
              </div>
            )}
          </div>
        )}
        modelControl={(
          <div className="relative">
            <button
              type="button"
              data-testid="chat-current-model"
              title={currentModel || '未配置模型'}
              onClick={async (e) => {
                e.stopPropagation()
                if (!modelMenuOpen) {
                  await refreshAvailableChatModels()
                }
                setModelMenuOpen(!modelMenuOpen)
              }}
              className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-[12px] text-[var(--text-secondary)] transition hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
            >
              <span className="max-w-40 truncate">{currentModel || '未配置模型'}</span>
              <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
            </button>

            {modelMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute bottom-full right-0 z-50 mb-1.5 w-60 rounded-lg border p-1 shadow-lg"
                style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
              >
                <div className="px-2.5 pb-1.5 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>切换对话模型</div>

                {availableChatModels.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto">
                    {availableChatModels.map((item) => {
                      const active = currentModel === item.model
                      return (
                        <button
                          key={`${item.connectionId}::${item.model}`}
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const s = await window.electronAPI.settings.get()
                              const prevRoutes = (JSON.parse(s.modelRoutes || '[]') as ModelRouteProfile[])
                              const routesList = Array.isArray(prevRoutes) ? prevRoutes : []
                              const selectedRoute: ModelRouteProfile = {
                                purpose: 'primary',
                                connectionId: item.connectionId,
                                model: item.model,
                                enabled: true,
                              }
                              const remainingPrimary = routesList.filter(
                                (r) => r.purpose === 'primary' && !(r.connectionId === item.connectionId && r.model.trim() === item.model),
                              )
                              const nonPrimary = routesList.filter((r) => r.purpose !== 'primary')
                              const nextRoutes = [selectedRoute, ...remainingPrimary, ...nonPrimary]
                              await window.electronAPI.settings.saveModelConfiguration({
                                connections: s.modelConnections || '[]',
                                routes: JSON.stringify(nextRoutes),
                              })
                              setCurrentModel(item.model)
                            } catch {
                              toast('切换模型失败，请前往模型设置检查连接', 'error')
                            }
                            setModelMenuOpen(false)
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition"
                          style={{
                            color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                            background: active ? 'var(--accent-subtle)' : undefined,
                          }}
                          onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--hover-overlay)' }}
                          onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '' }}
                          title={`${item.connectionName} · ${item.model}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{item.model}</div>
                            <div className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.connectionName}</div>
                          </div>
                          {active && <Check size={12} className="shrink-0" style={{ color: 'var(--accent-fg)' }} />}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-2.5 py-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    当前仅有：{currentModel || '未配置模型'}
                  </div>
                )}

                <div className="mx-1.5 my-1 h-px" style={{ background: 'var(--border-subtle)' }} />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setModelMenuOpen(false)
                    openModelSettings()
                  }}
                  className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] text-[var(--text-secondary)] transition hover:bg-[var(--hover-overlay)] hover:text-[var(--text-primary)]"
                >
                  <span>管理模型设置…</span>
                  <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
            )}
          </div>
        )}
      />
    </>
  )

  return (
    <>
    <div className="app-shell relative flex h-screen select-none" style={{ display: standaloneView ? 'none' : undefined, background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* 全宽固定氛围底图：Chat 与人物世界共享左侧栏强磨砂透色；人物世界右侧保持不透明底色防与头图重影 */}
      {chatBackdropEnabled && (activeView === 'chat' || isWorldView(activeView)) ? (
        <CompanionSceneBackdrop roleId={activeRoleId} bannerSrc={roleBanners[activeRoleId] ?? companionBanner} opacity={chatBackdropOpacity} />
      ) : null}
      {/* ── Primary 侧栏（Alice 壳） ── */}
      {/*
       * 侧栏保留在 DOM 中，只动画外层轨道的宽度和位移。
       * 这样展开 / 收起不会靠卸载造成硬切，同时 ResizeHandle 会和侧栏一起进退。
       */}
      {/* 最左 48px 极窄图标导轨：顶部伙伴头像 + 对话 + 用户可自定义生活快捷入口 + 底部系统/开发入口 */}
      <NavigationRail
        personaName={currentPersonaName}
        avatarSrc={roleAvatars[activeRoleId] ?? companionAvatar}
        activeView={activeView}
        activeWorldTab={worldTab}
        worldShortcuts={railWorldShortcuts}
        onChangeWorldShortcuts={(next) => {
          setRailWorldShortcuts(next)
          saveRailWorldShortcuts(next)
        }}
        onOpenShelf={openRoleShelf}
        onNavigate={(view) => {
          if (isWorldView(view) || view === 'world') {
            setWorldTab(worldTabFromView(view === 'world' ? 'world' : view))
            setActiveView('world')
            return
          }
          setActiveView(view)
        }}
        onOpenWorldTab={(tab) => {
          setWorldTab(tab)
          setActiveView('world')
        }}
        developerMode={developerMode}
        unreadMomentsCount={unreadMomentsCount}
        activeBgTaskCount={activeBgTaskCount}
        frosted={chatBackdropEnabled && (activeView === 'chat' || isWorldView(activeView))}
        showRightBorder={!(sidebarOpen && activeView === 'chat')}
      />

      {/* 旁侧会话抽屉：切进人物世界时自动收起留出宽屏画布，回对话自动恢复 */}
      {(() => {
        const showSessionSidebar = sidebarOpen && activeView === 'chat'
        return (
      <div
        ref={sidebarShellRef}
        className="sidebar-transition relative z-[1] flex min-h-0 shrink-0 overflow-hidden"
        style={{
          width: showSessionSidebar ? sidebarWidth + 1 : 0,
          opacity: showSessionSidebar ? 1 : 0,
          transform: showSessionSidebar ? undefined : 'translateX(-12px)',
          pointerEvents: showSessionSidebar ? 'auto' : 'none',
        }}
        aria-hidden={!showSessionSidebar}
        inert={!showSessionSidebar}
        data-open={showSessionSidebar}
        data-testid="sidebar-transition-shell"
      >
        <PrimarySidebar
          collapseControlPlacement="header"
          showFooter={false}
          showBrandAvatar={false}
          frosted={chatBackdropEnabled && (activeView === 'chat' || isWorldView(activeView))}
          developerMode={developerMode}
          personaName={currentPersonaName}
          personaBlurb={companionBlurb || '越探索，越着迷。'}
          avatarSrc={companionAvatar}
          activeView={activeView}
          activeSessionId={activeSessionId}
          sessionGroups={sessionGroups}
          sessionPreviews={sessionPreviews}
          pinnedIds={pinnedIds}
          bgStreamingSessionId={bgStreamingSessionId}
          activeBgTaskCount={activeBgTaskCount}
          unreadMomentsCount={unreadMomentsCount}
          sidebarSearchOpen={sidebarSearchOpen}
          sessionFilter={sessionFilter}
          sessionFilterRef={sessionFilterRef}
          renamingId={renamingId}
          renameValue={renameValue}
          width={sidebarWidth}
          onOpenShelf={openRoleShelf}
          onCreateSession={() => { setActiveView('chat'); void createNewSession() }}
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
          onCollapse={() => {
            sidebarAutoCollapsedRef.current = false
            manualSidebarWithDockRef.current = false
            setSidebarOpen(false)
          }}
        />
        <ResizeHandle
          orientation="vertical"
          title="拖动调整侧栏宽度"
          onDelta={(dx) => setSidebarWidth((w) => w + dx)}
        />
      </div>
        )
      })()}

      {/* 会话右键菜单 */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null) }}
        >
          <div
            className="absolute rounded-lg border p-1 shadow-lg"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: 'var(--dropdown-bg)',
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
                className="flex w-full cursor-pointer items-center rounded-md px-2.5 py-1.5 text-left text-[13px] transition hover:bg-[var(--hover-overlay)]"
                style={{ color: 'danger' in item && item.danger ? 'var(--danger)' : 'var(--text-secondary)' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 主区域 ── */}
      <div className={`${activeView === 'chat' ? 'chat-shape-scope ' : ''}relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden`} style={activeView === 'chat' ? layoutProfileStyle('chat') : undefined}>
        {/* 收起侧栏后的展开按钮：常驻于主区域左上角，覆盖 Chat / 人物世界 / 记忆 / 技能全部视图 */}
        {activeView === 'chat' && !sidebarOpen && sidebarReopenReady && (
          <IconButton
            ref={sidebarReopenRef}
            size={32}
            label="展开侧栏"
            onClick={() => {
              sidebarAutoCollapsedRef.current = false
              if (dockActive) manualSidebarWithDockRef.current = true
              setSidebarReopenReady(false)
              setSidebarOpen(true)
              requestAnimationFrame(() => sidebarShellRef.current?.querySelector<HTMLButtonElement>('button[aria-label="收起侧栏"]')?.focus())
            }}
            className="pointer-events-auto absolute left-3 top-3 z-30 hover:bg-[var(--hover-overlay)]"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-overlay)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
            title="展开侧边栏 (Ctrl+B)"
          >
            <PanelLeftOpen size={16} />
          </IconButton>
        )}
        {/* Chat 工具槽常驻，避免工作区入口随项目或聊天阶段消失；其它全页视图仍自带导航。 */}
        {activeView === 'chat' && (
          <div data-testid="chat-toolbar" className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-12 items-center justify-end px-3">
            <div className="min-w-0 flex-1" aria-hidden="true" />
              <IconButton
                onClick={() => {
                  if (!showFileBrowser) {
                    setShowFileBrowser(true)
                    setRightDockCollapsed(false)
                  } else {
                    setRightDockCollapsed((current) => !current)
                  }
                }}
                size={32}
                className="pointer-events-auto mr-2 transition hover:bg-[var(--hover-overlay)]"
                style={{
                  color: showFileBrowser && !rightDockCollapsed ? 'var(--accent-fg)' : 'var(--text-muted)',
                  background: showFileBrowser && !rightDockCollapsed ? 'var(--accent-subtle)' : undefined,
                }}
                aria-expanded={showFileBrowser && !rightDockCollapsed}
                aria-controls="chat-right-dock"
                onMouseEnter={(e) => { if (!showFileBrowser || rightDockCollapsed) e.currentTarget.style.background = 'var(--hover-overlay)' }}
                onMouseLeave={(e) => { if (!showFileBrowser || rightDockCollapsed) e.currentTarget.style.background = '' }}
                label={showFileBrowser && !rightDockCollapsed ? '收起工作区' : '打开工作区'}
                title={showFileBrowser && !rightDockCollapsed ? '收起工作区' : '打开工作区'}
              >
                <PanelRight size={16} />
              </IconButton>
            {(() => {
              const session = sessions.find((item) => item.id === activeSessionId)
              const sessionRole = session?.roleId
              const isSummon = session?.sessionKind === 'summon'
              const mismatched = Boolean(sessionRole && sessionRole !== activeRoleId && !isSummon)
              if (!isSummon && !mismatched) return null
              const title = isSummon
                ? '召唤子会话：已装载对方人设，不推进其生活世界'
                : '此会话绑定旧主角；生活世界已是新活跃主角'
              return (
                <span className="pointer-events-auto rounded-full px-2 py-1 text-[10px]" style={{ color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 10%, transparent)' }} title={title}>
                  {isSummon ? '召唤会话' : '会话角色已变化'}
                </span>
              )
            })()}
          </div>
        )}

        {activeView !== 'chat' && (
          <div className="view-transition flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            {isWorldView(activeView) ? (
              <WorldHub
                profile={{
                  name: currentPersonaName,
                  description: companionBlurb,
                  statusSummary: companionStatusSummary,
                  statusMetrics: companionStatusMetrics,
                  avatarSrc: roleAvatars[activeRoleId] ?? companionAvatar,
                  bannerSrc: roleBanners[activeRoleId] ?? companionBanner,
                }}
                roleId={activeRoleId}
                onTakeToChat={({ text }: { text: string }) => {
                  setActiveView('chat')
                  setInput(text)
                  requestAnimationFrame(() => {
                    const el = inputRef.current
                    if (!el) return
                    el.focus()
                    const end = el.value.length
                    el.setSelectionRange(end, end)
                  })
                }}
                allowAssetEditing={false}
                onGenerateAssetImage={(asset) => {
                  setActiveView('chat')
                  setInput(buildWorldAssetImageDraftPrompt(asset))
                  requestAnimationFrame(() => {
                    const el = inputRef.current
                    if (!el) return
                    el.focus()
                    const end = el.value.length
                    el.setSelectionRange(end, end)
                  })
                }}
                tab={activeView === 'world' ? worldTab : worldTabFromView(activeView)}
                onTabChange={(t) => {
                  setWorldTab(t)
                  setActiveView('world')
                }}
                onClose={() => setActiveView('chat')}
                onOpenSession={(sid) => { void openSummonSession(sid) }}
                onOpenShelf={openRoleShelf}
                unreadMomentsCount={unreadMomentsCount}
                enableImagePreview
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
                  <SkillsPanel visible={true} />
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

        {/* 消息列表 + 左侧轮次跳转导航轨 */}
        {activeView === 'chat' && <div className="relative flex min-h-0 flex-1 flex-col">
        <ChatTurnRail
          turns={userTurns}
          activeTurnId={activeTurnId ?? userTurns[userTurns.length - 1]?.id ?? null}
          onJumpToTurn={jumpToTurn}
        />
        <div
          ref={chatContainerRef}
          data-testid="chat-messages"
          onScroll={handleChatScroll}
          className={`scrollbar-thin scrollbar-stable relative flex-1 select-text overflow-y-auto ${dragOver ? 'ring-2 ring-inset ring-[var(--accent)]' : ''}`}
          style={dragOver ? { ['--tw-ring-color' as string]: 'var(--accent)' } as React.CSSProperties : {}}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFileAttach(e.dataTransfer.files) }}
        >
          <div className={`relative z-[1] flex min-h-full flex-col ${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`}>
          <div className="mx-auto flex min-h-full w-full flex-1 flex-col" style={{ maxWidth: 'var(--layout-width)' }} data-testid="chat-content">
            {/* 欢迎屏 — 无头像时段问候 + 角色台词 + 居中输入框（上盖托盘）+ 等宽毛玻璃朋友圈悬浮切片卡 */}
            {messages.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center pb-14 pt-4">
                <ChatWelcome
                  title={coldStart.title}
                  subtitle={coldStart.subtitle}
                  roleName={currentPersonaName}
                  composer={(
                    <div
                      className="relative w-full"
                      style={{ ...layoutProfileStyle('chat'), background: 'transparent' }}
                      data-testid="chat-composer-area"
                    >
                      {chatComposerInner}
                    </div>
                  )}
                  latestMoment={latestWelcomeMoment ? {
                    ...latestWelcomeMoment,
                    onOpen: () => { setWorldTab('moments'); setActiveView('world') },
                    onTalkAbout: () => {
                      const snippet = latestWelcomeMoment.text.length > 60
                        ? `${latestWelcomeMoment.text.slice(0, 60)}…`
                        : latestWelcomeMoment.text
                      const draft = `聊聊你刚发的这条动态：「${snippet}」`
                      setInput(draft)
                      requestAnimationFrame(() => {
                        const el = inputRef.current
                        if (el) {
                          el.focus()
                          el.setSelectionRange(draft.length, draft.length)
                        }
                      })
                    },
                  } : null}
                  onGreet={() => { void sendMessage('你好，介绍一下你自己') }}
                  onPlanDay={() => { void sendMessage('今天打算怎么过？陪我想想。') }}
                  onAskRecent={() => { void sendMessage('最近在忙啥呢？跟我聊聊。') }}
                  onOpenWorld={() => { setWorldTab('moments'); setActiveView('world') }}
                />
              </div>
            )}

            {/* 消息流 — Alice 壳 Phase B（多轮工具任务完成后默认折叠过程，只留最后一轮最终回复与外露生图） */}
            <div className={LAYOUT_CLASSES.section}>
              {groupVisibleMessages(visibleMessages).map((entry) => {
                const isUser = entry.kind === 'user'
                const msg = isUser ? entry.msg : entry.finalMsg
                const intermediateSteps = isUser ? [] : entry.intermediate
                const hasMultiTurnProcess = intermediateSteps.length > 0
                const isSearchMatch = searchQuery && (
                  msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                  || intermediateSteps.some((step) => step.content.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                const dimmed = searchQuery && !isSearchMatch
                const isLastMsg = (isUser ? entry.visibleIndex : entry.lastVisibleIndex) === visibleMessages.length - 1
                const showThinkingBeforeMsg = !isUser && isLastMsg && reasoning.chunks.length > 0
                const isRunStreaming = !isUser && isStreaming && isLastMsg
                const processExpanded = hasMultiTurnProcess && (isRunStreaming || Boolean(expandedProcessRuns[msg.id]))
                const intermediateResolved = hasMultiTurnProcess
                  ? intermediateSteps.map((step) => ({
                      step,
                      tools: applyToolCollapse(
                        resolveToolsForAssistant(step, messages, {
                          liveHostId: liveToolHostId,
                          liveTools: activeTools,
                          expandHistoric: false,
                        }),
                      ),
                    }))
                  : []
                const allIntermediateTools = intermediateResolved.flatMap((item) => item.tools)
                const intermediateImageTools = allIntermediateTools.filter((item) => Boolean(item.generatedImages?.length))
                const navigateToWorldTab = (targetTab: 'moments' | 'culture' | 'wardrobe' | 'home' | 'footprints') => {
                  setActiveView('world')
                  setWorldTab(targetTab)
                }

                return (
                  <div
                    key={msg.id}
                    data-chat-turn-id={isUser ? msg.id : undefined}
                    className={`animate-fade-in-up group ${dimmed ? 'opacity-20' : ''} ${isSearchMatch ? 'rounded-md ring-1 ring-[var(--accent)]' : ''}`}
                    style={isSearchMatch ? { ['--tw-ring-color' as string]: 'var(--accent)', ['--tw-ring-opacity' as string]: '0.3' } as React.CSSProperties : {}}
                  >
                    <ChatMessageFrame
                      role={isUser ? 'user' : 'assistant'}
                      name={messagePersonaName}
                      avatarSrc={isUser ? undefined : ((messageRoleId ? roleAvatars[messageRoleId] : undefined) ?? roleAvatars[activeRoleId] ?? companionAvatar)}
                      showUserAvatar={false}
                      timestamp={msg.timestamp}
                      editing={isUser && editingMsgId === msg.id}
                      actions={isUser ? (
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
                      ) : (
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
                      )}>
                      {isUser ? <>
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
                          <>
                            {msg.images && msg.images.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {msg.images.map((img, i) => (
                                  <ImagePreviewImage key={i} src={img.dataUrl} alt={img.fileName || 'image'} className="max-h-48 max-w-full rounded border" buttonClassName="max-w-full" style={{ borderColor: 'var(--border-color)' }} />
                                ))}
                              </div>
                            )}
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </>
                        )}

                      </> : <>
                        {hasMultiTurnProcess ? (
                          <div className="mb-2" data-testid="assistant-process-group">
                            <ActionButton
                              variant="plain"
                              onClick={() => setExpandedProcessRuns((prev) => ({ ...prev, [msg.id]: !processExpanded }))}
                              aria-expanded={processExpanded}
                              className="-mx-1.5 !min-h-0 !justify-start gap-1 rounded-[var(--radius-sm)] border-0 !px-1.5 !py-1 text-left text-[12px] hover:bg-[var(--hover-overlay)]"
                            >
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {isRunStreaming
                                  ? `正在处理中（已完成 ${allIntermediateTools.length || intermediateSteps.length} 步）…`
                                  : buildProcessSummaryText(
                                      allIntermediateTools.map((t) => t.name),
                                      intermediateSteps.length,
                                      showThinkingBeforeMsg,
                                      allIntermediateTools.filter((t) => t.status === 'error').length,
                                    )}
                              </span>
                              <ChevronRight
                                size={12}
                                className={`shrink-0 transition-transform ${processExpanded ? 'rotate-90' : ''}`}
                                style={{ color: 'var(--text-muted)' }}
                              />
                            </ActionButton>
                            {processExpanded && (
                              <div className="mt-1 mb-3.5 space-y-0.5">
                                {showThinkingBeforeMsg && (
                                  <ReasoningCallback
                                    chunks={reasoning.chunks}
                                    expanded={thinkingExpanded}
                                    onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                                    streaming={isStreaming}
                                    presentation="stable"
                                    embedded
                                  />
                                )}
                                {intermediateResolved.map(({ step, tools: stepTools }) => (
                                  stepTools.length > 0 ? (
                                    <ToolCallbackList
                                      key={step.id}
                                      tools={stepTools.map((t) => ({ ...t, generatedImages: undefined }))}
                                      sessionId={activeSessionId}
                                      onToggleCollapse={toggleToolCollapse}
                                      onNavigateToWorld={navigateToWorldTab}
                                      embedded
                                    />
                                  ) : null
                                ))}
                              </div>
                            )}
                          </div>
                        ) : showThinkingBeforeMsg ? (
                          <ReasoningCallback
                            chunks={reasoning.chunks}
                            expanded={thinkingExpanded}
                            onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                            streaming={isStreaming}
                            presentation="stable"
                            className="mb-2"
                          />
                        ) : null}
                        {(msg.content || (isStreaming && isLastMsg)) && (
                        <div className="mb-3" style={{ color: 'var(--text-primary)' }}>
                          {msg.content ? <MarkdownRenderer content={msg.content} /> : null}
                          {isStreaming && msg.id === messages.filter(m => m.role === 'assistant').at(-1)?.id && (
                            <span className="animate-typing-cursor ml-0.5 inline-block h-4 w-0.5" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                        )}
                        {intermediateImageTools.length > 0 && (
                          <ToolCallbackList
                            tools={intermediateImageTools}
                            sessionId={activeSessionId}
                            onToggleCollapse={toggleToolCollapse}
                            imagesOnly
                            className="mt-2"
                          />
                        )}
                        {(() => {
                          // Alice：tool_call 跟在本回合 assistant 正文后；历史从 toolCalls+后续 tool 还原
                          const turnTools = applyToolCollapse(
                            resolveToolsForAssistant(msg, messages, {
                              liveHostId: liveToolHostId,
                              liveTools: activeTools,
                              expandHistoric: false,
                            }),
                          )
                          return turnTools.length > 0 ? (
                            <ToolCallbackList
                              tools={turnTools}
                              sessionId={activeSessionId}
                              onToggleCollapse={toggleToolCollapse}
                              onNavigateToWorld={navigateToWorldTab}
                              className="mt-1"
                            />
                          ) : null
                        })()}

                      </>}
                    </ChatMessageFrame>
                  </div>
                )
              })}
            </div>

            {/* 助手消息尚未出现时，思考过程与回复生成中提示共用助手列，与正式回复严格左对齐 */}
            {(() => {
              const showPendingReasoning = (messages.length > 0 || isStreaming) && reasoning.chunks.length > 0 && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant'
              const pendingContentPhase = contentPhase(
                Boolean(
                  messages[messages.length - 1]?.role === 'assistant'
                  && messages[messages.length - 1]?.content,
                ),
                isStreaming,
              )
              if (!showPendingReasoning && pendingContentPhase !== 'active') return null
              return (
                <div className="mt-4">
                  <ChatMessageFrame
                    role="assistant"
                    name={currentPersonaName}
                    avatarSrc={roleAvatars[activeRoleId] ?? companionAvatar}
                  >
                    {showPendingReasoning && (
                      <ReasoningCallback
                        chunks={reasoning.chunks}
                        expanded={thinkingExpanded}
                        onToggle={() => setThinkingExpanded(!thinkingExpanded)}
                        streaming={isStreaming}
                        presentation="stable"
                        className="mb-2"
                      />
                    )}
                    {!showPendingReasoning && <ContentCallbackCue phase={pendingContentPhase} />}
                  </ChatMessageFrame>
                </div>
              )
            })()}

            <div ref={messagesEndRef} />
          </div>
          </div>

        </div>
        </div>}

        {/* 输入区 — 对话开始后固定落回底部，空态时由 ChatWelcome 居中承载 */}
        {activeView === 'chat' && messages.length > 0 && (
          <div className={`relative shrink-0 ${LAYOUT_CLASSES.gutter} pb-5 pt-2`} style={{ ...layoutProfileStyle('chat'), background: 'transparent' }} data-testid="chat-composer-area">
            <ChatScrollToBottomButton visible={showScrollToBottom} onClick={scrollToBottom} />
            <div className="mx-auto w-full" style={{ maxWidth: 'var(--layout-width)' }}>
              {chatComposerInner}
            </div>
          </div>
        )}
      </div>

      {/* 右坞：文件 / 审阅 / 终端；Debug 统一进入全页工作区 */}
      {showFileBrowser && (
        <>
          {activeView === 'chat' && !rightDockCollapsed && <ResizeHandle
            orientation="vertical"
            title="拖动调整右坞宽度"
            onDelta={(dx) => setRightDockWidth((w) => w - dx)}
          />}
          {(() => {
            const occupiedLeft = 54 + (sidebarOpen && activeView === 'chat' ? sidebarWidth : 0)
            const maxDockForCenter = Math.max(LAYOUT_BOUNDS.rightDockWidth.min, viewportWidth - occupiedLeft - 380)
            const effectiveRightDockWidth = Math.max(LAYOUT_BOUNDS.rightDockWidth.min, Math.min(rightDockWidth, maxDockForCenter))
            return (
              <ChatRightDock
                key={currentProject?.path || 'no-project'}
                projectPath={currentProject?.path || null}
                sessionId={activeSessionId}
                showFiles={showFileBrowser}
                collapsed={rightDockCollapsed || activeView !== 'chat'}
                width={effectiveRightDockWidth}
                onCloseFiles={() => { setRightDockCollapsed(false); setShowFileBrowser(false) }}
                onTakeToChat={({ text }) => {
                  setActiveView('chat')
                  setInput(text)
                  requestAnimationFrame(() => {
                    const el = inputRef.current
                    if (!el) return
                    el.focus()
                    const end = el.value.length
                    el.setSelectionRange(end, end)
                  })
                }}
              />
            )
          })()}
        </>
      )}

      {/* Memory / Skills / Debug / Playground 均为主区域全页视图 */}
    </div>

      {standaloneView && <div className="app-shell view-transition flex h-screen min-w-0 select-none" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        {activeView === 'debug' ? <DevPanel eventLog={eventLog} onClose={() => setActiveView('chat')} /> : activeView === 'settings' ? <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col">
          <SettingsPanel
            initialEntry={settingsEntry}
            onClose={closeSettings}
            saveBeforeLeaveRef={settingsSaveBeforeLeave}
            currentTheme={theme}
            onThemeChange={setTheme}
          />
        </div> : <PlaygroundPage onClose={() => setActiveView('chat')} />}
      </div>}

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
    </>
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
