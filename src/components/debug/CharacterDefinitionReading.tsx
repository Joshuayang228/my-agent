import type { ReactNode } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { evidenceObject } from './EvidenceSummary'

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

/** 背景：人物简介与稳定定义曾被通用字段卡淹没，候选和正式阅读需保持同一层级。
 * 意图：共享简介预览、三项事实和完整结构阅读；来源和跨页入口由真实容器 / 隔离候选各自提供。
 * 约束：空对象、缺资料和结构异常分开；不填默认人格，不把设定数值当心情，未知字段原样可达。
 */
export function CharacterDefinitionReading({ id, title, summary, profile, worldDefaults, expanded, onToggle, source, related }: {
  id: string; title: string; summary: string; profile: unknown; worldDefaults: unknown; expanded: boolean; onToggle: () => void; source: ReactNode; related: ReactNode
}) {
  const data = evidenceObject(profile)
  const valid = profile !== null && typeof profile === 'object' && !Array.isArray(profile)
  const text = (value: unknown) => typeof value === 'string' && value ? value : '未提供'
  const interests = Array.isArray(data.interests) ? data.interests.filter((value): value is string => typeof value === 'string') : []
  const badInterests = data.interests !== undefined && (!Array.isArray(data.interests) || data.interests.some(value => typeof value !== 'string'))
  return <>
    <div className="debug-character-summary" data-record-id={id}>
      <p className="debug-character-body">{summary.length > 160 ? `${summary.slice(0, 160)}…` : summary || '简介未提供'}</p>
      {summary.length > 160 && <p className="debug-character-meta">简介预览 · 原文在完整资料中</p>}
      {profile === null || profile === undefined ? <p className="debug-character-state" role="status">详细人物资料未提供；简介仍可阅读。</p> : !valid ? <p className="debug-character-state" role="status">资料结构格式异常；完整原文保留。</p> : Object.keys(data).length === 0 ? <p className="debug-character-state" role="status">已读取空资料结构，尚无资料字段。</p> : <dl className="debug-character-facts">{[['身份', text(data.occupation)], ['年龄呈现', text(data.agePresentation)], ['稳定兴趣', interests.join('、') || '未提供']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
      {badInterests && <p className="debug-character-state" role="status">稳定兴趣字段格式异常；完整原文保留。</p>}
      <ActionButton variant="plain" aria-label={`${title} · 完整资料`} aria-expanded={expanded} onClick={onToggle}>完整资料</ActionButton>
    </div>
    {expanded && <article className="debug-character-detail" aria-label="领域证据详情">
      {summary.length > 160 && <section><h3>完整简介</h3><p className="debug-character-body">{summary}</p></section>}
      <h3>人物定义</h3><p className="debug-character-meta">Role Pack 定义；表达基线是设定值，不是当前心情或模型参数。</p>
      <div className="debug-character-profile"><ProfileValue value={profile} /></div>
      <details className="debug-prompt-provenance"><summary>默认世界定义</summary>{worldDefaults === null || worldDefaults === undefined ? <p>未提供默认世界定义；不等于当前世界为空。</p> : <pre>{JSON.stringify(worldDefaults, null, 2)}</pre>}</details>
      {source}<div className="debug-character-related">{related}</div>
    </article>}
  </>
}
