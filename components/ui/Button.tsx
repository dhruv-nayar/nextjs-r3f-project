import React from 'react'
import { cn } from '@/lib/design-system'

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onClick?: () => void
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  fullWidth?: boolean
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
  fullWidth = false,
}) => {
  const baseStyles = 'font-body rounded-lg transition-colors focus:outline-none'

  const variantStyles = {
    primary: 'bg-taupe hover:bg-taupe/90 text-white shadow-lg',
    secondary: 'bg-floral-white text-taupe/60 hover:text-graphite border border-taupe/10',
    danger: 'bg-scarlet hover:bg-scarlet/90 text-white shadow-lg',
    ghost: 'hover:bg-taupe/5 text-taupe/70 hover:text-graphite',
  }

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {children}
    </button>
  )
}

export default Button
