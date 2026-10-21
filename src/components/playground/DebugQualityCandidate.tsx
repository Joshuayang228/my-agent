import { useState } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'

export type QualityPreviewState = 'ready' | 'unread' | 'loading' | 'unavailable' | 'error' | 'refresh-error' | 'no-report' | 'running' | 'long' | 'failed-case' | 'unreviewed'
interface Props { kind: 'quality' | 'persona'; previewState: QualityPreviewState; snapshotState: QualityPreviewState; onRetry: () => void }
interface CaseItem { id: string; title: string; pass: boolean; evidence: string[]; review?: string }
const SKILL_CASES: readonly CaseItem[] = [
  { id: 'skill-activation', title: '旅行整理场景触发 Skill', pass: true, evidence: ['Skill key：demo.skill.travel', '激活工具：read', '触发依据：用户请求整理资料'] },
  { id: 'skill-boundary', title: '工具边界拒绝写入', pass: false, evidence: ['允许工具：read', '实际尝试：write', '结果：权限边界阻止'] },
  { id: 'skill-response', title: '回复遵守输出约束', pass: true, evidence: ['回复保留来源引用', '未暴露隐藏推理'] },
]
const PERSONA_CASES: readonly CaseItem[] = [
  { id: 'persona-continuity', title: '关系连续性', pass: true, evidence: ['上下文保留已确认偏好', '没有把样张反馈当作新记忆'], review: '未审阅' },
  { id: 'persona-voice', title: '人物表达', pass: true, evidence: ['语气符合 Role Pack', '输出协议通过'], review: '未审阅' },
  { id: 'persona-boundary', title: '世界事实边界', pass: false, evidence: ['一条回复引用未确认事实', '需要人工复核因果'], review: '需要人工判断' },
]

/** 背景：质量页同时展示 Skill grader 与 Persona 人工审阅，混在一张状态卡会丢失证据责任。
 * 意图：按报告类型显示摘要、单项结果与证据，报告缺失时明确缺口。
 * 约束：只读隔离样张，不自动运行 Eval、不判定真实模型、不伪造人工审阅。
 */
export function DebugQualityCandidate({ kind, previewState, snapshotState, onRetry }: Props) {
  const [selected, setSelected] = useState<string>()
  const state = previewState === 'refresh-error' ? snapshotState : previewState
  const available = !['unread', 'loading', 'unavailable', 'error'].includes(previewState)
  const cases = kind === 'quality' ? SKILL_CASES : PERSONA_CASES
  const shown = state === 'long' ? [...cases, { id: 'extra', title: '长场景样张', pass: true, evidence: ['报告正文较长，按需展开。'.repeat(8)] }] : cases
  const current = shown.find(item => item.id === selected)
  const passCount = shown.filter(item => item.pass).length
  const title = kind === 'quality' ? 'Skill Eval' : 'Persona Eval'
  return <section className="debug-quality-workbench" data-testid={`debug-evidence-${kind}`}>
    {!available ? <div className="debug-quality-state" role={['error', 'unavailable'].includes(previewState) ? 'alert' : 'status'}><p>{previewState === 'unread' ? `${title} 报告尚未读取` : previewState === 'loading' ? '正在读取质量报告…' : previewState === 'unavailable' ? '需要桌面诊断连接才能读取报告。' : '质量报告读取失败'}</p>{previewState !== 'loading' && <ActionButton onClick={onRetry}>读取报告样张</ActionButton>}</div> : <>
      {previewState === 'refresh-error' && <div className="debug-quality-state" role="alert"><p>刷新失败，保留上次报告与选中证据；下方不代表最新运行。</p><ActionButton onClick={onRetry}>重试读取样张</ActionButton></div>}
      {state === 'no-report' && <div className="debug-quality-state" role="status"><p>还没有可读取的 {title} 报告。</p><p>报告由固定 CLI 生成；打开 Debug 不会自动运行模型。</p></div>}
      {state === 'running' && <div className="debug-quality-state" role="status"><p>{title} 正在运行；完成前不显示通过结论。</p></div>}
      {state === 'unreviewed' && kind === 'persona' && <p className="debug-quality-state" role="status">自动结果已读取，人工审阅尚未完成；两者分开保存。</p>}
      {state !== 'no-report' && state !== 'running' && <>
        <div className="debug-quality-summary"><div><span>报告</span><strong>{title}</strong></div><div><span>结果</span><strong className={passCount === shown.length ? 'debug-quality-pass' : 'debug-quality-fail'}>{passCount}/{shown.length} 通过</strong></div><div><span>判定</span><strong>{kind === 'persona' ? '自动 + 人工' : '自动 Grader'}</strong></div></div>
        <div className="debug-quality-cases">{shown.map(item => <article key={item.id} className="debug-quality-case" data-case-id={item.id}><ActionButton variant="plain" style={{ color: 'var(--text-primary)' }} onClick={() => setSelected(selected === item.id ? undefined : item.id)}><Badge tone={item.pass ? 'success' : 'danger'}>{item.pass ? '通过' : '失败'}</Badge><strong>{item.title}</strong><span>{item.review ?? `${item.evidence.length} 条证据`}</span></ActionButton>{selected === item.id && <div className="debug-quality-evidence">{item.evidence.map((evidence, index) => <p key={index}>{evidence}</p>)}{kind === 'persona' && <p>人工审阅：{item.review ?? '未审阅'}；此页不替代人工下结论。</p>}</div>}</article>)}</div>
      </>}
      <details className="debug-quality-boundary"><summary>来源与诊断边界</summary><p>{kind === 'quality' ? '来源为 Skill Eval CLI 报告与 grader 证据；Skill 正文、凭据和隐藏推理不在此复制。' : '来源为 Persona Eval CLI 报告；自动判定与人工审阅独立保存，人工结果不会由 UI 自动推断。'} 不执行 Eval、不改变报告、不把 Playground 样张标成生产结论。</p></details>
    </>}
  </section>
}
