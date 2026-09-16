/**
 * 名册 / 召唤（生活面关系卡）
 * 展示活跃主角相关卡司；可看摘要或开召唤子会话（装载对方 Pack，不启生活世界）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, MessageCircle, RefreshCw, TriangleAlert, Users, X } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { ConfirmPanel } from './foundation/ConfirmPanel'
import { IconButton } from './foundation/IconButton'
import { useToast } from './Toast'
import {
  describeCastAvailabilityWhileLoading,
  isCastAvailabilitySnapshot,
  type CastAvailabilitySnapshot,
} from '../shared/cast-availability-view'

interface RosterLine {
  otherId: string
  otherName: string
  relationType: string
  text: string
}

interface CastBrief {
  id: string
  name: string
  description: string
  summary: string
  canBeProtagonist: boolean
  summonHint: string
}

export interface CastRecentInteraction {
  sessionId: string
  title: string
  updatedAt: number
}

interface CastPanelProps {
  onClose: () => void
  /** 召唤开聊成功后切到该会话 */
  onOpenSession?: (sessionId: string) => void
  /** 打开角色架（可切换主角的卡司） */
  onOpenShelf?: () => void
  /** 按 roleId 的最近召唤会话（由 App 从 sessions 派生） */
  recentByRole?: Record<string, CastRecentInteraction>
}

function formatRelative(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function relationLabel(type: string): string {
  const t = type.trim()
  if (!t) return '相识'
  const map: Record<string, string> = {
    friend: '朋友',
    colleague: '同事',
    family: '家人',
    mentor: '前辈',
    crush: '暧昧',
    rival: '对手',
    acquaintance: '熟人',
  }
  return map[t.toLowerCase()] || t
}

function initialOf(name: string): string {
  const s = name.trim()
  return s ? s.slice(0, 1) : '?'
}

function availabilityToneColor(tone: 'available' | 'busy' | 'unknown'): string {
  if (tone === 'available') return 'var(--success)'
  if (tone === 'busy') return 'var(--warning)'
  return 'var(--text-muted)'
}

export function CastPanel({
  onClose,
  onOpenSession,
  onOpenShelf,
  recentByRole = {},
}: CastPanelProps) {
  const { toast } = useToast()
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState('')
  const [lines, setLines] = useState<RosterLine[]>([])
  const [cast, setCast] = useState<CastBrief[]>([])
  const [availabilityById, setAvailabilityById] = useState<Record<string, CastAvailabilitySnapshot | null>>({})
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')
  const [selected, setSelected] = useState<CastBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const [pendingForce, setPendingForce] = useState<{ id: string; name: string; description: string } | null>(null)
  const startingRef = useRef(false)
  const loadGeneration = useRef(0)

  const loadAvailability = useCallback(async (ids: string[], generation: number) => {
    if (!window.electronAPI?.companion.checkCastAvailability || ids.length === 0) {
      if (loadGeneration.current === generation) {
        setAvailabilityById({})
        setAvailabilityLoading(false)
        setAvailabilityError(ids.length ? '当前环境还不能读取忙闲。' : '')
      }
      return
    }
    setAvailabilityLoading(true)
    setAvailabilityError('')
    const next: Record<string, CastAvailabilitySnapshot | null> = {}
    const failed: string[] = []
    await Promise.all(ids.map(async (id) => {
      try {
        const result = await window.electronAPI!.companion.checkCastAvailability(id)
        next[id] = isCastAvailabilitySnapshot(result) ? result : null
        if (!next[id]) failed.push(id)
      } catch {
        next[id] = null
        failed.push(id)
      }
    }))
    if (loadGeneration.current !== generation) return
    setAvailabilityById(next)
    setAvailabilityLoading(false)
    setAvailabilityError(failed.length ? '部分联系人的忙闲还没读到，开聊时会再确认。' : '')
  }, [])

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion.getRoster) return
    const generation = ++loadGeneration.current
    setLoading(true)
    setAvailabilityLoading(true)
    try {
      const [data, active] = await Promise.all([
        window.electronAPI.companion.getRoster(),
        window.electronAPI.companion.getActive(),
      ])
      if (loadGeneration.current !== generation) return
      setRoleId(data.roleId)
      setRoleName(active.name)
      setLines(data.lines)
      setCast(data.cast)
      setSelected(null)
      setAvailabilityById({})
      await loadAvailability([...new Set(data.lines.map((line) => line.otherId))], generation)
    } catch {
      if (loadGeneration.current === generation) {
        setAvailabilityLoading(false)
        setAvailabilityError("通讯录还没读到，请稍后重试。")
      }
    } finally {
      if (loadGeneration.current === generation) setLoading(false)
    }
  }, [loadAvailability])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!window.electronAPI?.companion.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load])

  const cards = useMemo(() => {
    return lines.map((line) => {
      const brief = cast.find((c) => c.id === line.otherId)
      const recent = recentByRole[line.otherId]
      const availability = describeCastAvailabilityWhileLoading(availabilityById[line.otherId], availabilityLoading)
      return { line, brief, recent, availability }
    })
  }, [lines, cast, recentByRole, availabilityById, availabilityLoading])

  const summon = async (id: string) => {
    if (!window.electronAPI?.companion.summonBrief) return
    const r = await window.electronAPI.companion.summonBrief(id)
    if (r.ok) setSelected(r.brief)
  }

  const startChat = async (id: string, name: string, force = false) => {
    if (!window.electronAPI?.companion.startSummon || startingRef.current) return
    startingRef.current = true
    setStarting(id)
    try {
      const r = await window.electronAPI.companion.startSummon(id, force)
      if (!r.ok) {
        if (r.error === 'BUSY' && !force) {
          const tip = [r.reason, r.alternative].filter(Boolean).join(' · ')
          toast(tip || `${name}现在不太方便`, 'warning')
          setPendingForce({ id, name, description: tip || `${name}现在不太方便` })
          return
        }
        toast(r.error === 'UNKNOWN_ROLE' ? '未知角色，无法召唤' : '召唤失败', 'error')
        return
      }
      setPendingForce(null)
      toast(
        r.sessionKind === 'summon'
          ? r.presence
            ? `已开启与${name}的召唤对话 · 此刻：${r.presence}`
            : `已开启与${name}的召唤对话（不推进其生活世界）`
          : `已开启与${name}的对话`,
        'success',
      )
      onOpenSession?.(r.sessionId)
      onClose()
    } finally {
      startingRef.current = false
      setStarting(null)
    }
  }

  return (
    <div className="flex h-full flex-col" data-testid="world-cast-panel">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              通讯录
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              以 {roleName || roleId || '活跃主角'} 为视角 · 召唤 ≠ 换主角
            </div>
          </div>
        </div>
        <div className="flex h-8 items-center gap-1">
          <IconButton size={32} label="刷新通讯录" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
          </IconButton>
          <IconButton size={32} label="关闭通讯录" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {pendingForce && <div className="mb-3"><ConfirmPanel icon={<TriangleAlert size={15} />} title={`仍要强行与${pendingForce.name}开聊吗？`} description={`${pendingForce.description}\n\n强行开聊会忽略对方当前的忙碌状态，但不会切换活跃主角。`} confirmLabel="强行开聊" busy={starting === pendingForce.id} onCancel={() => { if (!startingRef.current) setPendingForce(null) }} onConfirm={() => { const target = pendingForce; if (target) void startChat(target.id, target.name, true) }} /></div>}
        <p
          className="mb-4 rounded-lg border px-3 py-2 text-[11px] leading-relaxed"
          style={{
            borderColor: 'var(--companion-catchup-border)',
            background: 'var(--companion-catchup-bg)',
            color: 'var(--text-secondary)',
          }}
        >
          「开聊」创建召唤子会话并装载对方人设；不会切换活跃主角，也不会推进对方生活世界。
          要换活跃主角请用角色架。
        </p>
        {availabilityError ? (
          <p className="mb-3 text-[11px]" style={{ color: "var(--warning)" }} data-testid="world-cast-availability-error">
            {availabilityError}
          </p>
        ) : null}

        {cards.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            暂无关系边。
          </p>
        ) : (
          <ul className="space-y-3">
            {cards.map(({ line, brief, recent, availability }) => (
              <li
                key={`${line.otherId}-${line.relationType}`}
                className="companion-life-card rounded-xl border px-3.5 py-3"
                data-testid={`world-cast-card-${line.otherId}`}
                data-availability={availability.tone}
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--card-bg)',
                  boxShadow: 'var(--companion-shadow-card)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      background: 'var(--companion-catchup-bg)',
                      color: 'var(--companion-accent-warm)',
                    }}
                    aria-hidden
                  >
                    {initialOf(line.otherName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {line.otherName}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {relationLabel(line.relationType)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        data-testid={`world-cast-presence-${line.otherId}`}
                        style={{
                          background: "var(--bg-secondary)",
                          color: availabilityToneColor(availability.tone),
                        }}
                      >
                        {availability.label}
                      </span>
                      {brief?.canBeProtagonist ? (
                        <span className="text-[10px]" style={{ color: 'var(--companion-accent-warm)' }}>
                          可任主角
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {line.text}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {availability.detail}
                    </p>
                    {recent ? (
                      <button
                        type="button"
                        onClick={() => onOpenSession?.(recent.sessionId)}
                        className="mt-1.5 text-left text-[11px] transition"
                        style={{ color: 'var(--text-muted)' }}
                        title="打开最近召唤会话"
                      >
                        最近互动 · {formatRelative(recent.updatedAt)}
                        {recent.title ? ` · ${recent.title}` : ''}
                      </button>
                    ) : (
                      <div className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        尚未召唤开聊
                      </div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <ActionButton onClick={() => void summon(line.otherId)}>
                        查看摘要
                      </ActionButton>
                      <ActionButton
                        className="gap-1"
                        tone="accent"
                        disabled={starting === line.otherId}
                        onClick={() => void startChat(line.otherId, line.otherName)}
                      >
                        <MessageCircle size={11} />
                        {starting === line.otherId ? "开启中…" : "开聊"}
                      </ActionButton>
                      {brief?.canBeProtagonist && onOpenShelf ? (
                        <ActionButton className="gap-1" onClick={onOpenShelf} title="换活跃主角请走角色架，不是召唤">
                          <LayoutGrid size={11} />
                          去角色架
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div
            className="mt-4 rounded-xl border px-3 py-3"
            style={{
              borderColor: 'var(--companion-catchup-border)',
              background: 'var(--companion-catchup-bg)',
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {selected.summonHint || selected.summary || selected.description}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ActionButton
                className="gap-1"
                tone="accent"
                disabled={starting === selected.id}
                onClick={() => void startChat(selected.id, selected.name)}
              >
                <MessageCircle size={11} />
                {starting === selected.id ? "开启中…" : "开聊"}
              </ActionButton>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                摘要无 protected；开聊后装载完整人设
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
