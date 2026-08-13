import { useEffect, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { PersonaEvalHumanReview, PersonaEvalHumanReviewInput } from '../../shared/types'

function reviewStatusLabel(review?: PersonaEvalHumanReview): string {
  if (!review) return '未审阅'
  if (review.verdict === 'pass') return '已审阅 · 通过'
  if (review.verdict === 'revise') return '已审阅 · 需要修改'
  if (review.verdict === 'uncertain') return '已审阅 · 无法判断'
  return '已审阅 · 未下结论'
}

type ReviewDraft = PersonaEvalHumanReviewInput

const ratingFields: Array<{ key: 'naturalness' | 'roleConsistency' | 'emotionalAttunement'; label: string }> = [
  { key: 'naturalness', label: '活人感 / 自然度' },
  { key: 'roleConsistency', label: '角色一致性' },
  { key: 'emotionalAttunement', label: '情绪承接' },
]
const issueFields: Array<{ key: 'forcedOptimism' | 'planPushing' | 'psychologicalDiagnosis' | 'templatedness'; label: string }> = [
  { key: 'forcedOptimism', label: '强行乐观' },
  { key: 'planPushing', label: '立即推进计划' },
  { key: 'psychologicalDiagnosis', label: '擅自心理诊断' },
  { key: 'templatedness', label: '模板化' },
]

/**
 * Persona Eval Trial 的人工审阅控件。
 *
 * 背景：自动 Judge 无法覆盖活人感、语气审美和情绪承接，需要在人看到真实回复后留下独立判断。
 * 设计意图：控件只管理本地草稿，保存和删除由父级注入；不在组件内混入自动 Eval 判定或 Prompt 修改。
 * 关键约束：默认折叠；正向体验为 1–5，风险信号为无 / 轻微 / 明显；不使用系统确认框。
 */
export function HumanReviewSection({ reportFileName, scenarioId, trialId, review, onSave, onDelete }: {
  reportFileName: string
  scenarioId: string
  trialId: string
  review?: PersonaEvalHumanReview
  onSave: (input: PersonaEvalHumanReviewInput) => Promise<boolean>
  onDelete: (input: Pick<PersonaEvalHumanReview, 'reportFileName' | 'scenarioId' | 'trialId'>) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ReviewDraft>({ reportFileName, scenarioId, trialId, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft({ reportFileName, scenarioId, trialId, notes: '', ...review })
    setOpen(Boolean(review))
  }, [reportFileName, scenarioId, trialId, review])

  const setField = (key: keyof ReviewDraft, value: unknown) => setDraft((previous) => ({ ...previous, [key]: value }))
  const save = async () => {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false) }
  }
  const clear = async () => {
    setSaving(true)
    try {
      const ok = await onDelete({ reportFileName, scenarioId, trialId })
      if (ok) setDraft({ reportFileName, scenarioId, trialId, notes: '' })
    } finally { setSaving(false) }
  }

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded border px-2.5 py-2" data-testid="persona-human-review" style={{ borderColor: review ? 'var(--accent)' : 'var(--border-subtle)' }}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-[11px]">
        <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>人工审阅</span>
        <span style={{ color: review?.verdict === 'revise' ? 'var(--warning)' : review?.verdict === 'pass' ? 'var(--success)' : 'var(--text-muted)' }}>{reviewStatusLabel(review)}</span>
      </summary>
      <div className="mt-2 space-y-3 border-t pt-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <SectionLabel>正向体验 · 1–5 分</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {ratingFields.map(({ key, label }) => <ReviewChoice key={key} label={label} value={draft[key]} options={[1, 2, 3, 4, 5]} onChange={(value) => setField(key, value)} />)}
          </div>
        </div>
        <div>
          <SectionLabel>风险信号</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {issueFields.map(({ key, label }) => <ReviewChoice key={key} label={label} value={draft[key]} options={['none', 'minor', 'major']} optionLabels={['无', '轻微', '明显']} onChange={(value) => setField(key, value)} />)}
          </div>
        </div>
        <ReviewChoice label="总体结论" value={draft.verdict} options={['pass', 'revise', 'uncertain']} optionLabels={['通过', '需要修改', '无法判断']} onChange={(value) => setField('verdict', value)} />
        <label className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="mb-1 block">人工备注</span>
          <textarea value={draft.notes} onChange={(event) => setField('notes', event.target.value)} rows={3} className="theme-input w-full resize-y text-xs" placeholder="记录具体语句、语气或需要回看的原因…" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{review ? `最近保存：${new Date(review.updatedAt).toLocaleString('zh-CN')}` : '尚未保存；不会改动自动 Eval 结果。'}</span>
          <div className="flex gap-2">
            {review && <button type="button" onClick={() => void clear()} disabled={saving} className="inline-flex h-7 items-center gap-1 rounded border px-2 text-[10px] disabled:opacity-50" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}><Trash2 size={11} />清空</button>}
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-7 items-center gap-1 rounded px-2.5 text-[10px] font-medium disabled:opacity-50" style={{ background: 'var(--accent)', color: 'white' }}><Save size={11} />{saving ? '保存中…' : '保存审阅'}</button>
          </div>
        </div>
      </div>
    </details>
  )
}

function ReviewChoice({ label, value, options, optionLabels, onChange }: { label: string; value: unknown; options: readonly unknown[]; optionLabels?: string[]; onChange: (value: unknown) => void }) {
  return (
    <div>
      <div className="mb-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((option, index) => <button key={String(option)} type="button" aria-label={`${label}：${optionLabels?.[index] || String(option)}`} onClick={() => onChange(value === option ? undefined : option)} className="rounded border px-2 py-1 text-[10px]" data-selected={value === option || undefined} style={{ borderColor: value === option ? 'var(--accent)' : 'var(--border-subtle)', background: value === option ? 'var(--accent-subtle)' : 'transparent', color: value === option ? 'var(--accent-fg)' : 'var(--text-secondary)' }}>{optionLabels?.[index] || String(option)}</button>)}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{children}</div>
}
