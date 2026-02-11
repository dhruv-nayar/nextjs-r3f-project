'use client'

interface DimensionInputProps {
  dimensions: { width: number; height: number; depth: number }
  onChange: (dimensions: { width: number; height: number; depth: number }) => void
  autoDetected?: boolean
}

export function DimensionInput({ dimensions, onChange, autoDetected }: DimensionInputProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Dimensions (feet)</label>
        {autoDetected && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            Auto-detected
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Width</label>
          <div className="relative">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={dimensions.width}
              onChange={(e) => onChange({ ...dimensions, width: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              ft
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Height</label>
          <div className="relative">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={dimensions.height}
              onChange={(e) => onChange({ ...dimensions, height: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              ft
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Depth</label>
          <div className="relative">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={dimensions.depth}
              onChange={(e) => onChange({ ...dimensions, depth: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 pr-10 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              ft
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
