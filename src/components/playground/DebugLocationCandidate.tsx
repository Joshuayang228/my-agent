import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES } from './debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugLocationFields, debugNowTime, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type LocationPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'unset' | 'fallback' | 'long' | 'missing'
interface Props {
  empty: boolean
  previewState: LocationPreviewState
  snapshotState: LocationPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
}

/** 背景：位置快照常被误读成到访 / 移动历史，原始数据铺开又遮住地点。
 * 意图：地点与细节优先，保留解析回退提示，完整字段及关联定义渐进展开。
 * 约束：只读隔离记录；没有行不补默认世界，未知引用不选择替代，更新时间不是到达时间。
 */
export function DebugLocationCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.location.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [expanded, setExpanded] = useState(Boolean(initialSelectedId))
  const entry = empty ? undefined : fixtures.find(value => value.role === role)
  const state = entry?.location ? { ...entry.location } : undefined
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && entry?.id !== initialSelectedId)
  if (state && dataState === 'unset') {
    state.currentLocation = '未设定'; state.locationDetail = ''; state.currentActivity = ''; state.updatedAt = 0
  }
  if (state && dataState === 'fallback') {
    state.currentLocation = '未设定'; state.locationDetail = ''; state.currentActivity = ''; state.updatedAt = 0
    state.storedWorld = { schemaVersion: 0, currentLocation: '旧结构地点 · 样张' }
    state.issue = '存储世界结构无效，当前展示默认解析结果；不代表实际位置已知。'
  }
  if (state && dataState === 'long') {
    const storedLocation = '虚构住所内靠窗的资料整理区，旁边放着旅行相册和待整理的笔记。'.repeat(2)
    const storedDetail = '【长位置细节样张】坐在书桌前，逐张整理照片并核对记录中的地点。\n\n'.repeat(20)
    state.currentLocation = storedLocation.slice(0, 40)
    state.locationDetail = storedDetail.slice(0, 80)
    state.storedWorld = { ...(typeof state.storedWorld === 'object' ? state.storedWorld : {}), currentLocation: storedLocation, locationDetail: storedDetail }
    state.issue = '存储地点与细节超出运行时长度限制；完整原文请查看来源。'
  }
  const detail = state?.locationDetail ?? ''
  return <section className="debug-location-workbench" data-testid="debug-evidence-location">
    <div className="debug-location-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setExpanded(false) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-location-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '位置尚未读取' : previewState === 'loading' ? '正在读取位置…' : previewState === 'unavailable' ? '位置接口不可用；需要桌面诊断连接。' : '位置读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取位置样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-location-state" role="alert"><p>刷新失败，保留上次位置快照；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing ? <p className="debug-location-state" role="status">引用位置未在该人物范围找到，未选择替代记录。</p> : state && entry ? <>
        {state.issue && <p className="debug-location-state debug-location-warning" role="status">{state.issue}</p>}
        <div className="debug-location-summary" data-record-id={entry.id}>
          <p className="debug-location-place">{state.currentLocation || '未设定'}</p>
          {detail ? <p className="debug-location-body">{detail}</p> : <p className="debug-location-meta">位置细节未记录</p>}
          <dl className="debug-location-facts"><div><dt>当前活动</dt><dd>{state.currentActivity || '未记录'}</dd></div></dl>
          <p className="debug-location-meta">世界更新时间{state.updatedAt ? ` ${debugNowTime(state.updatedAt, state.timezone)}` : '未记录'} · {state.timezone}</p>
          <ActionButton variant="plain" aria-label={`${entry.title} · 完整快照`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>完整快照</ActionButton>
        </div>
        {expanded && <article className="debug-location-detail" aria-label="领域证据详情">
          <h3>位置字段</h3><dl className="debug-candidate-facts">{debugLocationFields(state).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="debug-location-meta">位置与活动来自当前世界解析快照；更新时间不是到达时间，当前位置不证明旅行或访问历史。</p>
          <div className="debug-location-related">{entry.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
          <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><code>companion_role_state · {entry.id}</code><pre>{JSON.stringify({ role, parsed: { currentLocation: state.currentLocation, locationDetail: state.locationDetail, currentActivity: state.currentActivity, updatedAt: state.updatedAt, timezone: state.timezone }, storedWorld: state.storedWorld ?? '样张未提供独立存储副本' }, null, 2)}</pre><p>注册世界定义不是当前位置或历史输入的使用证明。</p>{entry.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看注册定义 · {DEBUG_ASSET_FIXTURES.find(asset => asset.key === key)?.label ?? key}<ArrowUpRight size={14} /></ActionButton>)}</details>
        </article>}
      </> : <p className="debug-location-state" role="status">该人物没有位置快照；未补造默认地点。</p>}
    </>}
  </section>
}
