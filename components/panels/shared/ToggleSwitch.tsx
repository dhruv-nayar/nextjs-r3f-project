'use client'

interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  labelWidth?: string
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
  labelWidth = 'w-20',
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-orange-500' : 'bg-white/20'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}

/**
 * Select dropdown for choosing from options
 */
interface SelectInputProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  options: Array<{ value: string | number; label: string }>
  labelWidth?: string
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  labelWidth = 'w-20',
}: SelectInputProps) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-white/70 text-sm ${labelWidth} flex-shrink-0`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-white/10 text-white px-3 py-1.5 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-graphite text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
