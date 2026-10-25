import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { DebugEvidenceResult, DebugEvidenceScope, DebugEvidenceView } from '../../shared/debug-evidence'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import { LocationStateReading } from './LocationStateReading'
import { useRoleDefinitionAssets } from './useRoleDefinitionAssets'
import { worldSnapshotIssue } from './world-snapshot'

const WORLD_SOURCE_TYPES = ['companion-world'] as const
const text = (value: unknown) => typeof value === 'string' ? value : ''

/** 背景：位置与此刻共读世界行，通用字段不能代替位置专用阅读。
 * 意图：采用已确认的地点 / 细节摘要，独立保留解析与保存投影及世界定义入口。
 * 约束：不复制 codec，不从地点名补住所或旅行因果，不用当前行替代缺失引用，不写世界数据。
 */
export function LocationEvidenceContent({ result, loading, error, roleId, scope, targetId, revision, onRoleChange, onRetry, onEvidence, onAsset }: {
  result: DebugEvidenceResult | null; loading: boolean; error: string; roleId: string; scope?: DebugEvidenceScope | null; targetId?: string; revision: number
  onRoleChange?: (id: string) => void; onRetry: () => void; onEvidence: (view: DebugEvidenceView, id: string) => void; onAsset: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(Boolean(targetId))
  const record = result?.records.find(record => !targetId || record.id === targetId)
  const world = evidenceObject(record?.data.world)
  const timezone = result?.timezone ?? ''
  const definitions = useRoleDefinitionAssets(roleId, WORLD_SOURCE_TYPES, expanded && Boolean(record), revision)
  const fields: Array<[string, string]> = [['当前位置', text(world.currentLocation) || '未设定'], ['位置细节', text(world.locationDetail) || '未记录'], ['当前活动', text(world.currentActivity) || '未记录'], ['世界更新时间', snapshotTime(world.updatedAt, timezone)], ['时区', timezone], ['来源', 'companion_role_state · codec 解析快照'], ['移动原因', '未记录']]
  return <section className="debug-location-workbench" data-testid="debug-evidence-location">
    {targetId && <ActionButton variant="plain" onClick={() => onEvidence('location', '')}>返回当前领域列表</ActionButton>}
    {scope && onRoleChange && <div className="debug-location-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={roleId} onChange={event => onRoleChange(event.target.value)}>{scope.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</SelectField></label></div>}
    {error && <div className="debug-location-state" role="alert"><p>{result ? '刷新失败，保留上次位置快照；下方不是最新结果。' : error}</p><ActionButton onClick={onRetry}>重试</ActionButton></div>}
    {loading && <p className="debug-location-state" role="status">正在读取位置…</p>}
    {result?.issues.map((issue, index) => <p className="debug-location-state" role="status" key={index}>{issue}</p>)}
    {result?.state === 'ready' ? record ? <>
      {record.truncated && <p className="debug-location-state" role="status">正文或结构已截断。</p>}
      <LocationStateReading id={record.id} title={record.title} location={text(world.currentLocation)} detail={text(world.locationDetail)} activity={text(world.currentActivity)} updated={snapshotTime(world.updatedAt, timezone)} timezone={timezone} warning={worldSnapshotIssue(record.data.world, record.data.storedWorld)} expanded={expanded} onToggle={() => setExpanded(!expanded)} fields={fields}
        related={<>{([['now', '查看此刻状态'], ['residence', '查看家居资料'], ['footprints', '查看足迹记录']] as const).map(([view, label]) => <ActionButton key={view} variant="plain" onClick={() => onEvidence(view, '')}>{label}<ArrowUpRight size={14} /></ActionButton>)}{record.links.map(link => <ActionButton key={`${link.view}:${link.id}`} variant="plain" onClick={() => onEvidence(link.view, link.id)}>{link.label}</ActionButton>)}</>}
        source={<details className="debug-prompt-provenance"><summary>来源与原始记录</summary><p>{record.source} · {record.id} · {record.roleId}</p><pre>{JSON.stringify(record.data, null, 2)}</pre><p>注册世界定义不是当前位置或历史输入的使用证明。</p>{definitions.loading && <p role="status">正在读取注册定义关联…</p>}{definitions.error && <p role="alert">{definitions.error}位置快照仍可阅读。<ActionButton variant="plain" onClick={definitions.retry}>重试注册关联</ActionButton></p>}{definitions.assets?.map(asset => <ActionButton key={asset.key} variant="plain" onClick={() => onAsset(asset.key)}>查看注册定义 · {asset.name}<ArrowUpRight size={14} /></ActionButton>)}{definitions.assets?.length === 0 && !definitions.error && <p>当前目录未返回该人物世界定义，不补造关联。</p>}</details>} />
    </> : <p className="debug-location-state" role="status">{targetId ? '引用位置未在该人物范围找到，未选择替代记录。' : '该人物没有位置快照；未补造默认地点。'}</p> : result && <p className="debug-location-state" role="status">{result.state === 'unavailable' ? '诊断源暂不可用' : '此类证据尚无独立读取源'} · {result.boundary}</p>}
  </section>
}
