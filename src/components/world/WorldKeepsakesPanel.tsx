import { useCallback, useEffect, useState } from 'react'
import {
  Gift,
  MessageSquareShare,
  Sparkles,
  HeartHandshake,
  Heart,
  Utensils,
  Map as MapIcon,
  Compass,
  Coffee,
} from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { contentGutterStyle } from '../../shared/content-layout'
import { GiftGivingModal } from './GiftGivingModal'
import type {
  CompanionKeepsakeRecord,
  CompanionGiftRecord,
  CompanionGiftItem,
} from '../../shared/types'

interface WorldKeepsakesPanelProps {
  roleId?: string
  onTakeToChat?: (opts: { text: string }) => void
  refreshToken?: number
  onLoadingChange?: (loading: boolean) => void
  /**
   * Playground 离线样张注入数据：提供时完全跳过主进程 IPC 查询与广播订阅，
   * 并在内存中响应增改删与交互，用于无真实后端的纯前端设计审查。
   */
  previewKeepsakes?: CompanionKeepsakeRecord[]
  previewGifts?: CompanionGiftRecord[]
  previewAvailableGifts?: CompanionGiftItem[]
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
    }).format(timestamp)
  } catch {
    return new Date(timestamp).toLocaleDateString()
  }
}

function renderGiftCategoryIcon(category: string) {
  switch (category) {
    case 'food':
      return <Utensils size={16} />
    case 'collectible':
      return <MapIcon size={16} />
    case 'practical':
      return <Compass size={16} />
    case 'emotional':
      return <Heart size={16} />
    default:
      return <Gift size={16} />
  }
}

export function WorldKeepsakesPanel({
  roleId = 'luffy',
  onTakeToChat,
  refreshToken = 0,
  onLoadingChange,
  previewKeepsakes,
  previewGifts,
  previewAvailableGifts,
  previewReadError,
  onPreviewRetry,
}: WorldKeepsakesPanelProps) {
  const [activeTab, setActiveTab] = useState<'keepsakes' | 'gifts'>('keepsakes')
  const [keepsakes, setKeepsakes] = useState<CompanionKeepsakeRecord[]>(previewKeepsakes ?? [])
  const [gifts, setGifts] = useState<CompanionGiftRecord[]>(previewGifts ?? [])
  const [loading, setLoading] = useState(false)
  const [gifting, setGifting] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)

  const isLuffy = roleId === 'luffy'
  const title = isLuffy ? '草帽一伙的专属信物与羁绊' : '专属信物与同伴羁绊'
  const description = isLuffy
    ? '路飞在关键时刻赠予你的誓约信物，以及你送给路飞的心意礼物手账。'
    : '角色赠予你的珍贵物件，以及你送给角色的心意礼物手账。'

  // 同步 Playground 样张输入
  useEffect(() => {
    if (previewKeepsakes !== undefined) {
      setKeepsakes(previewKeepsakes)
    }
  }, [previewKeepsakes])

  useEffect(() => {
    if (previewGifts !== undefined) {
      setGifts(previewGifts)
    }
  }, [previewGifts])

  const loadData = useCallback(async () => {
    if (previewKeepsakes !== undefined || previewGifts !== undefined) return
    setLoading(true)
    onLoadingChange?.(true)
    try {
      if (window.electronAPI?.companion?.listKeepsakes) {
        const records = await window.electronAPI.companion.listKeepsakes(roleId)
        setKeepsakes(records)
      }
      if (window.electronAPI?.companion?.listReceivedGifts) {
        const giftRecords = await window.electronAPI.companion.listReceivedGifts(roleId)
        setGifts(giftRecords)
      }
    } catch (err) {
      console.warn('Failed to load keepsakes or gifts:', err)
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [previewKeepsakes, previewGifts, roleId, onLoadingChange])

  useEffect(() => {
    void loadData()
  }, [loadData, refreshToken])

  // 监听信物与赠礼实时广播
  useEffect(() => {
    if (previewKeepsakes !== undefined && previewGifts !== undefined) return
    const unsubs: Array<() => void> = []

    if (window.electronAPI?.companion?.onKeepsakeGifted) {
      const u1 = window.electronAPI.companion.onKeepsakeGifted((event) => {
        if (event.roleId === roleId) {
          setKeepsakes((prev) => [event.keepsake, ...prev.filter((k) => k.id !== event.keepsake.id)])
        }
      })
      unsubs.push(u1)
    }

    if (window.electronAPI?.companion?.onGiftReceived) {
      const u2 = window.electronAPI.companion.onGiftReceived((event) => {
        if (event.roleId === roleId) {
          setGifts((prev) => [event.gift, ...prev.filter((g) => g.id !== event.gift.id)])
        }
      })
      unsubs.push(u2)
    }

    return () => {
      unsubs.forEach((fn) => fn())
    }
  }, [previewKeepsakes, previewGifts, roleId])

  const handleTriggerGift = async () => {
    if (gifting) return
    if (previewKeepsakes !== undefined) {
      setGifting(true)
      const mockGift: CompanionKeepsakeRecord = {
        id: `mock-keepsake-${Date.now()}`,
        roleId,
        name: '羁绊的晨曦星盘',
        description: '在一次并肩跨越狂风骤雨后的黎明，由伙伴亲手雕刻并赠予你的专属星盘。',
        lore: '「喂！看这个！只要指针还转动，无论我们在大海的哪一端，我们都是最牢固的伙伴！」',
        giftMessage: '喂！看这个！这是我们一起冒险的证明！',
        giftReason: '样张中的模拟羁绊赠礼',
        iconName: 'gift',
        acquiredAt: Date.now(),
      }
      setKeepsakes((prev) => [mockGift, ...prev])
      setGifting(false)
      return
    }
    if (!window.electronAPI?.companion?.giftKeepsake) return
    setGifting(true)
    try {
      const gifted = await window.electronAPI.companion.giftKeepsake(roleId)
      if (gifted) {
        setKeepsakes((prev) => [gifted, ...prev.filter((k) => k.id !== gifted.id)])
      }
    } catch (err) {
      console.warn('Failed to gift keepsake:', err)
    } finally {
      setGifting(false)
    }
  }

  const handleGiftSent = (gift: CompanionGiftRecord) => {
    setGifts((prev) => [gift, ...prev.filter((g) => g.id !== gift.id)])
    setActiveTab('gifts')
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-keepsakes-panel"
      data-world-content="keepsakes"
    >
      {/* 头部标题与操作 */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <Gift size={16} style={{ color: 'var(--companion-accent-warm, #f59e0b)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <Badge tone="accent">
              {activeTab === 'keepsakes' ? `${keepsakes.length} 件信物` : `${gifts.length} 份心意`}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ActionButton
            size="sm"
            tone="accent"
            onClick={() => setShowGiftModal(true)}
            data-testid="open-gift-modal-btn"
          >
            <Heart size={12} className="mr-1" />
            赠送礼物 · 共筑羁绊
          </ActionButton>

          {activeTab === 'keepsakes' && (
            <ActionButton
              size="sm"
              variant="plain"
              tone="neutral"
              disabled={gifting}
              onClick={handleTriggerGift}
            >
              <Sparkles size={12} className={`mr-1 ${gifting ? 'animate-spin' : ''}`} />
              {gifting ? '正在准备...' : '索取信物'}
            </ActionButton>
          )}
        </div>
      </div>

      {/* 标签栏：伙伴信物 vs 赠礼心意 */}
      <div className="mb-4 flex gap-1 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('keepsakes')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            activeTab === 'keepsakes' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            color: activeTab === 'keepsakes' ? 'var(--companion-accent-warm, #f59e0b)' : 'var(--text-secondary)',
          }}
          data-testid="tab-keepsakes"
        >
          伙伴信物 ({keepsakes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gifts')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            activeTab === 'gifts' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            color: activeTab === 'gifts' ? 'var(--companion-accent-warm, #f59e0b)' : 'var(--text-secondary)',
          }}
          data-testid="tab-gifts"
        >
          心意手账 ({gifts.length})
        </button>
      </div>

      {/* 内容展示区 */}
      {previewReadError ? (
        <div
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
          data-testid="keepsakes-error-state"
        >
          <p className="text-sm font-medium" style={{ color: 'var(--danger, #ef4444)' }}>
            {previewReadError}
          </p>
          {onPreviewRetry && (
            <ActionButton size="sm" variant="plain" tone="accent" className="mt-3" onClick={onPreviewRetry}>
              重新加载
            </ActionButton>
          )}
        </div>
      ) : activeTab === 'keepsakes' ? (
        /* 信物列表 */
        keepsakes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="还没有获赠专属信物"
              description="与角色共同完成心愿、持续深入交谈或跨越相处里程碑时，角色会主动向你赠予专属信物。"
              centerWithoutAction
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {keepsakes.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border p-4 shadow-sm transition hover:shadow-md"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 30%, var(--border-subtle))',
                }}
                data-testid={`keepsake-card-${item.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{
                          background: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 15%, transparent)',
                          color: 'var(--companion-accent-warm, #f59e0b)',
                        }}
                      >
                        <Gift size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.name}
                        </h3>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          获赠于 {formatDate(item.acquiredAt)}
                        </span>
                      </div>
                    </div>

                    <Badge tone="accent">
                      <HeartHandshake size={10} className="mr-0.5 inline" />
                      {item.giftReason}
                    </Badge>
                  </div>

                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {item.description}
                  </p>

                  {item.lore && (
                    <div
                      className="mt-3 rounded-lg border-l-2 p-2.5 text-[11px] leading-relaxed italic"
                      style={{
                        backgroundColor: 'var(--bg-tertiary)',
                        borderLeftColor: 'var(--companion-accent-warm, #f59e0b)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {item.lore}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  {onTakeToChat && (
                    <ActionButton
                      size="sm"
                      variant="plain"
                      tone="accent"
                      onClick={() => {
                        onTakeToChat({
                          text: `我正看着你送给我的《${item.name}》，心里感觉特别温暖...`,
                        })
                      }}
                    >
                      <MessageSquareShare size={12} className="mr-1" />
                      触摸信物 · 与TA聊聊
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* 心意手账（用户送礼历史） */
        gifts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="还没有赠送过心意礼物"
              description="挑选一份美味的大肉或珍贵礼物送给伙伴，TA会感到无比开心并充满活力！"
              action={
                <ActionButton size="sm" tone="accent" onClick={() => setShowGiftModal(true)}>
                  <Heart size={12} className="mr-1" />
                  现在送出第一份心意
                </ActionButton>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {gifts.map((gift) => (
              <div
                key={gift.id}
                className="flex flex-col justify-between rounded-xl border p-4 shadow-sm transition hover:shadow-md"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 25%, var(--border-subtle))',
                }}
                data-testid={`received-gift-card-${gift.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{
                          background: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 15%, transparent)',
                          color: 'var(--companion-accent-warm, #f59e0b)',
                        }}
                      >
                        {renderGiftCategoryIcon(gift.category)}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {gift.giftName}
                        </h3>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          赠送于 {formatDate(gift.createdAt)}
                        </span>
                      </div>
                    </div>

                    {gift.vitalsBuff && (
                      <Badge tone="accent">
                        {gift.vitalsBuff.satiety ? `饱腹+${gift.vitalsBuff.satiety} ` : ''}
                        {gift.vitalsBuff.mood ? `心情+${gift.vitalsBuff.mood} ` : ''}
                        {gift.vitalsBuff.energy ? `体力+${gift.vitalsBuff.energy}` : ''}
                      </Badge>
                    )}
                  </div>

                  {/* 用户留言 */}
                  {gift.userNote && (
                    <div
                      className="mt-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>我的寄语：</span>
                      “{gift.userNote}”
                    </div>
                  )}

                  {/* 角色欢呼回响 */}
                  <div
                    className="mt-3 rounded-lg border-l-2 p-2.5 text-[11px] leading-relaxed italic"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      borderLeftColor: 'var(--companion-accent-warm, #f59e0b)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="font-semibold not-italic" style={{ color: 'var(--companion-accent-warm, #f59e0b)' }}>
                      {isLuffy ? '路飞的回响：' : '伙伴回响：'}
                    </span>
                    “{gift.companionReaction}”
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  {onTakeToChat && (
                    <ActionButton
                      size="sm"
                      variant="plain"
                      tone="accent"
                      onClick={() => {
                        onTakeToChat({
                          text: `我们刚才聊到了你收到的《${gift.giftName}》，真是太开心了！`,
                        })
                      }}
                    >
                      <MessageSquareShare size={12} className="mr-1" />
                      与TA聊聊这份礼物
                    </ActionButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 赠礼模态弹窗 */}
      <GiftGivingModal
        roleId={roleId}
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        onGiftSent={handleGiftSent}
        onTakeToChat={onTakeToChat}
        previewAvailableGifts={previewAvailableGifts}
      />
    </div>
  )
}
