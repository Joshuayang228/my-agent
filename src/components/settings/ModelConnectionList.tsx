import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard } from './SettingsFields'

export function ModelConnectionList({ count, onAdd, disabled = false, children, testIdPrefix = 'settings' }: {
  count: number
  onAdd: () => void
  disabled?: boolean
  children: ReactNode
  testIdPrefix?: string
}) {
  return <SettingCard testId={`${testIdPrefix}-model-connections`}>
    <div className="flex items-start justify-between gap-3" data-testid={`${testIdPrefix}-model-connections-heading`}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>连接与模型清单</h3>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{count ? `${count} 个连接入口；模型用途在上方单独安排。` : '还没有连接，添加后再维护模型清单。'}</p>
      </div>
      <ActionButton onClick={onAdd} disabled={disabled} className="h-8 gap-1 rounded-[var(--radius-md)] px-3 font-medium" style={{ borderColor: 'var(--accent)', color: 'var(--accent-fg)' }} data-testid={`${testIdPrefix}-model-add`}><Plus size={13} aria-hidden="true" />添加连接</ActionButton>
    </div>
    {count === 0 && <div data-testid={`${testIdPrefix}-model-empty`} className="mt-5 border-t pt-5 text-center" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>还没有连接入口</div>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>添加连接后，在连接下维护多个模型，再到上方安排用途。</p>
    </div>}
    <div className="mt-4 space-y-2">{children}</div>
  </SettingCard>
}
