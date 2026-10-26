import type { ReactNode } from 'react'
import { ActionButton } from '../foundation/ActionButton'
import { Badge } from '../foundation/Badge'

export interface QualityCaseReading { id: string; title: string; pass: boolean; caption?: string }
export const qualityCaseKey = (item: QualityCaseReading, index: number) => JSON.stringify([index, item.id])

/** 背景：报告概要与逐项证据承担不同阅读任务，旧正式页默认堆叠所有技术字段。
 * 意图：候选与正式共用摘要 / 场景清单，证据由各报告类型按原保存值呈现。
 * 约束：不重新判分、不推断人工结论；重复 ID 按保存顺序区分，同报告刷新保持展开。
 */
export function QualityReportReading<T extends QualityCaseReading>({ title, result, resultNote, pass, judgment, cases, selectedKey, onSelect, renderEvidence }: {
  title: string; result: string; resultNote?: string; pass: boolean; judgment: string; cases: readonly T[]; selectedKey?: string; onSelect: (key: string | undefined) => void; renderEvidence: (item: T) => ReactNode
}) {
  return <>
    <div className="debug-quality-summary"><div><span>报告</span><strong>{title}</strong></div><div><span>结果</span><strong className={pass ? 'debug-quality-pass' : 'debug-quality-fail'}>{result}</strong>{resultNote && <span>{resultNote}</span>}</div><div><span>判定</span><strong>{judgment}</strong></div></div>
    {!cases.length && <p className="debug-quality-state" role="status">这份已保存报告没有逐项场景，不补默认验收结果。</p>}
    {selectedKey && !cases.some((item, index) => qualityCaseKey(item, index) === selectedKey) && <p className="debug-quality-state" role="status">选中场景未在当前报告返回，未选择其他场景代替。</p>}
    <div className="debug-quality-cases">{cases.map((item, index) => { const key = qualityCaseKey(item, index); return <article key={key} className="debug-quality-case" data-case-id={item.id} data-case-key={key}><ActionButton variant="plain" style={{ color: 'var(--text-primary)' }} aria-expanded={selectedKey === key} onClick={() => onSelect(selectedKey === key ? undefined : key)}><Badge tone={item.pass ? 'success' : 'danger'}>{item.pass ? '通过' : '失败'}</Badge><strong>{item.title || '场景描述未提供'}</strong><span>{item.caption}</span></ActionButton>{selectedKey === key && <div className="debug-quality-evidence">{renderEvidence(item)}</div>}</article> })}</div>
  </>
}
