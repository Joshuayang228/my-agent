import { X } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { SelectField } from '../foundation/SelectField'
import { CONNECTION_ADAPTERS, CONNECTION_PRESETS, CONNECTION_SOURCE_OPTIONS, connectionDraftForSource, providerSource, validConnectionDraft, type ModelConnectionDraft } from '../../shared/model-connection-form'

/**
 * 背景：候选与正式连接表单曾分别维护，已验收的分类和布局未进入产品。
 * 设计意图：共享纯受控业务表单，保存和测试由调用方负责，不复制一套候选皮肤。
 * 关键约束：不访问 IPC / 存储；切换来源、预设或协议清除临时 Key，忙碌状态下所有操作锁定。
 */
export function ModelConnectionForm({ value, onChange, onSave, onCancel, editing = false, busy = false, hasApiKey = false, preview = false }: {
  value: ModelConnectionDraft
  onChange: (next: ModelConnectionDraft) => void
  onSave: () => void
  onCancel: () => void
  editing?: boolean
  busy?: boolean
  hasApiKey?: boolean
  preview?: boolean
}) {
  const presetLabel = value.source === 'coding' ? '编程套餐' : value.source === 'relay' ? '聚合 / 中转服务' : value.source === 'local' ? '本地服务' : '官方服务商'
  const title = editing ? '编辑连接' : '添加连接'
  const fieldClass = 'theme-input mt-1 w-full min-w-0 rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px] outline-none'
  return <fieldset disabled={busy} aria-busy={busy} className="m-0 min-w-0 border-0 p-0" data-testid="model-connection-form">
    <div className="flex items-start justify-between gap-3">
      <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <ActionButton size="sm" className="h-7 w-7 p-0" aria-label={`关闭${title}`} title={`关闭${title}`} onClick={onCancel}><X size={14} /></ActionButton>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="连接入口类型">
      {CONNECTION_SOURCE_OPTIONS.map((item) => <ActionButton key={item.id} size="sm" role="radio" aria-checked={value.source === item.id}
        tone={value.source === item.id ? 'accent' : 'neutral'} onClick={() => onChange(connectionDraftForSource(item.id))}>{item.label}</ActionButton>)}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>连接名称
        <TextField aria-label="连接名称" placeholder="连接名称" value={value.name} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, name: event.target.value })} className={fieldClass} />
      </label>
      {value.source === 'custom' ? <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>适配器
        <SelectField aria-label="连接适配器" value={CONNECTION_ADAPTERS.find((item) => item.provider === value.provider)?.id ?? ''}
          onChange={(event) => { const adapter = CONNECTION_ADAPTERS.find((item) => item.id === event.target.value); if (adapter) onChange({ ...value, provider: adapter.provider, apiKey: '' }) }} className={fieldClass}>
          {value.provider === 'auto' && <option value="" disabled>请选择适配器</option>}
          {CONNECTION_ADAPTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </SelectField>
      </label> : <label className="min-w-0 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{presetLabel}
        <SelectField aria-label={presetLabel} value={value.presetId} onChange={(event) => onChange(connectionDraftForSource(value.source, event.target.value))} className={fieldClass}>
          {CONNECTION_PRESETS.filter((item) => providerSource(item) === value.source).map((item) => <option key={item.providerId} value={item.providerId}>{item.label}</option>)}
        </SelectField>
      </label>}
      <label className="min-w-0 text-[10px] sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>Base URL
        <TextField aria-label="Base URL" placeholder="Base URL" value={value.baseUrl} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, baseUrl: event.target.value, apiKey: '' })} className={fieldClass} />
      </label>
      <label className="min-w-0 text-[10px] sm:col-span-2" style={{ color: 'var(--text-secondary)' }}>{preview ? 'API Key（仅样张状态）' : 'API Key'}
        <TextField aria-label="API Key" type="password" autoComplete="off" placeholder={preview ? '不会写入真实设置' : hasApiKey ? 'API Key（留空则保留原密钥）' : 'API Key'}
          value={value.apiKey} onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, apiKey: event.target.value })} className={fieldClass} />
      </label>
    </div>
    <div className="mt-3 flex justify-end gap-2 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
      <ActionButton size="sm" onClick={onCancel}>取消</ActionButton>
      <ActionButton size="sm" tone="accent" onClick={onSave} disabled={!validConnectionDraft(value)}>保存连接</ActionButton>
    </div>
  </fieldset>
}
