import { useCallback, useEffect, useState } from 'react'
import { Compass, CheckCircle2, MessageSquareShare, Sparkles, HelpCircle, ArrowRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'
import { EmptyState } from '../foundation/EmptyState'
import type { CompanionCoDecisionRecord } from '../../shared/types'

export interface CoDecisionCardProps {
  roleId?: string
  /**
   * Playground 离线样张注入数据：提供时完全跳过主进程 IPC 查询与广播订阅，
   * 并在内存中响应用户点击与决策选择，用于无真实后端的纯前端设计审查。
   */
  previewDecision?: CompanionCoDecisionRecord | null
  onDecisionResolved?: (decision: CompanionCoDecisionRecord) => void
  onTakeToChat?: (opts: { text: string }) => void
  allowManualTrigger?: boolean
}

export function CoDecisionCard({
  roleId = 'luffy',
  previewDecision,
  onDecisionResolved,
  onTakeToChat,
  allowManualTrigger = false,
}: CoDecisionCardProps) {
  const [decision, setDecision] = useState<CompanionCoDecisionRecord | null>(previewDecision ?? null)
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // 同步 Playground 样张输入
  useEffect(() => {
    if (previewDecision !== undefined) {
      setDecision(previewDecision)
    }
  }, [previewDecision])

  const loadPendingDecision = useCallback(async () => {
    if (previewDecision !== undefined) return
    if (!window.electronAPI?.companion?.getPendingCoDecision) return
    setLoading(true)
    try {
      const record = await window.electronAPI.companion.getPendingCoDecision(roleId)
      setDecision(record)
    } catch (err) {
      console.warn('Failed to load pending co-decision:', err)
    } finally {
      setLoading(false)
    }
  }, [roleId, previewDecision])

  useEffect(() => {
    void loadPendingDecision()
  }, [loadPendingDecision])

  // 监听决策变更广播（仅真实 Electron 环境激活）
  useEffect(() => {
    if (previewDecision !== undefined) return
    if (!window.electronAPI?.companion?.onCoDecisionCreated) return
    const unsubCreated = window.electronAPI.companion.onCoDecisionCreated((event) => {
      if (event.roleId === roleId) {
        setDecision(event.decision)
      }
    })
    const unsubResolved = window.electronAPI.companion.onCoDecisionResolved?.((event) => {
      if (event.roleId === roleId) {
        setDecision(event.decision)
      }
    })
    return () => {
      unsubCreated()
      unsubResolved?.()
    }
  }, [roleId, previewDecision])

  const handleSelectOption = async (optionId: string) => {
    if (!decision || decision.status !== 'pending') return
    const selectedOption = decision.options.find((opt) => opt.id === optionId)
    if (!selectedOption) return

    if (previewDecision !== undefined) {
      // 离线模式直接更新内存 state
      const updated: CompanionCoDecisionRecord = {
        ...decision,
        status: 'resolved',
        selectedOptionId: optionId,
        selectedOptionLabel: selectedOption.label,
        companionReaction: `哇哈哈哈哈！听你的，就选「${selectedOption.label}」！我现在就去告诉大伙，明天全速前进！`,
        resolvedAt: Date.now(),
      }
      setDecision(updated)
      onDecisionResolved?.(updated)
      return
    }

    if (!window.electronAPI?.companion?.resolveCoDecision) return
    setResolvingId(optionId)
    try {
      const resolved = await window.electronAPI.companion.resolveCoDecision(decision.id, optionId)
      if (resolved) {
        setDecision(resolved)
        onDecisionResolved?.(resolved)
      }
    } catch (err) {
      console.warn('Failed to resolve co-decision:', err)
    } finally {
      setResolvingId(null)
    }
  }

  const handleCreateNewDecision = async () => {
    if (creating) return
    if (previewDecision !== undefined) return
    if (!window.electronAPI?.companion?.createCoDecision) return
    setCreating(true)
    try {
      const created = await window.electronAPI.companion.createCoDecision(roleId)
      if (created) {
        setDecision(created)
      }
    } catch (err) {
      console.warn('Failed to create new co-decision:', err)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-[var(--radius-card)] border p-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>正在同步伙伴的未决事项...</span>
      </div>
    )
  }

  if (!decision) {
    return (
      <div
        className="flex flex-col items-center justify-between rounded-[var(--radius-card)] border border-dashed p-6 text-center"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}
        data-testid="co-decision-empty"
      >
        <EmptyState
          title="当前暂无需要共同决定的事项"
        description="当角色在日常生活中面临分歧抉择时，会主动向你发起求助。"
        />
        {allowManualTrigger && (
          <ActionButton size="sm" tone="accent" className="mt-4" onClick={handleCreateNewDecision} disabled={creating}>
            <Sparkles size={12} className={`mr-1 ${creating ? 'animate-spin' : ''}`} />
            启发一个航行抉择
          </ActionButton>
        )}
      </div>
    )
  }

  const isResolved = decision.status === 'resolved'
  return (
    <div
      className="relative flex flex-col gap-3 rounded-[var(--radius-card)] border p-4 transition-all"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: isResolved
          ? 'color-mix(in srgb, var(--accent) 30%, var(--border-subtle))'
          : 'color-mix(in srgb, var(--companion-accent-warm) 45%, var(--border-subtle))',
      }}
      data-testid="co-decision-card"
      data-decision-status={decision.status}
    >
      {/* 头部：标题与状态标签 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)]"
            style={{
              background: isResolved
                ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                : 'color-mix(in srgb, var(--companion-accent-warm) 15%, transparent)',
              color: isResolved ? 'var(--accent)' : 'var(--companion-accent-warm)',
            }}
          >
            {isResolved ? <CheckCircle2 size={15} /> : <Compass size={15} className="animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {decision.title}
              </h3>
              <Badge tone={isResolved ? 'neutral' : 'accent'}>
                {isResolved ? '已完成' : '待你决定'}
              </Badge>
            </div>
          </div>
        </div>

        {onTakeToChat && (
          <ActionButton
            size="sm"
            variant="plain"
            tone="neutral"
            onClick={() => {
              onTakeToChat({
                text: `关于你刚才纠结的「${decision.title}」，我们来好好聊聊吧！`,
              })
            }}
          >
            <MessageSquareShare size={12} className="mr-1" />
            在聊天中探讨
          </ActionButton>
        )}
      </div>

      {/* 角色求助困境正文 */}
      <div
        className="rounded-[var(--radius-card)] p-3 text-[12px] leading-relaxed"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          color: 'var(--text-secondary)',
        }}
      >
        <div className="mb-1 flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
          <HelpCircle size={12} style={{ color: 'var(--companion-accent-warm)' }} />
          <span>伙伴的求助：</span>
        </div>
        <p className="whitespace-pre-wrap">{decision.dilemma}</p>
      </div>

      {/* 选项区域 */}
      {!isResolved ? (
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
            请为你身边的同伴选定接下来的前进方向：
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {decision.options.map((option) => {
              const isResolvingThis = resolvingId === option.id
              return (
                <div
                  key={option.id}
                  className="group relative flex flex-col justify-between rounded-[var(--radius-card)] border p-3 transition-all hover:border-[var(--accent)]"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-subtle)',
                  }}
                  data-testid={`co-decision-option-${option.id}`}
                >
                  <div>
                    <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {option.label}
                    </h4>
                    {option.desc && (
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {option.desc}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-1 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    {option.impactHint ? (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {option.impactHint}
                      </span>
                    ) : (
                      <span />
                    )}
                    <ActionButton
                      size="sm"
                      tone="accent"
                      disabled={resolvingId !== null}
                      onClick={() => handleSelectOption(option.id)}
                    >
                      {isResolvingThis ? '确认中...' : '选这个'}
                      <ArrowRight size={11} className="ml-0.5 inline" />
                    </ActionButton>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* 已决态展示：选中的方案与角色第一人称回响 */
        <div className="flex flex-col gap-2.5 pt-1">
          <div
            className="flex items-center justify-between rounded-[var(--radius-card)] border px-3 py-2 text-[12px]"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--accent) 8%, var(--bg-primary))',
              borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border-subtle))',
            }}
          >
            <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--accent)' }}>
              <CheckCircle2 size={14} />
              <span>你的抉择：{decision.selectedOptionLabel}</span>
            </div>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              已锁定为明日航程关键依据
            </span>
          </div>

          {decision.companionReaction && (
            <div
            className="rounded-[var(--radius-card)] border p-3 text-[12px] leading-relaxed italic"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border-subtle))',
                color: 'var(--text-primary)',
              }}
            >
              <div className="mb-0.5 text-[10px] font-medium not-italic" style={{ color: 'var(--text-muted)' }}>
                伙伴的即时回响：
              </div>
              <p>“{decision.companionReaction}”</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
