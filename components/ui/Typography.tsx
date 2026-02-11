import { ReactNode } from 'react'
import { cn } from '@/lib/design-system'

/**
 * Typography Components
 * Consistent text styling across the application
 */

interface TextProps {
  children: ReactNode
  className?: string
}

/**
 * Section Header - Used for section titles like "Quick Filters", "Sort by"
 * Style: Uppercase, tracked, small, muted
 */
export function SectionHeader({ children, className = '' }: TextProps) {
  return (
    <h3 className={cn('text-xs font-body uppercase tracking-wide text-taupe/50', className)}>
      {children}
    </h3>
  )
}

/**
 * Page Title - Used for main page headings like "Studio OMHU"
 * Style: Display font, medium weight
 */
export function PageTitle({ children, className = '' }: TextProps) {
  return (
    <h1 className={cn('text-lg font-display font-medium text-graphite', className)}>
      {children}
    </h1>
  )
}

/**
 * Item Name - Used for item card names
 * Style: Display font, tight leading
 */
export function ItemName({ children, className = '' }: TextProps) {
  return (
    <h3 className={cn('font-display text-base text-graphite leading-tight', className)}>
      {children}
    </h3>
  )
}

/**
 * Category Label - Used for category tags on item cards
 * Style: Very small, uppercase, tracked, light weight, muted
 */
export function CategoryLabel({ children, className = '' }: TextProps) {
  return (
    <p className={cn('text-taupe/40 text-[10px] font-body font-light uppercase tracking-wider', className)}>
      {children}
    </p>
  )
}

/**
 * Body Text - Default body text
 * Style: Body font, small, regular
 */
export function BodyText({ children, className = '' }: TextProps) {
  return (
    <p className={cn('font-body text-sm text-graphite', className)}>
      {children}
    </p>
  )
}

/**
 * Secondary Text - Muted secondary text
 * Style: Body font, small, lighter color
 */
export function SecondaryText({ children, className = '' }: TextProps) {
  return (
    <span className={cn('text-taupe/70 font-body text-sm', className)}>
      {children}
    </span>
  )
}

/**
 * Label Text - For form labels and small captions
 * Style: Extra small, muted
 */
export function LabelText({ children, className = '' }: TextProps) {
  return (
    <label className={cn('text-xs font-body text-taupe/50', className)}>
      {children}
    </label>
  )
}
