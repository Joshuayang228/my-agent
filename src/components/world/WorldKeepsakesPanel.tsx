import { useCallback, useEffect, useState } from 'react'
import { Gift, MessageSquareShare, Sparkles, HeartHandshake } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { contentGutterStyle } from '../../shared/content-layout'
import type { CompanionKeepsakeRecord } from '../../shared/types'

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

export function WorldKeepsakesPanel({
  roleId = 'luffy',
  onTakeToChat,
  refreshToken = 0,
  onLoadingChange,
  previewKeepsakes,
  previewReadError,
  onPreviewRetry,
}: WorldKeepsakesPanelProps) {
  const [keepsakes, setKeepsakes] = useState<CompanionKeepsakeRecord[]>(previewKeepsakes ?? [])
  const [loading, setLoading] = useState(false)
  const [gifting, setGifting] = useState(false)

  const isLuffy = roleId === 'luffy'
  const title = isLuffy ? '草帽一伙的专属信物' : '专属信物与同伴誓约'
  const description = isLuffy
    ? '路飞在关键羁绊时刻赠予你的珍贵信物，见证跨越千山万水的同伴情谊。'
    : '角色在相伴旅途中亲手赠予你的珍贵物件，是不可替代的羁绊见证。'

  // 同步 Playground 样张输入
  useEffect(() => {
    if (previewKeepsakes !== undefined) {
      setKeepsakes(previewKeepsakes)
    }
  }, [previewKeepsakes])

  const loadKeepsakes = useCallback(async () => {
    if (previewKeepsakes !== undefined) return
    if (!window.electronAPI?.companion?.listKeepsakes) return
    setLoading(true)
    onLoadingChange?.(true)
    try {
      const records = await window.electronAPI.companion.listKeepsakes(roleId)
      setKeepsakes(records)
    } catch (err) {
      console.warn('Failed to load keepsakes:', err)
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [previewKeepsakes, roleId, onLoadingChange])

  useEffect(() => {
    void loadKeepsakes()
  }, [loadKeepsakes, refreshToken])

  // 监听信物馈赠实时广播（仅在真实 Electron 环境下激活）
  useEffect(() => {
    if (previewKeepsakes !== undefined) return
    if (!window.electronAPI?.companion?.onKeepsakeGifted) return
    const unsubscribe = window.electronAPI.companion.onKeepsakeGifted((event) => {
      if (event.roleId === roleId) {
        setKeepsakes((prev) => [event.keepsake, ...prev.filter((k) => k.id !== event.keepsake.id)])
      }
    })
    return () => {
      unsubscribe()
    }
  }, [previewKeepsakes, roleId])

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

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-keepsakes-panel"
      data-world-content="keepsakes"
    >
      {/* 头部标题与操作 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Gift size={16} style={{ color: 'var(--companion-accent-warm, #f59e0b)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <Badge tone="accent">{keepsakes.length} 件信物</Badge>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>

        <ActionButton
          size="sm"
          tone="accent"
          disabled={gifting}
          onClick={handleTriggerGift}
        >
          <Sparkles size={12} className={`mr-1 ${gifting ? 'animate-spin' : ''}`} />
          {gifting ? '正在准备赠礼...' : '见证羁绊·索取信物'}
        </ActionButton>
      </div>

      {/* 错误提示态与信物卡片列表 */}
      {previewReadError ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="keepsakes-error-state">
          <p className="text-sm font-medium" style={{ color: 'var(--danger, #ef4444)' }}>
            {previewReadError}
          </p>
          {onPreviewRetry && (
            <ActionButton size="sm" variant="plain" tone="accent" className="mt-3" onClick={onPreviewRetry}>
              重新加载
            </ActionButton>
          )}
        </div>
      ) : keepsakes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            title="还没有获赠专属信物"
            description="与角色共同完成心愿、持续深入交谈或跨越相处里程碑时，角色会主动向你赠予专属信物。"
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
                {/* 顶部图标与分类标签 */}
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

                {/* 描述与背书设定 */}
                <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.description}
                </p>

                {/* 专属剧情台词 / 寄语 */}
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

              {/* 底部直达会话互动 */}
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
                    触摸信物·与TA聊聊
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
