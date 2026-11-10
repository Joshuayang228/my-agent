import { useCallback, useEffect, useState } from 'react'
import { Compass, CheckCircle2, Sparkles, MessageSquareShare, History } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import { ErrorState } from '../foundation/ErrorState'
import { contentGutterStyle } from '../../shared/content-layout'
import { CoDecisionCard } from './CoDecisionCard'
import type { CompanionCoDecisionRecord } from '../../shared/types'

export interface WorldDecisionsPanelProps {
  roleId?: string
  onTakeToChat?: (opts: { text: string }) => void
  refreshToken?: number
  onLoadingChange?: (loading: boolean) => void
  /**
   * Playground 离线样张注入数据：提供时完全跳过主进程 IPC 查询与广播订阅，
   * 并在内存中响应增改删与选择，用于无真实后端的纯前端设计审查。
   */
  previewDecisions?: CompanionCoDecisionRecord[]
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

export function WorldDecisionsPanel({
  roleId = 'luffy',
  onTakeToChat,
  refreshToken = 0,
  onLoadingChange,
  previewDecisions,
  previewReadError,
  onPreviewRetry,
}: WorldDecisionsPanelProps) {
  const [decisions, setDecisions] = useState<CompanionCoDecisionRecord[]>(previewDecisions ?? [])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loadError, setLoadError] = useState('')

  const title = '共同决策'
  const description = '角色在生活面临分歧时向你发起的求助，你的选择会影响后续的日程与动态。'

  // 同步 Playground 样张输入
  useEffect(() => {
    if (previewDecisions !== undefined) {
      setDecisions(previewDecisions)
    }
  }, [previewDecisions])

  const loadDecisions = useCallback(async () => {
    if (previewDecisions !== undefined) return
    if (!window.electronAPI?.companion?.listCoDecisions) return
    setLoading(true)
    setLoadError('')
    onLoadingChange?.(true)
    try {
      const records = await window.electronAPI.companion.listCoDecisions(roleId)
      setDecisions(records)
    } catch (err) {
      setLoadError('共同决策读取失败，请重试。')
      console.warn('Failed to load co-decisions:', err)
    } finally {
      setLoading(false)
      onLoadingChange?.(false)
    }
  }, [roleId, previewDecisions, onLoadingChange])

  useEffect(() => {
    void loadDecisions()
  }, [loadDecisions, refreshToken])

  // 监听广播（仅真实 Electron 环境激活）
  useEffect(() => {
    if (previewDecisions !== undefined) return
    if (!window.electronAPI?.companion?.onCoDecisionCreated) return
    const unsubCreated = window.electronAPI.companion.onCoDecisionCreated((event) => {
      if (event.roleId === roleId) {
        setDecisions((prev) => [event.decision, ...prev.filter((d) => d.id !== event.decision.id)])
      }
    })
    const unsubResolved = window.electronAPI.companion.onCoDecisionResolved?.((event) => {
      if (event.roleId === roleId) {
        setDecisions((prev) => [event.decision, ...prev.filter((d) => d.id !== event.decision.id)])
      }
    })
    return () => {
      unsubCreated()
      unsubResolved?.()
    }
  }, [roleId, previewDecisions])

  const handleCreateDecision = async () => {
    if (creating) return
    if (previewDecisions !== undefined) return
    if (!window.electronAPI?.companion?.createCoDecision) return
    setCreating(true)
    try {
      const created = await window.electronAPI.companion.createCoDecision(roleId)
      if (created) {
        setDecisions((prev) => [created, ...prev.filter((d) => d.id !== created.id)])
      }
    } catch (err) {
      console.warn('Failed to create co-decision:', err)
    } finally {
      setCreating(false)
    }
  }

  const activeDecision = decisions.find((d) => d.status === 'pending') || decisions[0] || null
  const pastDecisions = decisions.filter((d) => d.id !== activeDecision?.id && d.status === 'resolved')

  return (
    <div
      className="flex min-h-0 flex-1 flex-col py-3"
      style={contentGutterStyle()}
      data-testid="world-decisions-panel"
      data-world-content="decisions"
    >
      {/* 顶部标题区 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <Compass size={16} style={{ color: 'var(--companion-accent-warm)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            <Badge tone="accent">{decisions.length} 项决断记录</Badge>
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>

        <ActionButton
          size="sm"
          tone="accent"
          disabled={creating || (activeDecision?.status === 'pending')}
          onClick={handleCreateDecision}
        >
          <Sparkles size={12} className={`mr-1 ${creating ? 'animate-spin' : ''}`} />
          {creating ? '正在准备新决策...' : '发起新决策'}
        </ActionButton>
      </div>

      {/* 错误提示态 */}
      {previewReadError || loadError ? (
        <ErrorState
          title="共同决策暂时无法读取"
          description={previewReadError ?? loadError}
          action={<ActionButton size="sm" variant="plain" tone="accent" onClick={previewReadError ? onPreviewRetry : () => { void loadDecisions() }}>重新加载</ActionButton>}
          className="flex-1"
        />
      ) : decisions.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            title="当前暂无需要共同决定的事项"
            description="当角色在日常生活中面临分歧抉择时，会主动向你发起求助。"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 当前主要/待决事项卡片 */}
          {activeDecision && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {activeDecision.status === 'pending' ? '当前正等待你的决定：' : '最近完成的决定：'}
                </span>
              </div>
              <CoDecisionCard
                roleId={roleId}
                previewDecision={activeDecision}
                onDecisionResolved={(resolved) => {
                  setDecisions((prev) => [resolved, ...prev.filter((d) => d.id !== resolved.id)])
                }}
                onTakeToChat={onTakeToChat}
              />
            </div>
          )}

          {/* 历史抉择时间轴 */}
          {pastDecisions.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                <History size={13} style={{ color: 'var(--text-muted)' }} />
                <span>共同走过的抉择足迹 ({pastDecisions.length})</span>
              </div>

              <div className="flex flex-col gap-3">
                {pastDecisions.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-[var(--radius-xl)] border p-3.5"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-subtle)',
                    }}
                    data-testid={`past-decision-${item.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />
                        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {item.title}
                        </h4>
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        决断于 {item.resolvedAt ? formatDate(item.resolvedAt) : formatDate(item.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[12px]">
                      <Badge tone="accent">
                        你的选择：{item.selectedOptionLabel}
                      </Badge>
                    </div>

                    {item.companionReaction && (
                      <p className="rounded-[var(--radius-lg)] p-2.5 text-[11px] leading-relaxed italic" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        “{item.companionReaction}”
                      </p>
                    )}

                    {onTakeToChat && (
                      <div className="flex justify-end pt-1">
                        <ActionButton
                          size="sm"
                          variant="plain"
                          tone="neutral"
                          onClick={() => {
                            onTakeToChat({
                              text: `回想起我们之前一起决定的「${item.title}」，当时选择了「${item.selectedOptionLabel}」，现在感觉真是个正确的决定！`,
                            })
                          }}
                        >
                          <MessageSquareShare size={11} className="mr-1" />
                          回顾这次决定
                        </ActionButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
