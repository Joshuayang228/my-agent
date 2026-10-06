/**
 * 活跃主角物什（生活面）：衣柜 + 书架分栏；编辑 / 删除 / 新增。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Shirt, Sparkles } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { IconButton } from './foundation/IconButton'
import { ImagePreviewImage } from './foundation/ImagePreviewImage'
import { GeneratedImageResult } from './chat/callbacks/GeneratedImageResult'
import { TabStrip } from './foundation/TabStrip'
import {
  WorldAssetActions,
  WorldAssetAddRow,
  WorldAssetDeleteConfirm,
  WorldAssetForm,
  WorldWriteError,
  draftFromAsset,
  emptyWorldAssetDraft,
  payloadFromDraft,
  type WorldAssetDraft,
  type WorldAssetKind,
  type WorldAssetRecord,
} from './world/WorldAssetEditor'
import type { GeneratedImageReference } from '../shared/types'

type AssetTab = 'wardrobe' | 'bookshelf'

interface AssetsPanelProps {
  onGenerateAssetImage?: (asset: WorldAssetRecord) => void
  previewAssets?: WorldAssetRecord[]
  previewEditable?: boolean
  previewWearingId?: string
  /** Playground 可将书架收归文化角；正式页默认保留资产分栏。 */
  showAssetTabs?: boolean
  /** Playground 的衣柜候选展示；正式页保持默认资产面板布局。 */
  presentation?: 'default' | 'wardrobe-gallery'
  /** 隔离故事中的整套图片；仅匹配初始槽位时展示，不能冒充生产生成结果。 */
  previewOutfitImage?: { src?: string; status: 'ready' | 'pending' | 'failed' | 'none' }
}

function occasionTags(payload: Record<string, unknown>): string[] {
  const tags: string[] = []
  for (const key of ['style', 'occasion', 'color', 'genre', 'author', 'note']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) tags.push(value.trim())
  }
  return tags.slice(0, 4)
}

function PreviewAssetImage({ asset, gallery = false }: { asset: WorldAssetRecord; gallery?: boolean }) {
  const src = typeof asset.payload.playgroundImageSrc === 'string' ? asset.payload.playgroundImageSrc : ''
  if (!src) return null
  return <ImagePreviewImage src={src} alt={`${asset.name}的穿着参考图`} className={`mb-3 block w-full rounded-[var(--radius-md)] ${gallery ? 'aspect-[3/4] object-contain' : 'aspect-[4/3] object-cover'}`} buttonClassName="w-full" />
}

function imageFromAsset(asset: WorldAssetRecord): GeneratedImageReference | null {
  const value = asset.payload.image
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const image = value as Partial<GeneratedImageReference>
  if (typeof image.id !== 'string' || !/^[a-f0-9]{64}$/.test(image.id) || typeof image.path !== 'string'
    || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType ?? '')
    || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || !Number.isSafeInteger(image.byteLength)) return null
  return image as GeneratedImageReference
}

function AssetImage({ asset }: { asset: WorldAssetRecord }) {
  const image = imageFromAsset(asset)
  if (!image || !window.electronAPI?.companion?.readAssetImage) return null
  return <GeneratedImageResult image={image} readImage={(imageId) => window.electronAPI.companion.readAssetImage(asset.id, imageId)} scope={`asset:${asset.id}`} />
}

export function AssetsPanel({ previewAssets, previewEditable = false, previewWearingId, showAssetTabs = true, presentation = 'default', previewOutfitImage, onGenerateAssetImage }: AssetsPanelProps) {
  const isPreview = previewAssets !== undefined
  const canEdit = (!isPreview || previewEditable) && !(isPreview && presentation === 'wardrobe-gallery')
  const [roleId, setRoleId] = useState('')
  const [items, setItems] = useState<WorldAssetRecord[]>(previewAssets ?? [])
  const [tab, setTab] = useState<AssetTab>('wardrobe')
  const [wearingId, setWearingId] = useState<string | null>(null)
  const [wearingHint, setWearingHint] = useState('')
  const [category, setCategory] = useState('all')
  const [previewWardrobeView, setPreviewWardrobeView] = useState('wearing')
  const [previewSlots, setPreviewSlots] = useState<Record<string, string>>({})
  const [changeError, setChangeError] = useState('')
  const [changingId, setChangingId] = useState<string | null>(null)
  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(!isPreview)
  const [readError, setReadError] = useState('')
  const requestId = useRef(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<WorldAssetDraft>(emptyWorldAssetDraft('wardrobe'))
  const [addDrafts, setAddDrafts] = useState<Partial<Record<AssetTab, { open: boolean; draft: WorldAssetDraft }>>>({})
  const [pendingDelete, setPendingDelete] = useState<WorldAssetRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState('')
  const writing = useRef(false)
  const writeEpoch = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; requestId.current++; if (changeTimer.current) clearTimeout(changeTimer.current) }
  }, [])

  const adding = addDrafts[tab]?.open ?? false
  const addDraft = addDrafts[tab]?.draft ?? emptyWorldAssetDraft(tab)

  const load = useCallback(async () => {
    // 切角和刷新可能交错返回；只发布最新读取，避免旧角色覆盖当前衣柜。
    // 请求序号也约束失败与收尾，卸载后不得重新发布状态。
    const currentRequest = ++requestId.current
    if (isPreview) {
      setItems(previewAssets ?? [])
      setWearingId(previewWearingId ?? null)
      setWearingHint('')
      setPreviewWardrobeView('wearing')
      setPreviewSlots(Object.fromEntries((previewAssets ?? []).filter((asset) => asset.payload.previewWearing === true).map((asset) => [String(asset.payload.category), asset.id])))
      return
    }
    if (!window.electronAPI?.companion) {
      setReadError('物什需要桌面连接，请重新打开应用后重试。')
      setLoading(false)
      return
    }
    setLoading(true)
    setReadError('')
    try {
      const [active, assets, moments] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.getAssets(),
        window.electronAPI.companion.getMoments({ limit: 20 }),
      ])
      if (!mounted.current || currentRequest !== requestId.current) return
      if (assets.roleId !== active.id || moments.roleId !== active.id) {
        setItems([])
        setRoleId('')
        setWearingId(null)
        setWearingHint('')
        setEditingId(null)
        setPendingDelete(null)
        setAddDrafts({})
        throw new Error('ROLE_CHANGED')
      }
      setRoleId(assets.roleId)
      setItems(assets.items)
      const wardrobe = assets.items.filter((asset) => asset.kind === 'wardrobe')
      let foundId: string | null = null
      let hint = ''
      for (const moment of moments.items) {
        const assetId = typeof moment.meta?.assetId === 'string' ? moment.meta.assetId : ''
        const outfit = typeof moment.meta?.outfit === 'string' ? moment.meta.outfit : ''
        if (assetId && wardrobe.some((asset) => asset.id === assetId)) {
          foundId = assetId
          hint = typeof moment.meta?.location === 'string' && moment.meta.location
            ? `最近动态 · ${moment.meta.location}`
            : '来自最近生活动态'
          break
        }
        if (outfit) {
          const byName = wardrobe.find((asset) => asset.name === outfit)
          if (byName) {
            foundId = byName.id
            hint = '来自最近生活动态'
            break
          }
        }
      }
      setWearingId(foundId)
      setWearingHint(hint)
    } catch {
      if (mounted.current && currentRequest === requestId.current) setReadError('物什暂时无法加载，请重试。')
    } finally {
      if (mounted.current && currentRequest === requestId.current) setLoading(false)
    }
  }, [isPreview, previewAssets, previewWearingId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (isPreview || !window.electronAPI?.companion.onRoleChanged) return
    return window.electronAPI.companion.onRoleChanged(() => {
      // 切角不取消已发出的写入；更换代次隔离旧响应，新角色可独立操作。
      // 旧请求不得清草稿、发布错误或释放新角色的写入锁。
      writeEpoch.current++
      writing.current = false
      setBusy(false)
      setItems([])
      setRoleId('')
      setWearingId(null)
      setWearingHint('')
      setWriteError('')
      setEditingId(null)
      setPendingDelete(null)
      setAddDrafts({})
      void load()
    })
  }, [isPreview, load])

  const tabItems = useMemo(() => items.filter((asset) => asset.kind === tab), [items, tab])
  const wearing = useMemo(() => (wearingId ? items.find((asset) => asset.id === wearingId) ?? null : null), [items, wearingId])
  const inventory = useMemo(() => tabItems.filter((asset) => asset.id !== wearing?.id), [tabItems, wearing])

  const mutate = async (action: (isCurrent: () => boolean) => Promise<void>, message: string) => {
    if (writing.current || !mounted.current) return
    const epoch = ++writeEpoch.current
    const isCurrent = () => mounted.current && epoch === writeEpoch.current
    writing.current = true
    setBusy(true)
    setWriteError('')
    try {
      await action(isCurrent)
      if (isCurrent() && !isPreview) await load()
    } catch {
      if (isCurrent()) setWriteError(message)
    } finally {
      if (isCurrent()) {
        writing.current = false
        setBusy(false)
      }
    }
  }

  const startEdit = (asset: WorldAssetRecord) => {
    if (writing.current) return
    setWriteError('')
    setPendingDelete(null)
    setEditingId(asset.id)
    setEditDraft(draftFromAsset(asset))
  }

  const saveEdit = async () => {
    if (!editingId || !editDraft.name.trim() || writing.current) return
    if (isPreview) {
      setItems((current) => current.map((asset) => (
        asset.id === editingId ? { ...asset, name: editDraft.name.trim(), payload: { ...asset.payload, ...payloadFromDraft(editDraft) } } : asset
      )))
      setEditingId(null)
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.updateAsset(editingId, {
        name: editDraft.name,
        payload: payloadFromDraft(editDraft),
      })
      if (!result.ok) throw new Error(result.error || '保存失败')
      if (!isCurrent()) return
      setEditingId(null)
    }, '未保存，修改仍保留。请重试。')
  }

  const saveAdd = async () => {
    if (!addDraft.name.trim() || writing.current) return
    if (isPreview) {
      const now = Date.now()
      setItems((current) => [...current, {
        id: `preview-${crypto.randomUUID()}`,
        roleId: roleId || 'preview',
        kind: addDraft.kind,
        name: addDraft.name.trim(),
        payload: { ...payloadFromDraft(addDraft), ...(presentation === 'wardrobe-gallery' ? { category: category === 'all' ? 'outerwear' : category } : {}) },
        acquiredAt: now,
        sourceEventId: null,
      }])
      setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: emptyWorldAssetDraft(tab) } }))
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.createAsset({
        roleId,
        kind: addDraft.kind,
        name: addDraft.name,
        payload: payloadFromDraft(addDraft),
      })
      if (!result.ok) throw new Error(result.error || '添加失败')
      if (!isCurrent()) return
      setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: emptyWorldAssetDraft(tab) } }))
    }, '未添加，内容仍保留。请重试。')
  }

  const removeAsset = async (asset: WorldAssetRecord) => {
    if (writing.current) return
    if (isPreview) {
      setItems((current) => current.filter((item) => item.id !== asset.id))
      if (editingId === asset.id) setEditingId(null)
      if (wearingId === asset.id) setWearingId(null)
      setPendingDelete(null)
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.deleteAsset(asset.id)
      if (!result.ok) throw new Error(result.error || '删除失败')
      if (!isCurrent()) return
      if (editingId === asset.id) setEditingId(null)
      if (wearingId === asset.id) setWearingId(null)
      setPendingDelete(null)
    }, '未删除，请重试或取消。')
  }

  const KindIcon = tab === 'bookshelf' ? BookOpen : Shirt
  const wardrobeGallery = isPreview && presentation === 'wardrobe-gallery' && tab === 'wardrobe'
  const visibleItems = wardrobeGallery
    ? tabItems.filter((asset) => category === 'all' || asset.payload.category === category)
    : tab === 'wardrobe' && wearing ? inventory : tabItems
  const slotLabels: Record<string, string> = { top: '上装', bottom: '下装', outerwear: '外套', shoes: '鞋履' }
  // 候选图片只对应明确的初始组合，换上另一件时不能沿用旧整套图。
  // 以资产 ID 比较而非名称比较，恢复原组合可复用；正式页不走此隔离分支。
  const initialSlots = Object.fromEntries((previewAssets ?? []).filter((asset) => asset.payload.previewWearing === true).map((asset) => [String(asset.payload.category), asset.id]))
  const matchesInitialOutfit = Object.keys(slotLabels).every((slot) => initialSlots[slot] === previewSlots[slot])
  const outfitImageStatus = matchesInitialOutfit ? previewOutfitImage?.status ?? 'none' : 'none'
  const outfitImageSrc = outfitImageStatus === 'ready' ? previewOutfitImage?.src : undefined
  const changePreview = (asset: WorldAssetRecord) => {
    // Playground 需展示换装在途和失败态，使用本地延迟而不调用真实穿着服务。
    // 仅替换目标槽位，失败不发布新穿搭；离页时取消计时器，不能产生生产写入。
    const slot = String(asset.payload.category)
    if (changingId || !slotLabels[slot] || previewSlots[slot] === asset.id) return
    setChangingId(asset.id)
    setChangeError('')
    changeTimer.current = setTimeout(() => {
      if (!mounted.current) return
      if (asset.payload.previewChangeFailure) setChangeError('未换上，当前穿着仍保留。请重试。')
      else {
        setPreviewSlots((slots) => ({ ...slots, [slot]: asset.id }))
        if (slot === 'outerwear') setWearingId(asset.id)
        setPreviewWardrobeView('wearing')
      }
      setChangingId(null)
    }, 450)
  }

  return (
    <fieldset disabled={busy || changingId !== null} aria-busy={busy || loading || changingId !== null} className="m-0 flex h-full min-h-0 flex-col border-0 p-0" data-testid="world-assets-panel">
      {showAssetTabs && <div className="border-b px-4 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <TabStrip
          label="物什分区"
          activeId={tab}
          onSelect={(id) => {
            setTab(id as AssetTab)
            setEditingId(null)
            setPendingDelete(null)
            setWriteError('')
          }}
          items={[
            { id: 'wardrobe', label: '衣柜', icon: <Shirt size={12} />, testId: 'assets-tab-wardrobe' },
            { id: 'bookshelf', label: '书架', icon: <BookOpen size={12} />, testId: 'assets-tab-bookshelf' },
          ]}
        />
      </div>}

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <WorldWriteError message={readError}>
          {!isPreview && <ActionButton onClick={() => void load()} disabled={loading}>重新读取</ActionButton>}
        </WorldWriteError>
        {pendingDelete && (
          <WorldAssetDeleteConfirm
            asset={pendingDelete}
            busy={busy}
            onCancel={() => { if (!busy) setPendingDelete(null) }}
            onConfirm={() => { const target = pendingDelete; if (target) void removeAsset(target) }}
          />
        )}
        <WorldWriteError message={writeError}>
          {!isPreview && <ActionButton onClick={() => void load()} disabled={loading}>重新读取</ActionButton>}
        </WorldWriteError>
        {wardrobeGallery && <div className="mb-4" data-testid="wardrobe-view-tabs"><TabStrip label="衣柜视图" activeId={previewWardrobeView} onSelect={(id) => { setPreviewWardrobeView(id); if (id !== 'wearing') setCategory(id) }} items={[
          { id: 'wearing', label: '正在穿着' }, { id: 'all', label: '全部', separatorBefore: true },
          ...Object.entries(slotLabels).map(([id, label]) => ({ id, label })),
        ]} /></div>}
        {wardrobeGallery && <WorldWriteError message={changeError} />}
        {tab === 'wardrobe' && (!wardrobeGallery || previewWardrobeView === 'wearing') ? (
          <section className="mb-5">
            {!wardrobeGallery && <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--companion-accent-warm)' }}>{wardrobeGallery ? '正在穿着' : '穿着中'}</div>
            </div>}
            {wearing ? (
              <div className={wardrobeGallery ? 'py-2' : 'companion-life-card rounded-xl border p-4'} data-testid="world-wardrobe-wearing" style={wardrobeGallery ? undefined : { borderColor: 'var(--companion-accent-warm)', background: 'var(--card-bg)', boxShadow: 'var(--companion-shadow-card)' }}>
                <div className={wardrobeGallery ? 'flex min-w-0 flex-col items-center gap-4' : 'flex items-start gap-3'}>
                  {wardrobeGallery
                    ? <div className="aspect-[3/4] w-full max-w-60 overflow-hidden rounded-[var(--radius-md)]" data-testid="wardrobe-outfit-image" style={{ background: 'var(--bg-secondary)' }}>
                      {outfitImageSrc
                        ? <ImagePreviewImage src={outfitImageSrc} alt="当前穿搭全身图" className="block aspect-[3/4] w-full object-contain" buttonClassName="h-full w-full" />
                        : <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-[12px]" role="status" style={{ color: 'var(--text-muted)' }}>
                          <Shirt size={22} />
                          <span>{outfitImageStatus === 'pending' ? '正在生成穿搭图片' : outfitImageStatus === 'failed' ? '穿搭图片生成失败，当前穿着已保留' : '暂无当前穿搭图片'}</span>
                        </div>}
                    </div>
                    : isPreview && wearing.payload.playgroundImageSrc
                    ? <ImagePreviewImage src={String(wearing.payload.playgroundImageSrc)} alt={`${wearing.name}的穿着参考图`} className={wardrobeGallery ? 'block aspect-[3/4] max-h-80 w-full rounded-[var(--radius-md)] object-contain' : 'h-24 w-24 shrink-0 rounded-[var(--radius-md)] object-cover'} buttonClassName={wardrobeGallery ? 'w-full' : ''} />
                    : <div className={`flex shrink-0 items-center justify-center rounded-xl ${wardrobeGallery ? 'aspect-[3/4] max-h-80 w-full' : 'h-14 w-14'}`} style={{ background: 'var(--companion-catchup-bg)', color: 'var(--companion-accent-warm)' }}><Sparkles size={22} /></div>}
                  <div className={wardrobeGallery ? 'w-full min-w-0 max-w-2xl' : 'min-w-0 flex-1'}>
                    {!wardrobeGallery && <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{wearing.name}</div>}
                    {wearingHint ? <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{wearingHint}</div> : null}
                    {wardrobeGallery && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="wardrobe-current-slots">
                      {Object.entries(slotLabels).map(([slot, label]) => {
                        const current = items.find((asset) => asset.id === previewSlots[slot])
                        return <div key={slot} className="flex min-h-12 min-w-0 flex-col gap-1 text-[12px]">
                          <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                          <span className="min-w-0 truncate" title={current?.name} style={{ color: 'var(--text-primary)' }}>{current?.name ?? '未选择'}</span>
                        </div>
                      })}
                    </div>}
                    {!wardrobeGallery && <div className="mt-2 flex flex-wrap gap-1.5">
                      {occasionTags(wearing.payload).map((tag) => (
                        <span key={tag} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--companion-catchup-bg)', color: 'var(--companion-accent-warm)' }}>{tag}</span>
                      ))}
                    </div>}
                    {editingId === wearing.id
                      ? <WorldAssetForm draft={editDraft} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel="保存衣物" />
                      : canEdit ? <WorldAssetActions name={wearing.name} disabled={busy} onGenerate={onGenerateAssetImage ? () => onGenerateAssetImage(wearing) : undefined} onEdit={() => startEdit(wearing)} onDelete={() => setPendingDelete(wearing)} /> : null}
                  </div>
                </div>
                {!isPreview && <AssetImage asset={wearing} />}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-5 text-center text-[12px]" data-testid="world-wardrobe-wearing-empty" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                还没有近期穿着记录。
              </div>
            )}
          </section>
        ) : tab === 'bookshelf' ? (
          <section className="mb-4">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>收藏的书与阅读笔记。</p>
          </section>
        ) : null}

        {(!wardrobeGallery || previewWardrobeView !== 'wearing') && <section data-testid="world-assets-inventory">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {tab === 'bookshelf' ? '藏书' : '库存'}{tabItems.length ? ` · ${tabItems.length}` : ''}
          </div>
          {tabItems.length === 0 && !loading ? (
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>{tab === 'bookshelf' ? '书架还是空的。' : '衣柜还是空的。'}</p>
          ) : (
            <div className={wardrobeGallery ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-2.5'} style={wardrobeGallery ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}>
              {visibleItems.map((asset) => (
                <div key={asset.id} className={`companion-life-card rounded-xl border ${wardrobeGallery ? 'p-3.5' : 'px-3 py-3'}`} style={{ borderColor: editingId === asset.id ? 'var(--companion-accent-warm)' : 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--companion-shadow-card)' }}>
                  {isPreview && <PreviewAssetImage asset={asset} gallery={wardrobeGallery} />}
                  {!isPreview && <AssetImage asset={asset} />}
                  {(!wardrobeGallery || typeof asset.payload.playgroundImageSrc !== 'string' || !asset.payload.playgroundImageSrc) && <div className={`${wardrobeGallery ? 'mb-3 aspect-[3/4] w-full' : 'mb-2 h-9 w-9'} flex items-center justify-center rounded-lg`} style={{ background: 'var(--bg-secondary)' }}>
                    {wardrobeGallery && <span className="mr-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{asset.payload.previewImageState === 'pending' ? '生成中' : asset.payload.previewImageState === 'failed' ? '生成失败' : '暂无图片'}</span>}
                    <KindIcon size={wardrobeGallery ? 22 : 16} style={{ color: 'var(--text-secondary)' }} />
                  </div>}
                  <div className={`${wardrobeGallery ? 'line-clamp-2 min-h-10' : 'truncate'} text-[13px] font-medium`} style={{ color: 'var(--text-primary)' }} title={asset.name}>{asset.name}</div>
                  {wardrobeGallery && <div className="mt-2 h-8"><ActionButton className="h-8 w-24" aria-label={`换上 ${asset.name}`} disabled={changingId !== null || previewSlots[String(asset.payload.category)] === asset.id} onClick={() => changePreview(asset)}>
                    {changingId === asset.id ? '换上中' : previewSlots[String(asset.payload.category)] === asset.id ? '正在穿着' : '换上'}
                  </ActionButton></div>}
                  {!wardrobeGallery && <div className="mt-1.5 flex flex-wrap gap-1">
                    {occasionTags(asset.payload).map((tag) => (
                      <span key={tag} className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{tag}</span>
                    ))}
                  </div>}
                  {editingId === asset.id
                    ? <WorldAssetForm draft={editDraft} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel={tab === 'bookshelf' ? '保存书目' : '保存衣物'} />
                    : canEdit ? <WorldAssetActions name={asset.name} disabled={busy} onGenerate={onGenerateAssetImage ? () => onGenerateAssetImage(asset) : undefined} onEdit={() => startEdit(asset)} onDelete={() => setPendingDelete(asset)} /> : null}
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <WorldAssetAddRow
              open={adding}
              label={tab === 'bookshelf' ? '书目' : '衣物'}
              draft={addDraft}
              busy={busy}
              onOpen={() => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft: drafts[tab]?.draft ?? emptyWorldAssetDraft(tab) } }))}
              onChange={(draft) => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft } }))}
              onSave={() => void saveAdd()}
              onCancel={() => { if (!busy) setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: drafts[tab]?.draft ?? emptyWorldAssetDraft(tab) } })) }}
            />
          )}
        </section>}
      </div>
    </fieldset>
  )
}
