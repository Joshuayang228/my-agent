import { useId, type ChangeEvent, type ReactNode } from 'react'
import { Check, ImagePlus, LoaderCircle, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { ConfirmPanel } from '../foundation/ConfirmPanel'
import { IconButton } from '../foundation/IconButton'
import { SelectField } from '../foundation/SelectField'
import { TextField } from '../foundation/TextField'
import { CheckboxField } from '../foundation/CheckboxField'
import { readingNotesForAsset, tripStopSchema, type ReadingNoteRecord, type TripStopRecord } from '../../shared/world-records'

type WorldAssetPresentation = 'home-gallery' | 'travel-gallery' | 'culture-gallery' | 'wardrobe-gallery'

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
  presentation?: WorldAssetPresentation
  stops?: TripStopRecord[]
  readingNotes?: ReadingNoteRecord[]
}

interface FieldSpec {
  key: 'name' | string
  label: string
  multiline?: boolean
  maxLength: number
  options?: readonly { value: string; label: string }[]
  checkbox?: boolean
  inputType?: 'date'
  numeric?: boolean
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

export function draftFromAsset(asset: { id?: string; kind: string; name: string; payload: Record<string, unknown> }, presentation?: WorldAssetPresentation): WorldAssetDraft {
  const kind = isWorldAssetKind(asset.kind) ? asset.kind : 'furniture'
  const draft = emptyWorldAssetDraft(kind)
  draft.name = asset.name
  draft.presentation = presentation
  if (presentation === 'wardrobe-gallery') draft.payload.recordType = asset.payload.recordType === 'outfit' ? 'outfit' : 'garment'
  if (presentation === 'home-gallery' && kind === 'home') draft.payload.recordType = asset.payload.recordType === 'space' ? 'space' : 'residence'
  if (presentation === 'travel-gallery') {
    const stops = tripStopSchema.array().safeParse(asset.payload.stops ?? [])
    draft.stops = stops.success ? stops.data : []
  }
  if (presentation === 'culture-gallery') draft.readingNotes = readingNotesForAsset({ id: asset.id ?? 'legacy', payload: asset.payload }).map(({ assetId: _assetId, ...note }) => note)
  for (const field of fieldsFor(kind, presentation, asset.payload.recordType, asset.payload.type)) {
    if (field.key === 'name') continue
    const value = presentation === 'wardrobe-gallery' && field.key.startsWith('slot:') ? (asset.payload.slots as Record<string, unknown> | undefined)?.[field.key.slice(5)] : asset.payload[field.key]
    draft.payload[field.key] = field.numeric && typeof value === 'number' ? String(value) : field.checkbox ? String(value === true) : field.key === 'displayEvidence' && Array.isArray(value) ? value.filter(item => typeof item === 'string').join('\n') : textValue(value)
  }
  if (presentation === 'culture-gallery' && ['film', 'music'].includes(String(asset.payload.type))) {
    draft.payload.detail ||= textValue(asset.payload.summary)
    const creatorKey = asset.payload.type === 'film' ? 'director' : 'artist'
    draft.payload[creatorKey] ||= textValue(asset.payload.author)
  }
  return draft
}

export function fieldsFor(kind: WorldAssetKind, presentation?: WorldAssetPresentation, recordType?: unknown, cultureType?: unknown): FieldSpec[] {
  if (presentation === 'wardrobe-gallery' && kind === 'wardrobe') {
    if (recordType === 'outfit') return [{ key: 'name', label: '套装名称', maxLength: 40 }, ...[['top', '上装'], ['bottom', '下装'], ['outerwear', '外套'], ['shoes', '鞋子']].map(([slot, label]) => ({ key: `slot:${slot}`, label, maxLength: 160 }))]
    return [{ key: 'name', label: '名称', maxLength: 40 }, { key: 'category', label: '衣物分类', maxLength: 24, options: [{ value: '', label: '请选择' }, ...[['top', '上装'], ['bottom', '下装'], ['outerwear', '外套'], ['shoes', '鞋子']].map(([value, label]) => ({ value, label }))] }, { key: 'color', label: '颜色', maxLength: 24 }, { key: 'style', label: '风格', maxLength: 24 }, { key: 'occasion', label: '场合', maxLength: 24 }]
  }
  if (presentation === 'culture-gallery' && ['culture', 'bookshelf'].includes(kind)) {
    const type = kind === 'bookshelf' ? 'reading' : cultureType ?? 'reading'
    const fields: FieldSpec[] = [{ key: 'name', label: type === 'reading' ? '书名' : '作品', maxLength: 40 }]
    if (kind === 'culture') fields.push({ key: 'type', label: '类型', maxLength: 24, options: CULTURE_TYPES })
    if (type === 'reading') fields.push(
      { key: 'author', label: '作者', maxLength: 160 },
      { key: 'readingStatus', label: '阅读状态', maxLength: 24, options: [{ value: '', label: '未记录' }, ...[['planned', '想读'], ['reading', '正在读'], ['paused', '暂时放下'], ['finished', '已完成'], ['abandoned', '未继续']].map(([value, label]) => ({ value, label }))] },
      { key: 'currentPage', label: '当前页数', maxLength: 7, numeric: true }, { key: 'totalPages', label: '总页数', maxLength: 7, numeric: true },
      { key: 'detail', label: '摘要', maxLength: 4000, multiline: true },
    )
    else if (type === 'film' || type === 'music') fields.push(
      { key: type === 'film' ? 'director' : 'artist', label: type === 'film' ? '导演' : '音乐人', maxLength: 160 },
      { key: type === 'film' ? 'mediaKind' : 'musicKind', label: '作品类型', maxLength: 24, options: [{ value: '', label: '未记录' }, ...(type === 'film' ? [{ value: 'movie', label: '电影' }, { value: 'series', label: '剧集' }] : [{ value: 'track', label: '单曲' }, { value: 'album', label: '专辑' }])] },
      { key: type === 'film' ? 'watchStatus' : 'listeningStatus', label: type === 'film' ? '观看状态' : '收听状态', maxLength: 24, options: [{ value: '', label: '未记录' }, ...(type === 'film' ? [['planned', '想看'], ['watching', '正在看'], ['paused', '暂时放下'], ['finished', '已完成'], ['abandoned', '未继续']] : [['queued', '想听'], ['listening', '正在听'], ['revisiting', '最近常听'], ['finished', '已完成']]).map(([value, label]) => ({ value, label }))] },
      { key: 'detail', label: type === 'film' ? '观后感' : '听感', maxLength: 4000, multiline: true },
    )
    else fields.push({ key: 'author', label: '摄影者', maxLength: 160 }, { key: 'locationName', label: '拍摄地点', maxLength: 160 }, { key: 'depictedAt', label: '拍摄时间', maxLength: 160 }, { key: 'detail', label: '作品故事', maxLength: 4000, multiline: true })
    return fields
  }
  if (presentation === 'travel-gallery' && kind === 'footprint') return [
    { key: 'name', label: '旅行名称', maxLength: 40 },
    { key: 'destination', label: '目的地', maxLength: 160 },
    { key: 'status', label: '旅行状态', maxLength: 24, options: [{ value: 'active', label: '旅行中' }, { value: 'completed', label: '已结束' }] },
    { key: 'start', label: '出发日期', maxLength: 10, inputType: 'date' },
    { key: 'end', label: '结束日期', maxLength: 10, inputType: 'date' },
    { key: 'story', label: '旅行故事', maxLength: 4000, multiline: true },
  ]
  if (presentation === 'home-gallery' && kind === 'home' && recordType === 'space') return [
    { key: 'name', label: '空间名称', maxLength: 40 },
    { key: 'residenceId', label: '所属住所', maxLength: 160 },
    { key: 'description', label: '空间描述', maxLength: 4000, multiline: true },
  ]
  if (presentation === 'home-gallery' && kind === 'furniture') return [
    { key: 'name', label: '物件', maxLength: 40 },
    { key: 'spaceId', label: '所属空间', maxLength: 160 },
    { key: 'description', label: '说明', maxLength: 4000, multiline: true },
    { key: 'originNote', label: '来历', maxLength: 4000, multiline: true },
    { key: 'displayInHome', label: '在家居中展示', maxLength: 5, checkbox: true },
    { key: 'displayReason', label: '展示理由', maxLength: 4000, multiline: true },
    { key: 'displayEvidence', label: '故事或习惯依据', maxLength: 16000, multiline: true },
  ]
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
  for (const field of fieldsFor(draft.kind, draft.presentation, draft.payload.recordType, draft.payload.type)) {
    if (field.key === 'name') continue
    if (draft.presentation === 'wardrobe-gallery' && field.key.startsWith('slot:')) continue
    const value = draft.payload[field.key] ?? ''
    payload[field.key] = draft.presentation === 'culture-gallery' && (field.numeric || field.options && field.key !== 'type') ? value.trim() ? field.numeric ? Number(value) : value : null : field.checkbox ? value === 'true' : field.key === 'displayEvidence' && draft.presentation === 'home-gallery' ? value.split('\n').map(line => line.trim()).filter(Boolean)
      : draft.presentation === 'travel-gallery' && field.key === 'end' && (draft.payload.status === 'active' || !value) ? null
      : ['spaceId', 'residenceId'].includes(field.key) && draft.presentation === 'home-gallery' && !value ? null : value
  }
  if (draft.presentation === 'home-gallery' && draft.kind === 'home') payload.recordType = draft.payload.recordType === 'space' ? 'space' : 'residence'
  if (draft.presentation === 'travel-gallery') { payload.recordType = 'trip'; payload.stops = draft.stops ?? [] }
  if (draft.presentation === 'culture-gallery' && (draft.kind === 'bookshelf' || draft.payload.type === 'reading')) payload.readingNotes = draft.readingNotes ?? []
  if (draft.presentation === 'culture-gallery' && ['film', 'music'].includes(draft.payload.type)) { payload.author = null; payload.summary = null }
  if (draft.presentation === 'wardrobe-gallery') {
    payload.recordType = draft.payload.recordType === 'outfit' ? 'outfit' : 'garment'
    if (payload.recordType === 'outfit') payload.slots = Object.fromEntries(['top', 'bottom', 'outerwear', 'shoes'].filter(slot => draft.payload[`slot:${slot}`]?.trim()).map(slot => [slot, draft.payload[`slot:${slot}`].trim()]))
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
  assets = [],
}: {
  draft: WorldAssetDraft
  onChange: (draft: WorldAssetDraft) => void
  onSave: () => void
  onCancel: () => void
  busy: boolean
  saveLabel: string
  assets?: readonly WorldAssetRecord[]
}) {
  const formId = useId()
  return (
    <div className="mt-2 space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }} data-testid="world-asset-form">
      {fieldsFor(draft.kind, draft.presentation, draft.payload.recordType, draft.payload.type).filter(field => !(draft.presentation === 'travel-gallery' && draft.payload.status === 'active' && field.key === 'end')).map((baseField) => {
        const references = assets.filter(asset => asset.kind === 'home' && (baseField.key === 'spaceId' ? asset.payload.recordType === 'space' : asset.payload.recordType !== 'space'))
        const field = draft.presentation === 'wardrobe-gallery' && baseField.key.startsWith('slot:') ? { ...baseField, options: [{ value: '', label: '未选择' }, ...assets.filter(asset => asset.kind === 'wardrobe' && asset.payload.category === baseField.key.slice(5) && !['outfit', 'wear-state'].includes(String(asset.payload.recordType))).map(asset => ({ value: asset.id, label: asset.name }))] } : draft.presentation === 'home-gallery' && ['spaceId', 'residenceId'].includes(baseField.key) ? { ...baseField, options: [{ value: '', label: baseField.key === 'spaceId' ? '未归置' : '未关联住所' }, ...references.map(asset => ({ value: asset.id, label: asset.name }))] } : baseField
        const value = field.key === 'name' ? draft.name : (draft.payload[field.key] ?? '')
        const setValue = (next: string) => {
          if (field.key === 'name') onChange({ ...draft, name: next })
          else onChange({ ...draft, payload: { ...draft.payload, [field.key]: next } })
        }
        const controlId = `${formId}-${field.key}`
        if (field.checkbox) return <label key={field.key} className="flex items-center gap-2 text-xs"><CheckboxField checked={value === 'true'} disabled={busy} onChange={event => setValue(String(event.target.checked))} />{field.label}</label>
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
                type={field.inputType}
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
      {draft.presentation === 'culture-gallery' && (draft.kind === 'bookshelf' || draft.payload.type === 'reading') && <section className="space-y-3" aria-label="读书笔记维护">
        {(draft.readingNotes ?? []).map((note, index) => <div key={note.id} className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between text-xs"><span>笔记 {index + 1}</span><IconButton label={`删除笔记 ${index + 1}`} disabled={busy} onClick={() => onChange({ ...draft, readingNotes: draft.readingNotes?.filter(item => item.id !== note.id) })}><Trash2 size={14} /></IconButton></div>
          <TextField aria-label={`笔记 ${index + 1} 正文`} multiline rows={3} maxLength={4000} disabled={busy} value={note.text} className="theme-input w-full border px-2 py-1" onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, readingNotes: draft.readingNotes?.map(item => item.id === note.id ? { ...item, text: event.target.value } : item) })} />
          <div className="grid grid-cols-2 gap-2"><TextField aria-label={`笔记 ${index + 1} 页码`} type="number" min={1} max={1000000} disabled={busy} value={note.page ?? ''} className="theme-input border px-2 py-1" onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, readingNotes: draft.readingNotes?.map(item => { if (item.id !== note.id) return item; const { page: _page, ...rest } = item; return event.target.value ? { ...rest, page: Number(event.target.value) } : rest }) })} /><TextField aria-label={`笔记 ${index + 1} 章节`} maxLength={160} disabled={busy} value={note.chapter ?? ''} className="theme-input border px-2 py-1" onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, readingNotes: draft.readingNotes?.map(item => item.id === note.id ? { ...item, chapter: event.target.value } : item) })} /></div>
        </div>)}
        <ActionButton disabled={busy || (draft.readingNotes?.length ?? 0) >= 200} onClick={() => onChange({ ...draft, readingNotes: [...(draft.readingNotes ?? []), { id: crypto.randomUUID(), text: '', createdAt: Date.now() }] })}><Plus size={14} className="mr-1" />添加笔记</ActionButton>
      </section>}
      {draft.presentation === 'travel-gallery' && <section className="space-y-3" aria-label="旅途经历维护">
        {(draft.stops ?? []).map((stop, index) => <div key={stop.id} className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between text-xs"><span>经历 {index + 1}</span><IconButton label={`删除经历 ${index + 1}`} disabled={busy} onClick={() => onChange({ ...draft, stops: draft.stops?.filter(item => item.id !== stop.id) })}><Trash2 size={14} /></IconButton></div>
          {(['name', 'date', 'story'] as const).map(key => <label key={key} className="block text-xs">{key === 'name' ? '地点或经历' : key === 'date' ? '日期' : '故事'}<TextField aria-label={`经历 ${index + 1} ${key === 'name' ? '地点或经历' : key === 'date' ? '日期' : '故事'}`} type={key === 'date' ? 'date' : undefined} multiline={key === 'story'} rows={3} maxLength={key === 'story' ? 4000 : key === 'name' ? 160 : 10} disabled={busy} value={stop[key] ?? ''} className="theme-input mt-1 w-full border px-2 py-1" onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...draft, stops: draft.stops?.map(item => item.id === stop.id ? key === 'date' && !event.target.value ? { id: item.id, name: item.name, story: item.story } : { ...item, [key]: event.target.value } : item) })} /></label>)}
        </div>)}
        <ActionButton disabled={busy || (draft.stops?.length ?? 0) >= 200} onClick={() => onChange({ ...draft, stops: [...(draft.stops ?? []), { id: crypto.randomUUID(), name: '', story: '' }] })}><Plus size={14} className="mr-1" />添加经历</ActionButton>
      </section>}
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
  onGenerate,
  disabled,
}: {
  name: string
  onEdit: () => void
  onDelete: () => void
  onGenerate?: () => void
  disabled?: boolean
}) {
  return (
    <div className={`relative mt-2 h-8 ${onGenerate ? 'w-[104px]' : 'w-[68px]'}`} data-testid="world-asset-actions">
      <div className="absolute inset-0 flex items-center justify-end gap-1">
        <IconButton size={32} label={`为 ${name} 生成图片`} disabled={disabled || !onGenerate} onClick={() => onGenerate?.()} className={`transition hover:bg-[var(--hover-overlay)] ${onGenerate ? '' : 'invisible'}`} style={{ color: 'var(--accent-emphasis)' }} aria-hidden={!onGenerate}>
          <ImagePlus size={14} />
        </IconButton>
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
  assets,
}: {
  open: boolean
  label: string
  draft: WorldAssetDraft
  busy: boolean
  onOpen: () => void
  onChange: (draft: WorldAssetDraft) => void
  onSave: () => void
  onCancel: () => void
  assets?: readonly WorldAssetRecord[]
}) {
  return (
    <div className="mt-3" data-testid={`world-asset-add-${draft.kind}`}>
      {open ? (
        <div className="rounded-[var(--radius-lg)] border p-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
          <WorldAssetForm draft={draft} assets={assets} onChange={onChange} onSave={onSave} onCancel={onCancel} busy={busy} saveLabel={`保存${label}`} />
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
