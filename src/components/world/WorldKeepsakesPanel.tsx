import { useCallback, useEffect, useState } from 'react'
import {
  Gift,
  MessageSquareShare,
  Sparkles,
  Heart,
  Utensils,
  Map as MapIcon,
  Compass,
  ArrowLeft,
} from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { TabStrip } from '../foundation/TabStrip'
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
  const [loadError, setLoadError] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = keepsakes.find(item => item.id === selectedId)

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
    setLoadError('')
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
      setLoadError('信物与礼物读取失败，请重试。')
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
    setSelectedId(null)
    setActiveTab('gifts')
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-keepsakes-panel"
      data-world-content="keepsakes"
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {selected ? (
          <ActionButton variant="plain" onClick={() => setSelectedId(null)}>
            <ArrowLeft size={14} className="mr-1" />返回信物
          </ActionButton>
        ) : (
          <TabStrip label="信物内容" activeId={activeTab}
            onSelect={id => { setActiveTab(id as 'keepsakes' | 'gifts'); setSelectedId(null) }}
            items={[
              { id: 'keepsakes', label: '收到的信物', testId: 'tab-keepsakes' },
              { id: 'gifts', label: '送出的礼物', testId: 'tab-gifts' },
            ]}
          />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ActionButton onClick={() => setShowGiftModal(true)} data-testid="open-gift-modal-btn">
            <Heart size={14} className="mr-1" />赠送礼物
          </ActionButton>
          {activeTab === 'keepsakes' && !selected && (
            <ActionButton variant="plain" disabled={gifting} onClick={handleTriggerGift}>
              <Sparkles size={14} className="mr-1" />{gifting ? '正在准备…' : '索取信物'}
            </ActionButton>
          )}
        </div>
      </div>

      {/* 内容展示区 */}
      {previewReadError || loadError ? (
        <div
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
          data-testid="keepsakes-error-state"
        >
          <ErrorState
            title="信物与礼物暂时无法读取"
            description={previewReadError ?? loadError}
            action={<ActionButton size="sm" variant="plain" tone="accent" onClick={previewReadError ? onPreviewRetry : () => { void loadData() }}>重新加载</ActionButton>}
          />
        </div>
      ) : activeTab === 'keepsakes' ? (
        /* 信物列表 */
        keepsakes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="还没有获赠信物"
              description="与角色共同完成心愿、持续深入交谈或跨越相处里程碑时，角色会主动向你赠予信物。"
              centerWithoutAction
            />
          </div>
        ) : (
          selected ? (
            <article className="w-full max-w-3xl rounded-[var(--radius-card)] border p-6 sm:p-8"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
              data-testid={`keepsake-detail-${selected.id}`}>
              <h2 className="break-words font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</h2>
              <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>获赠于 {formatDate(selected.acquiredAt)}</p>
              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
              {selected.lore && <p className="mt-4 whitespace-pre-wrap break-words font-display text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>{selected.lore}</p>}
              {selected.giftMessage && <blockquote className="mt-5 whitespace-pre-wrap break-words font-display text-base leading-8" style={{ color: 'var(--text-primary)' }}>{selected.giftMessage}</blockquote>}
              {selected.giftReason && <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>{selected.giftReason}</p>}
              {onTakeToChat && <div className="mt-6 flex justify-end">
                <ActionButton variant="plain" onClick={() => onTakeToChat({ text: `我想和你聊聊你送我的《${selected.name}》。` })}>
                  <MessageSquareShare size={14} className="mr-1" />聊聊这件信物
                </ActionButton>
              </div>}
            </article>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="keepsake-shelf">
              {keepsakes.map(item => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)}
                  aria-label={`查看信物：${item.name}`} data-testid={`keepsake-card-${item.id}`}
                  className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border text-left transition-colors hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                  <span className="flex min-h-28 flex-col justify-between gap-4 p-4" style={{ background: 'var(--accent-subtle)' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(item.acquiredAt)}</span>
                    <span className="break-words font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                  </span>
                  <span className="p-4"><span className="line-clamp-3 break-words text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>{item.description}</span></span>
                </button>
              ))}
            </div>
          )
        )
      ) : (
        /* 心意手账（用户送礼历史） */
        gifts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              title="还没有赠送过心意礼物"
              description="挑选一份合适的礼物送给伙伴，TA会感受到你的心意。"
              action={
                <ActionButton size="sm" tone="accent" onClick={() => setShowGiftModal(true)}>
                  <Heart size={12} className="mr-1" />
                  现在送出第一份心意
                </ActionButton>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {gifts.map((gift) => (
              <div
                key={gift.id}
                className="flex flex-col justify-between border-b pb-4 transition-colors hover:bg-[var(--hover-overlay)]"
                style={{ borderColor: 'var(--border-subtle)' }}
                data-testid={`received-gift-card-${gift.id}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)]"
                        style={{
                          background: 'color-mix(in srgb, var(--companion-accent-warm) 15%, transparent)',
                          color: 'var(--companion-accent-warm)',
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
                      className="mt-3 rounded-[var(--radius-lg)] px-3 py-2 text-[11px] leading-relaxed"
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>我的寄语：</span>
                      “{gift.userNote}”
                    </div>
                  )}

                  {/* 角色欢呼回响 */}
                  <div
                    className="mt-3 rounded-[var(--radius-lg)] p-2.5 text-[11px] leading-relaxed italic"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="font-semibold not-italic" style={{ color: 'var(--companion-accent-warm)' }}>
                      伙伴回响：
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
