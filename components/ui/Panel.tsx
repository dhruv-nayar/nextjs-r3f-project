import { ReactNode } from 'react'
import { cn } from '@/lib/design-system'

/**
 * Panel Component
 * Reusable container with consistent styling for sidebars and content panels
 *
 * Features:
 * - Floral white background
 * - Rounded corners (2xl by default)
 * - Subtle border and diffuse shadow
 * - Optional sticky positioning
 * - Configurable width and padding
 */

interface PanelProps {
  children: ReactNode
  className?: string
  /** Enable sticky positioning */
  sticky?: boolean
  /** Sticky offset from top (e.g., 'top-28') */
  top?: string
  /** Panel width (e.g., 'w-64', 'w-80') */
  width?: string
  /** Panel padding (e.g., 'p-6', 'p-4') */
  padding?: string
  /** Shadow variant */
  shadow?: 'none' | 'panel' | 'card'
  /** Border variant */
  border?: 'none' | 'subtle' | 'extraSubtle'
}

export function Panel({
  children,
  className = '',
  sticky = false,
  top = 'top-28',
  width = 'w-64',
  padding = 'p-6',
  shadow = 'panel',
  border = 'extraSubtle'
}: PanelProps) {
  const shadowClass = {
    none: '',
    panel: 'shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)]',
    card: 'shadow-sm hover:shadow-md transition-shadow duration-200'
  }[shadow]

  const borderClass = {
    none: '',
    subtle: 'border border-taupe/5',
    extraSubtle: 'border border-taupe/[0.03]'
  }[border]

  return (
    <div className={cn(width, 'flex-shrink-0', className)}>
      <div
        className={cn(
          sticky && `sticky ${top}`,
          'bg-floral-white rounded-2xl',
          padding,
          borderClass,
          shadowClass
        )}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * PanelSection - Section within a panel
 * Provides consistent spacing between panel sections
 */
interface PanelSectionProps {
  children: ReactNode
  className?: string
}

export function PanelSection({ children, className = '' }: PanelSectionProps) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}
