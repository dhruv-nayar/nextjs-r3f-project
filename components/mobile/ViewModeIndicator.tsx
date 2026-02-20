'use client'

import { cn } from '@/lib/design-system'

interface ViewModeIndicatorProps {
  className?: string
}

export function ViewModeIndicator({ className }: ViewModeIndicatorProps) {
  return (
    <div
      className={cn(
        'fixed top-20 left-1/2 -translate-x-1/2 z-40',
        'px-4 py-2 bg-graphite/80 backdrop-blur-sm rounded-full',
        'text-white text-sm font-body',
        'flex items-center gap-2',
        'pointer-events-none',
        className
      )}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
      View Only
    </div>
  )
}
