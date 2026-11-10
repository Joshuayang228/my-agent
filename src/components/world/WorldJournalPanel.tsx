import { useCallback, useEffect, useState } from 'react'
import { Heart, Trash2, MessageSquareShare, Moon, ArrowLeft, MailOpen } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { contentGutterStyle } from '../../shared/content-layout'
import { VulnerabilityCard } from './VulnerabilityCard'
import type { CompanionInnerThoughtRecord, CompanionVulnerabilityRecord } from '../../shared/types'

interface WorldJournalPanelProps {
  roleId?: string
  onTakeToChat?: (opts: { text: string }) => void
  refreshToken?: number
  onLoadingChange?: (loading: boolean) => void
  /**
   * Playground 离线样张注入数据：提供时完全跳过主进程 IPC 查询与广播订阅，
   * 并在内存中响应增删改与筛选，用于无真实后端的纯前端设计审查。
   */
  previewThoughts?: CompanionInnerThoughtRecord[]
  previewVulnerability?: CompanionVulnerabilityRecord | null
  showVulnerabilityCard?: boolean
  previewReadError?: string
  onPreviewRetry?: () => void
  /** 日记册样式先显示封面摘要，再进入信件式正文阅读。 */
  presentation?: 'stream' | 'shelf'
}

function formatDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(timestamp)
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}

export function WorldJournalPanel({
  roleId = 'luffy',
  onTakeToChat,
  refreshToken = 0,
  onLoadingChange,
  previewThoughts,
  previewVulnerability,
  showVulnerabilityCard = true,
  previewReadError,
  onPreviewRetry,
  presentation = 'shelf',
}: WorldJournalPanelProps) {
  const [thoughts, setThoughts] = useState<CompanionInnerThoughtRecord[]>(previewThoughts ?? [])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedThoughtId, setSelectedThoughtId] = useState<string | null>(null)

  // 同步 Playground 样张输入
  useEffect(() => {
    if (previewThoughts !== undefined) {
      setThoughts(previewThoughts)
    }
  }, [previewThoughts])

  const loadThoughts = useCallback(async () => {
    if (previewThoughts !== undefined) return
    if (!window.electronAPI?.companion?.listInnerThoughts) return
    setLoading(true)
    setLoadError('')
    onLoadingChange?.(true)
    try {
      const records = await window.electronAPI.companion.listInnerThoughts(roleId)
      setThoughts(records)
    } catch (err) {
      setLoadError('日记读取失败，请重试。')
      console.warn('Failed to load inner thoughts:', err)
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [previewThoughts, roleId, onLoadingChange])

  useEffect(() => {
    void loadThoughts()
  }, [loadThoughts, refreshToken])

  // 监听新独白实时广播（仅在真实 Electron 环境下激活）
  useEffect(() => {
    if (previewThoughts !== undefined) return
    if (!window.electronAPI?.companion?.onInnerThoughtCreated) return
    const unsubscribe = window.electronAPI.companion.onInnerThoughtCreated((newThought) => {
      if (newThought.roleId === roleId) {
        setThoughts((prev) => [newThought, ...prev.filter((t) => t.id !== newThought.id)])
      }
    })
    const unsubNightly = window.electronAPI.companion.onNightlyReflectionCreated?.((newThought) => {
      if (newThought.roleId === roleId) {
        setThoughts((prev) => [newThought, ...prev.filter((t) => t.id !== newThought.id)])
      }
    })
    return () => {
      unsubscribe()
      unsubNightly?.()
    }
  }, [previewThoughts, roleId])

  const handleToggleFavorite = async (id: string) => {
    if (previewThoughts !== undefined) {
      setThoughts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isFavorite: !t.isFavorite } : t)),
      )
      return
    }
    if (!window.electronAPI?.companion?.toggleInnerThoughtFavorite) return
    try {
      const updatedFav = await window.electronAPI.companion.toggleInnerThoughtFavorite(id)
      setThoughts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isFavorite: updatedFav } : t)),
      )
    } catch (err) {
      console.warn('Failed to toggle inner thought favorite:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (previewThoughts !== undefined) {
      setThoughts((prev) => prev.filter((t) => t.id !== id))
      setSelectedThoughtId((current) => current === id ? null : current)
      return
    }
    if (!window.electronAPI?.companion?.deleteInnerThought) return
    try {
      await window.electronAPI.companion.deleteInnerThought(id)
      setThoughts((prev) => prev.filter((t) => t.id !== id))
      setSelectedThoughtId((current) => current === id ? null : current)
    } catch (err) {
      console.warn('Failed to delete inner thought:', err)
    }
  }

  const selectedThought = thoughts.find((thought) => thought.id === selectedThoughtId) ?? null

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-journal-panel"
      data-world-content="journal"
    >
      {/* 详情页保留返回入口，列表页直接进入日记册内容。 */}
      {selectedThought && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <ActionButton variant="plain" tone="neutral" onClick={() => setSelectedThoughtId(null)} aria-label="返回日记册">
            <ArrowLeft size={14} className="mr-1" />
            返回日记册
          </ActionButton>
          <div className="flex items-center gap-1">
            <IconButton size={24} label={selectedThought.isFavorite ? '取消收藏' : '收藏日记'} onClick={() => handleToggleFavorite(selectedThought.id)} style={{ color: selectedThought.isFavorite ? 'var(--danger)' : 'var(--text-muted)' }}>
              <Heart size={13} className={selectedThought.isFavorite ? 'fill-current' : ''} />
            </IconButton>
            <IconButton size={24} label="删除记录" onClick={() => handleDelete(selectedThought.id)} style={{ color: 'var(--text-muted)' }}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        </div>
      )}

      {/* 伙伴实时心境波动与脆弱时刻 */}
      {showVulnerabilityCard && !selectedThought && (
        <div className="mb-4">
          <VulnerabilityCard
            roleId={roleId}
            previewVulnerability={previewVulnerability}
            onTakeToChat={onTakeToChat}
          />
        </div>
      )}

      {/* 日记册或信件详情。列表层只保留封面摘要，正文在详情层阅读。 */}
      {previewReadError || loadError ? (
        <ErrorState
          title="日记暂时无法读取"
          description={previewReadError ?? loadError}
          action={<ActionButton size="sm" variant="plain" tone="accent" onClick={previewReadError ? onPreviewRetry : () => { void loadThoughts() }}>重新加载</ActionButton>}
          className="flex-1"
        />
      ) : selectedThought ? (
        <article className="flex min-h-0 flex-1 flex-col gap-4" data-testid={`journal-detail-${selectedThought.id}`}>
          <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-[11px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
            <span>{formatDate(selectedThought.createdAt)}</span>
            {selectedThought.location && <span>· {selectedThought.location}</span>}
            {selectedThought.mood && <Badge tone="accent">{selectedThought.mood}</Badge>}
          </div>
          <div className="w-full max-w-3xl rounded-[var(--radius-card)] border p-6 sm:p-8" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
            <h3 className="font-display text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{selectedThought.title}</h3>
            <p className="mt-5 whitespace-pre-wrap font-display text-[15px] leading-8" style={{ color: 'var(--text-primary)' }}>{selectedThought.content}</p>
            {selectedThought.epiphany && (
              <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`journal-epiphany-${selectedThought.id}`}>
                <p className="text-[11px] font-semibold" style={{ color: 'var(--accent-fg)' }}>写在页边的一句领悟</p>
                <p className="mt-2 font-display text-[14px] italic leading-7" style={{ color: 'var(--text-secondary)' }}>“{selectedThought.epiphany}”</p>
              </div>
            )}
            {onTakeToChat && (
              <div className="mt-8 flex justify-end border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <ActionButton size="sm" variant="plain" tone="neutral" onClick={() => onTakeToChat({ text: `我读了你写的日记《${selectedThought.title}》，想和你聊聊这页内容。` })}>
                  <MessageSquareShare size={12} className="mr-1" />与TA聊聊
                </ActionButton>
              </div>
            )}
          </div>
        </article>
      ) : thoughts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState title="日记本里还空着" description="当角色独处、回忆或整理心情时，会自主写下真情实感。" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="journal-shelf">
          {thoughts.map((thought) => (
            <button key={thought.id} type="button" className="group flex min-h-56 flex-col overflow-hidden rounded-[var(--radius-card)] border text-left transition-colors hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }} onClick={() => setSelectedThoughtId(thought.id)} aria-label={`打开日记：${thought.title}`} data-testid={`journal-entry-${thought.id}`}>
              <span className="flex min-h-28 flex-col justify-between p-4" style={{ background: 'var(--accent-subtle)' }}>
                <span className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{formatDate(thought.createdAt)}</span><MailOpen size={15} style={{ color: 'var(--accent-fg)' }} />
                </span>
                <span className="font-display text-lg font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{thought.title}</span>
              </span>
              <span className="flex flex-1 flex-col justify-between gap-3 p-4">
                <span className="line-clamp-3 text-[12px] leading-6" style={{ color: 'var(--text-secondary)' }}>{thought.content}</span>
                <span className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {thought.mood && <span>{thought.mood}</span>}
                  {thought.thoughtType === 'nightly_reflection' && <Badge tone="accent"><Moon size={10} className="mr-1 inline" />深夜反思</Badge>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}    </div>
  )
}
