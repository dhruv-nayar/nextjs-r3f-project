'use client'

import { useState, ReactNode } from 'react'

interface PropertySectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  collapsible?: boolean
}

export function PropertySection({
  title,
  children,
  defaultOpen = true,
  collapsible = true,
}: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="mb-4">
      {/* Section Header */}
      <div
        className={`flex items-center justify-between mb-2 ${
          collapsible ? 'cursor-pointer' : ''
        }`}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        <h3 className="text-white font-medium text-sm">{title}</h3>
        {collapsible && (
          <svg
            className={`w-4 h-4 text-white/50 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Section Content */}
      {isOpen && <div className="space-y-2">{children}</div>}
    </div>
  )
}
