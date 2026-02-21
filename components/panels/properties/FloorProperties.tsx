'use client'

import { Room } from '@/types/room'
import {
  GRID_SPACING_OPTIONS,
  SurfaceGridSettings,
  createDefaultRoomGridState,
} from '@/types/selection'
import { useRoom } from '@/lib/room-context'
import { PropertySection, DimensionInput, ToggleSwitch, SelectInput } from '../shared'

interface FloorPropertiesProps {
  room: Room
}

export function FloorProperties({ room }: FloorPropertiesProps) {
  const { updateRoom } = useRoom()

  // Get current grid settings for floor
  const gridState = room.gridSettings || createDefaultRoomGridState()
  const floorGrid = gridState.floor

  const updateFloorGrid = (updates: Partial<SurfaceGridSettings>) => {
    const currentGridState = room.gridSettings || createDefaultRoomGridState()
    const newGridSettings = {
      ...currentGridState,
      floor: {
        ...currentGridState.floor,
        ...updates,
      },
    }
    console.log('[FloorProperties] updateFloorGrid:', { updates, newGridSettings })
    updateRoom(room.id, { gridSettings: newGridSettings })
  }

  const dimensions = room.dimensions || { width: 10, depth: 10, height: 10 }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
            />
          </svg>
          <span className="text-white font-medium">Floor</span>
        </div>
        <p className="text-white/50 text-xs mt-1">
          Part of {room.name}
        </p>
      </div>

      {/* Dimensions (read-only, from room) */}
      <PropertySection title="Dimensions">
        <DimensionInput
          label="Width"
          value={dimensions.width}
          onChange={() => {}}
          readonly={true}
        />
        <DimensionInput
          label="Depth"
          value={dimensions.depth}
          onChange={() => {}}
          readonly={true}
        />
        <p className="text-white/40 text-xs mt-1 ml-16">
          Edit room dimensions to change floor size
        </p>
      </PropertySection>

      {/* Area calculation */}
      <PropertySection title="Area" collapsible={false}>
        <div className="bg-white/5 rounded-lg px-3 py-2">
          <span className="text-white font-medium">
            {(dimensions.width * dimensions.depth).toFixed(1)} sq ft
          </span>
        </div>
      </PropertySection>

      {/* Grid Settings */}
      <PropertySection title="Measurement Grid">
        <ToggleSwitch
          label="Show Grid"
          checked={floorGrid.enabled}
          onChange={(enabled) => updateFloorGrid({ enabled })}
        />

        {floorGrid.enabled && (
          <>
            <SelectInput
              label="Spacing"
              value={floorGrid.spacing.toString()}
              onChange={(v) => updateFloorGrid({ spacing: parseFloat(v) })}
              options={GRID_SPACING_OPTIONS.map((opt) => ({
                value: opt.value.toString(),
                label: opt.label,
              }))}
            />
            <ToggleSwitch
              label="Rulers"
              checked={floorGrid.showRulers}
              onChange={(showRulers) => updateFloorGrid({ showRulers })}
            />
          </>
        )}
      </PropertySection>

      {/* Texture (placeholder) */}
      <PropertySection title="Appearance" defaultOpen={false}>
        <p className="text-white/40 text-xs">
          Texture and material options coming soon.
        </p>
      </PropertySection>
    </div>
  )
}
