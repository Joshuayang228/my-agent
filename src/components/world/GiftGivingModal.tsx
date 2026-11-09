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
  '辛苦啦，吃饱了再出发！',
  '大冒险也要平平安安哦！',
  '愿你今天也是元气满满的一天！',
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

  const isLuffy = roleId === 'luffy'

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
          companionReaction: isLuffy
            ? `哇啊啊啊！是大肉！太棒啦——！你怎么知道我正好肚子饿了！我要开动啦——！嚼嚼嚼……超级好吃！你果然是最好的同伴！嘻嘻嘻！`
            : `收到你送的《${selectedGift.name}》啦！真的太贴心了，心里暖洋洋的。谢谢你！`,
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
    setResult(null)
    setUserNote('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(3px)' }}
      data-testid="gift-giving-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border shadow-2xl"
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
            <Gift size={18} style={{ color: 'var(--companion-accent-warm, #f59e0b)' }} />
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {result ? '送礼心意回响' : '赠送礼物 · 共筑羁绊'}
            </h3>
          </div>
          <button
            onClick={handleReset}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto p-5">
          {result ? (
            /* 赠送成功与回响卡片 */
            <div className="flex flex-col items-center text-center" data-testid="gift-result-card">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-inner"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 18%, transparent)',
                  color: 'var(--companion-accent-warm, #f59e0b)',
                }}
              >
                <Sparkles size={28} />
              </div>

              <h4 className="mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {isLuffy ? '路飞收下了你的心意！' : '角色收到了你的礼物！'}
              </h4>

              <div className="mt-1.5">
                <Badge tone="accent">
                  <CheckCircle2 size={11} className="mr-1 inline" />
                  已赠送：{result.giftName}
                </Badge>
              </div>

              {result.vitalsBuff && (
                <div className="mt-2.5 flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>体征恢复：</span>
                  {result.vitalsBuff.satiety && <span>饱腹度 +{result.vitalsBuff.satiety}</span>}
                  {result.vitalsBuff.mood && <span>心情 +{result.vitalsBuff.mood}</span>}
                  {result.vitalsBuff.energy && <span>体力 +{result.vitalsBuff.energy}</span>}
                </div>
              )}

              {/* 角色第一人称回响气泡 */}
              <div
                className="mt-4 w-full rounded-xl border p-4 text-left shadow-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 35%, var(--border-subtle))',
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--companion-accent-warm, #f59e0b)' }}>
                    {isLuffy ? '路飞的即时回响：' : '伙伴回响：'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>已存入主会话</span>
                </div>
                <p className="text-[13px] leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>
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
                        text: `看到你这么开心，我心里也暖暖的！`,
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
                挑选一件心意礼物送给伙伴；真诚的陪伴会让TA感到由衷的喜悦，并提升生命体征与彼此羁绊。
              </p>

              {/* 礼物网格 */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {gifts.map((item) => {
                  const isSelected = item.key === selectedKey
                  const isFavorite = item.roleAffinity?.[roleId] === 'favorite'

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedKey(item.key)}
                      className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
                        isSelected ? 'ring-2' : 'hover:border-amber-400/50'
                      }`}
                      style={{
                        backgroundColor: isSelected
                          ? 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 12%, var(--bg-secondary))'
                          : 'var(--bg-secondary)',
                        borderColor: isSelected
                          ? 'var(--companion-accent-warm, #f59e0b)'
                          : 'var(--border-subtle)',
                      }}
                      data-testid={`gift-item-${item.key}`}
                    >
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg shadow-sm"
                        style={{
                          backgroundColor: 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 18%, transparent)',
                          color: 'var(--companion-accent-warm, #f59e0b)',
                        }}
                      >
                        {renderGiftIcon(item.iconName)}
                      </div>

                      <span className="mt-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>

                      {isFavorite && (
                        <span
                          className="mt-1 rounded-full px-1.5 py-0.2 text-[9px] font-medium"
                          style={{
                            backgroundColor: 'color-mix(in srgb, #ef4444 15%, transparent)',
                            color: '#ef4444',
                          }}
                        >
                          最爱
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 选中礼物详情 */}
              {selectedGift && (
                <div
                  className="rounded-xl border p-3.5"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selectedGift.name}
                    </h5>
                    {selectedGift.vitalsBuff && (
                      <span className="text-[10px]" style={{ color: 'var(--companion-accent-warm, #f59e0b)' }}>
                        {selectedGift.vitalsBuff.satiety ? `饱腹+${selectedGift.vitalsBuff.satiety} ` : ''}
                        {selectedGift.vitalsBuff.mood ? `心情+${selectedGift.vitalsBuff.mood} ` : ''}
                        {selectedGift.vitalsBuff.energy ? `体力+${selectedGift.vitalsBuff.energy}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {selectedGift.description}
                  </p>
                </div>
              )}

              {/* 附带寄语输入 */}
              <div>
                <label className="block text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  赠礼留言 / 寄语（可选）
                </label>

                {/* 快捷寄语 */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRESET_QUICK_NOTES.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setUserNote(preset)}
                      className="rounded-full border px-2.5 py-1 text-[11px] transition hover:border-amber-400"
                      style={{
                        backgroundColor: userNote === preset ? 'color-mix(in srgb, var(--companion-accent-warm, #f59e0b) 12%, transparent)' : 'var(--bg-secondary)',
                        borderColor: userNote === preset ? 'var(--companion-accent-warm, #f59e0b)' : 'var(--border-subtle)',
                        color: userNote === preset ? 'var(--companion-accent-warm, #f59e0b)' : 'var(--text-secondary)',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="写下你想对TA说的心里话（如：特地为你挑选的，冒险路上要平平安安哦！）..."
                  maxLength={120}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border p-2.5 text-xs outline-none transition focus:ring-1"
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
                <ActionButton size="sm" variant="plain" tone="neutral" onClick={onClose} disabled={submitting}>
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
                  {submitting ? '正在赠送...' : '送出心意'}
                </ActionButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
