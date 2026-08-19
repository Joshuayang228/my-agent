/** 单项采用标记：只挂在有直接生产证据的 token、组件或故事上。 */

import { BadgeCheck } from 'lucide-react'

export function AdoptionMark({ label = '已采用' }: { label?: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
      style={{ color: 'var(--success)' }}
      title={label}
      aria-label={label}
      data-testid="adoption-mark"
    >
      <BadgeCheck size={13} strokeWidth={1.8} />
    </span>
  )
}
