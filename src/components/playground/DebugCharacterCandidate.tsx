import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { CharacterDefinitionReading } from '../debug/CharacterDefinitionReading'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES } from './debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, type DebugCharacterDefinition, type DebugEvidencePageId } from './debug-evidence-fixtures'

export type CharacterPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'partial' | 'empty-profile' | 'long' | 'missing'
interface Props {
  empty: boolean
  previewState: CharacterPreviewState
  snapshotState: CharacterPreviewState
  initialSelectedId?: string
  onRetry: () => void
  onPage: (page: DebugEvidencePageId) => void
  onAsset: (key: string) => void
}

/** 背景：人物定义、当前生活与历史输入容易被混读，铺开全字段会遮住人物简介。
 * 意图：主层只读简介与三项事实，完整定义和注册来源渐进展开。
 * 约束：仅隔离样张；缺失不补造设定，注册定义不作为历史注入证据，跨页无已存 ID 时只导航。
 */
export function DebugCharacterCandidate({ empty, previewState, snapshotState, initialSelectedId, onRetry, onPage, onAsset }: Props) {
  const fixtures = DEBUG_EVIDENCE_PAGES.character.items
  const [role, setRole] = useState<string>(fixtures.find(entry => entry.id === initialSelectedId)?.role ?? 'lin')
  const [expanded, setExpanded] = useState(Boolean(initialSelectedId))
  const entry = empty ? undefined : fixtures.find(value => value.role === role)
  const definition: DebugCharacterDefinition | undefined = entry?.character ? { ...entry.character } : undefined
  const dataState = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const missing = dataState === 'missing' || Boolean(initialSelectedId && entry?.id !== initialSelectedId)
  if (definition && dataState === 'partial') definition.profile = { occupation: '', agePresentation: '', interests: ['阅读'] }
  if (definition && dataState === 'empty-profile') definition.profile = {}
  if (definition && dataState === 'long') {
    definition.summary = '【长简介样张】喜欢在日常里收集值得保存的线索，愿意陪对方慢慢整理材料。'.repeat(24)
    definition.profile = { ...definition.profile, background: ['【长经历样张】从照片、笔记和对话里寻找线索。'.repeat(60)], extraMaterial: '额外资料字段也完整保留。' }
  }
  return <section className="debug-character-workbench" data-testid="debug-evidence-character">
    <div className="debug-character-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setExpanded(false) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-character-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '人物资料尚未读取' : previewState === 'loading' ? '正在读取人物资料…' : previewState === 'unavailable' ? '资料接口不可用；需要桌面诊断连接。' : '人物资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取资料样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-character-state" role="alert"><p>刷新失败，保留上次资料；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing ? <p className="debug-character-state" role="status">引用资料未在该人物范围找到，未选择替代人物。</p> : definition && entry ? <>
        <CharacterDefinitionReading id={entry.id} title={entry.title} summary={definition.summary} profile={definition.profile} worldDefaults={definition.worldDefaults} expanded={expanded} onToggle={() => setExpanded(!expanded)}
          source={<details className="debug-prompt-provenance"><summary>来源与原始样张</summary><p>当前注册定义不证明历史请求已使用；版本与指纹在注册目录查看。</p><code>Role Pack · {entry.id}</code><pre>{JSON.stringify({ role, ...definition }, null, 2)}</pre>{entry.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看注册定义 · {DEBUG_ASSET_FIXTURES.find(asset => asset.key === key)?.label ?? key}<ArrowUpRight size={14} /></ActionButton>)}</details>}
          related={entry.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)} />
      </> : <p className="debug-character-state" role="status">该人物没有已提供资料；未补造人物设定。</p>}
    </>}
  </section>
}
