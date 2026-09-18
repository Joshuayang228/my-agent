import { forwardRef, type InputHTMLAttributes } from 'react'

type CheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'>

/**
 * MCP 许可与基础样张曾各自声明复选框，主题及操作槽缺少统一来源。
 * 保留原生 input 的标签、键盘和表单行为，只集中尺寸与主题，不重新实现选择状态。
 * checked / disabled 由调用方持有；hover、选中及保存中均不得改变外部尺寸。
 */
export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField({ className = '', style, ...props }, ref) {
  return <input {...props} ref={ref} type="checkbox"
    className={`h-[16px] w-[16px] shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    style={{ accentColor: 'var(--accent-emphasis)', ...style }} />
})
