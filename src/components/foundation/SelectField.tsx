import { forwardRef, type SelectHTMLAttributes } from 'react'

export const SelectField = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function SelectField({ className = '', ...props }, ref) {
  return <select {...props} ref={ref} className={`theme-input h-9 min-w-0 w-full rounded-md border px-2 text-xs outline-none disabled:opacity-50 ${className}`} />
})
