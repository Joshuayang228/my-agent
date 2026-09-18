import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react'
import type { ModelRouteProfile, ModelRoutePurpose } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { SelectField } from '../foundation/SelectField'
import { ScopeBadge, SettingCard } from './SettingsFields'

type ModelOption = { value: string; label: string }
type RoutePurpose = { id: ModelRoutePurpose; label: string; description: string }

/**
 * 背景：正式用途安排与候选重复维护布局，已确认的密度和操作语义未可靠回流。
 * 意图：共享纯展示组合，沿用 Foundation 控件；持久化或内存实验由调用方负责。
 * 约束：不读取 IPC，不猜用途能力；所有操作槽固定尺寸，保存失败由调用方保留原列表。
 */
export function ModelUsageArrangements({ purposes, routes, options, routeLabel, onAdd, onToggle, onMove, onRemove, testIdPrefix = 'settings', disabled = false }: {
  purposes: readonly RoutePurpose[]
  routes: readonly ModelRouteProfile[]
  options: readonly ModelOption[]
  routeLabel: (route: ModelRouteProfile) => string
  onAdd: (purpose: ModelRoutePurpose, value: string) => void
  onToggle: (route: ModelRouteProfile) => void
  onMove: (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => void
  onRemove: (route: ModelRouteProfile) => void
  testIdPrefix?: string
  disabled?: boolean
}) {
  return <SettingCard testId={`${testIdPrefix}-model-current`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>模型使用安排</h3>
        <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>从已添加的连接模型中选择；顺序就是优先级，第一项失败时按顺序尝试下一项。</p>
      </div>
      <ScopeBadge label="影响后续任务" />
    </div>
    <div className="mt-4 space-y-4">{purposes.map(purpose => {
      const items = routes.filter(route => route.purpose === purpose.id)
      return <section key={purpose.id} className="border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`${testIdPrefix}-route-${purpose.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{purpose.label}</div>
            <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{purpose.description}</div>
          </div>
          <SelectField aria-label={`添加${purpose.label}模型`} value="" disabled={disabled} onChange={event => onAdd(purpose.id, event.target.value)} className="max-w-[13rem]">
            <option value="">添加模型</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
        </div>
        {items.length === 0
          ? <div className="mt-3 rounded-[var(--radius-md)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>还没有安排模型；请从已添加的模型中选择。</div>
          : <div className="mt-3 space-y-2">{items.map((route, index) => {
            const label = routeLabel(route)
            return <div key={JSON.stringify([route.connectionId, route.model])} data-model-route-row className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border px-2.5 py-2" style={{ borderColor: route.enabled ? 'var(--border-subtle)' : 'var(--border-color)', opacity: route.enabled ? 1 : 0.58 }}>
              <span className="w-5 shrink-0 text-center text-[11px] font-semibold" style={{ color: 'var(--accent-fg)' }}>{index + 1}</span>
              <GripVertical size={13} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[11px]" title={label} style={{ color: 'var(--text-primary)' }}>{label}</span>
              <ActionButton size="sm" role="switch" aria-checked={route.enabled} aria-label={`${label}${route.enabled ? '已启用' : '已停用'}`} disabled={disabled} onClick={() => onToggle(route)} className="h-7 min-h-0 w-12 shrink-0 border-0 px-0" style={{ color: route.enabled ? 'var(--accent-fg)' : 'var(--text-muted)', background: route.enabled ? 'var(--accent-subtle)' : 'transparent' }}>{route.enabled ? '启用' : '停用'}</ActionButton>
              <IconButton label={`上移 ${label}`} disabled={disabled || index === 0} onClick={() => onMove(purpose.id, index, -1)} className="disabled:opacity-30"><ArrowUp size={13} style={{ color: 'var(--text-muted)' }} /></IconButton>
              <IconButton label={`下移 ${label}`} disabled={disabled || index === items.length - 1} onClick={() => onMove(purpose.id, index, 1)} className="disabled:opacity-30"><ArrowDown size={13} style={{ color: 'var(--text-muted)' }} /></IconButton>
              <IconButton label={`移除 ${label}`} disabled={disabled} onClick={() => onRemove(route)}><X size={13} style={{ color: 'var(--danger)' }} /></IconButton>
            </div>
          })}</div>}
      </section>
    })}</div>
  </SettingCard>
}
