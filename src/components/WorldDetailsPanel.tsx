import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { IconButton } from './foundation/IconButton'
import { ErrorState } from './foundation/ErrorState'
import { LAYOUT_CLASSES } from '../shared/content-layout'
import { WorldCultureContent, WorldHomeContent, WorldFootprintsContent, type LivingAsset, type LivingAssetImageReader, type LivingAssetImageRevealer } from './world/WorldLivingContent'
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

type WorldDetailTab = 'culture' | 'home' | 'footprints'

interface WorldDetailsPanelProps {
  tab: WorldDetailTab
  onGenerateAssetImage?: (asset: WorldAssetRecord) => void
  previewAssets?: WorldAssetRecord[]
  previewMoments?: Array<{ text: string; publishedAt: number; meta: Record<string, unknown> }>
  previewPresence?: string
  previewRoleName?: string
  previewEditable?: boolean
  /** 正式人物世界只浏览；独立资产面板可保留维护能力。 */
  allowAssetEditing?: boolean
  showDetailTitle?: boolean
  /** 人物世界列表不提供手工新增；独立资产面板保留原维护入口。 */
  showAddControls?: boolean
}

interface WorldDetailsState {
  roleId: string
  roleName: string
  presence: string
  moments: Array<{ text: string; publishedAt: number; meta: Record<string, unknown> }>
  assets: WorldAssetRecord[]
}

const ADD_KIND: Record<WorldDetailTab, WorldAssetKind> = {
  culture: 'culture',
  home: 'furniture',
  footprints: 'footprint',
}

const ADD_LABEL: Record<WorldDetailTab, string> = {
  culture: '文化记录',
  home: '生活物件',
  footprints: '旅行',
}

/**
 * 背景：人物世界的文化角、家居和足迹入口已在 Playground 验收；文化角需要真实的多类型生活资产，不能继续只读书架映射。
 * 设计意图：三面复用 companion_assets 的角色隔离链，足迹只展示已出发旅行，不从日常动态推断。
 * 关键约束：正式读取完成后复核活跃角色及逐条归属；样张只在显式 preview 中使用，删空不补造资料。
 */
export function WorldDetailsPanel({
  tab,
  onGenerateAssetImage,
  previewAssets,
  previewMoments,
  previewPresence = '',
  previewRoleName = '',
  previewEditable = false,
  allowAssetEditing = true,
  showDetailTitle = true,
  showAddControls = true,
}: WorldDetailsPanelProps) {
  const isPreview = previewAssets !== undefined
  const canEdit = allowAssetEditing && (!isPreview || previewEditable)
  const [state, setState] = useState<WorldDetailsState | null>(isPreview ? {
    roleId: 'preview',
    roleName: previewRoleName,
    presence: previewPresence,
    moments: previewMoments ?? [],
    assets: previewAssets ?? [],
  } : null)
  const [error, setError] = useState('')
  const [writeError, setWriteError] = useState('')
  const [loading, setLoading] = useState(!isPreview)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<WorldAssetDraft>(emptyWorldAssetDraft(ADD_KIND[tab]))
  const [addDrafts, setAddDrafts] = useState<Partial<Record<WorldDetailTab, { open: boolean; draft: WorldAssetDraft }>>>({})
  const [pendingDelete, setPendingDelete] = useState<WorldAssetRecord | null>(null)
  const requestId = useRef(0)
  const writing = useRef(false)
  const writeEpoch = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const adding = addDrafts[tab]?.open ?? false
  const addDraft = addDrafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab])

  const readImage = useCallback<LivingAssetImageReader>(async (assetId, imageId) => {
    if (isPreview || !window.electronAPI?.companion?.readAssetImage) return { ok: false, error: '样张图片不读取本地文件。' }
    return window.electronAPI.companion.readAssetImage(assetId, imageId)
  }, [isPreview])
  const revealImage = useCallback<LivingAssetImageRevealer>(async (assetId, imageId) => {
    if (isPreview || !window.electronAPI?.companion?.revealAssetImage) return { ok: false, error: '样张图片不能定位本地文件。' }
    return window.electronAPI.companion.revealAssetImage(assetId, imageId)
  }, [isPreview])

  const load = useCallback(async () => {
    if (isPreview) {
      setState({
        roleId: 'preview',
        roleName: previewRoleName,
        presence: previewPresence,
        moments: previewMoments ?? [],
        assets: previewAssets ?? [],
      })
      return
    }
    const currentRequest = ++requestId.current
    if (!window.electronAPI?.companion) {
      setError('生活面需要桌面连接，请重新打开应用后重试。')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [active, presence, moments, assets] = await Promise.all([
        window.electronAPI.companion.getActive(),
        window.electronAPI.companion.catchupStatus(),
        window.electronAPI.companion.getMoments({ limit: 50 }),
        window.electronAPI.companion.getAssets(),
      ])
      const confirmed = await window.electronAPI.companion.getActive()
      if (requestId.current !== currentRequest || !mounted.current) return
      if (confirmed.id !== active.id || [presence.roleId, moments.roleId, assets.roleId].some((roleId) => roleId !== active.id)) {
        setState(null)
        throw new Error('ROLE_CHANGED')
      }
      setState({ roleId: active.id, roleName: active.name, presence: presence.presence, moments: moments.items.filter(item => item.roleId === active.id), assets: assets.items.filter(item => item.roleId === active.id) })
    } catch {
      if (requestId.current === currentRequest && mounted.current) setError('生活面暂时无法加载，请重试。')
    } finally {
      if (requestId.current === currentRequest && mounted.current) setLoading(false)
    }
  }, [isPreview, previewAssets, previewMoments, previewPresence, previewRoleName])

  useEffect(() => { void load(); return () => { requestId.current++ } }, [load])

  useEffect(() => {
    if (isPreview || !window.electronAPI?.companion.onRoleChanged) return
    // 页面在切角通知后仍可能保持挂载；清空旧主角草稿，而非把它带到新资产链。
    // load 立即递增请求序号，旧读取不得发布结果；预览不订阅生产通知。
    return window.electronAPI.companion.onRoleChanged(() => {
      // 切角不取消已发出的写入；更换代次隔离旧响应，新角色可独立操作。
      // 旧请求不得清草稿、发布错误或释放新角色的写入锁。
      writeEpoch.current++
      writing.current = false
      setBusy(false)
      setState(null)
      setEditingId(null)
      setPendingDelete(null)
      setAddDrafts({})
      setWriteError('')
      void load()
    })
  }, [isPreview, load])

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
    setEditDraft(draftFromAsset(asset, !isPreview && tab === 'home' ? 'home-gallery' : !isPreview && tab === 'footprints' ? 'travel-gallery' : !isPreview && tab === 'culture' ? 'culture-gallery' : undefined))
  }

  const saveEdit = async () => {
    if (!editingId || !editDraft.name.trim() || writing.current) return
    if (isPreview) {
      setState((current) => current ? {
        ...current,
        assets: current.assets.map((asset) => asset.id === editingId ? { ...asset, name: editDraft.name.trim(), payload: payloadFromDraft(editDraft) } : asset),
      } : current)
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
      setState((current) => current ? {
        ...current,
        assets: [...current.assets, {
          id: `preview-${crypto.randomUUID()}`,
          roleId: 'preview',
          kind: addDraft.kind,
          name: addDraft.name.trim(),
          payload: payloadFromDraft(addDraft),
          acquiredAt: now,
          sourceEventId: null,
        }],
      } : current)
      setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: emptyWorldAssetDraft(ADD_KIND[tab]) } }))
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.createAsset({
        roleId: state?.roleId ?? '',
        kind: addDraft.kind,
        name: addDraft.name,
        payload: payloadFromDraft(addDraft),
      })
      if (!result.ok) throw new Error(result.error || '添加失败')
      if (!isCurrent()) return
      setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: emptyWorldAssetDraft(ADD_KIND[tab]) } }))
    }, '未添加，内容仍保留。请重试。')
  }

  const removeAsset = async (asset: WorldAssetRecord) => {
    if (writing.current) return
    if (isPreview) {
      setState((current) => current ? { ...current, assets: current.assets.filter((item) => item.id !== asset.id) } : current)
      if (editingId === asset.id) setEditingId(null)
      setPendingDelete(null)
      return
    }
    await mutate(async (isCurrent) => {
      const result = await window.electronAPI!.companion.deleteAsset(asset.id)
      if (!result.ok) throw new Error(result.error || '删除失败')
      if (!isCurrent()) return
      if (editingId === asset.id) setEditingId(null)
      setPendingDelete(null)
    }, '未删除，请重试或取消。')
  }

  const renderEditor = (asset: LivingAsset) => {
    if (!canEdit) return null
    if (editingId === asset.id) {
      return <WorldAssetForm draft={editDraft} assets={state?.assets.filter(item => item.roleId === state.roleId)} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel={`保存${ADD_LABEL[tab]}`} />
    }
    const record = state?.assets.find((item) => item.id === asset.id)
    if (!record) return null
    return <WorldAssetActions name={record.name} disabled={busy} onGenerate={onGenerateAssetImage ? () => onGenerateAssetImage(record) : undefined} onEdit={() => startEdit(record)} onDelete={() => setPendingDelete(record)} />
  }

  if (loading && !state) return <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>正在整理生活面…</div>
  const readFailure = error && <ErrorState title={`${tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}未能读取`} description={error} action={<ActionButton disabled={loading} onClick={() => void load()}>重试生活面</ActionButton>} />
  if (error && !state) return <div className={`${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`}>{readFailure}</div>
  if (!state) return null

  return <fieldset disabled={busy} aria-busy={busy || loading} className="m-0 flex h-full min-h-0 min-w-0 flex-col border-0 p-0" data-testid="world-details">
    {showDetailTitle && !error && (
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
        {showDetailTitle ? (
          <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.roleName}的{tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}</div>
        ) : null}
      </div>
    )}
    {error && <div className={`${LAYOUT_CLASSES.gutter} ${LAYOUT_CLASSES.block}`}>{readFailure}</div>}
    {pendingDelete && <WorldAssetDeleteConfirm asset={pendingDelete} busy={busy} onCancel={() => { if (!busy) setPendingDelete(null) }} onConfirm={() => { const target = pendingDelete; if (target) void removeAsset(target) }} />}
    <WorldWriteError message={writeError}>{!isPreview && <ActionButton onClick={() => void load()} disabled={loading}>重新读取</ActionButton>}</WorldWriteError>
    {tab === 'culture' && <WorldCultureContent assets={state.assets} renderEditor={renderEditor} readImage={isPreview ? undefined : readImage} revealImage={isPreview ? undefined : revealImage} showPreviewImages={isPreview} presentation={isPreview ? 'default' : 'culture-gallery'} toolbarAction={!isPreview && <IconButton label="刷新生活面" size={32} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton>} />}
    {tab === 'home' && <WorldHomeContent assets={state.assets} roleId={state.roleId} presence={state.presence} renderEditor={renderEditor} readImage={isPreview ? undefined : readImage} revealImage={isPreview ? undefined : revealImage} showPreviewImages={isPreview} presentation={isPreview ? 'default' : 'home-gallery'} toolbarAction={!isPreview && <IconButton label="刷新生活面" size={32} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton>} />}
    {tab === 'footprints' && <WorldFootprintsContent assets={state.assets} roleId={state.roleId} moments={state.moments} renderEditor={renderEditor} readImage={isPreview ? undefined : readImage} revealImage={isPreview ? undefined : revealImage} showPreviewImages={isPreview} variant={isPreview ? 'alice' : 'travel-gallery'} toolbarAction={!isPreview && <IconButton label="刷新生活面" size={32} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton>} />}
    {canEdit && showAddControls && (
      <div className="shrink-0 px-4 pb-4">
      {tab === 'home' && !isPreview && !adding && <div className="flex flex-wrap gap-2">
        {(['residence', 'space'] as const).map(type => <ActionButton key={type} disabled={busy} onClick={() => setAddDrafts(drafts => ({ ...drafts, home: { open: true, draft: { ...emptyWorldAssetDraft('home'), presentation: 'home-gallery', payload: { recordType: type } } } }))}>添加{type === 'space' ? '空间' : '住所'}</ActionButton>)}
      </div>}
      <WorldAssetAddRow
        open={adding}
        label={tab === 'home' && addDraft.kind === 'home' ? addDraft.payload.recordType === 'space' ? '空间' : '住所' : ADD_LABEL[tab]}
        assets={state.assets.filter(item => item.roleId === state.roleId)}
        draft={addDraft}
        busy={busy}
        onOpen={() => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft: tab === 'home' && !isPreview ? { ...emptyWorldAssetDraft('furniture'), presentation: 'home-gallery' } : tab === 'footprints' && !isPreview ? { kind: 'footprint', name: '', presentation: 'travel-gallery', payload: { status: 'completed' }, stops: [] } : tab === 'culture' && !isPreview ? { ...emptyWorldAssetDraft('culture'), presentation: 'culture-gallery', readingNotes: [] } : drafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab]) } }))}
        onChange={(draft) => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft } }))}
        onSave={() => void saveAdd()}
        onCancel={() => { if (!busy) setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: drafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab]) } })) }}
      />
      </div>
    )}
  </fieldset>
}
