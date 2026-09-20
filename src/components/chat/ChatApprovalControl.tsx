import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, RefreshCw, Shield, Zap } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'

export type ChatApprovalMode = 'confirm-all' | 'auto' | 'full-access'
const options = [
  { mode: 'confirm-all', Icon: Shield, shortLabel: '确认模式', label: '请求批准', description: '破坏性操作始终询问；仅允许工作区内写入' },
  { mode: 'auto', Icon: RefreshCw, shortLabel: '自动审批', label: '替我审批', description: '仅对风险操作请求批准；仅允许工作区内写入' },
  { mode: 'full-access', Icon: Zap, shortLabel: '完全访问', label: '完全访问权限', description: '跳过确认，并放开文件路径沙箱' },
] as const

/**
 * 背景：正式审批入口独立手写，且保存失败时仍显示新模式；候选只有静态按钮，呈现会漂移。
 * 设计意图：共享基础按钮和菜单反馈，模式只由调用方成功写入后回传，不在呈现层乐观修改权限。
 * 关键约束：主进程确认不得绕过；在途单次写入，候选禁用，关闭 / 卸载后不得抢焦点，hover 不改变入口尺寸。
 */
export function ChatApprovalControl({ value, onChange, disabled = false }: {
  value: ChatApprovalMode
  onChange?: (mode: ChatApprovalMode) => Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const busy = useRef(false)
  const live = useRef(true)
  const visible = useRef(false)
  const unavailable = disabled || !onChange
  const current = options.find(option => option.mode === value) ?? options[0]
  const close = (restoreFocus = false) => {
    visible.current = false
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])
  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close() }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  const choose = async (mode: ChatApprovalMode) => {
    if (unavailable || busy.current) return
    if (mode === value) { close(true); return }
    busy.current = true
    setPending(true)
    setError(false)
    try {
      await onChange!(mode)
      if (live.current && visible.current) close(true)
    } catch {
      if (live.current) setError(true)
    } finally {
      busy.current = false
      if (live.current) setPending(false)
    }
  }
  return <div ref={root} className="relative shrink-0" data-testid="chat-approval-control"
    onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close() }}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(true) } }}>
    <ActionButton ref={trigger} disabled={unavailable} aria-label={current.shortLabel} aria-haspopup="menu" aria-expanded={open}
      title={unavailable ? '审批设置在此样张中不可修改' : current.shortLabel}
      className="h-7 w-28 gap-1 !border-0 !px-2 !text-[10.5px] hover:bg-[var(--hover-overlay)]"
      onClick={() => { visible.current = !open; setOpen(!open) }}>
      <current.Icon size={12} aria-hidden="true" /><span>{current.shortLabel}</span><ChevronDown size={9} aria-hidden="true" />
    </ActionButton>
    {open && <div role="menu" aria-label="审批方式" aria-busy={pending}
      className="absolute bottom-full left-0 z-50 mb-1 w-56 max-w-[calc(100vw-3rem)] rounded-lg border p-1.5 shadow-lg"
      style={{ borderColor: 'var(--border-color)', background: 'var(--dropdown-bg)' }}
      onKeyDown={event => {
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]'))
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const key = event.key
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return
        event.preventDefault()
        const next = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : (index + (key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
        items[next]?.focus()
      }}>
      <div className="px-2 pb-1.5 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>应如何批准操作？</div>
      {options.map(option => <ActionButton key={option.mode} role="menuitemradio" aria-checked={value === option.mode}
        aria-disabled={pending} onClick={() => void choose(option.mode)}
        className="w-full !items-start !justify-start gap-2 !border-0 !px-2 py-2 text-left hover:bg-[var(--hover-overlay)] focus-visible:bg-[var(--hover-overlay)]"
        style={{ background: value === option.mode ? 'var(--accent-subtle)' : undefined }}>
        <option.Icon size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
          {option.label}<Check size={12} className={value === option.mode ? 'shrink-0' : 'invisible shrink-0'} aria-hidden="true" />
        </span><span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-muted)' }}>{option.description}</span></span>
      </ActionButton>)}
      {pending && <p role="status" className="px-2 py-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>正在保存…</p>}
      {error && <p role="alert" className="px-2 py-1 text-[11px]" style={{ color: 'var(--danger)' }}>未能更改审批方式，当前模式未变。请重试。</p>}
    </div>}
  </div>
}
