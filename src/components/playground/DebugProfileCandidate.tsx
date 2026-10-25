import { useEffect, useState } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_EVIDENCE_PAGES, type DebugEvidencePageId } from './debug-evidence-fixtures'
import { DEBUG_PROFILE_SOURCES, profileSourcesForRole } from './debug-profile-fixtures'
import { ProfileReading, PROFILE_SECTIONS } from '../debug/ProfileReading'

export type ProfilePreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'paged' | 'partial' | 'unknown-time' | 'truncated' | 'long' | 'missing' | 'only-other'
interface Props { empty?: boolean; previewState: ProfilePreviewState; snapshotState: ProfilePreviewState; initialSelectedId?: string; onRetry: () => void; onPage: (page: DebugEvidencePageId) => void; onEvidence: (page: DebugEvidencePageId, id: string) => void }

/**
 * 背景：旧样张把固定三块聚合称为全量画像，掩盖了真实有界查询与跨桶资料。
 * 意图：只把已读来源分为三组，正文优先，原始记录和其他类别按需读取。
 * 约束：反馈限定人物，其他类别不按桶偷过滤；不声称已注入，不读 IPC 或生成新摘要。
 */
export function DebugProfileCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onEvidence }: Props) {
  const [role, setRole] = useState('lin')
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [moreLoaded, setMoreLoaded] = useState(false)
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  useEffect(() => setMoreLoaded(false), [state, role])
  const sources = (empty ? [] : DEBUG_PROFILE_SOURCES).filter(record => state !== 'partial' || record.id !== 'demo-profile-workflow').map(record => {
    let body = record.body
    if (state === 'long' && record.id === 'demo-memory-lin') body = '【长反馈样张】讨论材料时保留完整的问题、选择理由和例外，不把这些内容改写成固定人格。\n\n'.repeat(70)
    const time = state === 'unknown-time' ? null : record.time
    return { ...record, body, time, truncated: state === 'truncated', data: { ...record.data, content: body, updatedAt: time } }
  })
  const owned = profileSourcesForRole(sources, role).filter(record => state !== 'only-other' || !PROFILE_SECTIONS.some(section => (section.categories as readonly string[]).includes(record.kind)))
  const records = state === 'paged' && !moreLoaded && !initialSelectedId ? owned.slice(0, 3) : owned
  const selected = records.find(record => record.id === selectedId)
  const missing = state === 'missing' || Boolean(initialSelectedId && !selected)
  return <section className="debug-profile-workbench" data-testid="debug-evidence-profile">
    <div className="debug-profile-toolbar"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setSelectedId(undefined) }}>{DEBUG_ROLES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectField></label><span>全局资料与当前人物的协作反馈</span></div>
    {!available ? <div className="debug-profile-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '画像来源尚未读取' : previewState === 'loading' ? '正在读取画像来源…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取画像来源。' : '画像来源读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取画像样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-profile-state" role="alert"><p>刷新失败，保留原人物、已加载来源、选中与展开；下方不是最新画像。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'partial' && <p className="debug-profile-state" role="status">部分来源未返回，其他已读资料保留，不能认定摘要完整。</p>}
      {missing && <p className="debug-profile-state" role="status">引用来源未在当前人物查询范围返回，未选择其他记忆代替。</p>}
      {!records.length && <p className="debug-profile-state" role="status">当前查询未返回画像来源，不代表用户没有相关资料。</p>}
      <ProfileReading records={records} selectedId={missing ? undefined : selectedId} onSelect={setSelectedId} timezone="Asia/Shanghai" afterList={records.length < owned.length && <ActionButton onClick={() => setMoreLoaded(true)}>读取下一页来源样张</ActionButton>} renderActions={record => (record.roleId === role || record.roleId === '') && DEBUG_EVIDENCE_PAGES.memories.items.some(entry => entry.id === record.id) ? <ActionButton variant="plain" onClick={() => onEvidence('memories', record.id)}>查看这条来源记忆</ActionButton> : null} />
      <details className="debug-profile-source"><summary>查询范围与其他入口</summary><p>来源：memories · 当前页 {records.length} 条已读来源，总数未知。顺序来自更新时间与 ID；分类只整理当前返回行，不推导人物设定或关系评分。</p><p>主对话是否注入以运行时实际证据为准；工作区不注入此画像。读取层排除含凭据记忆；其他类别只保留来源，不凑成三块摘要。</p><ActionButton variant="plain" onClick={() => onPage('memories')}>查看用户记忆</ActionButton><ActionButton variant="plain" onClick={() => onPage('context')}>查看请求保存范围</ActionButton></details>
    </>}
  </section>
}
