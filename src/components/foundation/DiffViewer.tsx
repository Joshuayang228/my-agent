import { Columns2, Rows3 } from 'lucide-react'
import { CodeBlock } from '../MarkdownRenderer'

export type DiffViewMode = 'unified' | 'split'

interface DiffViewerProps {
  unified: string
  before?: string | null
  after?: string | null
  mode?: DiffViewMode
  language?: string
  unifiedLanguage?: string
}

/**
 * 背景：文件读取期间或新文件没有旧稿，业务仍可能保留上一文件的并排选择。
 * 设计意图：内容与开关共用缺稿回退规则，不让各页面各自判断正文真假。
 * 关键约束：空字符串是有效稿件；只有 null/undefined 缺失，原文始终交给 CodeBlock。
 */
export function resolveDiffViewMode(mode: DiffViewMode, canSplit: boolean): DiffViewMode {
  return mode === 'split' && canSplit ? 'split' : 'unified'
}

export function DiffViewControls({ mode, canSplit, onChange }: {
  mode: DiffViewMode
  canSplit: boolean
  onChange: (mode: DiffViewMode) => void
}) {
  const current = resolveDiffViewMode(mode, canSplit)
  return <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="审阅视图" data-foundation="diff-view-controls">
    {([{ id: 'unified', label: '统一差异', Icon: Rows3 }, { id: 'split', label: '并排差异', Icon: Columns2 }] as const).map(({ id, label, Icon }) =>
      <button key={id} type="button" aria-label={label} title={label} aria-pressed={current === id} disabled={id === 'split' && !canSplit}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded disabled:opacity-40"
        style={{ color: current === id ? 'var(--accent-fg)' : 'var(--text-muted)', background: current === id ? 'var(--accent-subtle)' : undefined }} onClick={() => onChange(id)}>
        <Icon size={13} />
      </button>)}
  </div>
}

export function DiffViewer({ unified, before, after, mode = 'unified', language = 'text', unifiedLanguage = 'diff' }: DiffViewerProps) {
  const current = resolveDiffViewMode(mode, before != null && after != null)
  return <div className="min-w-0" data-foundation="diff-viewer" data-mode={current}>
    {current === 'split' ? <div className="grid min-w-0 grid-cols-2 gap-3">
      {([{ label: '修改前', content: before! }, { label: '修改后', content: after! }]).map(({ label, content }) =>
        <section key={label} aria-label={label} className="min-w-0">
          <p className="mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <CodeBlock code={content} language={language} />
        </section>)}
    </div> : <CodeBlock code={unified} language={unifiedLanguage} />}
  </div>
}
