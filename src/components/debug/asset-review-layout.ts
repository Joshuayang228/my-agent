import type { CSSProperties } from 'react'
import { SPACING } from '../../shared/content-layout'

// 来源表曾与版本入口相贴；候选和正式页共用 Foundation 档位，禁止再以局部像素值维护第二套间距。
export const reviewSpacingStyle = {
  '--review-gap-item': `${SPACING.tight}px`,
  '--review-gap-content': `${SPACING.compact}px`,
} as CSSProperties

export const REVIEW_SECTIONS = {
  conversation: { label: '主对话与表达', priority: 10 }, identity: { label: '人物身份', priority: 20 },
  growth: { label: '成长与关系', priority: 30 }, world: { label: '世界与生活', priority: 40 },
  social: { label: '朋友圈与互动', priority: 45 }, visual: { label: '视觉与图片', priority: 47 },
  memory: { label: '记忆与成长', priority: 50 }, proactive: { label: '主动消息', priority: 55 },
  tools: { label: '工具与技能', priority: 60 },
  evaluation: { label: '验收', priority: 70 }, model: { label: '模型配置', priority: 80 },
  platform: { label: '平台规则与上下文', priority: 100 },
} as const
