import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { ActionButton } from '../foundation/ActionButton'
import { SelectField } from '../foundation/SelectField'
import { DEBUG_ROLES } from './debug-experience-fixtures'
import { DEBUG_ASSET_FIXTURES } from './debug-asset-fixtures'
import { DEBUG_EVIDENCE_PAGES, debugCharacterFields, type DebugCharacterDefinition, type DebugEvidencePageId } from './debug-evidence-fixtures'

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

const PROFILE_LABELS: Record<string, string> = {
  schemaVersion: '资料结构版本', occupation: '身份', agePresentation: '年龄呈现', birthday: '生日', genderPresentation: '性别呈现', pronouns: '称谓', origin: '背景来源',
  background: '背景经历', education: '教育经历', careerHistory: '职业经历', skills: '能力', dailyRhythm: '生活节奏', interests: '稳定兴趣', dislikes: '不喜欢', habits: '习惯', flaws: '局限', socialStyle: '社交方式', valuesInPractice: '行动中的价值观',
  lifeAnchors: '人生锚点', appearance: '外观', favorites: '偏好', selfAwareness: '自我认知', expression: '表达基线',
  period: '时期', title: '标题', summary: '描述', overall: '整体印象', hair: '头发', eyes: '眼睛', build: '体型', clothingStyle: '穿衣风格', distinguishingFeatures: '辨识特征',
  foods: '食物', drinks: '饮品', music: '音乐', books: '书籍', activities: '活动', weather: '天气', colors: '颜色', warmth: '温暖', energy: '活力', directness: '直接', playfulness: '趣味', initiative: '主动',
}

function ProfileValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span>未提供</span>
  if (Array.isArray(value)) return value.length ? <ul>{value.map((entry, index) => <li key={index}><ProfileValue value={entry} /></li>)}</ul> : <span>未提供</span>
  if (typeof value === 'object') return <dl>{Object.entries(value).map(([key, entry]) => <div key={key}><dt>{PROFILE_LABELS[key] ?? key}</dt><dd><ProfileValue value={entry} /></dd></div>)}</dl>
  return <span>{String(value)}</span>
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
  const summary = definition?.summary ?? ''
  return <section className="debug-character-workbench" data-testid="debug-evidence-character">
    <div className="debug-character-toolbar debug-focused-scope"><label>人物<SelectField aria-label="诊断人物" value={role} disabled={!available} onChange={event => { setRole(event.target.value); setExpanded(false) }}>{DEBUG_ROLES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</SelectField></label></div>
    {!available ? <div className="debug-character-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? '人物资料尚未读取' : previewState === 'loading' ? '正在读取人物资料…' : previewState === 'unavailable' ? '资料接口不可用；需要桌面诊断连接。' : '人物资料读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取资料样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-character-state" role="alert"><p>刷新失败，保留上次资料；下方不是最新结果。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {missing ? <p className="debug-character-state" role="status">引用资料未在该人物范围找到，未选择替代人物。</p> : definition && entry ? <>
        <div className="debug-character-summary" data-record-id={entry.id}>
          <p className="debug-character-body">{summary.length > 160 ? `${summary.slice(0, 160)}…` : summary || '简介未提供'}</p>
          {summary.length > 160 && <p className="debug-character-meta">简介预览 · 原文在完整资料中</p>}
          {definition.profile === null ? <p className="debug-character-state" role="status">详细人物资料未提供；简介仍可阅读。</p> : Object.keys(definition.profile).length === 0 ? <p className="debug-character-state" role="status">已读取空资料结构，尚无资料字段。</p> : <dl className="debug-character-facts">{debugCharacterFields(definition).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
          <ActionButton variant="plain" aria-label={`${entry.title} · 完整资料`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>完整资料</ActionButton>
        </div>
        {expanded && <article className="debug-character-detail" aria-label="领域证据详情">
          {summary.length > 160 && <section><h3>完整简介</h3><p className="debug-character-body">{summary}</p></section>}
          <h3>人物定义</h3><p className="debug-character-meta">Role Pack 定义；表达基线是设定值，不是当前心情或模型参数。</p>
          <div className="debug-character-profile"><ProfileValue value={definition.profile} /></div>
          <details className="debug-prompt-provenance"><summary>默认世界定义</summary>{definition.worldDefaults === null ? <p>未提供默认世界定义；不等于当前世界为空。</p> : <pre>{JSON.stringify(definition.worldDefaults, null, 2)}</pre>}</details>
          <details className="debug-prompt-provenance"><summary>来源与原始样张</summary><p>当前注册定义不证明历史请求已使用；版本与指纹在注册目录查看。</p><code>Role Pack · {entry.id}</code><pre>{JSON.stringify({ role, ...definition }, null, 2)}</pre>{entry.assets?.map(key => <ActionButton key={key} variant="plain" onClick={() => onAsset(key)}>查看注册定义 · {DEBUG_ASSET_FIXTURES.find(asset => asset.key === key)?.label ?? key}<ArrowUpRight size={14} /></ActionButton>)}</details>
          <div className="debug-character-related">{entry.relatedPages?.map(link => <ActionButton key={link.page} variant="plain" onClick={() => onPage(link.page)}>{link.label}<ArrowUpRight size={14} /></ActionButton>)}</div>
        </article>}
      </> : <p className="debug-character-state" role="status">该人物没有已提供资料；未补造人物设定。</p>}
    </>}
  </section>
}
