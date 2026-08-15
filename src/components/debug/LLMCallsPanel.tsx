/**
 * 全页 Debug 的持久化 LLM 调用浏览器。
 *
 * 背景：对话右坞只适合当前会话快速检查，全页 Debug 需要跨会话搜索、筛选和查看完整请求/响应。
 * 设计意图：复用现有 tracer sink 与 llm_debug_logs，不创建第二套调用生命周期或日志库。
 * 关键约束：正文按单条懒加载；清空只删除 Debug 日志，并在界面内要求二次确认。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  ChevronLeft, ChevronRight, Copy, Download, RefreshCw, Search, Trash2,
} from 'lucide-react'
import type { AgentAssetUsageEvidence, LLMCallDetail, LLMCallQuery, LLMCallSummary, PromptAssetTrace, SkillActivationTrace } from '../../shared/types'
import { formatDebugBytes, formatDebugValue, normalizeDebugMessages } from './debug-format'

const PAGE_SIZE = 30

type DetailView = 'prompts' | 'system' | 'messages' | 'tools' | 'extra' | 'response' | 'json'

export function LLMCallsPanel({ focusId }: { focusId?: string } = {}) {
  const [records, setRecords] = useState<LLMCallSummary[]>([])
  const [total, setTotal] = useState(0)
  const [storageBytes, setStorageBytes] = useState(0)
  const [page, setPage] = useState(0)
  const [searchDraft, setSearchDraft] = useState('')
  const [callerDraft, setCallerDraft] = useState('')
  const [modelDraft, setModelDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<LLMCallQuery['status'] | ''>('')
  const [filters, setFilters] = useState<Pick<LLMCallQuery, 'search' | 'caller' | 'model' | 'status'>>({})
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<LLMCallDetail | null>(null)
  const [assetEvidence, setAssetEvidence] = useState<AgentAssetUsageEvidence[]>([])
  const [detailView, setDetailView] = useState<DetailView>('prompts')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [clearArmed, setClearArmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const selectedIdRef = useRef('')

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  const query = useMemo<LLMCallQuery>(() => ({
    ...filters,
    order: 'desc',
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [filters, page])

  const loadDetail = useCallback(async (id: string) => {
    if (!id || !window.electronAPI?.debug) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const [nextDetail, evidence] = await Promise.all([
        window.electronAPI.debug.llmLogGet(id),
        window.electronAPI.debug.assetUsageQuery({ spanId: id, limit: 100 }),
      ])
      setDetail(nextDetail)
      setAssetEvidence(evidence.records)
    } catch (cause) {
      setDetail(null)
      setAssetEvidence([])
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadRecords = useCallback(async (keepSelection = true) => {
    const debug = window.electronAPI?.debug
    if (!debug) {
      setError('需要 Electron 环境才能读取 LLM Debug 日志')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await debug.llmLogsQuery(query)
      setRecords(result.records)
      setTotal(result.total)
      setStorageBytes(result.storageBytes)
      const currentSelection = selectedIdRef.current
      const selection = keepSelection && result.records.some((record) => record.id === currentSelection)
        ? currentSelection
        : result.records[0]?.id ?? ''
      setSelectedId(selection)
      if (selection) await loadDetail(selection)
      else setDetail(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [loadDetail, query])

  useEffect(() => { void loadRecords(true) }, [loadRecords])

  useEffect(() => {
    if (!focusId?.trim()) return
    setSelectedId(focusId)
    setDetailView('prompts')
    void loadDetail(focusId)
  }, [focusId, loadDetail])

  useEffect(() => {
    const unsubscribe = window.electronAPI?.debug?.onLLMCallEvent((event) => {
      if (event.type === 'ended' || event.type === 'cleared') void loadRecords(true)
    })
    return unsubscribe
  }, [loadRecords])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setPage(0)
    setFilters({
      ...(searchDraft.trim() ? { search: searchDraft.trim() } : {}),
      ...(callerDraft.trim() ? { caller: callerDraft.trim() } : {}),
      ...(modelDraft.trim() ? { model: modelDraft.trim() } : {}),
      ...(statusDraft ? { status: statusDraft } : {}),
    })
  }

  const exportFiltered = async () => {
    const debug = window.electronAPI?.debug
    if (!debug) return
    try {
      const result = await debug.llmLogsExport({ ...filters, order: 'desc' })
      if (!result.ok && !result.canceled) setError(result.error || '导出失败')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const clearLogs = async () => {
    if (!clearArmed) {
      setClearArmed(true)
      window.setTimeout(() => setClearArmed(false), 4000)
      return
    }
    const debug = window.electronAPI?.debug
    if (!debug) return
    try {
      const result = await debug.llmLogsClear()
      if (!result.ok) throw new Error('清空 Debug 日志失败')
      setClearArmed(false)
      setPage(0)
      await loadRecords(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const messages = normalizeDebugMessages(detail?.requestMessages)
  const systemMessages = messages.filter((message) => message.role === 'system')
  const promptAssets = normalizePromptAssets(detail?.requestExtra.promptAssets)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-3" data-testid="llm-calls-panel">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>LLM 调用</h2>
            <span className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {total} 条 · {formatDebugBytes(storageBytes)}
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            完整请求与响应按需读取；筛选与导出使用同一查询条件。
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton title="刷新" onClick={() => void loadRecords(true)}><RefreshCw size={13} /></IconButton>
          <IconButton title="导出筛选结果为 JSONL" onClick={() => void exportFiltered()}><Download size={13} /></IconButton>
          <button
            type="button"
            onClick={() => void clearLogs()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px]"
            style={{ borderColor: 'var(--border-color)', color: clearArmed ? 'var(--danger)' : 'var(--text-muted)' }}
          >
            <Trash2 size={12} />
            {clearArmed ? '再次确认清空' : '清空日志'}
          </button>
        </div>
      </header>

      <form onSubmit={applyFilters} className="grid gap-2 lg:grid-cols-[minmax(180px,1fr)_150px_180px_130px_auto]">
        <label className="relative">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            className="theme-input h-9 w-full rounded-lg border pl-8 pr-3 text-xs"
            placeholder="模型、Provider、会话…"
          />
        </label>
        <input
          value={callerDraft}
          onChange={(event) => setCallerDraft(event.target.value)}
          className="theme-input h-9 rounded-lg border px-3 text-xs"
          placeholder="Caller"
        />
        <input
          value={modelDraft}
          onChange={(event) => setModelDraft(event.target.value)}
          className="theme-input h-9 rounded-lg border px-3 text-xs"
          placeholder="精确模型"
        />
        <select
          value={statusDraft}
          onChange={(event) => setStatusDraft(event.target.value as LLMCallQuery['status'] | '')}
          className="theme-input h-9 rounded-lg border px-2 text-xs"
          aria-label="调用状态"
        >
          <option value="">全部状态</option>
          <option value="success">成功</option>
          <option value="error">错误</option>
          <option value="pending">进行中</option>
        </select>
        <button type="submit" className="h-9 rounded-lg px-3 text-xs font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>
          筛选
        </button>
      </form>

      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="grid min-h-[500px] gap-3 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <div className="scrollbar-hover min-h-0 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
          {loading && records.length === 0 && <Empty text="读取 LLM 调用中…" />}
          {!loading && records.length === 0 && <Empty text="没有匹配的 LLM 调用。" />}
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => {
                setSelectedId(record.id)
                setDetail(null)
                void loadDetail(record.id)
              }}
              className="block w-full border-b px-3 py-2.5 text-left last:border-b-0"
              style={{
                borderColor: 'var(--border-subtle)',
                background: selectedId === record.id ? 'var(--sidebar-active)' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2">
                <StatusDot status={record.status} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]" style={{ color: 'var(--text-primary)' }}>{record.model || 'unknown'}</span>
                <span className="shrink-0 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(record.startedAt)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--bg-tertiary)' }}>{record.caller || 'system'}</span>
                <span>{formatDuration(record.durationMs)}</span>
                <span>·</span>
                <span className="font-mono">{record.totalTokens}t</span>
                {record.error && <span className="ml-auto max-w-28 truncate" style={{ color: 'var(--danger)' }}>{record.error}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="min-w-0 rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-secondary)' }}>
          {detailLoading && !detail && <Empty text="读取调用详情中…" />}
          {!detailLoading && !detail && <Empty text="从左侧选择一条调用查看完整请求与响应。" />}
          {detail && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <div className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.model}</div>
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {detail.provider} · {detail.caller} · {detail.promptTokens}/{detail.completionTokens} tokens · {formatDuration(detail.durationMs)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(JSON.stringify(detail, null, 2)).then(() => {
                      setCopied(true)
                      window.setTimeout(() => setCopied(false), 1200)
                    })
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px]"
                  style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                >
                  <Copy size={11} />
                  {copied ? '已复制' : '复制 JSON'}
                </button>
              </div>

              <div className="my-2 flex flex-wrap gap-1">
                {(['prompts', 'system', 'messages', 'tools', 'extra', 'response', 'json'] as DetailView[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setDetailView(item)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px]"
                    style={{
                      color: detailView === item ? 'var(--accent-fg)' : 'var(--text-muted)',
                      background: detailView === item ? 'var(--accent-subtle)' : 'transparent',
                    }}
                  >
                    {{ prompts: `资产证据 ${assetEvidence.length || promptAssets.length}`, system: `System ${systemMessages.length}`, messages: `Messages ${messages.length}`, tools: 'Tools', extra: '请求参数', response: '响应', json: '完整 JSON' }[item]}
                  </button>
                ))}
              </div>

              {detailView === 'prompts' && (
                <AssetEvidenceDetail
                  evidence={assetEvidence}
                  fallback={(
                    <PromptAssetsDetail
                      assets={promptAssets}
                      unknownKeys={normalizeStringArray(detail.requestExtra.unknownPromptAssetKeys)}
                      promptlessReason={typeof detail.requestExtra.promptlessReason === 'string' ? detail.requestExtra.promptlessReason : ''}
                      skillActivations={normalizeSkillActivations(detail.requestExtra.skillActivations)}
                    />
                  )}
                />
              )}
              {detailView === 'system' && <DetailMessages messages={systemMessages} />}
              {detailView === 'messages' && <DetailMessages messages={messages} />}
              {detailView === 'tools' && <CodeBlock value={detail.requestTools} />}
              {detailView === 'extra' && <CodeBlock value={detail.requestExtra} />}
              {detailView === 'response' && (
                <div className="space-y-2">
                  {detail.error && <ResponseBlock label="错误" value={detail.error} danger />}
                  {detail.responseReasoning && <ResponseBlock label="Reasoning" value={detail.responseReasoning} />}
                  <ResponseBlock label="正文" value={detail.responseContent || '（空）'} />
                  <ResponseBlock label="Tool Calls" value={formatDebugValue(detail.responseToolCalls) || '[]'} />
                </div>
              )}
              {detailView === 'json' && <CodeBlock value={detail} />}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span>第 {total === 0 ? 0 : page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} / 共 {total} 条</span>
        <div className="flex gap-1">
          <IconButton title="上一页" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={14} /></IconButton>
          <span className="inline-flex h-8 min-w-16 items-center justify-center font-mono">{page + 1}/{totalPages}</span>
          <IconButton title="下一页" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={14} /></IconButton>
        </div>
      </div>
    </div>
  )
}

function usageGroup(item: AgentAssetUsageEvidence): string {
  if (item.usageKind === 'provider-route' || item.usageKind === 'provider-policy') return 'Provider'
  if (item.usageKind === 'tool-available' || item.usageKind === 'tool-execution') return 'Tool schema'
  if (item.usageKind === 'memory-operation') return 'Memory'
  if (item.usageKind === 'permission-decision') return 'Permission / Sandbox'
  if (item.usageKind === 'skill-activation') return 'Skill'
  return 'Prompt / 伙伴'
}

/** 展示真实运行关联；旧记录没有索引时回退现有 Prompt 资产视图。 */
function AssetEvidenceDetail({ evidence, fallback }: { evidence: AgentAssetUsageEvidence[]; fallback: ReactNode }) {
  if (evidence.length === 0) return <>{fallback}</>
  const groups = new Map<string, AgentAssetUsageEvidence[]>()
  for (const item of evidence) {
    const group = usageGroup(item)
    groups.set(group, [...(groups.get(group) ?? []), item])
  }
  return (
    <div className="scrollbar-hover max-h-[52vh] space-y-3 overflow-y-auto pr-1" data-testid="asset-evidence-detail">
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="mb-2 text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{group} · {items.length}</div>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded border px-2.5 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.assetKey}</span>
                  <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-fg)' }}>{item.relation}</span>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{item.usageKind} · {item.status}</span>
                </div>
                <div className="mt-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>{item.assetName} · v{item.assetVersion} · {item.assetFingerprint}</div>
                {Object.keys(item.metadata).length > 0 && <div className="mt-1 break-words font-mono text-[9px]" style={{ color: 'var(--text-muted)' }}>{formatDebugValue(item.metadata)}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * 将历史 Debug JSON 收窄为当前可渲染的 Prompt 资产。
 *
 * 背景：旧记录和手工导入 JSON 可能缺字段，详情页不能因单条脏数据崩溃。
 * 设计意图：只接受来源、版本、locale、模式和插槽完整的注册表投影。
 * 关键约束：不修补或猜测缺失元数据；异常项继续留在“完整 JSON”供诊断。
 */
function normalizeSkillActivations(value: unknown): SkillActivationTrace[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<SkillActivationTrace>
    if (typeof candidate.name !== 'string'
      || typeof candidate.toolName !== 'string'
      || (candidate.source !== 'builtin' && candidate.source !== 'user')
      || typeof candidate.version !== 'string'
      || typeof candidate.fingerprint !== 'string'
      || typeof candidate.activatedAt !== 'number') return []
    return [{
      name: candidate.name,
      toolName: candidate.toolName,
      source: candidate.source,
      version: candidate.version,
      fingerprint: candidate.fingerprint,
      ...(typeof candidate.reason === 'string' ? { reason: candidate.reason } : {}),
      activatedAt: candidate.activatedAt,
    } satisfies SkillActivationTrace]
  })
}

function normalizePromptAssets(value: unknown): PromptAssetTrace[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<PromptAssetTrace>
    if (typeof candidate.key !== 'string'
      || typeof candidate.source !== 'string'
      || typeof candidate.version !== 'string'
      || typeof candidate.locale !== 'string'
      || typeof candidate.purpose !== 'string'
      || typeof candidate.role !== 'string'
      || (candidate.mode !== 'static' && candidate.mode !== 'dynamic')
      || !Array.isArray(candidate.slots)) return []
    return [{
      ...candidate,
      key: candidate.key,
      source: candidate.source,
      version: candidate.version,
      locale: candidate.locale,
      purpose: candidate.purpose,
      role: candidate.role,
      mode: candidate.mode,
      slots: candidate.slots,
      fingerprint: typeof candidate.fingerprint === 'string' ? candidate.fingerprint : 'legacy',
      fingerprintKind: candidate.fingerprintKind === 'content' || candidate.fingerprintKind === 'structure'
        ? candidate.fingerprintKind
        : 'structure',
    } satisfies PromptAssetTrace]
  })
}

/**
 * 展示某次真实 LLM 调用关联的 Prompt 来源与版本。
 *
 * 背景：提示词管理器和当前装配预览都不是历史实发证据，调用详情必须单独呈现本次引用。
 * 设计意图：元数据卡片回答“用了哪个资产、从哪里来、什么版本”，正文仍交给 System / Messages。
 * 关键约束：未知 key 只告警，不伪造来源；动态插槽只显示名称，不展示可能含隐私的实际值。
 */
function PromptAssetsDetail({ assets, unknownKeys, promptlessReason, skillActivations }: { assets: PromptAssetTrace[]; unknownKeys: string[]; promptlessReason: string; skillActivations: SkillActivationTrace[] }) {
  if (assets.length === 0 && unknownKeys.length === 0 && !promptlessReason && skillActivations.length === 0) {
    return <Empty text="本次调用没有声明 Prompt 资产；可查看 System / Messages 确认实发正文。" />
  }
  return (
    <div className="scrollbar-hover max-h-[52vh] space-y-2 overflow-y-auto pr-1">
      {promptlessReason && (
        <section className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>本次调用显式声明为无固定 Prompt 资产</div>
          <div className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{promptlessReason}</div>
        </section>
      )}
      {unknownKeys.length > 0 && (
        <section className="rounded-lg border p-3" style={{ borderColor: 'var(--warning)', background: 'var(--bg-primary)' }}>
          <div className="text-[11px] font-semibold" style={{ color: 'var(--warning)' }}>注册表缺失 key</div>
          <div className="mt-1 break-words font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>{unknownKeys.join(', ')}</div>
        </section>
      )}
      {skillActivations.length > 0 && <SkillActivationsDetail items={skillActivations} />}
      {assets.map((asset) => (
        <article key={asset.key} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{asset.key}</div>
              <div className="mt-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>{asset.purpose}</div>
            </div>
            <span className="rounded px-2 py-0.5 font-mono text-[10px]" style={{ color: 'var(--accent-fg)', background: 'var(--accent-subtle)' }}>
              {asset.version} · {asset.locale} · {asset.mode}
            </span>
          </div>
          <dl className="mt-3 grid gap-1.5 text-[10px] sm:grid-cols-[64px_minmax(0,1fr)]">
            <dt style={{ color: 'var(--text-muted)' }}>来源</dt>
            <dd className="break-all font-mono" style={{ color: 'var(--text-secondary)' }}>{asset.source}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>角色</dt>
            <dd className="font-mono" style={{ color: 'var(--text-secondary)' }}>{asset.role}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>指纹</dt>
            <dd className="font-mono" style={{ color: 'var(--text-secondary)' }}>{asset.fingerprint} · {asset.fingerprintKind}</dd>
            {asset.slots.length > 0 && (
              <>
                <dt style={{ color: 'var(--text-muted)' }}>动态插槽</dt>
                <dd className="break-words" style={{ color: 'var(--text-secondary)' }}>
                  {asset.slots.map((slot) => slot.name).join('、')}
                </dd>
              </>
            )}
          </dl>
        </article>
      ))}
    </div>
  )
}

function SkillActivationsDetail({ items }: { items: SkillActivationTrace[] }) {
  return (
    <section className="rounded-lg border p-3" style={{ borderColor: 'var(--accent)', background: 'var(--bg-primary)' }}>
      <div className="text-[11px] font-semibold" style={{ color: 'var(--accent-fg)' }}>本次请求激活的 Skill</div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <article key={`${item.name}-${item.activatedAt}-${index}`} className="rounded border p-2" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.source === 'builtin' ? '内置' : '用户'} · v{item.version}</span>
            </div>
            <dl className="mt-1 grid gap-1 text-[10px] sm:grid-cols-[56px_minmax(0,1fr)]">
              <dt style={{ color: 'var(--text-muted)' }}>激活工具</dt>
              <dd className="break-all font-mono" style={{ color: 'var(--text-secondary)' }}>{item.toolName}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>指纹</dt>
              <dd className="font-mono" style={{ color: 'var(--text-secondary)' }}>{item.fingerprint}</dd>
              {item.reason && <><dt style={{ color: 'var(--text-muted)' }}>激活原因</dt><dd className="break-words" style={{ color: 'var(--text-secondary)' }}>{item.reason}</dd></>}
            </dl>
          </article>
        ))}
      </div>
    </section>
  )
}

function DetailMessages({ messages }: { messages: ReturnType<typeof normalizeDebugMessages> }) {
  if (messages.length === 0) return <Empty text="本次调用没有请求消息。" />
  return (
    <div className="scrollbar-hover max-h-[52vh] space-y-2 overflow-y-auto pr-1">
      {messages.map((message, index) => (
        <article key={`${message.id ?? index}-${index}`} className="rounded-lg border" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="flex justify-between border-b px-3 py-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <span className="font-mono text-[10px] font-semibold" style={{ color: roleColor(message.role) }}>{message.role}</span>
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{message.content.length} chars</span>
          </div>
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message.content || '（空）'}</pre>
        </article>
      ))}
    </div>
  )
}

function CodeBlock({ value }: { value: unknown }) {
  return (
    <pre className="scrollbar-hover max-h-[52vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px] leading-relaxed" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      {formatDebugValue(value) || '（空）'}
    </pre>
  )
}

function ResponseBlock({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <section>
      <div className="mb-1 text-[10px] font-semibold uppercase" style={{ color: danger ? 'var(--danger)' : 'var(--text-muted)' }}>{label}</div>
      <pre className="scrollbar-hover max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[11px]" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: danger ? 'var(--danger)' : 'var(--text-secondary)' }}>{value}</pre>
    </section>
  )
}

function IconButton({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-35"
      style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{text}</p>
}

function StatusDot({ status }: { status: LLMCallSummary['status'] }) {
  const color = status === 'success' ? 'var(--success)' : status === 'error' ? 'var(--danger)' : 'var(--warning)'
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-label={status} />
}

function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function roleColor(role: string): string {
  if (role === 'system') return 'var(--accent)'
  if (role === 'user') return 'var(--warning)'
  if (role === 'assistant') return 'var(--success)'
  return 'var(--text-muted)'
}
