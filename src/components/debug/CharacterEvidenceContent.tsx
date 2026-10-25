import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { CharacterDefinitionReading } from './CharacterDefinitionReading'
import { useRoleDefinitionAssets } from './useRoleDefinitionAssets'

const CHARACTER_SOURCE_TYPES = ['companion-manifest', 'companion-profile', 'companion-world'] as const

/** 背景：人物定义和资产目录分别提供真实证据，目录失败不能吞掉已读简介。
 * 意图：只在展开时查询真实目录，按明确角色归属选择定义，不在 UI 拼造资产 key。
 * 约束：人物 / 查询变更丢弃迟到结果；刷新失败保留正文及展开，目录关联不证明历史请求已使用。
 */
export function CharacterEvidenceContent({ result, loading, error, roleId, scope, targetId, revision, onRoleChange, onRetry, onEvidence, onAsset }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string; revision: number
  onRoleChange?: (id: string) => void; onRetry: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void; onAsset: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(Boolean(targetId))
  const record = result?.records.find(record => !targetId || record.id === targetId)
  const { assets, error: assetError, loading: assetLoading, retry } = useRoleDefinitionAssets(roleId, CHARACTER_SOURCE_TYPES, expanded && Boolean(record), revision)
  return <section className="debug-character-workbench" data-testid="debug-evidence-character">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('character', '')}>返回当前领域列表</ActionButton>}
    {scope && onRoleChange && <div className="debug-character-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}
    {error && <div className="debug-character-state" role="alert"><p>{result ? '刷新失败，保留上次资料；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-character-state" role="status">正在读取人物资料…</p>}
    {result?.issues.map((issue, index) => <p className="debug-character-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? record ? <>
      {record.truncated && <p className="debug-character-state" role="status">正文或结构已截断。</p>}
      <CharacterDefinitionReading id={record.id} title={record.title} summary={record.body} profile={record.data.profile} worldDefaults={record.data.worldDefaults} expanded={expanded} onToggle={() => setExpanded(!expanded)}
        source={<details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>当前注册定义不证明历史请求已使用；版本与指纹在注册目录查看。</p><p>{record.source} · {record.id} · {record.roleId}</p><pre>{JSON.stringify(record.data, null, 2)}</pre>{assetLoading && <p role="status">正在读取注册定义关联…</p>}{assetError && <p role="alert">{assetError}人物资料仍可阅读。<ActionButton variant="plain" onClick={retry}>重试注册关联</ActionButton></p>}{assets?.map(asset => <ActionButton key={asset.key} variant="plain" onClick={() => onAsset(asset.key)}>查看注册定义 · {asset.name}<ArrowUpRight size={14} /></ActionButton>)}{assets?.length === 0 && !assetError && <p>当前目录未返回该人物的来源定义，不补造关联。</p>}</details>}
        related={<><ActionButton variant="plain" onClick={() => onEvidence('growth', '')}>查看成长与反思<ArrowUpRight size={14} /></ActionButton><ActionButton variant="plain" onClick={() => onEvidence('items', '')}>查看文化记录<ArrowUpRight size={14} /></ActionButton></>} />
    </> : <p className="debug-character-state" role="status">{targetId ? '引用资料未在该人物范围找到，未选择替代人物。' : '该人物没有已提供资料；未补造人物设定。'}</p> : result && <p className="debug-character-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}
