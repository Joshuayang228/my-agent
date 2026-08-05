/**
 * 本轮记忆引用芯片（Chat 消息上方）。
 * Playground 故事矩阵与主聊天共用，避免展厅皮肤漂移。
 */

import type { MemoryCitation } from '../../shared/types'

export function MemoryCitationChips({
  citations,
  showActions,
  onForget,
  onAmend,
}: {
  citations: MemoryCitation[]
  showActions?: boolean
  onForget?: (id: string) => void
  onAmend?: (id: string, summary: string) => void
}) {
  if (citations.length === 0) return null

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5" aria-label="本轮引用的记忆">
      {citations.map((c) => (
        <span
          key={c.id}
          title={`id: ${c.id}\n${c.summary}`}
          className="inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-snug"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="max-w-[10rem] truncate">
            记忆·{c.category}: {c.summary}
          </span>
          {showActions && (
            <>
              <button
                type="button"
                className="shrink-0 underline-offset-2 hover:underline"
                style={{ color: 'var(--text-secondary)' }}
                title="记错了：从库中删除这条引用"
                onClick={() => onForget?.(c.id)}
              >
                记错了
              </button>
              <button
                type="button"
                className="shrink-0 underline-offset-2 hover:underline"
                style={{ color: 'var(--text-secondary)' }}
                title="改正：写入正确内容"
                onClick={() => onAmend?.(c.id, c.summary)}
              >
                改正
              </button>
            </>
          )}
        </span>
      ))}
    </div>
  )
}
