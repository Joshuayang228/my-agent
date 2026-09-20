/**
 * 活跃主角物什（生活面）：衣柜 + 书架分栏；编辑 / 删除 / 新增。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, RefreshCw, Shirt, Sparkles, X } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { IconButton } from './foundation/IconButton'
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

type AssetTab = 'wardrobe' | 'bookshelf'

interface AssetsPanelProps {
  onClose: () => void
  previewAssets?: WorldAssetRecord[]
  previewEditable?: boolean
  previewRoleName?: string
  previewWearingId?: string
}

function occasionTags(payload: Record<string, unknown>): string[] {
  const tags: string[] = []
  for (const key of ['style', 'occasion', 'color', 'genre', 'author', 'note']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) tags.push(value.trim())
  }
  return tags.slice(0, 4)
}

export function AssetsPanel({ onClose, previewAssets, previewEditable = false, previewRoleName = '', previewWearingId }: AssetsPanelProps) {
  const isPreview = previewAssets !== undefined
  const canEdit = !isPreview || previewEditable
  const [roleId, setRoleId] = useState('')
  const [roleName, setRoleName] = useState(previewRoleName)
  const [items, setItems] = useState<WorldAssetRecord[]>(previewAssets ?? [])
  const [tab, setTab] = useState<AssetTab>('wardrobe')
  const [wearingId, setWearingId] = useState<string | null>(null)
  const [wearingHint, setWearingHint] = useState('')
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
    return () => { mounted.current = false; requestId.current++ }
  }, [])

  const adding = addDrafts[tab]?.open ?? false
  const addDraft = addDrafts[tab]?.draft ?? emptyWorldAssetDraft(tab)

  const load = useCallback(async () => {
    // 切角和刷新可能交错返回；只发布最新读取，避免旧角色覆盖当前衣柜。
    // 请求序号也约束失败与收尾，卸载后不得重新发布状态。
    const currentRequest = ++requestId.current
    if (isPreview) {
      setItems(previewAssets ?? [])
      setRoleName(previewRoleName)
      setWearingId(previewWearingId ?? null)
      setWearingHint('')
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
        setRoleName('')
        setWearingId(null)
        setWearingHint('')
        setEditingId(null)
        setPendingDelete(null)
        setAddDrafts({})
        throw new Error('ROLE_CHANGED')
      }
      setRoleId(assets.roleId)
      setRoleName(active.name)
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
  }, [isPreview, previewAssets, previewRoleName, previewWearingId])

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
      setRoleName('')
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
        asset.id === editingId ? { ...asset, name: editDraft.name.trim(), payload: payloadFromDraft(editDraft) } : asset
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
        payload: payloadFromDraft(addDraft),
        acquiredAt: now,
        sourceEventId: null,
      }])
      setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: emptyWorldAssetDraft(tab) } }))
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.createAsset({
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
  const visibleItems = tab === 'wardrobe' && wearing ? inventory : tabItems

  return (
    <fieldset disabled={busy} aria-busy={busy || loading} className="m-0 flex h-full min-h-0 flex-col border-0 p-0" data-testid="world-assets-panel">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <KindIcon size={16} style={{ color: 'var(--companion-accent-warm)' }} />
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>物什</div>
            <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{roleName || roleId || '活跃主角'} · 衣柜 / 书架</div>
          </div>
        </div>
        <div className="flex h-8 items-center gap-1">
          {!isPreview && <IconButton size={32} label={readError ? '重试物什' : '刷新物什'} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton>}
          <IconButton size={32} label="关闭物什" onClick={onClose}><X size={14} /></IconButton>
        </div>
      </div>

      <div className="border-b px-4 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
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
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
        <WorldWriteError message={readError} />
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
        {tab === 'wardrobe' ? (
          <section className="mb-5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--companion-accent-warm)' }}>穿着中</div>
            {wearing ? (
              <div className="companion-life-card rounded-xl border p-4" data-testid="world-wardrobe-wearing" style={{ borderColor: 'var(--companion-accent-warm)', background: 'var(--card-bg)', boxShadow: 'var(--companion-shadow-card)' }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--companion-catchup-bg)', color: 'var(--companion-accent-warm)' }}>
                    <Sparkles size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{wearing.name}</div>
                    {wearingHint ? <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>{wearingHint}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {occasionTags(wearing.payload).map((tag) => (
                        <span key={tag} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: 'var(--companion-catchup-bg)', color: 'var(--companion-accent-warm)' }}>{tag}</span>
                      ))}
                    </div>
                    {editingId === wearing.id
                      ? <WorldAssetForm draft={editDraft} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel="保存衣物" />
                      : canEdit ? <WorldAssetActions name={wearing.name} disabled={busy} onEdit={() => startEdit(wearing)} onDelete={() => setPendingDelete(wearing)} /> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed px-4 py-5 text-center text-[12px]" data-testid="world-wardrobe-wearing-empty" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                暂无近期穿着记录。生活 tick 带上衣柜引用后，会显示在这里。
              </div>
            )}
          </section>
        ) : (
          <section className="mb-4">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>书架是角色拥有的书目真相；叙事里提到的读物应对得上这里的条目。</p>
          </section>
        )}

        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {tab === 'bookshelf' ? '藏书' : '库存'}{tabItems.length ? ` · ${tabItems.length}` : ''}
          </div>
          {tabItems.length === 0 && !loading ? (
            <p className="py-8 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>{tab === 'bookshelf' ? '书架还是空的。' : '衣柜还是空的。'}</p>
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))' }}>
              {visibleItems.map((asset) => (
                <div key={asset.id} className="companion-life-card rounded-xl border px-3 py-3" style={{ borderColor: editingId === asset.id ? 'var(--companion-accent-warm)' : 'var(--card-border)', background: 'var(--card-bg)', boxShadow: 'var(--companion-shadow-card)' }}>
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                    <KindIcon size={16} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="truncate text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{asset.name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {occasionTags(asset.payload).map((tag) => (
                      <span key={tag} className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>{tag}</span>
                    ))}
                  </div>
                  {editingId === asset.id
                    ? <WorldAssetForm draft={editDraft} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel={tab === 'bookshelf' ? '保存书目' : '保存衣物'} />
                    : canEdit ? <WorldAssetActions name={asset.name} disabled={busy} onEdit={() => startEdit(asset)} onDelete={() => setPendingDelete(asset)} /> : null}
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
        </section>
      </div>
    </fieldset>
  )
}
