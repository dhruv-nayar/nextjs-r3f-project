'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface DropdownOption {
  label: string
  value: string
  href?: string
  onClick?: () => void
}

interface DropdownProps {
  label: string
  options: DropdownOption[]
  value?: string
  onChange?: (value: string) => void
  className?: string
  buttonClassName?: string
  header?: string
  showSeparator?: boolean
  footerOption?: DropdownOption
  /** Always show the label prop instead of the selected option's label */
  alwaysShowLabel?: boolean
}

export function Dropdown({
  label,
  options,
  value,
  onChange,
  className = '',
  buttonClassName,
  header,
  showSeparator = false,
  footerOption,
  alwaysShowLabel = false
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleOptionClick = (option: DropdownOption) => {
    if (option.onClick) {
      option.onClick()
    }
    if (onChange) {
      onChange(option.value)
    }
    setIsOpen(false)
  }

  const selectedOption = options.find(opt => opt.value === value)
  const displayLabel = alwaysShowLabel ? label : (selectedOption ? selectedOption.label : label)

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || "text-taupe/70 font-body font-medium hover:text-graphite transition-colors text-sm flex items-center gap-1"}
      >
        <span>{displayLabel}</span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-48 bg-white rounded-lg shadow-xl border border-taupe/10 py-2 z-50">
          {header && (
            <div className="px-3 py-1.5 text-xs font-body uppercase tracking-wide text-taupe/50">
              {header}
            </div>
          )}
          {options.map((option, i) => (
            <button
              key={i}
              onClick={() => handleOptionClick(option)}
              className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                value === option.value
                  ? 'text-graphite bg-taupe/5'
                  : 'text-graphite hover:bg-taupe/5'
              }`}
            >
              {option.label}
            </button>
          ))}
          {showSeparator && footerOption && (
            <>
              <div className="h-px bg-taupe/10 my-2" />
              <button
                onClick={() => handleOptionClick(footerOption)}
                className="block w-full text-left px-3 py-2 text-sm font-body text-taupe/70 hover:text-graphite hover:bg-taupe/5 transition-colors"
              >
                {footerOption.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
