import { useState, useEffect, useCallback, useMemo } from 'react'
import type { MemoryCategory, MemoryEntry } from '../shared/types'
import {
  detectSensitiveKinds,
  formatSensitiveCollectionHint,
  labelSensitiveKinds,
} from '../shared/sensitive-memory'
import { User, Settings, MessageCircle, Star, Pin, Brain, X, ThumbsUp, ShieldAlert } from 'lucide-react'

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
}: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>(previewMemories ?? [])
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all')
  const [editing, setEditing] = useState<string | null>(previewEditingId ?? null)
  const [editContent, setEditContent] = useState(
    previewMemories?.find((memory) => memory.id === previewEditingId)?.content ?? '',
  )
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState<MemoryCategory>('fact')
  const [newContent, setNewContent] = useState('')
  const isPreview = previewMemories !== undefined
  const isPreviewInteractive = isPreview && previewEditable
  const isCompactPreview = isPreview && previewCompact
  const canEdit = !readOnly && (isPreviewInteractive || !isPreview)

  const loadMemories = useCallback(async () => {
    if (previewMemories) {
      setMemories(previewMemories)
      return
    }
    if (!window.electronAPI) return
    const list = await window.electronAPI.memory.list()
    setMemories(list as MemoryEntry[])
  }, [previewMemories])

  useEffect(() => { loadMemories() }, [loadMemories])

  const addSensitiveKinds = useMemo(
    () => detectSensitiveKinds(newContent),
    [newContent],
  )

  const handleAdd = async () => {
    if (readOnly || !window.electronAPI || !newContent.trim()) return
    const kinds = detectSensitiveKinds(newContent)
    if (kinds.length > 0) {
      const ok = window.confirm(formatSensitiveCollectionHint(kinds))
      if (!ok) return
    }
    let roleId: string | undefined
    if (newCategory === 'feedback' && window.electronAPI.companion?.getActive) {
      try {
        const active = await window.electronAPI.companion.getActive()
        roleId = active?.id
      } catch { /* ignore */ }
    }
    await window.electronAPI.memory.add(newCategory, newContent.trim(), roleId)
    setNewContent('')
    setAdding(false)
    await loadMemories()
  }

  const handleDelete = async (id: string) => {
    if (!canEdit) return
    if (isPreviewInteractive) {
      setMemories((current) => current.filter((memory) => memory.id !== id))
      if (editing === id) setEditing(null)
      return
    }
    if (!window.electronAPI) return
    await window.electronAPI.memory.delete(id)
    await loadMemories()
  }

  const handleSaveEdit = async (id: string) => {
    const content = editContent.trim()
    if (!canEdit || !content) return
    if (isPreviewInteractive) {
      setMemories((current) => current.map((memory) => (
        memory.id === id ? { ...memory, content, updatedAt: Date.now() } : memory
      )))
      setEditing(null)
      return
    }
    if (!window.electronAPI) return
    await window.electronAPI.memory.update(id, content)
    setEditing(null)
    await loadMemories()
  }

  const startEdit = (mem: MemoryEntry) => {
    setEditing(mem.id)
    setEditContent(mem.content)
  }

  const filtered = filter === 'all' ? memories : memories.filter(m => m.category === filter)
  const categoryCounts = memories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="flex h-full flex-col">
        {!previewCompact && (
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}><Brain size={16} /> 记忆</span>
              <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{memories.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {!readOnly && !isPreview && <button
                onClick={() => setAdding(!adding)}
                className="rounded-lg px-2.5 py-1 text-xs transition"
                style={{ color: 'var(--accent-fg)' }}
              >
                + 添加
              </button>}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 transition"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {isPreview && previewTitle && (
          <div className="px-5 pb-4 pt-5" data-testid="memory-preview-heading">
            <h2 className="text-base font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }} data-testid="memory-preview-title">{previewTitle}</h2>
            {previewDescription && <p className="mt-1 text-[11px] leading-5" style={{ color: 'var(--text-muted)' }}>{previewDescription}</p>}
          </div>
        )}

        {!previewCompact && (
          <div className="flex flex-wrap gap-2 border-b px-5 py-2.5" style={{ borderColor: 'var(--border-color)' }} data-testid="memory-category-filters">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                filter === 'all' ? 'font-medium' : ''
              }`}
              style={{ background: filter === 'all' ? 'var(--bg-tertiary)' : undefined, color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              全部 ({memories.length})
            </button>
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.id] || 0
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] transition ${
                    filter === cat.id
                      ? `${COLOR_MAP[cat.color].badge} font-medium`
                      : ''
                  }`}
                  style={filter !== cat.id ? { color: 'var(--text-muted)' } : undefined}
                >
                  {cat.icon} {cat.label} ({count})
                </button>
              )
            })}
          </div>
        )}



        {/* Add Form */}
        {adding && (
          <div className="border-b px-5 py-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
            <div className="mb-2 flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setNewCategory(cat.id)}
                  className={`rounded px-2 py-0.5 text-[10px] transition ${
                    newCategory === cat.id ? COLOR_MAP[cat.color].badge : ''
                  }`}
                  style={newCategory !== cat.id ? { color: 'var(--text-muted)' } : undefined}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void handleAdd()}
                placeholder="输入记忆内容..."
                autoFocus
                className="theme-input flex-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
              />
              <button
                onClick={() => void handleAdd()}
                disabled={!newContent.trim()}
                className="memory-save-button rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
              >
                保存
              </button>
            </div>
            {addSensitiveKinds.length > 0 && (
              <div
                className="mt-2 flex items-start gap-1.5 rounded px-2 py-1.5 text-[10px] leading-snug"
                style={{
                  color: 'var(--companion-accent-warm, #d4a574)',
                  background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--companion-accent-warm, #d4a574) 35%, transparent)',
                }}
              >
                <ShieldAlert size={12} className="mt-0.5 shrink-0" />
                <span>{formatSensitiveCollectionHint(addSensitiveKinds)}</span>
              </div>
            )}
          </div>
        )}

        {/* Memory List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <div className="mt-10 text-center">
              <div className="mb-2 flex justify-center" style={{ color: 'var(--text-muted)' }}><Brain size={28} /></div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {memories.length === 0
                  ? '还没有任何记忆。和 Agent 对话后会自动提取，也可以手动添加。'
                  : '该分类下暂无记忆'}
              </div>
            </div>
          ) : (
            <div
              className={isCompactPreview ? 'overflow-hidden rounded-xl border' : isPreview ? 'grid gap-3 px-0.5 sm:grid-cols-2' : 'space-y-2'}
              style={isCompactPreview ? { borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' } : undefined}
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
                    className={`group transition ${
                      isCompactPreview
                        ? 'border-b px-4 py-3 last:border-b-0'
                        : `rounded-xl border px-4 py-3.5 hover:bg-opacity-10 ${isPreview ? 'min-h-[156px]' : isSensitive ? '' : `${colors.border} ${colors.bg}`}`
                    }`}
                    style={
                      isCompactPreview
                        ? isSensitive
                          ? {
                              borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 55%, transparent)',
                              background: 'color-mix(in srgb, var(--companion-accent-warm, #d4a574) 10%, transparent)',
                            }
                          : { borderColor: 'var(--border-subtle)' }
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
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {!isCompactPreview && (
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${colors.badge}`}>
                            {cat?.icon} {cat?.label}
                          </span>
                        )}
                        {isSensitive && (
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
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        {canEdit && !isEditing && (
                          <>
                            <button
                              onClick={() => startEdit(mem)}
                              className="memory-action-button rounded px-1.5 py-0.5 text-[10px] transition"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              className="memory-delete-button rounded px-1.5 py-0.5 text-[10px] transition"
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="flex gap-2">
                        <input
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit(mem.id)
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          autoFocus
                          readOnly={!canEdit}
                          className="theme-input flex-1 rounded border px-2 py-1 text-xs outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(mem.id)}
                          disabled={!canEdit}
                          className="rounded px-2 py-1 text-[10px] text-white disabled:opacity-50"
                          style={{ background: 'var(--accent-emphasis)' }}
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="memory-action-button rounded px-2 py-1 text-[10px] transition"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{mem.content}</p>
                    )}

                    {previewShowSource && previewEvidence?.[mem.id] && (
                      <div
                        className="mt-2 border-t pt-1.5 text-[10px] leading-4"
                        style={{ borderColor: 'color-mix(in srgb, var(--border-color) 76%, transparent)', color: 'var(--text-muted)' }}
                        data-testid={`memory-preview-source-${mem.id}`}
                      >
                        <span style={{ color: 'var(--text-secondary)' }}>来自：</span>{previewEvidence[mem.id]?.source}
                      </div>
                    )}

                    <div className={`${isCompactPreview ? 'mt-1.5' : 'mt-2'} text-[9px]`} style={{ color: 'var(--text-muted)' }}>
                      {new Date(mem.createdAt).toLocaleDateString('zh-CN')}
                      {mem.updatedAt !== mem.createdAt && ` (更新于 ${new Date(mem.updatedAt).toLocaleDateString('zh-CN')})`}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 text-center text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
          {isPreview
            ? '这是 Playground 的隔离样张；在“纠正记忆”中试改不会保存到正式记忆。'
            : '记忆会注入到每次对话的 System Prompt 中 · 敏感项（健康/财务/凭据等）会高亮，勿存密码原文'}
        </div>
    </div>
  )
}
