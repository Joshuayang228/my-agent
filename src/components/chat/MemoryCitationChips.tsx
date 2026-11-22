/**
 * 本轮记忆引用芯片（Chat 助手回复上方）。
 *
 * 背景：此前芯片文案混杂英文分类名（如 `记忆·preference`），且编辑入口常驻挤压阅读区。
 * 设计意图：统一翻译为中文分类名，采用 `--radius-pill` 轻胶囊与低对比语义边框；
 * 「记错了 / 改正」保留 Foundation `ActionButton` 与键盘可达，默认低对比收轻、悬停清晰浮现。
 * 关键约束：保留 `aria-label="本轮引用的记忆"` 与 Foundation `ActionButton` 绑定，Playground 与正式页共用。
 */

import { Bookmark } from 'lucide-react'
import type { MemoryCitation } from '../../shared/types'
import { ActionButton } from '../foundation/ActionButton'

const CATEGORY_LABEL: Record<string, string> = {
  preference: '偏好',
  fact: '事实',
  workflow: '习惯',
  voice: '语气',
  feedback: '反馈',
  relationship: '关系',
  emotion: '情绪',
  identity: '身份',
}

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
    <div className="mb-2 flex flex-wrap gap-1.5" aria-label="本轮引用的记忆">
      {citations.map((c) => {
        const categoryLabel = CATEGORY_LABEL[c.category] ?? c.category
        return (
          <span
            key={c.id}
            title={`${categoryLabel}：${c.summary}`}
            className="group/chip inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] leading-5 transition-colors"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <Bookmark size={11} className="shrink-0" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>
              {categoryLabel}
            </span>
            <span className="max-w-[14rem] truncate">
              {c.summary}
            </span>
            {showActions && (
              <span className="inline-flex shrink-0 items-center gap-1.5 pl-0.5 opacity-55 transition-opacity group-hover/chip:opacity-100 focus-within:opacity-100">
                <ActionButton
                  variant="plain"
                  className="!min-h-0 shrink-0 rounded-none border-0 !px-0 !py-0 text-[10px] underline-offset-2 hover:!bg-transparent hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                  title="记错了：从记忆库中移除这条引用"
                  onClick={() => onForget?.(c.id)}
                >
                  记错了
                </ActionButton>
                <ActionButton
                  variant="plain"
                  className="!min-h-0 shrink-0 rounded-none border-0 !px-0 !py-0 text-[10px] underline-offset-2 hover:!bg-transparent hover:underline"
                  style={{ color: 'var(--text-muted)' }}
                  title="改正：写入更准确的记忆"
                  onClick={() => onAmend?.(c.id, c.summary)}
                >
                  改正
                </ActionButton>
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
