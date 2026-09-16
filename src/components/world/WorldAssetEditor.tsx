import { useId, type ChangeEvent, type ReactNode } from 'react'
import { Check, LoaderCircle, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { ConfirmPanel } from '../foundation/ConfirmPanel'
import { IconButton } from '../foundation/IconButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'

export const WORLD_ASSET_KINDS = ['wardrobe', 'bookshelf', 'culture', 'home', 'footprint', 'furniture'] as const
export type WorldAssetKind = (typeof WORLD_ASSET_KINDS)[number]

export interface WorldAssetRecord {
  id: string
  roleId: string
  kind: string
  name: string
  payload: Record<string, unknown>
  acquiredAt: number
  sourceEventId: string | null
}

export interface WorldAssetDraft {
  kind: WorldAssetKind
  name: string
  payload: Record<string, string>
}

interface FieldSpec {
  key: 'name' | string
  label: string
  multiline?: boolean
  maxLength: number
  options?: readonly { value: string; label: string }[]
}

const CULTURE_TYPES = [
  { value: 'reading', label: '读书' },
  { value: 'music', label: '音乐' },
  { value: 'film', label: '电影' },
  { value: 'photography', label: '摄影' },
] as const

const VISIT_STATUSES = [
  { value: 'favorite', label: '常去' },
  { value: 'wanted', label: '想去' },
] as const

const textValue = (value: unknown): string => (typeof value === 'string' ? value : '')

export function isWorldAssetKind(kind: string): kind is WorldAssetKind {
  return (WORLD_ASSET_KINDS as readonly string[]).includes(kind)
}

export function emptyWorldAssetDraft(kind: WorldAssetKind): WorldAssetDraft {
  const payload: Record<string, string> = {}
  if (kind === 'culture') payload.type = 'reading'
  if (kind === 'footprint') payload.visitStatus = 'favorite'
  return { kind, name: '', payload }
}

export function draftFromAsset(asset: { kind: string; name: string; payload: Record<string, unknown> }): WorldAssetDraft {
  const kind = isWorldAssetKind(asset.kind) ? asset.kind : 'furniture'
  const draft = emptyWorldAssetDraft(kind)
  draft.name = asset.name
  for (const field of fieldsFor(kind)) {
    if (field.key === 'name') continue
    draft.payload[field.key] = textValue(asset.payload[field.key])
  }
  return draft
}

export function fieldsFor(kind: WorldAssetKind): FieldSpec[] {
  if (kind === 'wardrobe') {
    return [
      { key: 'name', label: '名称', maxLength: 40 },
      { key: 'color', label: '颜色', maxLength: 24 },
      { key: 'style', label: '风格', maxLength: 24 },
      { key: 'occasion', label: '场合', maxLength: 24 },
    ]
  }
  if (kind === 'bookshelf') {
    return [
      { key: 'name', label: '书名', maxLength: 40 },
      { key: 'author', label: '作者', maxLength: 24 },
      { key: 'genre', label: '类型', maxLength: 24 },
      { key: 'note', label: '笔记', maxLength: 4000, multiline: true },
    ]
  }
  if (kind === 'culture') {
    return [
      { key: 'name', label: '作品', maxLength: 40 },
      { key: 'type', label: '类型', maxLength: 24, options: CULTURE_TYPES },
      { key: 'author', label: '作者', maxLength: 24 },
      { key: 'detail', label: '摘要', maxLength: 4000, multiline: true },
      { key: 'note', label: '笔记', maxLength: 4000, multiline: true },
    ]
  }
  if (kind === 'home') {
    return [
      { key: 'name', label: '空间', maxLength: 40 },
      { key: 'residence', label: '住所', maxLength: 4000, multiline: true },
      { key: 'interior', label: '室内', maxLength: 4000, multiline: true },
      { key: 'layout', label: '布局', maxLength: 4000, multiline: true },
      { key: 'view', label: '窗外', maxLength: 4000, multiline: true },
      { key: 'surroundings', label: '周边', maxLength: 4000, multiline: true },
    ]
  }
  if (kind === 'footprint') {
    return [
      { key: 'name', label: '地点', maxLength: 40 },
      { key: 'city', label: '城市', maxLength: 24 },
      { key: 'visitStatus', label: '状态', maxLength: 24, options: VISIT_STATUSES },
      { key: 'description', label: '说明', maxLength: 4000, multiline: true },
    ]
  }
  return [
    { key: 'name', label: '物件', maxLength: 40 },
    { key: 'description', label: '说明', maxLength: 4000, multiline: true },
  ]
}

export function payloadFromDraft(draft: WorldAssetDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of fieldsFor(draft.kind)) {
    if (field.key === 'name') continue
    payload[field.key] = draft.payload[field.key] ?? ''
  }
  return payload
}

export function deleteDescriptionFor(kind: string): string {
  if (kind === 'bookshelf') return '删除后历史引用会降级为无书名。'
  if (kind === 'wardrobe') return '历史动态里的着装引用会降级为无着装。'
  if (kind === 'home') return '删除后不会自动补种住所。'
  if (kind === 'footprint') return '删除后不会自动补种地点。'
  if (kind === 'furniture') return '删除后生活物件不会自动回来。'
  return '删除后这条生活记录不会自动回来。'
}

/**
 * 背景：衣柜短标签与文化 / 家居 / 足迹长文共用同一套增改删，正式页不能再各自造输入和按钮。
 * 设计意图：Foundation 只提供控件，业务层持有草稿、失败保留和处理中锁；Playground 用同一表单改内存夹具。
 * 关键约束：处理中禁止取消和重复提交；操作槽始终占位，hover 不得改变宽高。
 */
export function WorldAssetForm({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
  saveLabel,
}: {
  draft: WorldAssetDraft
  onChange: (draft: WorldAssetDraft) => void
  onSave: () => void
  onCancel: () => void
  busy: boolean
  saveLabel: string
}) {
  const formId = useId()
  return (
    <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }} data-testid="world-asset-form">
      {fieldsFor(draft.kind).map((field) => {
        const value = field.key === 'name' ? draft.name : (draft.payload[field.key] ?? '')
        const setValue = (next: string) => {
          if (field.key === 'name') onChange({ ...draft, name: next })
          else onChange({ ...draft, payload: { ...draft.payload, [field.key]: next } })
        }
        const controlId = `${formId}-${field.key}`
        return (
          <label key={field.key} htmlFor={controlId} className="block text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {field.label}
            {field.options ? (
              <SelectField
                id={controlId}
                aria-label={field.label}
                value={value}
                disabled={busy}
                onChange={(event) => setValue(event.target.value)}
                className="mt-0.5"
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectField>
            ) : (
              <TextField
                id={controlId}
                aria-label={field.label}
                multiline={field.multiline}
                value={value}
                disabled={busy}
                maxLength={field.maxLength}
                rows={field.multiline ? Math.min(8, Math.max(3, Math.ceil(value.length / 45))) : undefined}
                onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(event.target.value)}
                className={`theme-input mt-0.5 w-full rounded-[var(--radius-md)] border px-2 ${field.multiline ? 'min-h-20 resize-y py-1.5 text-[12px] leading-5' : 'h-8 py-1 text-[12px]'}`}
              />
            )}
          </label>
        )
      })}
      <div className="flex h-8 justify-end gap-1" data-testid="world-asset-form-actions">
        <IconButton size={32} label={saveLabel} title={busy ? '正在保存' : saveLabel} disabled={busy || !draft.name.trim()} onClick={onSave} style={{ color: 'var(--accent-fg)' }}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
        </IconButton>
        <IconButton size={32} label="取消" disabled={busy} onClick={onCancel}><X size={14} /></IconButton>
      </div>
    </div>
  )
}

export function WorldAssetActions({
  name,
  onEdit,
  onDelete,
  disabled,
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  return (
    <div className="relative mt-2 h-8 w-[68px]" data-testid="world-asset-actions">
      <div className="absolute inset-0 flex items-center justify-end gap-1">
        <IconButton size={32} label={`编辑 ${name}`} disabled={disabled} onClick={onEdit} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-secondary)' }}>
          <Pencil size={14} />
        </IconButton>
        <IconButton size={32} label={`删除 ${name}`} disabled={disabled} onClick={onDelete} className="transition hover:bg-[var(--hover-overlay)]" style={{ color: 'var(--text-muted)' }}>
          <Trash2 size={14} />
        </IconButton>
      </div>
    </div>
  )
}

export function WorldAssetAddRow({
  open,
  label,
  draft,
  busy,
  onOpen,
  onChange,
  onSave,
  onCancel,
}: {
  open: boolean
  label: string
  draft: WorldAssetDraft
  busy: boolean
  onOpen: () => void
  onChange: (draft: WorldAssetDraft) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-3" data-testid={`world-asset-add-${draft.kind}`}>
      {open ? (
        <div className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
          <WorldAssetForm draft={draft} onChange={onChange} onSave={onSave} onCancel={onCancel} busy={busy} saveLabel={`保存${label}`} />
        </div>
      ) : (
        <ActionButton onClick={onOpen} disabled={busy} className="gap-1.5 px-1 text-[12px]"><Plus size={14} />添加{label}</ActionButton>
      )}
    </div>
  )
}

export function WorldAssetDeleteConfirm({
  asset,
  busy,
  onCancel,
  onConfirm,
}: {
  asset: { name: string; kind: string }
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="mb-3">
      <ConfirmPanel
        icon={<TriangleAlert size={15} />}
        title={`删除「${asset.name}」？`}
        description={deleteDescriptionFor(asset.kind)}
        confirmLabel="删除"
        busy={busy}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </div>
  )
}

export function WorldWriteError({ message, children }: { message: string; children?: ReactNode }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--danger)' }}>
      <span className="min-w-0 flex-1">{message}</span>
      {children}
    </div>
  )
}
