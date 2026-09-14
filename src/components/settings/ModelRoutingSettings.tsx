import { useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { ModelConnectionProfile, ModelRouteProfile, ModelRoutePurpose } from '../../shared/types'
import { SettingCard, SettingRow } from './SettingsFields'
import { ActionButton } from '../foundation/ActionButton'

const PURPOSES: Array<{ id: ModelRoutePurpose; label: string; description: string }> = [
  { id: 'primary', label: '主对话', description: '聊天和主要 Agent 任务的优先模型。' },
  { id: 'auxiliary', label: '辅助任务', description: '标题、压缩、画像和生活脚本等轻量任务。' },
  { id: 'image', label: '图片理解', description: '需要图片输入时使用的模型入口。' },
]

function parse<T>(raw: string, fallback: T): T { try { return JSON.parse(raw) as T } catch { return fallback } }

export function ModelRoutingSettings({ connectionsRaw, routesRaw, legacyBaseUrl, legacyModel, onSave, onTestConnection }: { connectionsRaw: string; routesRaw: string; legacyBaseUrl: string; legacyModel: string; onSave: (connections: string, routes: string) => Promise<void>; onTestConnection: (connection: ModelConnectionProfile) => Promise<{ ok: true; model: string; ms: number } | { ok: false; error: string }> }) {
  const legacyConnection: ModelConnectionProfile = { id: 'legacy-primary', name: '当前主连接', baseUrl: legacyBaseUrl, model: legacyModel, enabled: true }
  const initialConnections = parse<ModelConnectionProfile[]>(connectionsRaw, [])
  const initialRoutes = parse<ModelRouteProfile[]>(routesRaw, [])
  const [connections, setConnections] = useState<ModelConnectionProfile[]>(() => initialConnections.length > 0 ? initialConnections : [legacyConnection])
  const [routes, setRoutes] = useState<ModelRouteProfile[]>(() => initialRoutes.length > 0 ? initialRoutes : [{ purpose: 'primary', connectionId: legacyConnection.id, model: legacyConnection.model, enabled: true }])
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModelConnectionProfile>({ id: '', name: '', baseUrl: '', model: '', apiKey: '', enabled: true })
  const [busy, setBusy] = useState(false)
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [testError, setTestError] = useState<Record<string, string>>({})
  const available = useMemo(() => connections.flatMap((connection) => connection.enabled && connection.model.trim() ? [{ connection, value: `${connection.id}::${connection.model}` }] : []), [connections])

  const persist = async (nextConnections: ModelConnectionProfile[], nextRoutes: ModelRouteProfile[]) => { setBusy(true); try { await onSave(JSON.stringify(nextConnections), JSON.stringify(nextRoutes)) } finally { setBusy(false) } }
  const openAdd = () => { setEditing('new'); setDraft({ id: `connection-${Date.now()}`, name: '', baseUrl: 'https://api.openai.com/v1', model: '', apiKey: '', enabled: true }) }
  const openEdit = (connection: ModelConnectionProfile) => { setEditing(connection.id); setDraft({ ...connection, apiKey: '' }) }
  const saveDraft = async () => {
    if (!draft.name.trim() || !draft.baseUrl.trim() || !draft.model.trim()) return
    const next = editing === 'new'
      ? [...connections, { ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim(), model: draft.model.trim() }]
      : connections.map((item) => item.id === draft.id
        ? {
            ...item,
            ...draft,
            // 背景：编辑连接时密钥输入框永远为空，空值不能覆盖主进程安全存储中的原密钥。
            // 设计意图：只把用户本次输入的非空密钥交给持久化层，避免要求 Renderer 读取旧密钥。
            // 关键约束：新连接允许写入新密钥；已有连接留空必须保留原有 apiKey 状态。
            ...(draft.apiKey?.trim() ? { apiKey: draft.apiKey } : { apiKey: item.apiKey }),
            name: draft.name.trim(),
            baseUrl: draft.baseUrl.trim(),
            model: draft.model.trim(),
          }
        : item)
    const sanitized = next.map(({ apiKey: _apiKey, ...connection }) => connection)
    setConnections(sanitized)
    setEditing(null)
    await persist(next, routes)
  }
  const remove = async (id: string) => { const next = connections.filter((item) => item.id !== id); const nextRoutes = routes.filter((item) => item.connectionId !== id); setConnections(next); setRoutes(nextRoutes); await persist(next, nextRoutes) }
  const testConnection = async (connection: ModelConnectionProfile) => { setTestState((current) => ({ ...current, [connection.id]: 'testing' })); setTestError((current) => ({ ...current, [connection.id]: '' })); const result = await onTestConnection(connection); if (result.ok) setTestState((current) => ({ ...current, [connection.id]: 'success' })); else { setTestState((current) => ({ ...current, [connection.id]: 'error' })); setTestError((current) => ({ ...current, [connection.id]: result.error })) } }
  const addRoute = async (purpose: ModelRoutePurpose, value: string) => { if (!value) return; const [connectionId, model] = value.split('::'); if (!connectionId || !model) return; const next = [...routes.filter((item) => item.purpose !== purpose), { purpose, connectionId, model, enabled: true }]; setRoutes(next); await persist(connections, next) }

  return <div className="space-y-4" data-testid="settings-model-routing">
    <SettingCard><SettingRow label="连接与模型" description="连接信息保存在本机；密钥不会回传到界面或写入备份文件。" scope="本机" stacked><div className="space-y-2">{connections.map((connection) => <div key={connection.id} className="flex min-w-0 items-center gap-3 rounded-[var(--radius-md)] border px-3 py-3" style={{ borderColor: 'var(--border-subtle)', opacity: connection.enabled ? 1 : .6 }}><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{connection.name}<span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{connection.enabled ? '已启用' : '已停用'}</span></div><div className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{connection.baseUrl} · {connection.model}</div></div>{testState[connection.id] === 'success' && <div role="status" className="shrink-0 text-[10px]" style={{ color: 'var(--success)' }}><CheckCircle2 size={12} /></div>}{testState[connection.id] === 'error' && <button type="button" className="shrink-0 text-[10px]" style={{ color: 'var(--danger)' }} onClick={() => void testConnection(connection)}>重试</button>}<ActionButton size="sm" onClick={() => void testConnection(connection)} disabled={busy || testState[connection.id] === 'testing'} aria-label={testState[connection.id] === 'testing' ? `正在测试 ${connection.name}` : `测试连接 ${connection.name}`}>{testState[connection.id] === 'testing' ? <LoaderCircle size={13} className="animate-spin" /> : testState[connection.id] === 'success' ? <RefreshCw size={13} /> : '测试连接'}</ActionButton><ActionButton size="sm" onClick={() => openEdit(connection)} disabled={busy}>编辑</ActionButton><ActionButton size="sm" onClick={() => void remove(connection.id)} disabled={busy} aria-label={`删除 ${connection.name}`}><Trash2 size={13} /></ActionButton></div>)}{editing ? <div className="space-y-2 rounded-[var(--radius-md)] border p-3" style={{ borderColor: 'var(--accent)' }}><input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="连接名称" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /><input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="Base URL" value={draft.baseUrl} onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} /><input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" placeholder="模型 ID" value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} /><input className="theme-input w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-[11px]" type="password" placeholder="API Key（留空则保留原密钥）" value={draft.apiKey || ''} onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })} /><div className="flex justify-end gap-2"><ActionButton size="sm" onClick={() => setEditing(null)}><X size={13} />取消</ActionButton><ActionButton size="sm" onClick={() => void saveDraft()} disabled={busy} tone="accent">保存连接</ActionButton></div></div> : <ActionButton size="sm" onClick={openAdd} disabled={busy}><Plus size={13} />添加连接</ActionButton>}</div></SettingRow></SettingCard>
    <SettingCard><SettingRow label="模型使用安排" description="从已启用连接中选择用途；列表顺序就是优先级。" scope="影响后续任务" stacked><div className="space-y-3">{PURPOSES.map((purpose) => <div key={purpose.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border-subtle)' }}><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{purpose.label}</div><div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{purpose.description}</div></div><select aria-label={`添加${purpose.label}模型`} value="" onChange={(event) => void addRoute(purpose.id, event.target.value)} className="theme-input rounded-[var(--radius-md)] border px-2 py-1.5 text-[10px]"><option value="">添加模型</option>{available.map(({ connection, value }) => <option key={`${purpose.id}-${value}`} value={value}>{connection.name} · {connection.model}</option>)}</select></div><div className="mt-2 space-y-1">{routes.filter((item) => item.purpose === purpose.id).map((route, index) => { const connection = connections.find((item) => item.id === route.connectionId); return <div key={`${route.connectionId}-${route.model}`} className="flex items-center gap-2 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[10px]" style={{ borderColor: 'var(--border-subtle)' }}><span className="w-4 text-center" style={{ color: 'var(--accent-fg)' }}>{index + 1}</span><span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{connection?.name || route.connectionId} · {route.model}</span><button type="button" onClick={() => { const next = routes.filter((item) => !(item.purpose === route.purpose && item.connectionId === route.connectionId && item.model === route.model)); setRoutes(next); void persist(connections, next) }} className="shrink-0 p-1" aria-label={`移除 ${route.model}`}><Trash2 size={12} style={{ color: 'var(--text-muted)' }} /></button></div> })}</div></div>)}</div></SettingRow></SettingCard>
  </div>
}
