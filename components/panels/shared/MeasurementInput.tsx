'use client'

import { useState, useEffect, useRef } from 'react'
import { parseMeasurement, formatFeetForDisplay } from '@/lib/utils/measurements'

interface MeasurementInputProps {
  label: string
  value: number // Value in decimal feet
  onChange: (feet: number) => void
  readonly?: boolean
  labelWidth?: string
  placeholder?: string
  min?: number
  max?: number
}

/**
 * Flexible measurement input that accepts multiple formats:
 * - 5'6" or 5' 6" (feet and inches with quotes)
 * - 5ft 6in or 5 ft 6 in (feet and inches with words)
 * - 5.5 ft or 5.5' (decimal feet)
 * - 66" or 66 in (inches only)
 * - 5.5 (plain number, defaults to feet)
 *
 * Uses local state pattern to prevent cursor jumping.
 */
export function MeasurementInput({
  label,
  value,
  onChange,
  readonly = false,
  labelWidth = 'w-16',
  placeholder = "5'6\" or 66\"",
  min,
  max,
}: MeasurementInputProps) {
  const [localValue, setLocalValue] = useState(() => formatFeetForDisplay(value))
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync with external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(formatFeetForDisplay(value))
      setError(null)
    }
  }, [value, isFocused])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    setError(null)
  }

  const commitValue = () => {
    const result = parseMeasurement(localValue)

    if (result.success) {
      let finalValue = result.feet

      // Apply min/max constraints
      if (min !== undefined) finalValue = Math.max(min, finalValue)
      if (max !== undefined) finalValue = Math.min(max, finalValue)

      onChange(finalValue)
      setLocalValue(formatFeetForDisplay(finalValue))
      setError(null)
    } else {
      setError(result.error || 'Invalid format')

      // Clear error timeout if exists
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }

      // Revert to last valid value after brief moment
      errorTimeoutRef.current = setTimeout(() => {
        setLocalValue(formatFeetForDisplay(value))
        setError(null)
      }, 1500)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    commitValue()
  }

  const handleFocus = () => {
    setIsFocused(true)
    // Select all text for easy replacement
    inputRef.current?.select()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitValue()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setLocalValue(formatFeetForDisplay(value))
      setError(null)
      inputRef.current?.blur()
    }
  }

  const inputClassName = `
    flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border
    focus:outline-none text-sm transition-colors
    ${error ? 'border-red-500/70' : 'border-white/20 focus:border-orange-500'}
    ${readonly ? 'opacity-60 cursor-not-allowed' : ''}
  `

  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={readonly}
          placeholder={placeholder}
          className={inputClassName}
        />
        {error && (
          <div className="absolute -bottom-5 left-0 text-red-400 text-xs whitespace-nowrap">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
