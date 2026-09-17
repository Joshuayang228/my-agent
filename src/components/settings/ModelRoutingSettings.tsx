import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CheckCircle2, Circle, LoaderCircle, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { LLMModelFetchResult, ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from '../../shared/types'
import { addConnectionModel, enabledConnectionModelIds, normalizeConnectionModels, removeConnectionModel, setConnectionModelEnabled } from '../../shared/llm-model-fetch'
import { ActionButton } from '../foundation/ActionButton'
import { SettingCard, SettingRow } from './SettingsFields'

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

export function ModelRoutingSettings({ connectionsRaw, routesRaw, legacyBaseUrl, legacyModel, onSave, onTestConnection, onFetchModels }: {
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
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [testError, setTestError] = useState<Record<string, string>>({})
  const [fetchState, setFetchState] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error' | 'unsupported'>>({})
  const [fetchError, setFetchError] = useState<Record<string, { message: string; retryable: boolean }>>({})
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({})
  const [modelDrafts, setModelDrafts] = useState<Record<string, string>>({})
  const available = useMemo(() => connections.flatMap((connection) => connection.enabled
    ? enabledConnectionModelIds(connection).map((model) => ({ connection, value: `${connection.id}::${model}`, model }))
    : []), [connections])

  const persist = async (nextConnections: ModelConnectionProfile[], nextRoutes: ModelRouteProfile[]) => {
    setBusy(true)
    try { await onSave(JSON.stringify(nextConnections), JSON.stringify(nextRoutes)) }
    finally { setBusy(false) }
  }
  const openAdd = () => { setEditing('new'); setDraft({ id: `connection-${Date.now()}`, name: '', baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '', enabled: true, models: [] }) }
  const openEdit = (connection: ModelConnectionProfile) => { setEditing(connection.id); setDraft({ ...connection, apiKey: '' }) }
  const saveDraft = async () => {
    if (!draft.name.trim() || !draft.baseUrl.trim()) return
    const next = editing === 'new'
      ? [...connections, withModels({ ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim() })]
      : connections.map((item) => item.id === draft.id
        ? withModels({
            ...item,
            ...draft,
            ...(draft.apiKey?.trim() ? { apiKey: draft.apiKey } : { apiKey: item.apiKey }),
            name: draft.name.trim(),
            baseUrl: draft.baseUrl.trim(),
          })
        : item)
    const sanitized = next.map(({ apiKey, ...connection }) => ({
      ...connection,
      apiKey: '',
      hasApiKey: Boolean((typeof apiKey === 'string' && apiKey.trim()) || connection.hasApiKey),
    }))
    setConnections(sanitized)
    setEditing(null)
    await persist(next, routes)
  }
  const remove = async (id: string) => {
    const next = connections.filter((item) => item.id !== id)
    const nextRoutes = routes.filter((item) => item.connectionId !== id)
    setConnections(next)
    setRoutes(nextRoutes)
    await persist(next, nextRoutes)
  }
  const persistModels = async (connectionId: string, updater: (connection: ModelConnectionProfile) => ModelConnectionProfile) => {
    const next = connections.map((item) => item.id === connectionId ? withModels(updater(item)) : item)
    const nextRoutes = routes.filter((route) => {
      const connection = next.find((item) => item.id === route.connectionId)
      return Boolean(connection && enabledConnectionModelIds(connection).includes(route.model))
    })
    setConnections(next)
    setRoutes(nextRoutes)
    await persist(next, nextRoutes)
  }
  const testConnection = async (connection: ModelConnectionProfile, draftApiKey?: string) => {
    const model = enabledConnectionModelIds(connection)[0] || connection.model
    if (!model) {
      setTestState((current) => ({ ...current, [connection.id]: 'error' }))
      setTestError((current) => ({ ...current, [connection.id]: '请先添加一个模型 ID' }))
      return
    }
    setTestState((current) => ({ ...current, [connection.id]: 'testing' }))
    setTestError((current) => ({ ...current, [connection.id]: '' }))
    const result = await onTestConnection({ ...connection, model }, draftApiKey)
    if (result.ok) setTestState((current) => ({ ...current, [connection.id]: 'success' }))
    else {
      setTestState((current) => ({ ...current, [connection.id]: 'error' }))
      setTestError((current) => ({ ...current, [connection.id]: result.error }))
    }
  }
  const fetchModels = async (connection: ModelConnectionProfile, draftApiKey?: string) => {
    if (fetchState[connection.id] === 'loading') return
    setFetchState((current) => ({ ...current, [connection.id]: 'loading' }))
    setFetchError((current) => { const next = { ...current }; delete next[connection.id]; return next })
    const result = await onFetchModels(connection, draftApiKey)
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
    setModelDrafts((current) => ({ ...current, [connection.id]: '' }))
    await persistModels(connection.id, (item) => ({ ...item, ...addConnectionModel(item, modelId) }))
  }
  const addRoute = async (purpose: ModelRoutePurpose, value: string) => {
    if (!value) return
    const [connectionId, model] = value.split('::')
    if (!connectionId || !model) return
    if (routes.some((item) => item.purpose === purpose && item.connectionId === connectionId && item.model === model)) return
    const next = [...routes, { purpose, connectionId, model, enabled: true }]
    setRoutes(next)
    await persist(connections, next)
  }
  const moveRoute = async (purpose: ModelRoutePurpose, index: number, direction: -1 | 1) => {
    const current = routes.filter((item) => item.purpose === purpose)
    const target = index + direction
    if (target < 0 || target >= current.length) return
    const nextPurpose = [...current]
    ;[nextPurpose[index], nextPurpose[target]] = [nextPurpose[target], nextPurpose[index]]
    const next = [...routes.filter((item) => item.purpose !== purpose), ...nextPurpose]
    setRoutes(next)
    await persist(connections, next)
  }

  return <div className="space-y-4" data-testid="settings-model-routing">
    <SettingCard>
      <SettingRow label="模型使用安排" description="从已添加的连接模型中选择；顺序就是优先级，第一项失败时按顺序尝试下一项。" scope="影响后续任务" stacked>
        <div className="space-y-3">{PURPOSES.map((purpose) => {
          const purposeRoutes = routes.filter((item) => item.purpose === purpose.id)
          return <div key={purpose.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{purpose.label}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{purpose.description}</div></div>
              <select aria-label={`添加${purpose.label}模型`} value="" onChange={(event) => void addRoute(purpose.id, event.target.value)} className="theme-input max-w-[13rem] rounded-[var(--radius-md)] border px-2 py-1.5 text-[10px]">
                <option value="">添加模型</option>
                {available.map(({ connection, value, model }) => <option key={`${purpose.id}-${value}`} value={value}>{connection.name} · {model}</option>)}
              </select>
            </div>
            {purposeRoutes.length === 0
              ? <div className="mt-3 rounded-[var(--radius-md)] border border-dashed px-3 py-3 text-[10px]" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>还没有安排模型；请从已添加的模型中选择。</div>
              : <div className="mt-2 space-y-1">{purposeRoutes.map((route, index) => {
                const connection = connections.find((item) => item.id === route.connectionId)
                const label = `${connection?.name || route.connectionId} · ${route.model}`
                return <div key={`${route.connectionId}-${route.model}`} className="flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)', opacity: route.enabled ? 1 : 0.58 }}>
                  <span className="w-4 text-center" style={{ color: 'var(--accent-fg)' }}>{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate" title={label} style={{ color: 'var(--text-primary)' }}>{label}</span>
                  <ActionButton size="sm" className="min-h-7 w-12 px-0" onClick={() => { const next = routes.map((item) => item === route ? { ...item, enabled: !item.enabled } : item); setRoutes(next); void persist(connections, next) }}>{route.enabled ? '启用' : '停用'}</ActionButton>
                  <ActionButton size="sm" className="min-h-7 w-7 px-0" aria-label={`上移 ${label}`} disabled={index === 0} onClick={() => void moveRoute(purpose.id, index, -1)}><ArrowUp size={12} /></ActionButton>
                  <ActionButton size="sm" className="min-h-7 w-7 px-0" aria-label={`下移 ${label}`} disabled={index === purposeRoutes.length - 1} onClick={() => void moveRoute(purpose.id, index, 1)}><ArrowDown size={12} /></ActionButton>
                  <ActionButton size="sm" className="min-h-7 w-7 px-0" aria-label={`移除 ${label}`} onClick={() => { const next = routes.filter((item) => item !== route); setRoutes(next); void persist(connections, next) }}><Trash2 size={12} /></ActionButton>
                </div>
              })}</div>}
          </div>
        })}</div>
      </SettingRow>
    </SettingCard>
    <SettingCard>
      <SettingRow label="连接与模型清单" description="连接信息保存在本机；密钥不会回传到界面或写入备份文件。获取到的模型需要点选后才会加入清单。" scope="本机" stacked>
        <div className="space-y-2">
          {connections.map((connection) => {
            const models = normalizeConnectionModels(connection)
            const draftModel = modelDrafts[connection.id] ?? ''
            const duplicate = models.some((item) => item.id === draftModel.trim())
            const currentFetch = fetchState[connection.id] ?? 'idle'
            const currentFetched = fetchedModels[connection.id] ?? []
            const editingThis = editing === connection.id
            return <div key={connection.id} className="min-w-0 rounded-[var(--radius-md)] border" style={{ borderColor: 'var(--border-subtle)' }} data-testid={`settings-model-profile-${connection.id}`}>
              {editingThis ? <div className="space-y-2 p-3">
                <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="连接名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="Base URL" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
                <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" type="password" placeholder={connection.hasApiKey ? 'API Key（留空则保留原密钥）' : 'API Key'} value={draft.apiKey || ''} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} />
                <div className="flex justify-end gap-2">
                  <ActionButton size="sm" onClick={() => setEditing(null)}><X size={13} />取消</ActionButton>
                  <ActionButton size="sm" onClick={() => void saveDraft()} disabled={busy} tone="accent">保存连接</ActionButton>
                </div>
              </div> : <>
                <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{connection.name}<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{connection.enabled ? '已启用' : '已停用'}</span></div>
                    <div className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{connection.baseUrl} · {models.length} 个模型</div>
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
                    <div><span style={{ color: 'var(--text-muted)' }}>密钥状态</span><div className="mt-1 font-medium" style={{ color: connection.hasApiKey ? 'var(--success)' : 'var(--danger)' }}>{connection.hasApiKey ? '已配置' : '未配置'}</div></div>
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
                    <input aria-label={`手动添加模型 ${connection.name}`} value={draftModel} onChange={(event) => setModelDrafts((current) => ({ ...current, [connection.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void submitModelDraft(connection) } }} placeholder="填写模型 ID" className="theme-input h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border px-2.5 text-[10px] outline-none" />
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
          {editing === 'new' ? <div className="space-y-2 rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'var(--accent)' }}>
            <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="连接名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="Base URL" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} />
            <input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" type="password" placeholder="API Key" value={draft.apiKey || ''} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} />
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton size="sm" onClick={() => { if (!draft.baseUrl.trim()) return; void testConnection(withModels(draft), draft.apiKey) }} disabled={busy || !draft.baseUrl.trim()}>测试连接</ActionButton>
              <ActionButton size="sm" onClick={() => { if (!draft.baseUrl.trim()) return; void fetchModels(withModels(draft), draft.apiKey) }} disabled={busy || !draft.baseUrl.trim()}>获取已有模型</ActionButton>
              <ActionButton size="sm" onClick={() => setEditing(null)}><X size={13} />取消</ActionButton>
              <ActionButton size="sm" onClick={() => void saveDraft()} disabled={busy} tone="accent">保存连接</ActionButton>
            </div>
            {fetchState[draft.id] === 'success' && (fetchedModels[draft.id] ?? []).length > 0 && <div className="space-y-2"><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>获取到的模型 · 点击加入清单</div><div className="flex flex-wrap gap-1.5">{(fetchedModels[draft.id] ?? []).map((modelId) => { const alreadyAdded = normalizeConnectionModels(draft).some((model) => model.id === modelId); return <ActionButton key={modelId} size="sm" disabled={alreadyAdded} onClick={() => setDraft((current) => ({ ...current, ...addConnectionModel(current, modelId) }))}><span className="max-w-[16rem] truncate">{modelId}</span>{alreadyAdded ? <Check size={12} /> : <Plus size={12} />}</ActionButton> })}</div></div>}
            {testState[draft.id] === 'error' && <div role="status" className="text-[10px]" style={{ color: 'var(--danger)' }}>{testError[draft.id]}</div>}
            {fetchState[draft.id] === 'error' && <div role="status" className="text-[10px]" style={{ color: 'var(--danger)' }}>{fetchError[draft.id]?.message}</div>}
            {fetchState[draft.id] === 'unsupported' && <div role="status" className="text-[10px]" style={{ color: 'var(--accent-fg)' }}>{fetchError[draft.id]?.message}</div>}
          </div> : <ActionButton size="sm" onClick={openAdd} disabled={busy}><Plus size={13} />添加连接</ActionButton>}
        </div>
      </SettingRow>
    </SettingCard>
  </div>
}
