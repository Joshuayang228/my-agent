import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ActionButton } from './ActionButton'
import { readingContentStyle } from '../../shared/content-layout'

export interface DetailHeaderProps {
  backLabel?: string
  onBack: () => void
  action?: ReactNode
  /** 默认按共享阅读宽度居中对齐，确保返回按钮与正文卡片左边界一致 */
  alignReading?: boolean
  className?: string
}

/**
 * 统一详情页顶栏（Foundation 原语）。
 *
 * 背景：文化角、足迹、日记、礼物等详情页此前各自手写返回栏与右侧操作槽，
 * 多次出现「和TA聊聊」悬在宽屏中间或返回栏与正文左边界错位的问题。
 * 设计意图：收口「左侧返回 + 右侧操作」结构，默认复用 readingContentStyle() 居中对齐。
 * 关键约束：仅负责详情顶栏布局，返回逻辑与业务操作按钮由调用方注入。
 */
export function DetailHeader({
  backLabel = '返回列表',
  onBack,
  action,
  alignReading = true,
  className = '',
}: DetailHeaderProps) {
  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-2 ${className}`.trim()}
      style={alignReading ? readingContentStyle() : undefined}
    >
      <ActionButton variant="plain" onClick={onBack}>
        <ArrowLeft size={14} className="mr-1.5" />
        {backLabel}
      </ActionButton>
      {action && <div className="flex items-center gap-1.5">{action}</div>}
    </div>
  )
}
