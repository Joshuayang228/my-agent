import { useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { PermissionRulesEditor } from '../PermissionRulesEditor'
import { ScopeBadge, SettingCard } from './SettingsFields'

const MODES = [
  ['auto', '自动', '只在需要时确认'],
  ['confirm-all', '全部确认', '每次工具调用都先问'],
  ['plan-first', '先计划', '先看计划再执行'],
] as const

export function PermissionSettingsContent({ mode, onModeChange, rules, onRulesChange, prefix = 'settings' }: {
  mode: string
  onModeChange: (value: string) => Promise<void> | void
  rules: string
  onRulesChange: (value: string) => Promise<void> | void
  prefix?: string
}) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const changeMode = async (value: string) => {
    if (pending.current || value === mode) return
    pending.current = true
    setBusy(true)
    setError('')
    try { await onModeChange(value) }
    catch { setError('默认审批方式未更改，请重试。') }
    finally { pending.current = false; setBusy(false) }
  }
  return <>
    <SettingCard>
      <div className="mb-3">
        <h3 className="flex items-center gap-2 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>默认审批方式<ScopeBadge label="全局" /></h3>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>未命中下面的自定义规则时，使用这里的默认方式；遇到具体操作时，你仍然可以临时调整。</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="默认审批方式">{MODES.map(([value, label, description]) => <ActionButton key={value}
        aria-pressed={mode === value} disabled={busy} onClick={() => { void changeMode(value) }}
        className="flex-col items-stretch p-3 text-left" style={{ borderColor: mode === value ? 'var(--accent)' : 'var(--border-subtle)', background: mode === value ? 'var(--accent-subtle)' : 'transparent' }}>
        <span className="flex items-center justify-between gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}<Check size={13} style={{ opacity: mode === value ? 1 : 0, color: 'var(--accent-fg)' }} /></span>
        <span className="mt-1 text-[10px] leading-4" style={{ color: 'var(--text-muted)' }}>{description}</span>
      </ActionButton>)}</div>
      {mode === 'full-access' && <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>当前为完全访问。选择上面的方式可恢复工作区边界。</p>}
      {error && <p role="alert" className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
    </SettingCard>
    <PermissionRulesEditor value={rules} onChange={onRulesChange} prefix={prefix} />
  </>
}
