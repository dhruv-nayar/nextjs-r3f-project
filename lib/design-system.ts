/**
 * Studio OMHU Design System
 * Centralized design tokens and utility functions
 */

export const designSystem = {
  colors: {
    porcelain: '#FAF9F6',
    floralWhite: '#F9F6EE',
    taupe: '#48392A',
    graphite: '#2F2F2F',
    sage: '#69995D',
    scarlet: '#FF331F',
  },

  // Border styles
  borders: {
    subtle: 'border border-taupe/5',
    extraSubtle: 'border border-taupe/[0.03]',
    normal: 'border border-taupe/10',
    dashed: 'border-2 border-dashed border-taupe/15',
    dashedHover: 'border-2 border-dashed border-taupe/20 hover:border-taupe/30',
  },

  // Shadow styles
  shadows: {
    card: 'shadow-sm hover:shadow-md transition-shadow duration-200',
    panel: 'shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)]',
    button: 'shadow-lg',
    dropdown: 'shadow-xl',
  },

  // Rounded corners
  rounded: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    xl: 'rounded-3xl',
  },

  // Spacing
  spacing: {
    sectionGap: 'space-y-6',
    cardGap: 'gap-5',
    tightGap: 'gap-3',
    relaxedGap: 'gap-6',
  },

  // Transitions
  transitions: {
    default: 'transition-colors',
    all: 'transition-all',
    shadow: 'transition-shadow duration-200',
  },
}

/**
 * Utility function to combine CSS classes
 * Filters out falsy values and joins remaining classes
 *
 * @example
 * cn('base-class', condition && 'conditional-class', 'another-class')
 * // Returns: 'base-class another-class' (if condition is false)
 */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
