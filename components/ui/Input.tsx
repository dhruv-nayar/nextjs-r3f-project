import React, { ReactNode } from 'react'
import { cn } from '@/lib/design-system'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  fullWidth?: boolean
  inputSize?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = false, inputSize = 'md', className = '', icon, ...props }, ref) => {
    const baseStyles = 'bg-floral-white text-graphite placeholder:text-taupe/40 font-body transition-colors focus:outline-none focus:bg-white rounded-lg disabled:bg-floral-white/50 disabled:cursor-not-allowed'

    const sizeStyles = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const errorStyles = error ? 'border-scarlet/50 focus:ring-scarlet/50 focus:border-scarlet/50' : ''

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label className="block text-sm font-medium text-graphite mb-2 font-body">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              baseStyles,
              sizeStyles[inputSize],
              errorStyles,
              fullWidth && 'w-full',
              icon && 'pl-9',
              className
            )}
            {...props}
          />
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe/30 text-xs">
              {icon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-scarlet font-body">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input

/**
 * SearchInput - Specialized input for search functionality
 * Pre-configured with search icon and appropriate styling
 */
interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  width?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  width = 'w-80'
}: SearchInputProps) {
  return (
    <div className={cn('relative', width, className)}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 pl-9 bg-floral-white text-graphite placeholder:text-taupe/40 font-body text-sm focus:outline-none focus:bg-white transition-colors rounded-lg"
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe/30 text-xs">🔍</span>
    </div>
  )
}
