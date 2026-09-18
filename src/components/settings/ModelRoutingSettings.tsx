import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { connectionCredentialLabel } from '../../shared/model-connection-form'
import type { LLMModelFetchResult, ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from '../../shared/types'
import { addConnectionModel, enabledConnectionModelIds, normalizeConnectionModels, removeConnectionModel, setConnectionModelEnabled } from '../../shared/llm-model-fetch'
import { ModelConnectionCard } from './ModelConnectionCard'
import { ModelConnectionList } from './ModelConnectionList'
import { ModelUsageArrangements } from './ModelUsageArrangements'
import { useToast } from '../Toast'
import { SettingCard } from './SettingsFields'
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
    <ModelConnectionList count={connections.length} onAdd={openAdd} disabled={busy || editing !== null}>
          {connections.map(connection => <ModelConnectionCard key={connection.id} id={connection.id} name={connection.name}
            sourceLabel={CONNECTION_SOURCE_OPTIONS.find(item => item.id === connection.source)?.label ?? '自定义连接'}
            providerLabel={CONNECTION_PRESETS.find(item => item.providerId === connection.presetId)?.label ?? CONNECTION_ADAPTERS.find(item => item.provider === connection.provider)?.label ?? '自动识别'}
            custom={connection.source === 'custom'} enabled={connection.enabled} baseUrl={connection.baseUrl}
            credentialLabel={connectionCredentialLabel(connection)} hasApiKey={Boolean(connection.hasApiKey)} models={normalizeConnectionModels(connection)}
            draft={modelDrafts[connection.id] ?? ''} onDraftChange={value => setModelDrafts(current => ({ ...current, [connection.id]: value }))}
            onSubmitModel={() => { void submitModelDraft(connection) }}
            onAddModel={modelId => { void persistModels(connection.id, item => ({ ...item, ...addConnectionModel(item, modelId) })) }}
            onToggleModel={model => { void persistModels(connection.id, item => ({ ...item, ...setConnectionModelEnabled(item, model.id, !model.enabled) })) }}
            onRemoveModel={modelId => { void persistModels(connection.id, item => ({ ...item, ...removeConnectionModel(item, modelId) })) }}
            onEdit={() => openEdit(connection)} onDelete={() => { void remove(connection.id) }}
            onTest={() => { void testConnection(connection) }} onFetch={() => { void fetchModels(connection) }}
            testState={testState[connection.id] ?? 'idle'} testMessage={testState[connection.id] === 'error' ? testError[connection.id] : undefined}
            fetchState={fetchState[connection.id] ?? 'idle'} fetchMessage={fetchError[connection.id]?.message} fetchRetryable={fetchError[connection.id]?.retryable}
            fetchedModels={fetchedModels[connection.id] ?? []} busy={busy} editing={editing === connection.id ? connectionForm : undefined} />)}
    </ModelConnectionList>
    {editing === 'new' && <SettingCard>{connectionForm}</SettingCard>}
  </fieldset>
}
