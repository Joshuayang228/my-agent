import { forwardRef, type SelectHTMLAttributes } from 'react'
import { SelectField } from './SelectField'

export interface TimeSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  value: string
}

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour))

/**
 * 背景：伙伴勿扰设置只支持整点，裸数字输入容易让用户误解为任意数值配置。
 * 设计意图：复用 Foundation SelectField 的原生选择与键盘行为，不引入日期库或自定义浮层。
 * 关键约束：组件只表达 0–23 的小时值；不得显示分钟或承担保存、跨午夜判断和通知调度。
 */
export const TimeSelect = forwardRef<HTMLSelectElement, TimeSelectProps>(function TimeSelect({ value, className = '', ...props }, ref) {
  return <SelectField {...props} ref={ref} value={value} className={className}>
    {HOURS.map((hour) => <option key={hour} value={hour}>{`${hour.padStart(2, '0')}:00`}</option>)}
  </SelectField>
})
