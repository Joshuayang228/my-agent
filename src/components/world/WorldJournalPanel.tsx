import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Heart, Trash2, MapPin, CloudSun, MessageSquareShare, FileText, Moon } from 'lucide-react'
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
}: WorldJournalPanelProps) {
  const [thoughts, setThoughts] = useState<CompanionInnerThoughtRecord[]>(previewThoughts ?? [])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [loadError, setLoadError] = useState('')

  const journalTitle = '日记'
  const journalDesc = '角色在独处、回忆或夜间沉思时留下的私密心声与随笔，不公开发表，唯你可见。'

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

  const handleCreateThought = async () => {
    if (creating) return
    if (previewThoughts !== undefined) {
      setCreating(true)
      const mockThought: CompanionInnerThoughtRecord = {
        id: `mock-thought-${Date.now()}`,
        roleId,
        title: '新写下的随笔灵感',
        content: '这是在样张预览中轻声唤醒的随笔。虽然只是即兴的记录，但也是此刻最真实的心情。',
        location: '甲板眺望台',
        weather: '微风晴朗',
        mood: '惬意放空',
        activity: '看海吹风',
        isFavorite: false,
        createdAt: Date.now(),
      }
      setThoughts((prev) => [mockThought, ...prev])
      setCreating(false)
      return
    }
    if (!window.electronAPI?.companion?.createInnerThought) return
    setCreating(true)
    try {
      const created = await window.electronAPI.companion.createInnerThought(roleId, '用户在日记本中轻声唤醒的随笔灵感')
      if (created) {
        setThoughts((prev) => [created, ...prev.filter((t) => t.id !== created.id)])
      }
    } catch (err) {
      console.warn('Failed to create inner thought:', err)
    } finally {
      setCreating(false)
    }
  }

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
      return
    }
    if (!window.electronAPI?.companion?.deleteInnerThought) return
    try {
      await window.electronAPI.companion.deleteInnerThought(id)
      setThoughts((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.warn('Failed to delete inner thought:', err)
    }
  }

  const displayedThoughts = filterFavorite
    ? thoughts.filter((t) => t.isFavorite)
    : thoughts

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-journal-panel"
      data-world-content="journal"
    >
      {/* 顶部标题与操作 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: 'var(--accent-fg)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {journalTitle}
            </h2>
            <Badge tone="accent">{thoughts.length} 篇随笔</Badge>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {journalDesc}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            size="sm"
            variant={filterFavorite ? 'default' : 'plain'}
            tone={filterFavorite ? 'accent' : 'neutral'}
            onClick={() => setFilterFavorite((prev) => !prev)}
            aria-pressed={filterFavorite}
          >
            <Heart size={12} className={`mr-1 ${filterFavorite ? 'fill-current' : ''}`} />
            {filterFavorite ? '只看星标' : '全部'}
          </ActionButton>

          <ActionButton
            size="sm"
            tone="accent"
            disabled={creating}
            onClick={handleCreateThought}
          >
            <Sparkles size={12} className={`mr-1 ${creating ? 'animate-spin' : ''}`} />
            {creating ? '正在思考记录...' : '写一篇独白'}
          </ActionButton>
        </div>
      </div>

      {/* 伙伴实时心境波动与脆弱时刻 */}
      {showVulnerabilityCard && (
        <div className="mb-4">
          <VulnerabilityCard
            roleId={roleId}
            previewVulnerability={previewVulnerability}
            onTakeToChat={onTakeToChat}
          />
        </div>
      )}

      {/* 错误提示与列表流 */}
      {previewReadError || loadError ? (
        <ErrorState
          title="日记暂时无法读取"
          description={previewReadError ?? loadError}
          action={<ActionButton size="sm" variant="plain" tone="accent" onClick={previewReadError ? onPreviewRetry : () => { void loadThoughts() }}>重新加载</ActionButton>}
          className="flex-1"
        />
      ) : displayedThoughts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            title={filterFavorite ? '还没有收藏任何独白' : '日记本里还空着'}
            description={
              filterFavorite
                ? '点击卡片右上角的心形图标，把触动内心的日记收藏起来吧。'
                : '当角色独处、回忆或整理心情时，会自主写下真情实感。'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedThoughts.map((thought) => (
            <div
              key={thought.id}
              className="group relative flex flex-col gap-2 rounded-[var(--radius-lg)] border p-4 transition-shadow hover:shadow-sm"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: thought.thoughtType === 'nightly_reflection' ? 'var(--accent)' : 'var(--border-subtle)',
              }}
              data-testid={`journal-entry-${thought.id}`}
            >
              {/* 卡片顶部元数据 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {formatDate(thought.createdAt)}
                  </span>
                  {thought.thoughtType === 'nightly_reflection' && (
                    <Badge tone="accent">
                      <Moon size={10} className="mr-0.5 inline" />
                      深夜反思
                    </Badge>
                  )}
                  {thought.location && (
                    <Badge tone="neutral">
                      <MapPin size={10} className="mr-0.5 inline" />
                      {thought.location}
                    </Badge>
                  )}
                  {thought.weather && (
                    <Badge tone="neutral">
                      <CloudSun size={10} className="mr-0.5 inline" />
                      {thought.weather}
                    </Badge>
                  )}
                  {thought.mood && (
                    <Badge tone="accent">
                      <Heart size={10} className="mr-0.5 inline" />
                      {thought.mood}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <IconButton
                    size={24}
                    label={thought.isFavorite ? '取消收藏' : '收藏日记'}
                    onClick={() => handleToggleFavorite(thought.id)}
                    style={{ color: thought.isFavorite ? 'var(--danger)' : 'var(--text-muted)' }}
                  >
                    <Heart size={13} className={thought.isFavorite ? 'fill-current' : ''} />
                  </IconButton>
                  <IconButton
                    size={24}
                    label="删除记录"
                    onClick={() => handleDelete(thought.id)}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>

              {/* 标题 */}
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {thought.title}
              </h3>

              {/* 正文 */}
              <p
                className="whitespace-pre-wrap text-[12px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {thought.content}
              </p>

              {/* 深夜反思心灵感悟一句话 */}
              {thought.epiphany && (
                <div
                  className="my-1.5 rounded-[var(--radius-md)] border-l-2 p-2.5 text-[12px] italic leading-relaxed"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    borderColor: 'var(--accent)',
                    color: 'var(--text-primary)',
                  }}
                  data-testid={`journal-epiphany-${thought.id}`}
                >
                  <span className="mr-1.5 not-italic text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>
                    💡 心灵感悟：
                  </span>
                  “{thought.epiphany}”
                </div>
              )}

              {/* 底部动作与对话桥梁 */}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {thought.activity ? (
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    动作：{thought.activity}
                  </span>
                ) : (
                  <span />
                )}

                {onTakeToChat && (
                  <ActionButton
                    size="sm"
                    variant="plain"
                    tone={thought.thoughtType === 'nightly_reflection' ? 'accent' : 'neutral'}
                    onClick={() => {
                      const promptText =
                        thought.thoughtType === 'nightly_reflection'
                          ? `读了你昨晚写的深夜感悟《${thought.title}》，心里觉得特别温暖，想和你聊聊……`
                          : `我刚刚偷看了你写的日记《${thought.title}》，原来你心里是这么想的啊！`
                      onTakeToChat({ text: promptText })
                    }}
                  >
                    <MessageSquareShare size={12} className="mr-1" />
                    {thought.thoughtType === 'nightly_reflection' ? '与TA聊聊这篇深夜感悟' : '与TA聊聊这篇日记'}
                  </ActionButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
