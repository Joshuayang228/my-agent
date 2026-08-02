/**
 * 名册 / 召唤（W5 Surfaces）
 * 展示活跃主角相关卡司；可看摘要或开召唤子会话（装载对方 Pack，不启生活世界）。
 */

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, RefreshCw, Users, X } from 'lucide-react'
import { useToast } from './Toast'

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

interface CastPanelProps {
  onClose: () => void
  /** 召唤开聊成功后切到该会话 */
  onOpenSession?: (sessionId: string) => void
}

export function CastPanel({ onClose, onOpenSession }: CastPanelProps) {
  const { toast } = useToast()
  const [roleId, setRoleId] = useState('')
  const [lines, setLines] = useState<RosterLine[]>([])
  const [cast, setCast] = useState<CastBrief[]>([])
  const [selected, setSelected] = useState<CastBrief | null>(null)
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!window.electronAPI?.companion.getRoster) return
    setLoading(true)
    try {
      const data = await window.electronAPI.companion.getRoster()
      setRoleId(data.roleId)
      setLines(data.lines)
      setCast(data.cast)
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!window.electronAPI?.companion.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      void load()
    })
  }, [load])

  const summon = async (id: string) => {
    if (!window.electronAPI?.companion.summonBrief) return
    const r = await window.electronAPI.companion.summonBrief(id)
    if (r.ok) setSelected(r.brief)
  }

  const startChat = async (id: string, name: string, force = false) => {
    if (!window.electronAPI?.companion.startSummon) return
    setStarting(id)
    try {
      const r = await window.electronAPI.companion.startSummon(id, force)
      if (!r.ok) {
        if (r.error === 'BUSY' && !force) {
          const tip = [r.reason, r.alternative].filter(Boolean).join(' · ')
          toast(tip || `${name}现在不太方便`, 'warning')
          setStarting(null)
          // 忙时仍可强开（对照 Alice：可用性是体验层，不是硬墙）
          const okForce = window.confirm(
            `${tip || `${name}现在不太方便`}\n\n仍要强行开聊吗？`,
          )
          if (okForce) await startChat(id, name, true)
          return
        }
        toast(r.error === 'UNKNOWN_ROLE' ? '未知角色，无法召唤' : '召唤失败', 'error')
        return
      }
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
      setStarting(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <Users size={16} style={{ color: 'var(--accent-fg)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              名册
            </div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              以 {roleId || '活跃主角'} 为视角
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => load()}
            className="rounded p-1.5 transition"
            style={{ color: 'var(--text-muted)' }}
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 transition"
            style={{ color: 'var(--text-muted)' }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        <p className="mb-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          名册短句会注入主对话 Prompt。「开聊」创建召唤子会话并装载对方完整人设；不会切换活跃主角，也不会推进对方生活世界。
        </p>

        {lines.length === 0 && !loading ? (
          <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
            暂无关系边。
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => {
              const brief = cast.find((c) => c.id === line.otherId)
              return (
                <li
                  key={`${line.otherId}-${line.relationType}`}
                  className="rounded-md border px-3 py-2.5"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}
                >
                  <div className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                    {line.text}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void summon(line.otherId)}
                      className="rounded px-2 py-0.5 text-[11px] transition"
                      style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
                    >
                      查看摘要
                    </button>
                    <button
                      type="button"
                      disabled={starting === line.otherId}
                      onClick={() => void startChat(line.otherId, line.otherName)}
                      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition"
                      style={{ color: 'var(--text-primary)', background: 'var(--hover-overlay)' }}
                    >
                      <MessageCircle size={11} />
                      {starting === line.otherId ? '开启中…' : '开聊'}
                    </button>
                    {brief?.canBeProtagonist ? (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        可切换主角
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {selected ? (
          <div
            className="mt-4 rounded-md border px-3 py-3"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {selected.name}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {selected.summonHint || selected.summary || selected.description}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                disabled={starting === selected.id}
                onClick={() => void startChat(selected.id, selected.name)}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] transition"
                style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}
              >
                <MessageCircle size={11} />
                {starting === selected.id ? '开启中…' : '开聊'}
              </button>
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
