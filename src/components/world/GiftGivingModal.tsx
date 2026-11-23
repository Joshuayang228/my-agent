import { useState, useEffect } from 'react'
import {
  Gift,
  X,
  Sparkles,
  Heart,
  Utensils,
  Map as MapIcon,
  Compass,
  Coffee,
  CheckCircle2,
  MessageSquareShare,
} from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { Badge } from '../foundation/Badge'
import type { CompanionGiftItem, CompanionGiftRecord } from '../../shared/types'

interface GiftGivingModalProps {
  roleId?: string
  isOpen: boolean
  onClose: () => void
  onGiftSent?: (gift: CompanionGiftRecord) => void
  onTakeToChat?: (opts: { text: string }) => void
  previewAvailableGifts?: CompanionGiftItem[]
  previewSendGift?: (giftKey: string, note?: string) => Promise<CompanionGiftRecord>
}

const PRESET_QUICK_NOTES = [
  '特意为你准备的，收下吧！',
  '辛苦啦，好好犒劳一下自己。',
  '路上也要平平安安的。',
  '希望今天也能开开心心的！',
]

function renderGiftIcon(iconName: string) {
  switch (iconName) {
    case 'Utensils':
      return <Utensils size={18} />
    case 'Map':
      return <MapIcon size={18} />
    case 'Compass':
      return <Compass size={18} />
    case 'Coffee':
      return <Coffee size={18} />
    case 'Heart':
      return <Heart size={18} />
    default:
      return <Gift size={18} />
  }
}

/**
 * 心意赠礼弹窗（GiftGivingModal）。
 *
 * 背景：旧版弹窗直接印出 `饱腹+20 心情+15 体力+10` 等 RPG 体征加值与硬编码角色名/十六进制色值，
 * 容易让用户产生“给电子宠物喂药”的出戏感，且缺少 Esc 与点击遮罩关闭。
 * 设计意图：全量改用 Foundation 设计令牌与自然情感文案（不暴露数值加值），补齐 dialog 无障碍语义与键盘关闭。
 * 关键约束：不改变后端 sendGift IPC 契约；Playground 离线预览与正式环境共用同一交互闭环。
 */
export function GiftGivingModal({
  roleId = 'luffy',
  isOpen,
  onClose,
  onGiftSent,
  onTakeToChat,
  previewAvailableGifts,
  previewSendGift,
}: GiftGivingModalProps) {
  const [gifts, setGifts] = useState<CompanionGiftItem[]>(previewAvailableGifts ?? [])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [userNote, setUserNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CompanionGiftRecord | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setResult(null)
        setUserNote('')
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, submitting, onClose])

  useEffect(() => {
    if (previewAvailableGifts) {
      setGifts(previewAvailableGifts)
      if (previewAvailableGifts.length > 0 && !selectedKey) {
        setSelectedKey(previewAvailableGifts[0].key)
      }
      return
    }
    if (!isOpen) return
    let active = true
    const loadGifts = async () => {
      if (!window.electronAPI?.companion?.listAvailableGifts) return
      setLoading(true)
      try {
        const list = await window.electronAPI.companion.listAvailableGifts(roleId)
        if (active) {
          setGifts(list)
          if (list.length > 0 && !selectedKey) {
            setSelectedKey(list[0].key)
          }
        }
      } catch (err) {
        console.warn('Failed to load gifts:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadGifts()
    return () => {
      active = false
    }
  }, [isOpen, previewAvailableGifts, roleId, selectedKey])

  if (!isOpen) return null

  const selectedGift = gifts.find((g) => g.key === selectedKey) || gifts[0]

  const handleSend = async () => {
    if (!selectedGift || submitting) return
    setSubmitting(true)
    try {
      let record: CompanionGiftRecord | null = null
      if (previewSendGift) {
        record = await previewSendGift(selectedGift.key, userNote)
      } else if (previewAvailableGifts) {
        record = {
          id: `preview-gift-${Date.now()}`,
          roleId,
          giftKey: selectedGift.key,
          giftName: selectedGift.name,
          category: selectedGift.category,
          userNote: userNote || undefined,
          companionReaction: `收到你送的「${selectedGift.name}」啦！真的太合我心意了，谢谢你一直惦记着我。`,
          createdAt: Date.now(),
          vitalsBuff: selectedGift.vitalsBuff,
        }
      } else if (window.electronAPI?.companion?.sendGift) {
        record = await window.electronAPI.companion.sendGift(roleId, selectedGift.key, userNote)
      }

      if (record) {
        setResult(record)
        onGiftSent?.(record)
      }
    } catch (err) {
      console.warn('Failed to send gift:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    if (submitting) return
    setResult(null)
    setUserNote('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)' }}
      data-testid="gift-giving-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleReset()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={result ? '送礼心意回响' : '赠送礼物'}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-card)] border shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* 弹窗顶栏 */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <Gift size={18} style={{ color: 'var(--accent-fg)' }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {result ? '送礼回响' : '赠送礼物'}
            </h3>
          </div>
          <IconButton label="关闭" onClick={handleReset} disabled={submitting} style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </IconButton>
        </div>

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {result ? (
            /* 赠送成功与回响卡片 */
            <div className="flex flex-col items-center text-center" data-testid="gift-result-card">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-fg)',
                }}
              >
                <Sparkles size={26} />
              </div>

              <h4 className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                伙伴收下了你的心意
              </h4>

              <div className="mt-1.5">
                <Badge tone="accent">
                  <CheckCircle2 size={11} className="mr-1 inline" />
                  已送出：{result.giftName}
                </Badge>
              </div>

              {/* 伙伴第一人称回响气泡 */}
              <div
                className="mt-4 w-full rounded-[var(--radius-md)] border p-4 text-left"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--accent-fg)' }}>
                    伙伴的即时回响
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>已同步到主会话</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  “{result.companionReaction}”
                </p>
              </div>

              {/* 操作区 */}
              <div className="mt-6 flex w-full justify-end gap-3">
                {onTakeToChat && (
                  <ActionButton
                    size="sm"
                    variant="plain"
                    tone="accent"
                    onClick={() => {
                      onTakeToChat({
                        text: `看到你喜欢这份「${result.giftName}」，我也很开心。`,
                      })
                      handleReset()
                    }}
                  >
                    <MessageSquareShare size={12} className="mr-1" />
                    去主会话聊聊
                  </ActionButton>
                )}
                <ActionButton size="sm" tone="accent" onClick={handleReset}>
                  完成
                </ActionButton>
              </div>
            </div>
          ) : (
            /* 礼物货架与表单 */
            <div className="space-y-4">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                挑一件合心意的小礼物送给伙伴，对方收到后会给你真心的回应并记在心意手账里。
              </p>

              {loading && gifts.length === 0 ? (
                <p className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>正在整理礼物清单…</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {gifts.map((item) => {
                    const isSelected = item.key === selectedKey
                    const isFavorite = item.roleAffinity?.[roleId] === 'favorite'

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setSelectedKey(item.key)}
                        className="flex flex-col items-center rounded-[var(--radius-md)] border p-3 text-center transition hover:bg-[var(--hover-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-fg)]"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                          borderColor: isSelected ? 'var(--accent-fg)' : 'var(--border-subtle)',
                        }}
                        data-testid={`gift-item-${item.key}`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            color: 'var(--accent-fg)',
                          }}
                        >
                          {renderGiftIcon(item.iconName)}
                        </div>

                        <span className="mt-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.name}
                        </span>

                        {isFavorite && (
                          <span
                            className="mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                            style={{
                              backgroundColor: 'var(--accent-subtle)',
                              color: 'var(--accent-fg)',
                            }}
                          >
                            偏爱
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* 选中礼物详情（纯自然描述，不展示 RPG 体征加值） */}
              {selectedGift && (
                <div
                  className="rounded-[var(--radius-md)] border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <h5 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {selectedGift.name}
                  </h5>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {selectedGift.description}
                  </p>
                </div>
              )}

              {/* 附带寄语输入 */}
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  附带一句话（可选）
                </label>

                {/* 快捷寄语 */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRESET_QUICK_NOTES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setUserNote(preset)}
                      className="rounded-full border px-2.5 py-1 text-[11px] transition hover:bg-[var(--hover-overlay)]"
                      style={{
                        backgroundColor: userNote === preset ? 'var(--accent-subtle)' : 'var(--bg-secondary)',
                        borderColor: userNote === preset ? 'var(--accent-fg)' : 'var(--border-subtle)',
                        color: userNote === preset ? 'var(--accent-fg)' : 'var(--text-secondary)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="想对伙伴说点什么，可以顺手写在这里…"
                  maxLength={120}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border p-2.5 text-xs outline-none transition focus:ring-1 focus:ring-[var(--accent-fg)]"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                  }}
                  data-testid="gift-note-input"
                />
              </div>

              {/* 底部提交 */}
              <div className="flex justify-end gap-2.5 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <ActionButton size="sm" variant="plain" tone="neutral" onClick={handleReset} disabled={submitting}>
                  取消
                </ActionButton>
                <ActionButton
                  size="sm"
                  tone="accent"
                  onClick={handleSend}
                  disabled={submitting || !selectedGift}
                  data-testid="send-gift-button"
                >
                  <Sparkles size={12} className={`mr-1 ${submitting ? 'animate-spin' : ''}`} />
                  {submitting ? '正在送出…' : '送出礼物'}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
