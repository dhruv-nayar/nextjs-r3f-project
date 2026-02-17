'use client'

import { useState, useEffect, useRef } from 'react'

interface DimensionInputProps {
  label: string
  value: number // Total value in feet
  onChange: (feet: number) => void
  readonly?: boolean
  labelWidth?: string
}

export function DimensionInput({
  label,
  value,
  onChange,
  readonly = false,
  labelWidth = 'w-16',
}: DimensionInputProps) {
  const [feet, setFeet] = useState(Math.floor(value))
  const [inches, setInches] = useState(Math.round((value % 1) * 12 * 10) / 10)

  // Sync with external value changes
  useEffect(() => {
    setFeet(Math.floor(value))
    setInches(Math.round((value % 1) * 12 * 10) / 10)
  }, [value])

  const handleFeetChange = (newFeet: number) => {
    setFeet(newFeet)
    onChange(newFeet + inches / 12)
  }

  const handleInchesChange = (newInches: number) => {
    // Clamp inches to valid range
    const clampedInches = Math.max(0, Math.min(11.9, newInches))
    setInches(clampedInches)
    onChange(feet + clampedInches / 12)
  }

  const inputClassName = `
    bg-white/10 text-white px-2 py-1.5 rounded-lg border border-white/20
    focus:border-orange-500 focus:outline-none text-sm
    ${readonly ? 'opacity-60 cursor-not-allowed' : ''}
  `

  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <input
        type="number"
        value={feet}
        onChange={(e) => handleFeetChange(parseInt(e.target.value) || 0)}
        min="0"
        disabled={readonly}
        className={`${inputClassName} w-14`}
      />
      <span className="text-white/50 text-xs">ft</span>
      <input
        type="number"
        value={inches.toFixed(1)}
        onChange={(e) => handleInchesChange(parseFloat(e.target.value) || 0)}
        step="0.1"
        min="0"
        max="11.9"
        disabled={readonly}
        className={`${inputClassName} w-14`}
      />
      <span className="text-white/50 text-xs">in</span>
    </div>
  )
}

/**
 * Simple number input for single values (like position, rotation)
 * Uses local state pattern to prevent cursor jumping.
 */
interface NumberInputProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  readonly?: boolean
  labelWidth?: string
  suffix?: string
}

export function NumberInput({
  label,
  value,
  onChange,
  step = 0.1,
  min,
  max,
  readonly = false,
  labelWidth = 'w-16',
  suffix,
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState(value.toString())
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value.toFixed(2))
    }
  }, [value, isFocused])

  const commitValue = () => {
    const parsed = parseFloat(localValue)
    if (!isNaN(parsed)) {
      let finalValue = parsed
      if (min !== undefined) finalValue = Math.max(min, finalValue)
      if (max !== undefined) finalValue = Math.min(max, finalValue)
      onChange(finalValue)
      setLocalValue(finalValue.toFixed(2))
    } else {
      // Revert to last valid value
      setLocalValue(value.toFixed(2))
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    commitValue()
  }

  const handleFocus = () => {
    setIsFocused(true)
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
      setLocalValue(value.toFixed(2))
      inputRef.current?.blur()
    }
  }

  const inputClassName = `
    flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20
    focus:border-orange-500 focus:outline-none text-sm
    ${readonly ? 'opacity-60 cursor-not-allowed' : ''}
  `

  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={readonly}
        className={inputClassName}
      />
      {suffix && <span className="text-white/50 text-xs">{suffix}</span>}
    </div>
  )
}
