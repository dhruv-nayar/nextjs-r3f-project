'use client'

import { ReactNode } from 'react'

interface PropertyRowProps {
  label: string
  children: ReactNode
  labelWidth?: string
}

export function PropertyRow({
  label,
  children,
  labelWidth = 'w-20',
}: PropertyRowProps) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  )
}
