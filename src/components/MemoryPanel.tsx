import { useState, useEffect, useCallback } from 'react'
import type { MemoryCategory, MemoryEntry } from '../shared/types'
import { User, Settings, MessageCircle, Star, Pin, Brain, X, ThumbsUp } from 'lucide-react'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  identity: <User size={12} />,
  workflow: <Settings size={12} />,
  voice: <MessageCircle size={12} />,
  preference: <Star size={12} />,
  fact: <Pin size={12} />,
  feedback: <ThumbsUp size={12} />,
}

const CATEGORIES: { id: MemoryCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'identity', label: '身份', icon: CATEGORY_ICONS.identity, color: 'cyan' },
  { id: 'workflow', label: '工作方式', icon: CATEGORY_ICONS.workflow, color: 'violet' },
  { id: 'voice', label: '沟通风格', icon: CATEGORY_ICONS.voice, color: 'emerald' },
  { id: 'preference', label: '偏好', icon: CATEGORY_ICONS.preference, color: 'amber' },
  { id: 'fact', label: '事实', icon: CATEGORY_ICONS.fact, color: 'rose' },
  { id: 'feedback', label: '反馈', icon: CATEGORY_ICONS.feedback, color: 'blue' },
]

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  cyan: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/30', text: 'text-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400' },
  violet: { bg: 'bg-violet-500/5', border: 'border-violet-500/30', text: 'text-violet-400', badge: 'bg-violet-500/10 text-violet-400' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400' },
  amber: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400' },
  rose: { bg: 'bg-rose-500/5', border: 'border-rose-500/30', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400' },
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400' },
}

interface MemoryPanelProps {
  onClose: () => void
}

export function MemoryPanel({ onClose }: MemoryPanelProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([])
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState<MemoryCategory>('fact')
  const [newContent, setNewContent] = useState('')

  const loadMemories = useCallback(async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.memory.list()
    setMemories(list as MemoryEntry[])
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])

  const handleAdd = async () => {
    if (!window.electronAPI || !newContent.trim()) return
    await window.electronAPI.memory.add(newCategory, newContent.trim())
    setNewContent('')
    setAdding(false)
    await loadMemories()
  }

  const handleDelete = async (id: string) => {
    if (!window.electronAPI) return
    await window.electronAPI.memory.delete(id)
    await loadMemories()
  }

  const handleSaveEdit = async (id: string) => {
    if (!window.electronAPI || !editContent.trim()) return
    await window.electronAPI.memory.update(id, editContent.trim())
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
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}><Brain size={16} /> 记忆</span>
            <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{memories.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdding(!adding)}
              className="rounded-lg px-2.5 py-1 text-xs text-cyan-500 transition"
            >
              + 添加
            </button>
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

        <div className="flex gap-2 border-b px-5 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
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
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="输入记忆内容..."
                autoFocus
                className="theme-input flex-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
              />
              <button
                onClick={handleAdd}
                disabled={!newContent.trim()}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40"
              >
                保存
              </button>
            </div>
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
            <div className="space-y-2">
              {filtered.map(mem => {
                const cat = CATEGORIES.find(c => c.id === mem.category)
                const colors = COLOR_MAP[cat?.color || 'cyan']
                const isEditing = editing === mem.id

                return (
                  <div
                    key={mem.id}
                    className={`group rounded-lg border ${colors.border} ${colors.bg} px-4 py-2.5 transition hover:bg-opacity-10`}
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${colors.badge}`}>
                        {cat?.icon} {cat?.label}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        {!isEditing && (
                          <>
                            <button
                              onClick={() => startEdit(mem)}
                              className="rounded px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-white"
                            >
                              编辑
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition hover:bg-red-500/10"
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
                          className="theme-input flex-1 rounded border px-2 py-1 text-xs outline-none"
                        />
                        <button
                          onClick={() => handleSaveEdit(mem.id)}
                          className="rounded bg-cyan-600 px-2 py-1 text-[10px] text-white hover:bg-cyan-500"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="rounded px-2 py-1 text-[10px] text-slate-400 hover:text-white"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{mem.content}</p>
                    )}

                    <div className="mt-1.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
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
          记忆会注入到每次对话的 System Prompt 中
        </div>
    </div>
  )
}
