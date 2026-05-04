import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helpText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[#4A4138]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2.5 border rounded-lg text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#6B8E7F] focus:border-transparent',
            'placeholder:text-[#7A6E60]',
            error
              ? 'border-red-400 bg-red-50'
              : 'border-[#E1D6C2] bg-white hover:border-[#C9BBA1]',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helpText && !error && <p className="text-xs text-[#7A6E60]">{helpText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
