import { BadgeCheck } from 'lucide-react'

/** 只表达一个事实：该设计或组件已经进入正式产品。未显示时不推断其他状态。 */
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
