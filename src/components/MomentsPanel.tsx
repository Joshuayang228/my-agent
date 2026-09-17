/**
 * 活跃主角朋友圈时间线（生活面卡片）
 * 仅展示当前 activeRole 的 moments；切换主角后列表随 IPC 变。
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Heart, MapPin, MessageCircle, Newspaper, RefreshCw, X } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { TextField } from './foundation/TextField'
import {
  emptyMomentSocial,
  mergeMomentComments,
  normalizeMomentCommentText,
  parseCastInteractions,
  type MomentSocialView,
} from '../shared/moment-user-interactions'

export interface MomentItem {
  id: string
  roleId: string
  eventId: string
  publishedAt: number
  text: string
  meta: Record<string, unknown>
  /** Playground / 已解析产品数据可附带的展示图片；生产事件仍以 meta 为唯一生活事实。 */
  media?: MomentMediaItem[]
}

export interface MomentMediaItem {
  src: string
  alt: string
}

export interface MomentsPreviewData {
  roleId: string
  roleName: string
  items: MomentItem[]
  summary?: string
}

interface MomentsPanelProps {
  onClose: () => void
  /** Playground / 测试专用只读朋友圈样张；存在时跳过 companion IPC。 */
  previewData?: MomentsPreviewData
  /** Playground 可显式切换为更接近微信朋友圈的社交流展示。 */
  appearance?: 'default' | 'social-feed' | 'alice-feed'
  /** 页面组合里已有 WorldHub 标题时隐藏重复的 Moments 标题行。 */
  hideHeader?: boolean
  /** Playground 仍用本地夹具互动；正式页只要没有 previewData 就走真实赞 / 评论。 */
  showSocialActions?: boolean
}

const TYPE_DOT: Record<string, string> = {
  daily: 'var(--companion-accent-warm)',
  social: 'var(--accent-fg)',
  work: 'var(--warning)',
  mood: 'var(--success)',
  outfit: '#a78bfa',
}

function formatWhen(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatRelativeWhen(ms: number): string {
  const delta = Math.max(0, Date.now() - ms)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function typeColor(type: unknown): string {
  if (typeof type !== 'string' || !type) return 'var(--companion-accent-warm)'
  const key = type.toLowerCase()
  return TYPE_DOT[key] || 'var(--companion-accent-warm)'
}


export function MomentsPanel({ onClose, previewData, appearance = 'default', hideHeader = false, showSocialActions = false }: MomentsPanelProps) {
  const isSocialFeed = appearance === 'social-feed' || appearance === 'alice-feed'
  const isAliceFeed = appearance === 'alice-feed'
  const [roleId, setRoleId] = useState(previewData?.roleId ?? '')
  const [roleName, setRoleName] = useState(previewData?.roleName ?? '')
  const [items, setItems] = useState<MomentItem[]>(previewData?.items ?? [])
  const [summary, setSummary] = useState(previewData?.summary ?? '')
  const [socialByMomentId, setSocialByMomentId] = useState<Record<string, MomentSocialView>>({})
  const [commentFocusId, setCommentFocusId] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({})
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set())
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(new Set())
  const pendingLikeLock = useRef(new Set<string>())
  const pendingCommentLock = useRef(new Set<string>())
  const [loading, setLoading] = useState(false)
  const socialEnabled = previewData ? showSocialActions : true

  const load = useCallback(async () => {
    if (previewData) {
      setRoleId(previewData.roleId)
      setRoleName(previewData.roleName)
      setItems(previewData.items)
      setSummary(previewData.summary ?? '')
      setSocialByMomentId(Object.fromEntries(previewData.items.map((item) => [item.id, emptyMomentSocial()])))
      setLoading(false)
      return
    }
    if (!window.electronAPI?.companion) return
    setLoading(true)
    try {
      const [active, moments, status] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getMoments({ limit: 80 }),
        window.electronAPI.companion.catchupStatus(),
      ])
      setRoleId(moments.roleId)
      setRoleName(active.name)
      setItems(moments.items)
      setSummary(status.catchupSummary || '')
      setSocialByMomentId(moments.socialByMomentId ?? {})
    } finally {
      setLoading(false)
    }
  }, [previewData])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (previewData || !window.electronAPI?.companion.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load, previewData])

  const patchSocial = useCallback((momentId: string, social: MomentSocialView) => {
    setSocialByMomentId((current) => ({ ...current, [momentId]: social }))
  }, [])

  const handleToggleLike = useCallback(async (momentId: string) => {
    if (!socialEnabled || pendingLikeLock.current.has(momentId)) return
    if (previewData) {
      setSocialByMomentId((current) => {
        const prev = current[momentId] ?? emptyMomentSocial()
        const liked = !prev.liked
        return {
          ...current,
          [momentId]: {
            ...prev,
            liked,
            likeCount: liked ? 1 : 0,
            like: liked ? { id: `preview-like-${momentId}`, createdAt: Date.now() } : undefined,
          },
        }
      })
      return
    }
    if (!window.electronAPI?.companion.toggleMomentLike) return
    pendingLikeLock.current.add(momentId)
    setPendingLikeIds((current) => new Set(current).add(momentId))
    try {
      const result = await window.electronAPI.companion.toggleMomentLike(momentId)
      if (!result.ok) {
        setCommentErrors((current) => ({ ...current, [momentId]: result.error }))
        return
      }
      setCommentErrors((current) => ({ ...current, [momentId]: '' }))
      patchSocial(momentId, result.social)
    } finally {
      pendingLikeLock.current.delete(momentId)
      setPendingLikeIds((current) => {
        const next = new Set(current)
        next.delete(momentId)
        return next
      })
    }
  }, [patchSocial, previewData, socialEnabled])

  const handleSubmitComment = useCallback(async (momentId: string) => {
    if (!socialEnabled || pendingCommentLock.current.has(momentId)) return
    const draft = commentDrafts[momentId] ?? ''
    if (previewData) {
      const normalized = normalizeMomentCommentText(draft)
      if (!normalized.ok) {
        setCommentErrors((current) => ({ ...current, [momentId]: normalized.error }))
        return
      }
      const text = normalized.text
      setSocialByMomentId((current) => {
        const prev = current[momentId] ?? emptyMomentSocial()
        const comments = [...prev.comments, { id: `preview-comment-${Date.now()}`, actorName: '我', text, createdAt: Date.now() }]
        return { ...current, [momentId]: { ...prev, comments, commentCount: comments.length } }
      })
      setCommentDrafts((current) => ({ ...current, [momentId]: '' }))
      setCommentErrors((current) => ({ ...current, [momentId]: '' }))
      return
    }
    if (!window.electronAPI?.companion.addMomentComment) return
    pendingCommentLock.current.add(momentId)
    setPendingCommentIds((current) => new Set(current).add(momentId))
    try {
      const result = await window.electronAPI.companion.addMomentComment(momentId, draft)
      if (!result.ok) {
        setCommentErrors((current) => ({ ...current, [momentId]: result.error }))
        return
      }
      patchSocial(momentId, result.social)
      setCommentDrafts((current) => ({ ...current, [momentId]: '' }))
      setCommentErrors((current) => ({ ...current, [momentId]: '' }))
    } finally {
      pendingCommentLock.current.delete(momentId)
      setPendingCommentIds((current) => {
        const next = new Set(current)
        next.delete(momentId)
        return next
      })
    }
  }, [commentDrafts, patchSocial, previewData, socialEnabled])

  const handleCommentKey = useCallback((event: KeyboardEvent<HTMLInputElement>, momentId: string) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    void handleSubmitComment(momentId)
  }, [handleSubmitComment])

  return (
    <div className={`flex h-full flex-col ${isSocialFeed ? 'moments-social-feed' : ''} ${isAliceFeed ? 'moments-alice-feed' : ''}`} data-testid="moments-panel">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <Newspaper size={16} style={{ color: 'var(--companion-accent-warm)' }} />
            <div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>朋友圈</div>
              <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {roleName || roleId || '活跃主角'} · 生活广播（非日志表）
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void load()} className="rounded p-1.5 transition" style={{ color: 'var(--text-muted)' }} title="刷新">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onClose} className="rounded p-1.5 transition" style={{ color: 'var(--text-muted)' }} title="关闭">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className={isSocialFeed ? 'flex-1 overflow-y-auto px-5 py-4 scrollbar-thin' : 'flex-1 overflow-y-auto px-4 py-3 scrollbar-thin'}>
        {!isSocialFeed && summary ? (
          <div className="mb-4 rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed" style={{ borderColor: 'var(--companion-catchup-border)', background: 'var(--companion-catchup-bg)', color: 'var(--text-secondary)' }}>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--companion-accent-warm)' }}>Catch-up</div>
            {summary}
          </div>
        ) : null}

        {items.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>还没有动态。活跃主角生活 tick / Catch-up 后会出现在这里。</p>
        ) : (
          <ul className={isSocialFeed ? 'space-y-5' : 'space-y-3'}>
            {items.map((m) => {
              const type = typeof m.meta?.type === 'string' ? m.meta.type : ''
              const location = typeof m.meta?.location === 'string' ? m.meta.location : ''
              const interactions = parseCastInteractions(m.meta || {})
              const coframes = interactions.filter((i) => i.kind === 'coframe')
              const social = socialByMomentId[m.id] ?? emptyMomentSocial()
              const comments = mergeMomentComments(interactions, social.comments)
              const commentOpen = commentFocusId === m.id
              const likePending = pendingLikeIds.has(m.id)
              const commentPending = pendingCommentIds.has(m.id)
              if (isSocialFeed) {
                return (
                  <li key={m.id} data-testid={isAliceFeed ? 'moment-post' : undefined} className={isAliceFeed ? 'moments-alice-post' : 'border-b pb-5'} style={isAliceFeed ? undefined : { borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-start gap-2.5">
                      <span className={`flex ${isAliceFeed ? 'h-10 w-10' : 'h-9 w-9'} shrink-0 items-center justify-center rounded-full text-[13px] font-semibold`} style={{ background: 'var(--accent-subtle)', color: 'var(--companion-accent-warm)' }}>
                        {(roleName || '小林').slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[13px] font-semibold" style={{ color: isAliceFeed ? 'var(--text-primary)' : 'var(--accent-fg)' }}>{roleName || '小林'}</div>
                          {!isAliceFeed ? (
                            <button type="button" className="rounded px-1 text-[13px]" style={{ color: 'var(--text-muted)' }} title="动态选项">···</button>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {isAliceFeed ? formatRelativeWhen(m.publishedAt) : formatWhen(m.publishedAt)}{!isAliceFeed && location ? ` · ${location}` : ''}
                        </div>
                        <p className="mt-2 text-[13px] leading-6" style={{ color: 'var(--text-primary)' }}>{m.text}</p>
                        {m.media?.length ? (
                          <div
                            className={`moments-alice-media mt-2.5 grid gap-1.5 ${m.media.length === 1 ? 'grid-cols-1' : m.media.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
                            data-testid="moment-media"
                          >
                            {m.media.slice(0, 9).map((media, index) => (
                              <img
                                key={`${media.src}-${index}`}
                                src={media.src}
                                alt={media.alt}
                                loading="lazy"
                                decoding="async"
                                className="moments-alice-media-image block w-full object-cover"
                                data-testid="moment-media-image"
                              />
                            ))}
                          </div>
                        ) : null}
                        {isAliceFeed && location ? (
                          <div className="moments-alice-location mt-1.5 inline-flex items-center gap-1 text-[10px]" data-testid="moment-location" style={{ color: 'var(--text-muted)' }}>
                            <MapPin size={11} strokeWidth={1.8} aria-hidden="true" />
                            <span>{location}</span>
                          </div>
                        ) : null}
                        {coframes.length ? <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>与{coframes.map((c) => c.castName).join('、')}同框</div> : null}
                        {comments.length ? (
                          <ul className="mt-2 space-y-1 rounded-md px-2.5 py-2 text-[11px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            {comments.map((c) => <li key={c.key} data-testid="moment-comment" data-comment-source={c.source}><span style={{ color: 'var(--accent-fg)' }}>{c.actorName}</span>：{c.text || '赞'}</li>)}
                          </ul>
                        ) : null}
                        {socialEnabled && (
                          <div className="moments-alice-actions mt-3 border-t pt-2" data-testid="moment-social-actions" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="flex items-center justify-start">
                              <ActionButton
                                aria-label={social.liked ? '取消赞' : '赞'}
                                data-testid="moment-like-button"
                                disabled={likePending}
                                onClick={() => void handleToggleLike(m.id)}
                                className="moments-alice-action gap-1.5"
                                style={{ color: social.liked ? 'var(--accent-fg)' : 'var(--text-muted)', background: social.liked ? 'var(--accent-subtle)' : 'transparent', borderColor: 'transparent' }}
                              >
                                <Heart size={13} fill={social.liked ? 'currentColor' : 'none'} aria-hidden="true" />
                                <span aria-hidden="true">{social.liked ? '1' : '赞'}</span>
                              </ActionButton>
                              <ActionButton
                                aria-label="评论"
                                aria-pressed={commentOpen}
                                data-testid="moment-comment-button"
                                onClick={() => setCommentFocusId((current) => current === m.id ? null : m.id)}
                                className="moments-alice-action gap-1.5"
                                style={{ color: commentOpen ? 'var(--accent-fg)' : 'var(--text-muted)', background: commentOpen ? 'var(--accent-subtle)' : 'transparent', borderColor: 'transparent' }}
                              >
                                <MessageCircle size={13} aria-hidden="true" />
                                <span aria-hidden="true">{comments.length || '评论'}</span>
                              </ActionButton>
                            </div>
                            <div className="mt-2 grid h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" data-testid="moment-comment-composer">
                              <TextField
                                value={commentDrafts[m.id] ?? ''}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setCommentDrafts((current) => ({ ...current, [m.id]: event.target.value }))}
                                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => handleCommentKey(event, m.id)}
                                placeholder="写评论"
                                disabled={commentPending}
                                aria-hidden={!commentOpen}
                                tabIndex={commentOpen ? 0 : -1}
                                data-testid="moment-comment-input"
                                className="theme-input h-8 min-w-0 rounded-[var(--radius-md)] border px-3"
                                style={{ visibility: commentOpen ? 'visible' : 'hidden', pointerEvents: commentOpen ? 'auto' : 'none' }}
                              />
                              <ActionButton
                                onClick={() => void handleSubmitComment(m.id)}
                                disabled={commentPending || !(commentDrafts[m.id] ?? '').trim()}
                                aria-hidden={!commentOpen}
                                tabIndex={commentOpen ? 0 : -1}
                                data-testid="moment-comment-submit"
                                style={{ visibility: commentOpen ? 'visible' : 'hidden', pointerEvents: commentOpen ? 'auto' : 'none' }}
                              >
                                发送
                              </ActionButton>
                            </div>
                            <p className="min-h-4 text-[10px]" data-testid="moment-comment-error" style={{ color: 'var(--danger)' }}>{commentErrors[m.id] || '\u00a0'}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              }
              return (
                <li key={m.id} className="companion-life-card rounded-xl border px-3.5 py-3" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--companion-shadow-card)' }}>
                  <div className="mb-1.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: typeColor(type) }} aria-hidden />
                    <span>{formatWhen(m.publishedAt)}</span>
                    {type ? <span>· {type}</span> : null}
                    {location ? <span>· {location}</span> : null}
                    {coframes.length ? <span>· 与{coframes.map((c) => c.castName).join('、')}同框</span> : null}
                  </div>
                  <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{m.text}</div>
                  {comments.length ? (
                    <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      {comments.map((c) => <li key={c.key} data-testid="moment-comment" data-comment-source={c.source} className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--companion-accent-warm)' }}>{c.actorName}</span>：{c.text || '赞'}</li>)}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
        {isSocialFeed && <p className="pt-5 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>仅展示近期动态 · 内容由主角的生活事件自然派生</p>}
      </div>
    </div>
  )
}
