import { cn } from '@/lib/design-system'

/**
 * Divider Components
 * Reusable dividers for visual separation
 */

interface DividerProps {
  className?: string
}

/**
 * Horizontal Divider - Subtle horizontal line
 * Default: 1px height, taupe/5 opacity
 */
export function HorizontalDivider({ className = '' }: DividerProps) {
  return <div className={cn('h-px bg-taupe/5', className)} />
}

/**
 * Vertical Divider - Subtle vertical line
 * Default: 1px width, 20px height, taupe/10 opacity
 */
export function VerticalDivider({ className = '' }: DividerProps) {
  return <div className={cn('w-px h-5 bg-taupe/10', className)} />
}

/**
 * Divider - Generic divider with orientation option
 */
interface GenericDividerProps extends DividerProps {
  orientation?: 'horizontal' | 'vertical'
  opacity?: 'subtle' | 'normal' | 'strong'
}

export function Divider({
  orientation = 'horizontal',
  className = '',
  opacity = 'subtle'
}: GenericDividerProps) {
  const opacityMap = {
    subtle: 'taupe/5',
    normal: 'taupe/10',
    strong: 'taupe/20'
  }

  const opacityClass = opacityMap[opacity]

  if (orientation === 'vertical') {
    return <div className={cn(`w-px bg-${opacityClass}`, className)} />
  }

  return <div className={cn(`h-px bg-${opacityClass}`, className)} />
}
