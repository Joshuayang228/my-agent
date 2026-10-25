import type { DebugEvidenceRecord } from '../../shared/debug-evidence'
import { evidenceObject } from './EvidenceSummary'
import { snapshotTime } from './NowStateReading'
import type { GrowthReadingItem } from './GrowthReading'

export interface ProjectedGrowth extends GrowthReadingItem { record: DebugEvidenceRecord }
const text = (value: unknown) => typeof value === 'string' ? value : ''
const time = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 8_640_000_000_000_000 ? value : 0

/** 背景：成长查询混合四种来源且旧反思 JSON 可能损坏，不能按人物 ID 合并。
 * 意图：保留实际 source + ID，将已保存结果投影给共用阅读层。
 * 约束：不补正文 / 版本 / 时间，坏运行条目仍可核对原文，不推断执行门闸。
 */
export function projectGrowthRecords(records: readonly DebugEvidenceRecord[], timezone: string): ProjectedGrowth[] {
  return records.map(record => {
    const kind = record.source === 'companion_mutable' ? 'current' : record.source === 'Role Pack mutable.default' ? 'default' : record.source === 'companion_mutable_versions' ? 'history' : record.source === 'companion_reflection_state' ? 'reflection' : 'unknown'
    const version = typeof record.data.version === 'number' && Number.isInteger(record.data.version) && record.data.version > 0 ? record.data.version : undefined
    const runs = Array.isArray(record.data.runs) ? record.data.runs.map(value => { const run = evidenceObject(value); return { at: snapshotTime(run.at, timezone), sortTime: time(run.at), changed: typeof run.changed === 'boolean' ? run.changed : undefined, summary: text(run.summary) } }) : []
    const badRuns = record.data.runs !== undefined && (!Array.isArray(record.data.runs) || record.data.runs.some(value => { const run = evidenceObject(value); return typeof run.summary !== 'string' || typeof run.changed !== 'boolean' || !time(run.at) }))
    const at = kind === 'history' ? record.data.created_at : record.data.updated_at
    return { id: record.id, key: `${record.source}:${record.id}`, kind, title: kind === 'current' ? '当前成长覆盖' : kind === 'default' ? '已读默认成长定义' : kind === 'history' ? `历史版本 v${version ?? '未记录'}` : kind === 'reflection' ? '反思运行结果' : record.title,
      body: record.body, version, at: snapshotTime(at, timezone), sortTime: time(at), summary: text(record.data.summary), lastRunAt: snapshotTime(record.data.last_run_at, timezone), runs,
      issue: badRuns ? '部分反思结果格式异常；原始记录保留，不推断运行是否成功。' : undefined, record }
  })
}

export function growthFields(item: ProjectedGrowth): Array<[string, string]> {
  return [['来源', item.record.source], ['记录标识', item.id],
    ...(item.kind === 'current' || item.kind === 'history' ? [['版本', item.version === undefined ? '未记录' : `v${item.version}`], [item.kind === 'history' ? '版本创建时间' : '覆盖更新时间', item.at]] as Array<[string, string]> : []),
    ...(item.kind === 'default' ? [['定义性质', '已读 Role Pack 默认，不冒充用户覆盖']] as Array<[string, string]> : []),
    ...(item.kind === 'reflection' ? [['最后运行', item.lastRunAt], ['结果性质', '已保存的运行结果摘要，不是隐藏思维'], ['门闸判断', '本查询未提供，不推算下一次运行时间']] as Array<[string, string]> : [])]
}
