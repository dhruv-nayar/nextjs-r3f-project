'use client'

import { ReactNode } from 'react'

interface HierarchyItemProps {
  label: string
  icon?: ReactNode
  indent?: number
  isSelected?: boolean
  isHovered?: boolean
  isExpanded?: boolean
  hasChildren?: boolean
  onClick?: () => void
  onToggle?: () => void
  onHover?: (hovered: boolean) => void
  secondaryLabel?: string
  className?: string
}

export function HierarchyItem({
  label,
  icon,
  indent = 0,
  isSelected = false,
  isHovered = false,
  isExpanded = false,
  hasChildren = false,
  onClick,
  onToggle,
  onHover,
  secondaryLabel,
  className = '',
}: HierarchyItemProps) {
  const paddingLeft = 12 + indent * 16

  return (
    <div
      className={`
        flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-sm
        ${isSelected
          ? 'bg-orange-500/30 border border-orange-400/50 text-orange-200'
          : isHovered
          ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-200'
          : 'border border-transparent text-white/80 hover:bg-white/5 hover:text-white'
        }
        ${className}
      `}
      style={{ paddingLeft }}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {/* Expand/Collapse chevron */}
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
          className="w-4 h-4 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Spacer when no chevron */}
      {!hasChildren && <div className="w-4" />}

      {/* Icon */}
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}

      {/* Label */}
      <span className="flex-1 truncate font-medium">{label}</span>

      {/* Secondary label (e.g., dimensions, count) */}
      {secondaryLabel && (
        <span className="text-xs text-white/50 ml-2">{secondaryLabel}</span>
      )}
    </div>
  )
}

// Icons for different item types
export const Icons = {
  room: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  wall: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  floor: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
    </svg>
  ),
  furniture: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  group: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  ),
}
