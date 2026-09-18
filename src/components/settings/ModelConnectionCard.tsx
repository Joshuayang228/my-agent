import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import { Check, Circle, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { IconButton } from '../foundation/IconButton'
import { TextField } from '../foundation/TextField'

type RequestState = 'idle' | 'loading' | 'success' | 'error' | 'unsupported'
type Model = { id: string; enabled: boolean }

/**
 * 背景：候选和正式连接卡片各自实现，测试结果会改变正式操作槽宽度。
 * 意图：展示与基础操作同源，请求、保存和隔离夹具由各自调用方注入。
 * 约束：不读取 IPC 或真实密钥；请求状态不得改变头部按钮尺寸，未保存的模型由调用方保留。
 */
export function ModelConnectionCard({ id, name, sourceLabel, providerLabel, custom = false, enabled = true, baseUrl, credentialLabel, hasApiKey, models, draft, onDraftChange, onSubmitModel, onAddModel, onToggleModel, onRemoveModel, onEdit, onDelete, onTest, onFetch, testState = 'idle', testMessage, fetchState = 'idle', fetchMessage, fetchRetryable = true, fetchedModels = [], busy = false, editing, editingTestId, testIdPrefix = 'settings' }: {
  id: string; name: string; sourceLabel: string; providerLabel: string; custom?: boolean; enabled?: boolean
  baseUrl: string; credentialLabel: string; hasApiKey: boolean; models: readonly Model[]
  draft: string; onDraftChange: (value: string) => void; onSubmitModel: () => void
  onAddModel: (model: string) => void; onToggleModel: (model: Model) => void; onRemoveModel: (model: string) => void
  onEdit: () => void; onDelete?: () => void; onTest: () => void; onFetch: () => void
  testState?: 'idle' | 'testing' | 'success' | 'error'; testMessage?: string
  fetchState?: RequestState; fetchMessage?: string; fetchRetryable?: boolean; fetchedModels?: readonly string[]
  busy?: boolean; editing?: ReactNode; editingTestId?: string; testIdPrefix?: string
}) {
  const duplicate = models.some(model => model.id === draft.trim())
  const statusColor = testState === 'success' ? 'var(--success)' : testState === 'error' ? 'var(--danger)' : 'var(--text-muted)'
  return <div className="min-w-0 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`${testIdPrefix}-model-profile-${id}`}>
    {editing ? <div className="p-3" data-testid={editingTestId}>{editing}</div> : <>
      <div className="flex flex-wrap items-center gap-2 px-3 py-3" data-testid={`${testIdPrefix}-connection-header-${id}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColor }} role="img" aria-label={testState === 'success' ? '连接测试通过' : testState === 'error' ? '连接测试失败' : testState === 'testing' ? '正在测试连接' : '尚未测试'} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium" title={name} style={{ color: 'var(--text-primary)' }}>{name}</div>
            <div className="mt-1 truncate text-[10px]" title={`${sourceLabel} · ${providerLabel}`} style={{ color: 'var(--text-muted)' }}>{sourceLabel} · {providerLabel} · {models.length} 个模型{!enabled && ' · 已停用'}</div>
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <IconButton size={32} label={`编辑连接 ${name}`} disabled={busy} onClick={onEdit} className="border" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }} data-testid={`${testIdPrefix}-edit-connection-${id}`}><Pencil size={13} /></IconButton>
          <ActionButton size="sm" className="h-8 min-h-0 w-[110px] shrink-0 gap-1 px-2 text-[10px]" disabled={busy || fetchState === 'loading'} onClick={onFetch} aria-label={fetchState === 'loading' ? `正在获取 ${name} 的模型` : `获取 ${name} 已有模型`} data-testid={`${testIdPrefix}-fetch-models-${id}`}><RefreshCw size={12} className={fetchState === 'loading' ? 'animate-spin' : ''} />{fetchState === 'loading' ? '正在获取…' : '获取已有模型'}</ActionButton>
          <ActionButton size="sm" className="h-8 min-h-0 w-[88px] shrink-0 gap-1 px-2 text-[10px]" disabled={busy || testState === 'testing'} onClick={onTest} aria-label={testState === 'testing' ? `正在测试 ${name}` : `测试连接 ${name}`} data-testid={`${testIdPrefix}-test-connection-${id}`}>
            {testState === 'testing' ? <LoaderCircle size={12} className="animate-spin" /> : <Check size={12} />}{testState === 'testing' ? '正在测试' : '测试连接'}
          </ActionButton>
          {onDelete && <IconButton size={32} label={`删除 ${name}`} disabled={busy} onClick={onDelete}><Trash2 size={13} style={{ color: 'var(--danger)' }} /></IconButton>}
        </div>
      </div>
      <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="grid gap-2 text-[10px] sm:grid-cols-3">
          <div className="min-w-0"><span style={{ color: 'var(--text-muted)' }}>{custom ? '适配器' : '服务入口'}</span><div className="mt-1 truncate font-medium" title={providerLabel} style={{ color: 'var(--text-secondary)' }}>{providerLabel}</div></div>
          <div className="min-w-0"><span style={{ color: 'var(--text-muted)' }}>Base URL</span><div className="mt-1 truncate font-mono" title={baseUrl} style={{ color: 'var(--text-secondary)' }}>{baseUrl}</div></div>
          <div><span style={{ color: 'var(--text-muted)' }}>密钥状态</span><div className="mt-1 font-medium" style={{ color: hasApiKey ? 'var(--success)' : credentialLabel === '未配置' ? 'var(--danger)' : 'var(--text-secondary)' }}>{credentialLabel}</div></div>
        </div>
        {testState !== 'idle' && <div role="status" className="mt-2 break-words text-[10px]" style={{ color: statusColor }}>{testMessage || (testState === 'success' ? '连接测试通过' : testState === 'testing' ? '正在测试连接…' : '连接测试失败，请检查地址和凭据后重试。')}</div>}
        <div className="mt-4 text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>模型清单 · {models.length} 个</div>
        <div className="mt-3 space-y-2">
          {models.length === 0 && <div className="rounded-[var(--radius-sm)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>这个连接还没有添加模型。</div>}
          {models.map(model => <div key={model.id} data-connection-model-row className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={model.id} style={{ color: 'var(--text-primary)' }}>{model.id}</span>
            <IconButton label={`${model.id}${model.enabled ? '已启用' : '未启用'}`} role="switch" aria-checked={model.enabled} disabled={busy} onClick={() => onToggleModel(model)}>{model.enabled ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Circle size={12} style={{ color: 'var(--text-muted)' }} />}</IconButton>
            <IconButton label={`移除模型 ${model.id}`} disabled={busy} onClick={() => onRemoveModel(model.id)}><Trash2 size={12} style={{ color: 'var(--danger)' }} /></IconButton>
          </div>)}
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2">
          <TextField aria-label={`手动添加模型 ${name}`} value={draft} disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => onDraftChange(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onSubmitModel() } }} placeholder="填写模型 ID" className="theme-input h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2.5 text-[10px]" />
          <IconButton size={32} label="手动添加模型" disabled={busy || !draft.trim() || duplicate} onClick={onSubmitModel} className="border disabled:opacity-40" style={{ borderColor: 'var(--border-color)' }}><Plus size={14} /></IconButton>
        </div>
        {fetchState === 'success' && fetchedModels.length > 0 && <div className="mt-3 space-y-2" data-testid={`${testIdPrefix}-fetched-models-${id}`}><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>获取到的模型 · 点击加入清单</div><div className="flex flex-wrap gap-1.5">{fetchedModels.map(modelId => {
          const alreadyAdded = models.some(model => model.id === modelId)
          return <ActionButton key={modelId} size="sm" disabled={busy || alreadyAdded} onClick={() => onAddModel(modelId)} className="max-w-full gap-1" style={{ borderColor: alreadyAdded ? 'var(--success)' : 'var(--border-color)', color: alreadyAdded ? 'var(--success)' : 'var(--text-secondary)' }}><span className="min-w-0 max-w-[16rem] truncate" title={modelId}>{modelId}</span>{alreadyAdded ? <Check size={12} className="shrink-0" /> : <Plus size={12} className="shrink-0" />}</ActionButton>
        })}</div></div>}
        {duplicate && <div role="status" className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>这个模型已在清单中。</div>}
        {fetchState === 'success' && fetchedModels.length === 0 && <div role="status" className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>没有获取到模型，可手动添加模型 ID。</div>}
        {(fetchState === 'error' || fetchState === 'unsupported') && <div role="status" className="mt-3 break-words rounded-[var(--radius-sm)] px-3 py-2 text-[10px]" style={{ background: fetchState === 'error' ? 'color-mix(in srgb, var(--danger) 10%, transparent)' : 'var(--accent-subtle)', color: fetchState === 'error' ? 'var(--danger)' : 'var(--accent-fg)' }}>
          {fetchMessage || (fetchState === 'error' ? '获取失败：请检查 Base URL 和连接凭据；仍可手动添加模型。' : '这个连接暂不提供模型列表；请手动添加模型 ID。')}
          {fetchState === 'error' && fetchRetryable && <ActionButton size="sm" disabled={busy} onClick={onFetch} className="ml-2">重试</ActionButton>}
        </div>}
      </div>
    </>}
  </div>
}
