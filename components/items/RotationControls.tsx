'use client'

interface RotationControlsProps {
  label: string
  axis: 'X' | 'Z'
  step: number // 0, 1, 2, 3 (representing 0, 90, 180, 270 degrees)
  onChange: (step: number) => void
  disabled?: boolean
}

export function RotationControls({
  label,
  axis,
  step,
  onChange,
  disabled = false,
}: RotationControlsProps) {
  const degrees = step * 90

  const handleRotateCCW = () => {
    onChange((step - 1 + 4) % 4)
  }

  const handleRotateCW = () => {
    onChange((step + 1) % 4)
  }

  return (
    <div className="bg-white rounded-xl p-3 border border-taupe/10">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-taupe/50 font-body">{label}</p>
        <span className="text-xs text-sage font-body">{axis}-Axis</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Counter-clockwise button */}
        <button
          onClick={handleRotateCCW}
          disabled={disabled}
          className="p-2 bg-porcelain hover:bg-taupe/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Rotate 90° counter-clockwise"
        >
          <svg
            className="w-4 h-4 text-taupe/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d="M3 12a9 9 0 1 0 9-9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="3 3 3 9 9 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Current value display */}
        <div className="flex-1 text-center">
          <span className="text-sm font-body font-medium text-graphite">
            {degrees}°
          </span>
        </div>

        {/* Clockwise button */}
        <button
          onClick={handleRotateCW}
          disabled={disabled}
          className="p-2 bg-porcelain hover:bg-taupe/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Rotate 90° clockwise"
        >
          <svg
            className="w-4 h-4 text-taupe/70"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d="M21 12a9 9 0 1 1-9-9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="21 3 21 9 15 9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
