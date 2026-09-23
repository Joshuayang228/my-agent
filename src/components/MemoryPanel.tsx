import { useState, useEffect, useCallback, useMemo, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { ActionButton } from './foundation/ActionButton'
import { ConfirmPanel } from './foundation/ConfirmPanel'
import { IconButton } from './foundation/IconButton'
import { TextField } from './foundation/TextField'
import { MemoryAddRow, MemoryToolbar } from './memory/MemoryManagementControls'
import { MEMORY_CATEGORY_GROUP, MEMORY_GROUPS, type MemoryGroup } from '../shared/memory-groups'
import type { MemoryCategory, MemoryEntry } from '../shared/types'
import {
  detectSensitiveKinds,
  formatSensitiveCollectionHint,
  labelSensitiveKinds,
  type SensitiveKind,
} from '../shared/sensitive-memory'
import { User, Settings, MessageCircle, Star, Pin, Brain, X, ThumbsUp, ShieldAlert, Pencil, Trash2, Check, LoaderCircle } from 'lucide-react'

type MemoryColor = 'accent' | 'warm' | 'success' | 'muted'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  identity: <User size={12} />,
  workflow: <Settings size={12} />,
  voice: <MessageCircle size={12} />,
  preference: <Star size={12} />,
  fact: <Pin size={12} />,
  feedback: <ThumbsUp size={12} />,
}

const CATEGORIES: { id: MemoryCategory; label: string; icon: React.ReactNode; color: MemoryColor }[] = [
  { id: 'identity', label: '身份', icon: CATEGORY_ICONS.identity, color: 'accent' },
  { id: 'workflow', label: '工作方式', icon: CATEGORY_ICONS.workflow, color: 'warm' },
  { id: 'voice', label: '沟通风格', icon: CATEGORY_ICONS.voice, color: 'success' },
  { id: 'preference', label: '偏好', icon: CATEGORY_ICONS.preference, color: 'muted' },
  { id: 'fact', label: '事实', icon: CATEGORY_ICONS.fact, color: 'muted' },
  { id: 'feedback', label: '反馈', icon: CATEGORY_ICONS.feedback, color: 'muted' },
]

const COLOR_MAP: Record<MemoryColor, { bg: string; border: string; text: string; badge: string }> = {
  accent: { bg: 'memory-color-accent-bg', border: 'memory-color-accent-border', text: 'memory-color-accent-text', badge: 'memory-color-accent-badge' },
  warm: { bg: 'memory-color-warm-bg', border: 'memory-color-warm-border', text: 'memory-color-warm-text', badge: 'memory-color-warm-badge' },
  success: { bg: 'memory-color-success-bg', border: 'memory-color-success-border', text: 'memory-color-success-text', badge: 'memory-color-success-badge' },
  muted: { bg: 'memory-color-muted-bg', border: 'memory-color-muted-border', text: 'memory-color-muted-text', badge: 'memory-color-muted-badge' },
}

/**
 * Playground 中为静态记忆补充用户可理解的关系证据。
 * 不承载提取方式、检索分数或 Prompt 等内部实现信息。
 */
export interface MemoryPreviewEvidence {
  source: string
}

interface MemoryPanelProps {
  onClose: () => void
  /** Playground 页面基线传入静态夹具，避免读取或写入真实记忆。 */
  previewMemories?: MemoryEntry[]
  previewEditingId?: string
  previewEvidence?: Partial<Record<string, MemoryPreviewEvidence>>
  previewTitle?: string
  previewDescription?: string
  previewCompact?: boolean
  /** Playground 的 Debug 候选已显式开启时，才允许显示来源摘要。 */
  previewShowSource?: boolean
  /** 仅允许 Playground 夹具在 Renderer 内存中被纠正，绝不触发真实 memory IPC。 */
  previewEditable?: boolean
  readOnly?: boolean
  previewHideFooter?: boolean
  /** 页面故事与正式入口复用同一管理流程，数据源仍严格隔离。 */
  previewManagement?: boolean
  previewGroup?: MemoryGroup
  onPreviewGroupChange?: (group: MemoryGroup) => void
}

export function MemoryPanel({
  onClose,
  previewMemories,
  previewEditingId,
  previewEvidence,
  previewTitle,
  previewDescription,
  previewCompact = false,
  previewShowSource = false,
  previewEditable = false,
  readOnly = false,
  previewHideFooter = false,
  previewManagement = false,
  previewGroup,
  onPreviewGroupChange,
}: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>(previewMemories ?? [])
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all')
  const [selectedGroup, setSelectedGroup] = useState<MemoryGroup>('identity')
  const group = previewGroup ?? selectedGroup
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(previewEditingId ?? null)
  const [editContent, setEditContent] = useState(
    previewMemories?.find((memory) => memory.id === previewEditingId)?.content ?? '',
  )
  const [multilineEdit, setMultilineEdit] = useState(() => {
    const content = previewMemories?.find((memory) => memory.id === previewEditingId)?.content ?? ''
    return content.length > 80 || content.includes('\n')
  })
  const [addDrafts, setAddDrafts] = useState<Partial<Record<MemoryGroup, { open: boolean; content: string }>>>({})
  const adding = addDrafts[group]?.open ?? false
  const newContent = addDrafts[group]?.content ?? ''
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingSensitiveAdd, setPendingSensitiveAdd] = useState<{ content: string; category: MemoryCategory; kinds: SensitiveKind[] } | null>(null)
  const setAdding = (open: boolean) => {
    setAddDrafts((drafts) => ({ ...drafts, [group]: { content: drafts[group]?.content ?? '', open } }))
    if (!open) setPendingSensitiveAdd(null)
  }
  const setNewContent = (content: string) => {
    setAddDrafts((drafts) => ({ ...drafts, [group]: { open: drafts[group]?.open ?? false, content } }))
    setPendingSensitiveAdd(null)
  }
  const newCategory = MEMORY_GROUPS.find((item) => item.id === group)!.category
  const isPreview = previewMemories !== undefined
  const isPreviewInteractive = isPreview && previewEditable
  const isCompactPreview = isPreview && previewCompact
  const isProductMemory = !isPreview
  const management = isProductMemory || previewManagement
  const useCompactLayout = isCompactPreview || isProductMemory
  const canEdit = !readOnly && (isPreviewInteractive || !isPreview)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!isPreview)
  const [readError, setReadError] = useState('')
  const [writeError, setWriteError] = useState('')
  const writing = useRef(false)
  const readVersion = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; readVersion.current += 1 }
  }, [])

  const loadMemories = useCallback(async () => {
    if (previewMemories !== undefined) {
      setMemories(previewMemories)
      return
    }
    const version = ++readVersion.current
    setLoading(true)
    setReadError('')
    try {
      if (!window.electronAPI?.memory) throw new Error('Memory bridge unavailable')
      const list = await window.electronAPI.memory.list()
      if (mounted.current && version === readVersion.current) setMemories(list as MemoryEntry[])
    } catch {
      if (mounted.current && version === readVersion.current) setReadError('记忆列表未能刷新，已有内容仍保留。请重试。')
    } finally {
      if (mounted.current && version === readVersion.current) setLoading(false)
    }
  }, [previewMemories])

  useEffect(() => { void loadMemories() }, [loadMemories])

  /**
   * 背景：真实 IPC 不像样张同步结束，连点会重复写入，迟到响应可能清空新的编辑稿。
   * 意图：写入期间锁住本面板，拒绝重入；成功后再刷新，刷新失败只允许重读。
   * 约束：失败不退出草稿；卸载后不能刷新或修改状态，旧列表响应不能覆盖刚完成的写入。
   */
  const mutate = async (action: () => Promise<void>, message: string) => {
    if (writing.current || !mounted.current) return
    writing.current = true
    readVersion.current += 1
    setLoading(false)
    setBusy(true)
    setWriteError('')
    try {
      await action()
      if (mounted.current) await loadMemories()
    } catch {
      if (mounted.current) setWriteError(message)
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const addSensitiveKinds = useMemo(
    () => detectSensitiveKinds(newContent),
    [newContent],
  )

  const addMemory = async (draft: { content: string; category: MemoryCategory }) => {
    const content = draft.content.trim()
    if (!content) return
    await mutate(async () => {
      let roleId: string | undefined
      if (draft.category === 'feedback') {
        const active = await window.electronAPI!.companion.getActive()
        roleId = active?.id
        if (!roleId) throw new Error('Active companion unavailable')
      }
      const entry = await window.electronAPI!.memory.add(draft.category, content, roleId)
      if (!mounted.current) return
      setMemories((current) => [...current.filter((memory) => memory.id !== entry.id), entry as MemoryEntry])
      setAddDrafts((drafts) => ({ ...drafts, [group]: { open: false, content: '' } }))
      setQuery('')
      setPendingSensitiveAdd(null)
    }, '记忆未添加，内容仍保留。请重试。')
  }

  const handleAdd = async () => {
    const content = newContent.trim()
    if (!canEdit || content.length < 2 || writing.current) return
    if (isPreviewInteractive) {
      const now = Date.now()
      setMemories((current) => [...current, { id: `memory-custom-${crypto.randomUUID()}`, category: newCategory, content, createdAt: now, updatedAt: now }])
      setAddDrafts((drafts) => ({ ...drafts, [group]: { open: false, content: '' } }))
      setQuery('')
      setPendingSensitiveAdd(null)
      return
    }
    if (isPreview || !window.electronAPI) return
    const kinds = detectSensitiveKinds(content)
    if (kinds.length > 0) {
      setPendingSensitiveAdd({ content, category: newCategory, kinds })
      return
    }
    await addMemory({ content, category: newCategory })
  }

  const handleDelete = async (id: string) => {
    if (!canEdit || writing.current) return
    if (isPreviewInteractive) {
      setMemories((current) => current.filter((memory) => memory.id !== id))
      if (editing === id) setEditing(null)
      setPendingDelete(null)
      return
    }
    if (!window.electronAPI) return
    await mutate(async () => {
      await window.electronAPI.memory.delete(id)
      if (!mounted.current) return
      setMemories((current) => current.filter((memory) => memory.id !== id))
      setPendingDelete(null)
    }, '记忆未删除，请重试或取消。')
  }

  const handleSaveEdit = async (id: string) => {
    const content = editContent.trim()
    if (!canEdit || !content || writing.current) return
    if (isPreviewInteractive) {
      setMemories((current) => current.map((memory) => (
        memory.id === id ? { ...memory, content, updatedAt: Date.now() } : memory
      )))
      setEditing(null)
      return
    }
    if (!window.electronAPI) return
    await mutate(async () => {
      await window.electronAPI.memory.update(id, content)
      if (!mounted.current) return
      setMemories((current) => current.map((memory) => memory.id === id ? { ...memory, content } : memory))
      setEditing(null)
    }, '记忆未保存，修改仍保留。请重试。')
  }

  const startEdit = (mem: MemoryEntry) => {
    if (writing.current) return
    setWriteError('')
    setPendingDelete(null)
    setEditing(mem.id)
    setEditContent(mem.content)
    // 长文删短时保持同一编辑器，避免重新挂载 input 丢失焦点；下一次编辑才重新选择形态。
    setMultilineEdit(mem.content.length > 80 || mem.content.includes('\n'))
  }

  const handleEditKey = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, id: string) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!writing.current) { setEditing(null); setWriteError('') }
    }
    if (event.key === 'Enter' && (!multilineEdit || event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void handleSaveEdit(id)
    }
  }

  const filtered = management
    ? memories.filter((memory) => MEMORY_CATEGORY_GROUP[memory.category] === group && memory.content.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN')))
    : filter === 'all' ? memories : memories.filter(m => m.category === filter)
  const groupCounts = memories.reduce((counts, memory) => {
    counts[MEMORY_CATEGORY_GROUP[memory.category]] += 1
    return counts
  }, { identity: 0, collaboration: 0, communication: 0, relationship: 0 })
  const categoryCounts = memories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <fieldset disabled={busy} aria-busy={busy || loading} className="m-0 flex h-full min-h-0 min-w-0 flex-col border-0 p-0">
        {pendingSensitiveAdd && <div className="px-4 pt-3"><ConfirmPanel icon={<ShieldAlert size={15} />} title="这条记忆包含敏感信息" description={`${formatSensitiveCollectionHint(pendingSensitiveAdd.kinds)}\n\n只有在你确认后，才会写入本机记忆。`} confirmLabel="确认保存" busy={busy} onCancel={() => { if (!busy) setPendingSensitiveAdd(null) }} onConfirm={() => { const draft = pendingSensitiveAdd; if (draft) void addMemory(draft) }} /></div>}
        {isProductMemory && <header className="px-5 pb-2 pt-5" data-testid="memory-page-heading">
          <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>记忆</h2>
          <p className="mt-1 max-w-2xl text-[12px] leading-5" style={{ color: 'var(--text-muted)' }}>查看和管理会影响未来相处的长期信息。</p>
        </header>}
        {management && <MemoryToolbar group={group} counts={groupCounts} query={query} onQueryChange={setQuery} searchOpen={searchOpen} onSearchOpen={setSearchOpen}
          onGroupChange={(next) => { setSelectedGroup(next); onPreviewGroupChange?.(next); setQuery(''); setWriteError(''); setPendingSensitiveAdd(null) }} />}
        {!management && !previewCompact && (
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}><Brain size={16} /> 记忆</span>
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{memories.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconButton
                size={32}
                label="关闭记忆"
                onClick={onClose}
                className="transition hover:bg-[var(--hover-overlay)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </IconButton>
            </div>
          </div>
        )}

        {isPreview && previewTitle && (
          <div className="px-5 pb-4 pt-5" data-testid="memory-preview-heading">
            <h2 className="text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }} data-testid="memory-preview-title">{previewTitle}</h2>
            {previewDescription && <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{previewDescription}</p>}
          </div>
        )}

        {!management && !previewCompact && (
          <div className="flex flex-wrap gap-2 border-b px-5 py-2.5" style={{ borderColor: 'var(--border-color)' }} data-testid="memory-category-filters">
            <ActionButton
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={filter === 'all' ? 'font-medium' : ''}
              style={{ background: filter === 'all' ? 'var(--bg-tertiary)' : 'transparent', color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', borderColor: filter === 'all' ? 'transparent' : 'var(--border-color)' }}
            >
              全部 ({memories.length})
            </ActionButton>
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] || 0
              return (
                <ActionButton
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  aria-pressed={filter === cat.id}
                  className={filter === cat.id ? `${COLOR_MAP[cat.color].badge} font-medium` : ''}
                  style={filter !== cat.id ? { color: 'var(--text-muted)' } : undefined}
                >
                  {cat.icon} {cat.label} ({count})
                </ActionButton>
              )
            })}
          </div>
        )}




        {(readError || writeError) && <div role="alert" className="flex shrink-0 items-center gap-2 px-4 py-2 text-xs" style={{ color: 'var(--danger)' }}>
          <span className="min-w-0 flex-1">{writeError || readError}</span>
          {readError && !writeError && <ActionButton onClick={() => void loadMemories()} disabled={loading}>重新读取</ActionButton>}
        </div>}
        {loading && <div role="status" className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>正在读取记忆…</div>}
        {/* Memory List */}
        <div className={management || isCompactPreview ? 'min-h-0 flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto px-5 py-3'} data-testid="memory-list-scroll">
          {filtered.length === 0 && (loading || readError) ? null : filtered.length === 0 ? (
            management || isCompactPreview ? (
              <div className="rounded-[var(--radius-lg)] border px-4 py-8 text-center text-[13px]" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)' }}>
                {query.trim() ? '没有找到匹配的记忆。' : memories.length === 0 ? '还没有任何记忆。' : '该分类下暂无记忆'}
              </div>
            ) : (
            <div className="mt-10 text-center">
              <div className="mb-2 flex justify-center" style={{ color: 'var(--text-muted)' }}><Brain size={28} /></div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {memories.length === 0
                  ? '还没有任何记忆。和 Agent 对话后会自动提取，也可以手动添加。'
                  : '该分类下暂无记忆'}
              </div>
            </div>
            )
          ) : (
            <div
              className={management || isCompactPreview ? 'space-y-3' : isPreview ? 'grid gap-3 px-0.5 sm:grid-cols-2' : 'space-y-2'}
            >
              {filtered.map(mem => {
                const cat = CATEGORIES.find(c => c.id === mem.category)
                const colors = COLOR_MAP[(cat?.color as MemoryColor) || 'accent']
                const isEditing = editing === mem.id
                const sensitiveKinds = detectSensitiveKinds(mem.content)
                const isSensitive = sensitiveKinds.length > 0

                return (
                  <div
                    key={mem.id}
                    data-testid={useCompactLayout ? `memory-item-${mem.id}` : undefined}
                    className={`${useCompactLayout ? 'group/memory-item' : 'group'} transition ${
                      useCompactLayout
                        ? 'rounded-[var(--radius-lg)] border p-4'
                        : `rounded-xl border px-4 py-3.5 hover:bg-opacity-10 ${isPreview ? 'min-h-[156px]' : isSensitive ? '' : `${colors.border} ${colors.bg}`}`
                    }`}
                    style={
                      useCompactLayout
                        ? isSensitive
                          ? {
                              borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 55%, var(--card-border))',
                              background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 8%, var(--card-bg))',
                            }
                          : { borderColor: 'var(--card-border)', background: 'var(--card-bg)' }
                        : isPreview
                          ? isSensitive
                            ? {
                                borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 55%, transparent)',
                                background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 10%, transparent)',
                              }
                            : { borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }
                          : isSensitive
                            ? {
                                borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 55%, transparent)',
                                background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 10%, transparent)',
                              }
                            : undefined
                    }
                  >
                    {useCompactLayout && isSensitive && (
                      <div
                        className="mb-2 flex items-start gap-2 text-[11px] leading-4"
                        data-testid={`memory-sensitive-warning-${mem.id}`}
                        style={{ color: 'var(--companion-accent-warm, #d4a574)' }}
                      >
                        <ShieldAlert size={13} className="mt-0.5 shrink-0" />
                        <span><strong>敏感信息</strong>：涉及{labelSensitiveKinds(sensitiveKinds)}隐私，请谨慎保留。</span>
                      </div>
                    )}
                    <div className={!useCompactLayout ? 'mb-1.5 flex items-center gap-1' : 'hidden'}>
                      <div className="flex flex-wrap items-center gap-1">
                        {!useCompactLayout && (
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${colors.badge}`}>
                            {cat?.icon} {cat?.label}
                          </span>
                        )}
                        {!useCompactLayout && isSensitive && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium"
                            title="启发式敏感标记，可删除或改正"
                            style={{
                              color: 'var(--companion-accent-warm, #d4a574)',
                              background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 18%, transparent)',
                            }}
                          >
                            <ShieldAlert size={10} />
                            敏感·{labelSensitiveKinds(sensitiveKinds)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={useCompactLayout ? 'grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3' : undefined}>
                    {isEditing ? (
                      useCompactLayout ? (
                        multilineEdit ? (
                          <TextField multiline
                            value={editContent}
                            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setEditContent(event.target.value)}
                            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => handleEditKey(event, mem.id)}
                            autoFocus
                            readOnly={!canEdit}
                            rows={Math.min(10, Math.max(4, Math.ceil(editContent.length / 45)))}
                            className="theme-input min-h-24 min-w-0 w-full resize-y rounded-[var(--radius-md)] px-3 py-2 text-[13px] font-medium leading-6"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        ) : (
                          <TextField
                            value={editContent}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => setEditContent(event.target.value)}
                            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleEditKey(event, mem.id)}
                            autoFocus
                            readOnly={!canEdit}
                            className="theme-input h-8 min-w-0 w-full rounded-[var(--radius-md)] px-3 text-[13px] font-medium leading-6"
                            style={{ color: 'var(--text-primary)' }}
                          />
                        )
                      ) : (
                      <div className="flex gap-2">
                        <TextField
                          value={editContent}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => setEditContent(event.target.value)}
                          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (event.key === 'Enter') void handleSaveEdit(mem.id)
                            if (event.key === 'Escape') setEditing(null)
                          }}
                          autoFocus
                          readOnly={!canEdit}
                          className="theme-input min-w-0 flex-1 rounded-[var(--radius-md)] px-2 py-1 text-xs"
                        />
                        <ActionButton
                          onClick={() => handleSaveEdit(mem.id)}
                          disabled={!canEdit || busy}
                          tone="accent"
                        >
                          保存
                        </ActionButton>
                        <ActionButton
                          onClick={() => setEditing(null)}
                          disabled={busy}
                        >
                          取消
                        </ActionButton>
                      </div>
                      )
                    ) : (
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <p className={`min-w-0 flex-1 ${useCompactLayout ? 'whitespace-pre-wrap break-words py-1 text-[13px] font-medium leading-6 [overflow-wrap:anywhere]' : 'text-xs leading-relaxed'}`} style={{ color: useCompactLayout ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{mem.content}</p>
                      </div>
                    )}

                    {useCompactLayout && <div className="relative h-8 w-full" data-testid={`memory-item-controls-${mem.id}`}>
                      <span className={`pointer-events-none absolute inset-0 flex items-center justify-end whitespace-nowrap text-[11px] transition ${canEdit ? isEditing || pendingDelete === mem.id ? 'opacity-0' : 'group-hover/memory-item:opacity-0 group-focus-within/memory-item:opacity-0' : ''}`} style={{ color: 'var(--text-muted)' }} data-testid={`memory-item-date-${mem.id}`}>
                        {new Date(mem.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                      {canEdit && (isEditing ? (
                        <div className="absolute inset-0 flex items-center justify-end gap-1">
                          <IconButton size={32} label={`保存记忆 ${editContent || mem.content}`} title={busy ? '正在保存' : '保存'} onClick={() => void handleSaveEdit(mem.id)} disabled={!editContent.trim() || busy} className="transition hover:bg-[var(--hover-overlay)] disabled:opacity-40" style={{ color: 'var(--accent-fg)' }}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}</IconButton>
                          <IconButton size={32} label={`取消编辑 ${mem.content}`} title="取消" onClick={() => { setEditing(null); setWriteError('') }} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton>
                        </div>
                      ) : pendingDelete === mem.id ? (
                        <div className="absolute inset-0 flex items-center justify-end gap-1" data-testid={`memory-delete-confirm-${mem.id}`}>
                          <IconButton size={32} label={`确认删除记忆 ${mem.content}`} title={busy ? '正在删除' : '确认删除'} onClick={() => void handleDelete(mem.id)} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--danger)' }}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}</IconButton>
                          <IconButton size={32} label={`取消删除 ${mem.content}`} title="取消删除" onClick={() => { setPendingDelete(null); setWriteError('') }} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><X size={14} /></IconButton>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-end gap-1 opacity-0 transition group-hover/memory-item:opacity-100 group-focus-within/memory-item:opacity-100" data-testid={`memory-item-actions-${mem.id}`}>
                          <IconButton size={32} label={`编辑记忆 ${mem.content}`} title="编辑" onClick={() => startEdit(mem)} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}><Pencil size={14} /></IconButton>
                          <IconButton size={32} label={`删除记忆 ${mem.content}`} title="删除" onClick={() => { setEditing(null); setWriteError(''); setPendingDelete(mem.id) }} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></IconButton>
                        </div>
                      ))}
                    </div>}
                    </div>

                    {isPreview && !isCompactPreview && isSensitive && !isEditing && (
                      <div
                        className="mt-3 flex items-start gap-2 rounded-md border px-2.5 py-2 text-[10px] leading-4"
                        data-testid={`memory-sensitive-warning-${mem.id}`}
                        style={{
                          borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 55%, transparent)',
                          background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 12%, transparent)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <ShieldAlert size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--companion-accent-warm, #d4a574)' }} />
                        <span><strong style={{ color: 'var(--companion-accent-warm, #d4a574)' }}>敏感信息</strong>：包含{labelSensitiveKinds(sensitiveKinds)}，请确认是否需要长期保留；你可以编辑或删除。</span>
                      </div>
                    )}

                    {/* 紧凑清单里来源只是正文下一行说明；分割线和“来自：”会把它抬成第二主信息。 */}
                    {previewShowSource && previewEvidence?.[mem.id] && (
                      <p
                        className={isCompactPreview ? 'mt-1 text-[11px] leading-5' : 'mt-2 border-t pt-1.5 text-[10px] leading-4'}
                        style={isCompactPreview
                          ? { color: 'var(--text-muted)' }
                          : { borderColor: 'color-mix(in srgb, var(--border-color) 76%, transparent)', color: 'var(--text-muted)' }}
                        data-testid={`memory-preview-source-${mem.id}`}
                      >
                        {isCompactPreview ? previewEvidence[mem.id]?.source : <><span style={{ color: 'var(--text-secondary)' }}>来自：</span>{previewEvidence[mem.id]?.source}</>}
                      </p>
                    )}

                    {isPreview && !isCompactPreview && <div className="mt-2 flex items-center justify-between gap-3">
                      {!isCompactPreview && <div className="text-[9px]" style={{ color: 'var(--text-muted)' }} data-testid={`memory-item-date-${mem.id}`}>
                        {new Date(mem.createdAt).toLocaleDateString('zh-CN')}
                        {mem.updatedAt !== mem.createdAt && ` (更新于 ${new Date(mem.updatedAt).toLocaleDateString('zh-CN')})`}
                      </div>}

                      {canEdit && !isEditing ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <ActionButton aria-label={`编辑记忆 ${mem.content}`} onClick={() => startEdit(mem)}>编辑</ActionButton>
                          <ActionButton aria-label={`删除记忆 ${mem.content}`} onClick={() => handleDelete(mem.id)} tone="danger">删除</ActionButton>
                        </div>
                      ) : null}
                    </div>}
                  </div>
                )
              })}
            </div>
          )}
          {management && canEdit && <MemoryAddRow open={adding} content={newContent} onContentChange={setNewContent}
            onOpen={() => { setAdding(true); setWriteError('') }}
            onCancel={() => { setAdding(false); setNewContent(''); setWriteError(''); setPendingSensitiveAdd(null) }} onSave={() => void handleAdd()} busy={busy}
            sensitiveHint={addSensitiveKinds.length ? formatSensitiveCollectionHint(addSensitiveKinds) : ''} />}
        </div>

        {!management && !previewHideFooter && <div className="border-t px-4 py-2 text-center text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          {isPreview
            ? '这是 Playground 的隔离样张；在“纠正记忆”中试改不会保存到正式记忆。'
            : '记忆会注入到每次对话的 System Prompt 中 · 敏感项（健康/财务/凭据等）会高亮，勿存密码原文'}
        </div>}
    </fieldset>
  )
}
