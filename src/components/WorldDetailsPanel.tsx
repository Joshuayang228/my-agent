import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { ActionButton } from './foundation/ActionButton'
import { IconButton } from './foundation/IconButton'
import { WorldCultureContent, WorldHomeContent, WorldFootprintsContent, type LivingAsset } from './world/WorldLivingContent'
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
  previewAssets?: WorldAssetRecord[]
  previewMoments?: Array<{ text: string; publishedAt: number; meta: Record<string, unknown> }>
  previewPresence?: string
  previewRoleName?: string
  previewEditable?: boolean
}

interface WorldDetailsState {
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
  footprints: '地点',
}

/**
 * 背景：人物世界的文化角、家居和足迹入口已在 Playground 验收；文化角需要真实的多类型生活资产，不能继续只读书架映射。
 * 设计意图：文化角、家居和足迹都复用 companion_assets 的 role_id 隔离资产链路；生活动态只补充足迹的近期发生记录。
 * 关键约束：三类资产必须由真实 IPC 返回；住所与常去地点只初始化一次，不因用户删空而重新制造。
 */
export function WorldDetailsPanel({
  tab,
  previewAssets,
  previewMoments,
  previewPresence = '',
  previewRoleName = '',
  previewEditable = false,
}: WorldDetailsPanelProps) {
  const isPreview = previewAssets !== undefined
  const canEdit = !isPreview || previewEditable
  const [state, setState] = useState<WorldDetailsState | null>(isPreview ? {
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
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const adding = addDrafts[tab]?.open ?? false
  const addDraft = addDrafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab])

  const load = useCallback(async () => {
    if (isPreview) {
      setState({
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
      if (requestId.current !== currentRequest || !mounted.current) return
      if ([presence.roleId, moments.roleId, assets.roleId].some((roleId) => roleId !== active.id)) {
        setState(null)
        throw new Error('ROLE_CHANGED')
      }
      setState({ roleName: active.name, presence: presence.presence, moments: moments.items, assets: assets.items })
    } catch {
      if (requestId.current === currentRequest && mounted.current) setError('生活面暂时无法加载，请重试。')
    } finally {
      if (requestId.current === currentRequest && mounted.current) setLoading(false)
    }
  }, [isPreview, previewAssets, previewMoments, previewPresence, previewRoleName])

  useEffect(() => { void load(); return () => { requestId.current++ } }, [load])

  const mutate = async (action: () => Promise<void>, message: string) => {
    if (writing.current || !mounted.current) return
    writing.current = true
    setBusy(true)
    setWriteError('')
    try {
      await action()
      if (mounted.current && !isPreview) await load()
    } catch {
      if (mounted.current) setWriteError(message)
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
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
      setState((current) => current ? {
        ...current,
        assets: current.assets.map((asset) => asset.id === editingId ? { ...asset, name: editDraft.name.trim(), payload: payloadFromDraft(editDraft) } : asset),
      } : current)
      setEditingId(null)
      return
    }
    await mutate(async () => {
      const result = await window.electronAPI!.companion.updateAsset(editingId, {
        name: editDraft.name,
        payload: payloadFromDraft(editDraft),
      })
      if (!result.ok) throw new Error(result.error || '保存失败')
      if (!mounted.current) return
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
    await mutate(async () => {
      const result = await window.electronAPI!.companion.createAsset({
        kind: addDraft.kind,
        name: addDraft.name,
        payload: payloadFromDraft(addDraft),
      })
      if (!result.ok) throw new Error(result.error || '添加失败')
      if (!mounted.current) return
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
    await mutate(async () => {
      const result = await window.electronAPI!.companion.deleteAsset(asset.id)
      if (!result.ok) throw new Error(result.error || '删除失败')
      if (!mounted.current) return
      if (editingId === asset.id) setEditingId(null)
      setPendingDelete(null)
    }, '未删除，请重试或取消。')
  }

  const renderEditor = (asset: LivingAsset) => {
    if (!canEdit) return null
    if (editingId === asset.id) {
      return <WorldAssetForm draft={editDraft} onChange={setEditDraft} onSave={() => void saveEdit()} onCancel={() => { if (!busy) { setEditingId(null); setWriteError('') } }} busy={busy} saveLabel={`保存${ADD_LABEL[tab]}`} />
    }
    const record = state?.assets.find((item) => item.id === asset.id)
    if (!record) return null
    return <WorldAssetActions name={record.name} disabled={busy} onEdit={() => startEdit(record)} onDelete={() => setPendingDelete(record)} />
  }

  if (loading && !state) return <div className="p-5 text-xs" style={{ color: 'var(--text-muted)' }}>正在整理生活面…</div>
  if (error && !state) return <div role="alert" className="flex items-center gap-2 p-5 text-xs" style={{ color: 'var(--danger)' }}><span>{error}</span><IconButton label="重试生活面" size={32} onClick={() => void load()}><RefreshCw size={14} /></IconButton></div>
  if (!state) return null

  return <fieldset disabled={busy} aria-busy={busy || loading} className="m-0 min-w-0 space-y-3 border-0 p-5" data-testid="world-details">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{state.roleName}的{tab === 'culture' ? '文化角' : tab === 'home' ? '家居' : '足迹'}</div>
      {!isPreview && <IconButton label={error ? '重试生活面' : '刷新生活面'} size={32} onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : undefined} /></IconButton>}
    </div>
    {error && <p role="alert" className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</p>}
    {pendingDelete && <WorldAssetDeleteConfirm asset={pendingDelete} busy={busy} onCancel={() => { if (!busy) setPendingDelete(null) }} onConfirm={() => { const target = pendingDelete; if (target) void removeAsset(target) }} />}
    <WorldWriteError message={writeError}>{!isPreview && <ActionButton onClick={() => void load()} disabled={loading}>重新读取</ActionButton>}</WorldWriteError>
    {tab === 'culture' && <WorldCultureContent assets={state.assets} renderEditor={renderEditor} />}
    {tab === 'home' && <WorldHomeContent assets={state.assets} presence={state.presence} renderEditor={renderEditor} />}
    {tab === 'footprints' && <WorldFootprintsContent assets={state.assets} moments={state.moments} renderEditor={renderEditor} />}
    {canEdit && (
      <WorldAssetAddRow
        open={adding}
        label={ADD_LABEL[tab]}
        draft={addDraft}
        busy={busy}
        onOpen={() => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft: drafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab]) } }))}
        onChange={(draft) => setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: true, draft } }))}
        onSave={() => void saveAdd()}
        onCancel={() => { if (!busy) setAddDrafts((drafts) => ({ ...drafts, [tab]: { open: false, draft: drafts[tab]?.draft ?? emptyWorldAssetDraft(ADD_KIND[tab]) } })) }}
      />
    )}
  </fieldset>
}
