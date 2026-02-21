'use client'

import { CompositeShapePart } from '@/types/room'

interface PartTransformControlsProps {
  part: CompositeShapePart
  onPositionChange: (position: { x?: number; y?: number; z?: number }) => void
  onRotationChange: (rotation: { x?: number; y?: number; z?: number }) => void
}

/**
 * Controls for adjusting part position and rotation
 */
export function PartTransformControls({
  part,
  onPositionChange,
  onRotationChange,
}: PartTransformControlsProps) {
  const radToDeg = (rad: number) => Math.round((rad * 180) / Math.PI)
  const degToRad = (deg: number) => (deg * Math.PI) / 180

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Transform: {part.name}</h4>

      {/* Position controls */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Position (feet)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-400">X</label>
            <input
              type="number"
              value={part.position.x}
              onChange={(e) => onPositionChange({ x: parseFloat(e.target.value) || 0 })}
              step={0.5}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Y (height)</label>
            <input
              type="number"
              value={part.position.y}
              onChange={(e) => onPositionChange({ y: parseFloat(e.target.value) || 0 })}
              step={0.5}
              min={0}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Z</label>
            <input
              type="number"
              value={part.position.z}
              onChange={(e) => onPositionChange({ z: parseFloat(e.target.value) || 0 })}
              step={0.5}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Rotation controls */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Rotation (degrees)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-400">X (pitch)</label>
            <input
              type="number"
              value={radToDeg(part.rotation.x)}
              onChange={(e) => onRotationChange({ x: degToRad(parseFloat(e.target.value) || 0) })}
              step={15}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Y (yaw)</label>
            <input
              type="number"
              value={radToDeg(part.rotation.y)}
              onChange={(e) => onRotationChange({ y: degToRad(parseFloat(e.target.value) || 0) })}
              step={15}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Z (roll)</label>
            <input
              type="number"
              value={radToDeg(part.rotation.z)}
              onChange={(e) => onRotationChange({ z: degToRad(parseFloat(e.target.value) || 0) })}
              step={15}
              disabled={part.locked}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Quick rotation buttons */}
        <div className="flex gap-1">
          <span className="text-xs text-gray-400 mr-1">Quick Y:</span>
          {[0, 45, 90, 135, 180].map((deg) => (
            <button
              key={deg}
              onClick={() => onRotationChange({ y: degToRad(deg) })}
              disabled={part.locked}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                radToDeg(part.rotation.y) === deg
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {deg}°
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      <button
        onClick={() => {
          onPositionChange({ x: 0, y: 0, z: 0 })
          onRotationChange({ x: 0, y: 0, z: 0 })
        }}
        disabled={part.locked}
        className="w-full px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Reset Transform
      </button>
    </div>
  )
}
