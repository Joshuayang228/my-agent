import { useState } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import type { DebugSystemSnapshot } from './DebugSystemContent'

export interface CapabilityRecord { id: string; name: string; kind: '注册定义' | 'Skill' | 'MCP'; status: string; detail: string; source: string; usage?: string; schema?: unknown; metadata?: unknown }
export type DebugToolDefinition = Awaited<ReturnType<Window['electronAPI']['debug']['tools']>>[number]

/** 背景：工具、Skill 和 MCP 来自不同读取源，不能把注册数量当作当次可用能力。
 * 意图：统一成带来源身份的阅读记录，保留 Schema 与完整元信息；失败源由所属容器独立提示。
 * 约束：不推断权限或实际调用，MCP 未连接时不把缓存工具数当成功零条。
 */
export function capabilityRecords(tools: readonly DebugToolDefinition[] | null, info: Pick<DebugSystemSnapshot, 'skills' | 'mcp'> | null): CapabilityRecord[] {
  return [
    ...(tools ?? []).map(tool => ({ id: `tool:${tool.name}`, name: tool.name, kind: '注册定义' as const, status: '已注册', detail: tool.description, source: 'ToolRegistry', schema: tool.parameters, metadata: tool.metadata })),
    ...(info?.skills?.items ?? []).map(skill => ({ id: `skill:${skill.name}`, name: skill.name, kind: 'Skill' as const, status: '已加载定义', detail: skill.description, source: skill.source })),
    ...(info?.mcp ?? []).map(server => ({ id: `mcp:${server.id}`, name: server.name, kind: 'MCP' as const, status: ({ connected: '已连接', error: '连接失败', disconnected: '未连接', connecting: '连接中' } as Record<string, string>)[server.status] ?? server.status, detail: `${server.status === 'connected' ? `${server.toolCount} 个工具` : '工具数量未知'}${server.error ? ` · ${server.error}` : ''}`, source: server.id })),
  ]
}

export function DebugCapabilitiesContent({ records }: { records: readonly CapabilityRecord[] }) {
  const [selectedId, setSelectedId] = useState<string>()
  const [kind, setKind] = useState('all')
  const rows = records.filter(record => kind === 'all' || record.kind === kind)
  const selected = rows.find(record => record.id === selectedId)
  return <>
    <div className="debug-tools-toolbar"><span>注册、可用与使用证据分开</span><label>形态<SelectField aria-label="工具形态筛选" value={kind} onChange={event => setKind(event.target.value)}><option value="all">全部</option><option value="注册定义">注册定义</option><option value="Skill">Skill</option><option value="MCP">MCP</option></SelectField></label></div>
    {!rows.length && <p className="debug-tools-state" role="status">当前已读来源没有此类定义；缺失来源不在此计数。</p>}
    <div className="debug-tools-list">{rows.map(record => <div key={record.id} data-record-id={record.id} className="debug-tools-row"><ActionButton variant="plain" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedId === record.id} onClick={() => setSelectedId(record.id)}><strong data-technical-name={record.kind === '注册定义'}>{record.name}</strong><span>{record.kind}</span><span>{record.status}</span></ActionButton></div>)}</div>
    {selected && <article className="debug-tools-detail" aria-label="能力详情"><ActionButton variant="plain" onClick={() => setSelectedId(undefined)}>返回能力列表</ActionButton><h3>{selected.name}</h3><p>{selected.detail}</p><dl><dt>注册 / 来源</dt><dd>{selected.source}</dd><dt>实际使用证据</dt><dd>{selected.usage || '未提供，不推断已调用'}</dd></dl>{selected.schema !== undefined && <details><summary>工具 Schema</summary><pre>{JSON.stringify(selected.schema, null, 2)}</pre></details>}{selected.metadata !== undefined && <details><summary>注册元信息</summary><pre>{JSON.stringify(selected.metadata, null, 2)}</pre></details>}</article>}
    <details className="debug-tools-source"><summary>来源与边界</summary><p>注册定义、当前可用和实际使用是不同事实；浏览不运行工具、不激活 Skill、不修改许可。Skill 说明和权限规则可能是有界投影，完整生产定义从提示词管理器读取。</p></details>
  </>
}
