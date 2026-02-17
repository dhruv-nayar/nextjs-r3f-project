'use client'

import { FloorplanDoorV2, FloorplanWallV2, FloorplanVertex } from '@/types/floorplan-v2'

interface DoorPropertiesPanelProps {
  door: FloorplanDoorV2
  wall: FloorplanWallV2
  vertices: FloorplanVertex[]
  onUpdate: (updates: { position?: number; width?: number }) => void
  onDelete: () => void
  onClose: () => void
}

export function DoorPropertiesPanel({
  door,
  wall,
  vertices,
  onUpdate,
  onDelete,
  onClose
}: DoorPropertiesPanelProps) {
  const startV = vertices.find(v => v.id === wall.startVertexId)
  const endV = vertices.find(v => v.id === wall.endVertexId)

  if (!startV || !endV) return null

  const dx = endV.x - startV.x
  const dy = endV.y - startV.y
  const wallLength = Math.sqrt(dx * dx + dy * dy)

  // Format feet as "XX'YY\""
  const formatFeet = (feet: number) => {
    const wholeFeet = Math.floor(feet)
    const inches = Math.round((feet - wholeFeet) * 12)
    return inches === 0 ? `${wholeFeet}'` : `${wholeFeet}'${inches}"`
  }

  return (
    <div className="absolute top-4 right-4 bg-white border border-taupe/20 rounded-lg shadow-lg p-4 w-72 z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-graphite font-display font-semibold text-lg">Door Properties</h3>
        <button
          onClick={onClose}
          className="text-taupe/60 hover:text-graphite text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Position Slider */}
      <div className="mb-4">
        <label className="block text-graphite/80 text-sm font-medium font-body mb-2">
          Position from wall start
        </label>
        <input
          type="range"
          min={1}
          max={Math.max(1, wallLength - door.width - 1)}
          step={0.5}
          value={door.position}
          onChange={(e) => onUpdate({ position: parseFloat(e.target.value) })}
          className="w-full accent-sage"
        />
        <div className="flex justify-between text-xs text-taupe/60 mt-1">
          <span>1'</span>
          <span className="font-medium text-sage">{formatFeet(door.position)}</span>
          <span>{formatFeet(wallLength - door.width - 1)}</span>
        </div>
      </div>

      {/* Width Slider */}
      <div className="mb-4">
        <label className="block text-graphite/80 text-sm font-medium font-body mb-2">
          Door width
        </label>
        <input
          type="range"
          min={2}
          max={4}
          step={0.5}
          value={door.width}
          onChange={(e) => onUpdate({ width: parseFloat(e.target.value) })}
          className="w-full accent-sage"
        />
        <div className="flex justify-between text-xs text-taupe/60 mt-1">
          <span>2'</span>
          <span className="font-medium text-sage">{formatFeet(door.width)}</span>
          <span>4'</span>
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="w-full px-4 py-2.5 bg-scarlet hover:bg-scarlet/90 text-white rounded-lg font-medium font-body transition-colors"
      >
        Delete Door
      </button>
    </div>
  )
}
