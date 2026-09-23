import { forwardRef, type InputHTMLAttributes, type Ref, type TextareaHTMLAttributes } from 'react'

type TextFieldProps = (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>) & {
  multiline?: boolean
}

/**
 * 背景：工作区地址、命令和侧聊输入需要不同提交逻辑，但它们的文字颜色、边界、焦点和窄宽行为必须来自同一基础层。
 * 设计意图：只统一输入控件的视觉与稳定几何，保留调用方的 value、事件、禁用和提交语义；不把业务表单状态塞进基础组件。
 * 关键约束：单行与多行都使用语义 token，控件不会因 hover/disabled 或占位符变化改变外部布局；multiline 只改变原生元素类型。
 */
export const TextField = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextFieldProps>(function TextField({ multiline = false, className = '', style, ...props }, ref) {
  const classes = `min-w-0 border-0 bg-transparent text-[12px] foundation-text-field outline-none placeholder:text-[var(--text-muted)] ${className}`
  const sharedStyle = { color: 'var(--text-primary)', ...style }
  if (multiline) return <textarea {...props as TextareaHTMLAttributes<HTMLTextAreaElement>} ref={ref as Ref<HTMLTextAreaElement>} className={classes} style={sharedStyle} />
  return <input {...props as InputHTMLAttributes<HTMLInputElement>} ref={ref as Ref<HTMLInputElement>} className={classes} style={sharedStyle} />
})
