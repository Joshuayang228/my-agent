import { useEffect, useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type Ref } from 'react'
import { Check, CheckCircle2, Circle, LoaderCircle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { connectionCredentialLabel } from '../../shared/model-connection-form'
import type { LLMModelFetchResult, ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from '../../shared/types'
import { addConnectionModel, enabledConnectionModelIds, normalizeConnectionModels, removeConnectionModel, setConnectionModelEnabled } from '../../shared/llm-model-fetch'
import { ActionButton } from '../foundation/ActionButton'
import { TextField } from '../foundation/TextField'
import { ModelUsageArrangements } from './ModelUsageArrangements'
import { useToast } from '../Toast'
import { SettingCard, SettingRow } from './SettingsFields'
import { ModelConnectionForm } from './ModelConnectionForm'
import { CONNECTION_ADAPTERS, CONNECTION_PRESETS, CONNECTION_SOURCE_OPTIONS, connectionDraftForSource, modelConnectionDraft, sameConnectionEndpoint, validConnectionDraft, type ModelConnectionDraft } from '../../shared/model-connection-form'

const PURPOSES: Array<{ id: ModelRoutePurpose; label: string; description: string }> = [
  { id: 'primary', label: '主对话', description: '聊天和主要 Agent 任务的优先模型。' },
  { id: 'auxiliary', label: '辅助任务', description: '标题、压缩、画像和生活脚本等轻量任务。' },
  { id: 'image', label: '图片理解', description: '需要图片输入时使用的模型入口。' },
]

function parse<T>(raw: string, fallback: T): T { try { return JSON.parse(raw) as T } catch { return fallback } }

function withModels(connection: ModelConnectionProfile): ModelConnectionProfile {
  const models = normalizeConnectionModels(connection)
  return { ...connection, models, model: models[0]?.id ?? connection.model ?? '' }
}

export function ModelRoutingSettings({ connectionsRaw, routesRaw, legacyBaseUrl, legacyModel, onSave, onTestConnection, onFetchModels, beforeLeaveRef }: {
  beforeLeaveRef?: Ref<() => boolean>
  connectionsRaw: string
  routesRaw: string
  legacyBaseUrl: string
  legacyModel: string
  onSave: (connections: string, routes: string) => Promise<void>
  onTestConnection: (connection: ModelConnectionProfile, draftApiKey?: string) => Promise<{ ok: true; model: string; ms: number } | { ok: false; error: string }>
  onFetchModels: (connection: ModelConnectionProfile, draftApiKey?: string) => Promise<LLMModelFetchResult>
}) {
  const legacyConnection = withModels({ id: 'legacy-primary', name: '当前主连接', baseUrl: legacyBaseUrl, model: legacyModel, enabled: true })
  const initialConnections = parse<ModelConnectionProfile[]>(connectionsRaw, []).map(withModels)
  const initialRoutes = parse<ModelRouteProfile[]>(routesRaw, [])
  const [connections, setConnections] = useState<ModelConnectionProfile[]>(() => initialConnections.length > 0 ? initialConnections : [legacyConnection])
  const [routes, setRoutes] = useState<ModelRouteProfile[]>(() => initialRoutes.length > 0 ? initialRoutes : [{ purpose: 'primary', connectionId: legacyConnection.id, model: legacyConnection.model, enabled: true }])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModelConnectionProfile>({ id: '', name: '', baseUrl: '', model: '', apiKey: '', enabled: true, models: [] })
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const mounted = useRef(false)
  const testRequests = useRef(new Map<string, symbol>())
  const fetchRequests = useRef(new Map<string, symbol>())
  const { toast } = useToast()
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; testRequests.current.clear(); fetchRequests.current.clear() }
  }, [])
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [testError, setTestError] = useState<Record<string, string>>({})
  const [fetchState, setFetchState] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error' | 'unsupported'>>({})
  const [fetchError, setFetchError] = useState<Record<string, { message: string; retryable: boolean }>>({})
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({})
  // 背景：连接草稿不在父级自动保存队列；意图：导航先检查，不静默写入半填配置；约束：忙碌时也必须留页，普通防抖保存不调用此检查。
  useImperativeHandle(beforeLeaveRef, () => () => {
    if (saving.current) {
      toast('模型设置正在保存，请稍后再离开。', 'warning')
      return false
    }
    const original = connections.find((item) => item.id === editing)
    const changed = editing !== null && (editing === 'new' || !original
      || JSON.stringify(modelConnectionDraft(draft)) !== JSON.stringify(modelConnectionDraft(original)) || Boolean(draft.apiKey))
    if (changed || connections.some((connection) => modelDrafts[connection.id]?.trim())) {
      toast('模型设置有未保存内容，请先保存、取消编辑或清空模型输入。', 'warning')
      return false
    }
    return true
  }, [connections, draft, editing, modelDrafts, toast])
  // 背景：同 id 可换端点或凭据；意图：保存成功后撤销旧请求和缓存；约束：失败保存及仅改名 / 用途不得误清理结果。
  const invalidateConnectionResults = (id: string, discovery = true) => {
    testRequests.current.delete(id)
    setTestState((current) => ({ ...current, [id]: 'idle' }))
    setTestError((current) => ({ ...current, [id]: '' }))
    if (!discovery) return
    fetchRequests.current.delete(id)
    setFetchState((current) => ({ ...current, [id]: 'idle' }))
    setFetchError((current) => { const next = { ...current }; delete next[id]; return next })
    setFetchedModels((current) => { const next = { ...current }; delete next[id]; return next })
  }
  const available = useMemo(() => connections.flatMap((connection) => connection.enabled
    ? enabledConnectionModelIds(connection).map((model) => ({ connection, value: `${connection.id}::${model}`, model }))
    : []), [connections])

  const persist = async (nextConnections: ModelConnectionProfile[], nextRoutes: ModelRouteProfile[]) => {
    if (saving.current) return false
    saving.current = true
    setBusy(true)
    try {
      await onSave(JSON.stringify(nextConnections), JSON.stringify(nextRoutes))
      if (!mounted.current) return false
      for (const previous of connections) {
        const next = nextConnections.find((item) => item.id === previous.id)
        if (!next || !sameConnectionEndpoint(previous, next) || Boolean(next.apiKey?.trim()) || previous.enabled !== next.enabled) {
          invalidateConnectionResults(previous.id)
        } else if ((enabledConnectionModelIds(previous)[0] || previous.model) !== (enabledConnectionModelIds(next)[0] || next.model)) {
          invalidateConnectionResults(previous.id, false)
        }
      }
      setConnections(nextConnections.map(({ apiKey, ...connection }) => ({
        ...connection, apiKey: '', hasApiKey: Boolean(apiKey?.trim() || connection.hasApiKey),
      })))
      setRoutes(nextRoutes)
      return true
    } catch {
      if (mounted.current) toast('模型设置保存未完成，当前编辑内容已保留，请重试。', 'error')
      return false
    } finally {
      saving.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const openAdd = () => { setEditing('new'); setDraft({ ...connectionDraftForSource('relay'), id: `connection-${crypto.randomUUID()}`, model: '', enabled: true, models: [] }) }
  const openEdit = (connection: ModelConnectionProfile) => { setEditing(connection.id); setDraft({ ...connection, apiKey: '' }) }
  const changeDraft = (value: ModelConnectionDraft) => {
    const saved = connections.find((item) => item.id === draft.id)
    setDraft({ ...draft, ...value, hasApiKey: Boolean(saved?.hasApiKey && sameConnectionEndpoint(saved, value)) })
  }
  const saveDraft = async () => {
    if (!validConnectionDraft({ ...modelConnectionDraft(draft), apiKey: draft.apiKey ?? '' })) return
    const next = editing === 'new'
      ? [...connections, withModels({ ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim() })]
      : connections.map((item) => item.id === draft.id
        ? withModels({
            ...item,
            ...draft,
            name: draft.name.trim(),
            baseUrl: draft.baseUrl.trim(),
          })
        : item)
    if (await persist(next, routes)) {
      setEditing(null)
      setDraft({ id: '', name: '', baseUrl: '', model: '', apiKey: '', enabled: true, models: [] })
    }
  }
  const remove = async (id: string) => {
    const next = connections.filter((item) => item.id !== id)
    const nextRoutes = routes.filter((item) => item.connectionId !== id)
    await persist(next, nextRoutes)
  }
  const persistModels = async (connectionId: string, updater: (connection: ModelConnectionProfile) => ModelConnectionProfile) => {
    const next = connections.map((item) => item.id === connectionId ? withModels(updater(item)) : item)
    const nextRoutes = routes.filter((route) => {
      const connection = next.find((item) => item.id === route.connectionId)
      return Boolean(connection && enabledConnectionModelIds(connection).includes(route.model))
    })
    return persist(next, nextRoutes)
  }
  const testConnection = async (connection: ModelConnectionProfile, draftApiKey?: string) => {
    if (testRequests.current.has(connection.id)) return
    const model = enabledConnectionModelIds(connection)[0] || connection.model
    if (!model) {
      setTestState((current) => ({ ...current, [connection.id]: 'error' }))
      setTestError((current) => ({ ...current, [connection.id]: '请先添加一个模型 ID' }))
      return
    }
    setTestState((current) => ({ ...current, [connection.id]: 'testing' }))
    setTestError((current) => ({ ...current, [connection.id]: '' }))
    const token = Symbol()
    testRequests.current.set(connection.id, token)
    const result = await onTestConnection({ ...connection, model }, draftApiKey)
      .catch(() => ({ ok: false as const, error: '连接测试未完成，请重试' }))
    if (!mounted.current || testRequests.current.get(connection.id) !== token) return
    testRequests.current.delete(connection.id)
    if (result.ok) setTestState((current) => ({ ...current, [connection.id]: 'success' }))
    else {
      setTestState((current) => ({ ...current, [connection.id]: 'error' }))
      setTestError((current) => ({ ...current, [connection.id]: result.error }))
    }
  }
  const fetchModels = async (connection: ModelConnectionProfile, draftApiKey?: string) => {
    if (fetchRequests.current.has(connection.id)) return
    setFetchState((current) => ({ ...current, [connection.id]: 'loading' }))
    setFetchError((current) => { const next = { ...current }; delete next[connection.id]; return next })
    const token = Symbol()
    fetchRequests.current.set(connection.id, token)
    const result = await onFetchModels(connection, draftApiKey)
      .catch(() => ({ ok: false as const, error: '模型列表获取未完成，请重试', reason: 'network' as const, retryable: true }))
    if (!mounted.current || fetchRequests.current.get(connection.id) !== token) return
    fetchRequests.current.delete(connection.id)
    if (result.ok) {
      setFetchedModels((current) => ({ ...current, [connection.id]: result.models }))
      setFetchState((current) => ({ ...current, [connection.id]: 'success' }))
      return
    }
    setFetchState((current) => ({ ...current, [connection.id]: result.reason === 'unsupported' ? 'unsupported' : 'error' }))
    setFetchError((current) => ({ ...current, [connection.id]: { message: result.error, retryable: result.retryable } }))
  }
  const submitModelDraft = async (connection: ModelConnectionProfile) => {
    const modelId = (modelDrafts[connection.id] ?? '').trim()
    if (!modelId || enabledConnectionModelIds(connection).includes(modelId) || normalizeConnectionModels(connection).some((item) => item.id === modelId)) return
    if (await persistModels(connection.id, (item) => ({ ...item, ...addConnectionModel(item, modelId) }))) {
      setModelDrafts((current) => ({ ...current, [connection.id]: '' }))
    }
  }
  const addRoute = async (purpose: ModelRoutePurpose, value: string) => {
    if (!value) return
    const [connectionId, model] = value.split('::')
    if (!connectionId || !model) return
    if (routes.some((item) => item.purpose === purpose && item.connectionId === connectionId && item.model === model)) return
    const next = [...routes, { purpose, connectionId, model, enabled: true }]
    await persist(connections, next)
  }
  const moveRoute = async (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => {
    const current = routes.filter((item) => item.purpose === purpose)
    const target = index + direction
    if (target < 0 || target >= current.length) return
    const nextPurpose = [...current]
    ;[nextPurpose[index], nextPurpose[target]] = [nextPurpose[target], nextPurpose[index]]
    const next = [...routes.filter((item) => item.purpose !== purpose), ...nextPurpose]
    await persist(connections, next)
  }

  const connectionForm = <ModelConnectionForm value={{ ...modelConnectionDraft(draft), apiKey: draft.apiKey ?? '' }}
    editing={editing !== 'new'} busy={busy} hasApiKey={draft.hasApiKey} onChange={changeDraft}
    onCancel={() => { setEditing(null); setDraft({ id: '', name: '', baseUrl: '', model: '', apiKey: '', enabled: true }) }} onSave={() => void saveDraft()} />

  return <fieldset disabled={busy} className="m-0 min-w-0 space-y-4 border-0 p-0" data-testid="settings-model-routing" aria-busy={busy}>
    <ModelUsageArrangements purposes={PURPOSES} routes={routes} disabled={busy}
      options={available.map(({ connection, value, model }) => ({ value, label: `${connection.name} · ${model}` }))}
      routeLabel={route => `${connections.find(item => item.id === route.connectionId)?.name || route.connectionId} · ${route.model}`}
      onAdd={(purpose, value) => { void addRoute(purpose, value) }}
      onMove={(purpose, index, direction) => { void moveRoute(purpose, index, direction) }}
      onToggle={route => { void persist(connections, routes.map(item => item === route ? { ...item, enabled: !item.enabled } : item)) }}
      onRemove={route => { void persist(connections, routes.filter(item => item !== route)) }} />
    <SettingCard>
      <SettingRow label="连接与模型清单" description="连接信息保存在本机；密钥不会回传到界面或写入备份文件。获取到的模型需要点选后才会加入清单。" scope="本机" stacked>
        <div className="space-y-2">
          <div className="flex justify-end"><ActionButton size="sm" onClick={openAdd} disabled={busy || editing !== null}><Plus size={13} />添加连接</ActionButton></div>
          {connections.map((connection) => {
            const credentialLabel = connectionCredentialLabel(connection)
            const models = normalizeConnectionModels(connection)
            const draftModel = modelDrafts[connection.id] ?? ''
            const duplicate = models.some((item) => item.id === draftModel.trim())
            const currentFetch = fetchState[connection.id] ?? 'idle'
            const currentFetched = fetchedModels[connection.id] ?? []
            const editingThis = editing === connection.id
            return <div key={connection.id} className="min-w-0 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`settings-model-profile-${connection.id}`}>
              {editingThis ? <div className="p-3">{connectionForm}</div> : <>
                <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{connection.name}<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{connection.enabled ? '已启用' : '已停用'}</span></div>
                    <div className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{CONNECTION_SOURCE_OPTIONS.find((item) => item.id === connection.source)?.label ?? '自定义连接'} · {CONNECTION_PRESETS.find((item) => item.providerId === connection.presetId)?.label ?? CONNECTION_ADAPTERS.find((item) => item.provider === connection.provider)?.label ?? '自动识别'} · {models.length} 个模型</div>
                  </div>
                  {testState[connection.id] === 'success' && <div role="status" className="shrink-0 text-[10px]" style={{ color: 'var(--success)' }}><CheckCircle2 size={12} /></div>}
                  {testState[connection.id] === 'error' && <ActionButton size="sm" className="min-h-7" onClick={() => void testConnection(connection)}>重试</ActionButton>}
                  <ActionButton size="sm" onClick={() => void fetchModels(connection)} disabled={busy || currentFetch === 'loading'} aria-label={currentFetch === 'loading' ? `正在获取 ${connection.name} 的模型` : `获取 ${connection.name} 已有模型`} data-testid={`settings-fetch-models-${connection.id}`}>{currentFetch === 'loading' ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}{currentFetch === 'loading' ? '正在获取…' : '获取已有模型'}</ActionButton>
                  <ActionButton size="sm" onClick={() => void testConnection(connection)} disabled={busy || testState[connection.id] === 'testing'} aria-label={testState[connection.id] === 'testing' ? `正在测试 ${connection.name}` : `测试连接 ${connection.name}`}>{testState[connection.id] === 'testing' ? <LoaderCircle size={13} className="animate-spin" /> : testState[connection.id] === 'success' ? <RefreshCw size={13} /> : '测试连接'}</ActionButton>
                  <ActionButton size="sm" onClick={() => openEdit(connection)} disabled={busy}>编辑</ActionButton>
                  <ActionButton size="sm" onClick={() => void remove(connection.id)} disabled={busy} aria-label={`删除 ${connection.name}`}><Trash2 size={13} /></ActionButton>
                </div>
                <div className="border-t px-3 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="grid gap-2 text-[10px] sm:grid-cols-3">
                    <div className="min-w-0"><span style={{ color: 'var(--text-muted)' }}>Base URL</span><div className="mt-1 truncate font-mono" title={connection.baseUrl} style={{ color: 'var(--text-secondary)' }}>{connection.baseUrl}</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>密钥状态</span><div className="mt-1 font-medium" style={{ color: connection.hasApiKey ? 'var(--success)' : credentialLabel === '未配置' ? 'var(--danger)' : 'var(--text-secondary)' }}>{credentialLabel}</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>测试状态</span><div className="mt-1" style={{ color: testState[connection.id] === 'success' ? 'var(--success)' : testState[connection.id] === 'error' ? 'var(--danger)' : 'var(--text-muted)' }}>{testState[connection.id] === 'success' ? '连接测试通过' : testState[connection.id] === 'error' ? (testError[connection.id] || '连接测试失败') : '尚未测试'}</div></div>
                  </div>
                  <div className="mt-4 text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>模型清单 · {models.length} 个</div>
                  <div className="mt-3 space-y-2">
                    {models.length === 0 && <div className="rounded-[var(--radius-sm)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>这个连接还没有添加模型。</div>}
                    {models.map((model) => <div key={model.id} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                      <span className="min-w-0 flex-1 truncate font-mono text-[11px]" title={model.id} style={{ color: 'var(--text-primary)' }}>{model.id}</span>
                      <ActionButton size="sm" className="min-h-7 w-7 px-0" role="switch" aria-checked={model.enabled} aria-label={`${model.id}${model.enabled ? '已启用' : '未启用'}`} onClick={() => void persistModels(connection.id, (item) => ({ ...item, ...setConnectionModelEnabled(item, model.id, !model.enabled) }))}>{model.enabled ? <Check size={14} /> : <Circle size={12} />}</ActionButton>
                      <ActionButton size="sm" className="min-h-7 w-7 px-0" aria-label={`移除模型 ${model.id}`} onClick={() => void persistModels(connection.id, (item) => ({ ...item, ...removeConnectionModel(item, model.id) }))}><Trash2 size={12} /></ActionButton>
                    </div>)}
                  </div>
                  <div className="mt-3 flex min-w-0 items-center gap-2">
                    <TextField aria-label={`手动添加模型 ${connection.name}`} value={draftModel} onChange={(event: ChangeEvent<HTMLInputElement>) => setModelDrafts((current) => ({ ...current, [connection.id]: event.target.value }))} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submitModelDraft(connection) } }} placeholder="填写模型 ID" className="theme-input h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2.5 text-[10px] outline-none" />
                    <ActionButton size="sm" className="h-8 w-8 min-h-0 px-0" aria-label="手动添加模型" disabled={!draftModel.trim() || duplicate} onClick={() => void submitModelDraft(connection)}><Plus size={14} /></ActionButton>
                  </div>
                  {duplicate && <div className="mt-2 text-[10px]" role="status" style={{ color: 'var(--text-muted)' }}>这个模型已在清单中。</div>}
                  {currentFetch === 'success' && currentFetched.length > 0 && <div className="mt-3 space-y-2" data-testid={`settings-fetched-models-${connection.id}`}><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>获取到的模型 · 点击加入清单</div><div className="flex flex-wrap gap-1.5">{currentFetched.map((modelId) => { const alreadyAdded = models.some((model) => model.id === modelId); return <ActionButton key={modelId} size="sm" disabled={alreadyAdded} onClick={() => void persistModels(connection.id, (item) => ({ ...item, ...addConnectionModel(item, modelId) }))}><span className="max-w-[16rem] truncate" title={modelId}>{modelId}</span>{alreadyAdded ? <Check size={12} /> : <Plus size={12} />}</ActionButton> })}</div></div>}
                  {currentFetch === 'success' && currentFetched.length === 0 && <div className="mt-2 text-[10px]" role="status" style={{ color: 'var(--text-muted)' }}>没有获取到模型，可手动添加模型 ID。</div>}
                  {currentFetch === 'unsupported' && <div role="status" className="mt-3 rounded-[var(--radius-sm)] px-3 py-2 text-[10px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{fetchError[connection.id]?.message || '这个连接暂不提供模型列表；请手动添加模型 ID。'}</div>}
                  {currentFetch === 'error' && <div role="status" className="mt-3 rounded-[var(--radius-sm)] px-3 py-2 text-[10px]" style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', color: 'var(--danger)' }}>{fetchError[connection.id]?.message || '获取失败：请检查 Base URL 和连接凭据；仍可手动添加模型。'}{fetchError[connection.id]?.retryable !== false && <button type="button" className="ml-2 underline" onClick={() => void fetchModels(connection)}>重试</button>}</div>}
                </div>
              </>}
            </div>
          })}
        </div>
      </SettingRow>
    </SettingCard>
    {editing === 'new' && <SettingCard>{connectionForm}</SettingCard>}
  </fieldset>
}
