/**
 * 伙伴礼物柜面板（WorldKeepsakesPanel）。
 *
 * 背景：人物世界的「礼物」Tab 定位为伙伴的只读礼物柜，展示伙伴送出的纪念礼物与收到的礼物回响；
 * 此前页内保留了「赠送礼物」「索取信物」等手动按钮与 RPG 体征加值徽标，与只读生活面及“通过聊天自然送礼”的产品定位冲突。
 * 设计意图：彻底收敛为只读陈列柜，双子标签按伙伴视角分为「送出的礼物」与「收到的礼物」，
 * 不保留任何手动送礼/刷信物按钮；用户送礼通过主会话 Chat（companion_receive_gift）自然完成。
 * 关键约束：保留 previewKeepsakes / previewGifts 供 Playground 离线预览；保留与 TA 聊聊入口。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquareShare,
  Gift,
} from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { DetailHeader } from '../foundation/DetailHeader'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { ImagePreviewImage } from '../foundation/ImagePreviewImage'
import { SurfaceCard } from '../foundation/SurfaceCard'
import { TabStrip } from '../foundation/TabStrip'
import { LAYOUT_CLASSES, contentGutterStyle, mediaFrameStyle } from '../../shared/content-layout'
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
   * 用于无真实后端的纯前端设计审查。
   */
  previewKeepsakes?: CompanionKeepsakeRecord[]
  previewGifts?: CompanionGiftRecord[]
  /** 兼容既有样张 props（只读礼物柜不再弹手动送礼窗） */
  previewAvailableGifts?: CompanionGiftItem[]
  previewReadError?: string
  onPreviewRetry?: () => void
  /** 可选默认子标签，方便 Playground 分别展示「送出的礼物」与「收到的礼物」 */
  initialSubTab?: 'keepsakes' | 'gifts'
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

function GiftCoverImage({ src, alt, detail = false }: { src?: string; alt: string; detail?: boolean }) {
  if (detail) {
    if (!src) return null
    return (
      <div
        className="mb-5 w-full overflow-hidden rounded-[var(--radius-md)]"
        style={{ ...mediaFrameStyle('card'), maxWidth: 460 }}
        data-testid="gift-detail-image"
      >
        <ImagePreviewImage
          src={src}
          alt={alt}
          className="block h-full w-full object-cover"
          buttonClassName="h-full w-full"
        />
      </div>
    )
  }
  return (
    <div className="w-full overflow-hidden" style={mediaFrameStyle('card')} data-testid="gift-card-image">
      {src ? (
        <img src={src} alt={alt} className="block h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          <Gift size={20} strokeWidth={1.6} />
          <span>暂无配图</span>
        </div>
      )}
    </div>
  )
}

export function WorldKeepsakesPanel({
  roleId = 'luffy',
  onTakeToChat,
  refreshToken = 0,
  onLoadingChange,
  previewKeepsakes,
  previewGifts,
  previewReadError,
  onPreviewRetry,
  initialSubTab = 'keepsakes',
}: WorldKeepsakesPanelProps) {
  const [activeTab, setActiveTab] = useState<'keepsakes' | 'gifts'>(initialSubTab)
  const [keepsakes, setKeepsakes] = useState<CompanionKeepsakeRecord[]>(previewKeepsakes ?? [])
  const [gifts, setGifts] = useState<CompanionGiftRecord[]>(previewGifts ?? [])
  const [loadError, setLoadError] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = activeTab === 'keepsakes' ? keepsakes.find((item) => item.id === selectedId) : undefined
  const selectedGift = activeTab === 'gifts' ? gifts.find((item) => item.id === selectedId) : undefined
  const hasSelection = Boolean(selected || selectedGift)

  useEffect(() => {
    setActiveTab(initialSubTab)
    setSelectedId(null)
  }, [initialSubTab])

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
      setLoadError('礼物柜读取失败，请重试。')
      console.warn('Failed to load gift cabinet:', err)
    } finally {
      onLoadingChange?.(false)
    }
  }, [previewKeepsakes, previewGifts, roleId, onLoadingChange])

  useEffect(() => {
    void loadData()
  }, [loadData, refreshToken])

  // 监听礼物实时广播（由 Chat 或关系里程碑触发）
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

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-keepsakes-panel"
      data-world-content="keepsakes"
    >
      {hasSelection ? (
        <DetailHeader backLabel="返回礼物柜" onBack={() => setSelectedId(null)} />
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <TabStrip
            label="礼物柜分类"
            activeId={activeTab}
            onSelect={(id) => {
              setActiveTab(id as 'keepsakes' | 'gifts')
              setSelectedId(null)
            }}
            items={[
              { id: 'keepsakes', label: '送出的礼物', testId: 'tab-keepsakes' },
              { id: 'gifts', label: '收到的礼物', testId: 'tab-gifts' },
            ]}
          />
        </div>
      )}

      {/* 内容展示区（纯只读礼物柜） */}
      {previewReadError || loadError ? (
        <div data-testid="keepsakes-error-state">
          <ErrorState
            title="礼物柜暂时无法读取"
            description={previewReadError ?? loadError}
            action={(
              <ActionButton
                size="sm"
                variant="plain"
                tone="accent"
                onClick={previewReadError ? onPreviewRetry : () => { void loadData() }}
              >
                重新加载
              </ActionButton>
            )}
          />
        </div>
      ) : activeTab === 'keepsakes' ? (
        /* 伙伴送出的礼物 */
        keepsakes.length === 0 ? (
          <EmptyState
            title="还没有送出过礼物"
            description="一起经历重要时刻或实现共同心愿时，伙伴会把想送你的纪念礼物放进这里。"
            centerWithoutAction
          />
        ) : selected ? (
          <article
            className="mx-auto w-full max-w-3xl rounded-[var(--radius-card)] border p-6 sm:p-8"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
            data-testid={`keepsake-detail-${selected.id}`}
          >
            <GiftCoverImage src={selected.imageUrl} alt={selected.name} detail />
            <h2 className="break-words font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </h2>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              送出于 {formatDate(selected.acquiredAt)}
            </p>
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
              {selected.description}
            </p>
            {selected.lore && (
              <p className="mt-4 whitespace-pre-wrap break-words font-display text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                {selected.lore}
              </p>
            )}
            {selected.giftMessage && (
              <blockquote className="mt-5 whitespace-pre-wrap break-words font-display text-base leading-8" style={{ color: 'var(--text-primary)' }}>
                {selected.giftMessage}
              </blockquote>
            )}
            {selected.giftReason && (
              <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                {selected.giftReason}
              </p>
            )}
            {onTakeToChat && (
              <div className="mt-6 flex justify-end">
                <ActionButton
                  variant="plain"
                  onClick={() => onTakeToChat({ text: `我想和你聊聊你送我的「${selected.name}」。` })}
                >
                  <MessageSquareShare size={14} className="mr-1" />聊聊这份礼物
                </ActionButton>
              </div>
            )}
          </article>
        ) : (
          <div className={`${LAYOUT_CLASSES.cardGrid} items-stretch`} data-testid="keepsake-shelf">
            {keepsakes.map((item) => (
              <SurfaceCard
                key={item.id}
                as="button"
                padding="none"
                onClick={() => setSelectedId(item.id)}
                aria-label={`查看礼物：${item.name}`}
                data-testid={`keepsake-card-${item.id}`}
              >
                <GiftCoverImage src={item.imageUrl} alt={item.name} />
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{formatDate(item.acquiredAt)}</span>
                  <span className="break-words font-display text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                  <span className="line-clamp-2 break-words text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
                    {item.description}
                  </span>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )
      ) : (
        /* 伙伴收到的礼物（来自伙伴或你在聊天中自然送出），与「送出的礼物」统一卡片与详情样式 */
        gifts.length === 0 ? (
          <EmptyState
            title="还没有收到过礼物"
            description="在聊天里送给伙伴喜欢的食物或小物件，TA 会珍藏进礼物柜。"
            centerWithoutAction
          />
        ) : selectedGift ? (
          <article
            className="mx-auto w-full max-w-3xl rounded-[var(--radius-card)] border p-6 sm:p-8"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--card-bg)' }}
            data-testid={`received-gift-detail-${selectedGift.id}`}
          >
            <GiftCoverImage src={selectedGift.imageUrl} alt={selectedGift.giftName} detail />
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="break-words font-display text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedGift.giftName}
              </h2>
              <Badge tone={selectedGift.giverName && selectedGift.giverName !== '你' ? 'neutral' : 'accent'}>
                来自 {selectedGift.giverName || '你'}
              </Badge>
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              收到于 {formatDate(selectedGift.createdAt)}
            </p>
            {selectedGift.userNote && (
              <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7" style={{ color: 'var(--text-secondary)' }}>
                “{selectedGift.userNote}”
              </p>
            )}
            <blockquote className="mt-5 whitespace-pre-wrap break-words font-display text-base leading-8" style={{ color: 'var(--text-primary)' }}>
              {selectedGift.companionReaction}
            </blockquote>
            {onTakeToChat && (
              <div className="mt-6 flex justify-end border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <ActionButton
                  variant="plain"
                  tone="accent"
                  onClick={() => onTakeToChat({ text: `聊聊你礼物柜里的「${selectedGift.giftName}」吧！` })}
                >
                  <MessageSquareShare size={14} className="mr-1" />聊聊这份礼物
                </ActionButton>
              </div>
            )}
          </article>
        ) : (
          <div className={`${LAYOUT_CLASSES.cardGrid} items-stretch`} data-testid="received-gift-shelf">
            {gifts.map((gift) => (
              <SurfaceCard
                key={gift.id}
                as="button"
                padding="none"
                onClick={() => setSelectedId(gift.id)}
                aria-label={`查看礼物：${gift.giftName}`}
                data-testid={`received-gift-card-${gift.id}`}
              >
                <GiftCoverImage src={gift.imageUrl} alt={gift.giftName} />
                <div className="flex flex-1 flex-col gap-2 p-3.5">
                  <span className="flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatDate(gift.createdAt)}</span>
                    <Badge tone={gift.giverName && gift.giverName !== '你' ? 'neutral' : 'accent'}>
                      来自 {gift.giverName || '你'}
                    </Badge>
                  </span>
                  <span className="break-words font-display text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {gift.giftName}
                  </span>
                  <span className="line-clamp-2 break-words text-[12px] leading-5" style={{ color: 'var(--text-secondary)' }}>
                    {gift.userNote || gift.companionReaction}
                  </span>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )
      )}
    </div>
  )
}
