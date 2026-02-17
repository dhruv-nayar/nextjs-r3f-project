'use client'

import { Room } from '@/types/room'
import {
  WallSide,
  WALL_DISPLAY_NAMES,
  GRID_SPACING_OPTIONS,
  SurfaceGridSettings,
  createDefaultRoomGridState,
} from '@/types/selection'
import { useRoom } from '@/lib/room-context'
import { PropertySection, MeasurementInput, ToggleSwitch, SelectInput } from '../shared'

interface WallPropertiesProps {
  room: Room
  side: WallSide
}

export function WallProperties({ room, side }: WallPropertiesProps) {
  const { updateRoom } = useRoom()

  // Get current grid settings for this wall
  const gridState = room.gridSettings || createDefaultRoomGridState()
  const wallGrid = gridState.walls[side]

  const handleHeightChange = (height: number) => {
    const currentDimensions = room.dimensions || { width: 10, depth: 10, height: 10 }
    updateRoom(room.id, {
      dimensions: {
        ...currentDimensions,
        height,
      },
    })
  }

  const updateWallGrid = (updates: Partial<SurfaceGridSettings>) => {
    const currentGridState = room.gridSettings || createDefaultRoomGridState()
    updateRoom(room.id, {
      gridSettings: {
        ...currentGridState,
        walls: {
          ...currentGridState.walls,
          [side]: {
            ...currentGridState.walls[side],
            ...updates,
          },
        },
      },
    })
  }

  // Calculate wall length based on side
  const getWallLength = () => {
    if (!room.dimensions) return 0
    return side === 'north' || side === 'south'
      ? room.dimensions.width
      : room.dimensions.depth
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
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
            />
          </svg>
          <span className="text-white font-medium">{WALL_DISPLAY_NAMES[side]}</span>
        </div>
        <p className="text-white/50 text-xs mt-1">
          Part of {room.name}
        </p>
      </div>

      {/* Dimensions */}
      <PropertySection title="Dimensions">
        <MeasurementInput
          label="Length"
          value={getWallLength()}
          onChange={() => {}} // Read-only - determined by room
          readonly={true}
        />
        <MeasurementInput
          label="Height"
          value={dimensions.height}
          onChange={handleHeightChange}
          min={1}
        />
        <p className="text-white/40 text-xs mt-1 ml-16">
          Height affects all walls in this room
        </p>
      </PropertySection>

      {/* Grid Settings */}
      <PropertySection title="Measurement Grid">
        <ToggleSwitch
          label="Show Grid"
          checked={wallGrid.enabled}
          onChange={(enabled) => updateWallGrid({ enabled })}
        />

        {wallGrid.enabled && (
          <>
            <SelectInput
              label="Spacing"
              value={wallGrid.spacing.toString()}
              onChange={(v) => updateWallGrid({ spacing: parseFloat(v) })}
              options={GRID_SPACING_OPTIONS.map((opt) => ({
                value: opt.value.toString(),
                label: opt.label,
              }))}
            />
            <ToggleSwitch
              label="Rulers"
              checked={wallGrid.showRulers}
              onChange={(showRulers) => updateWallGrid({ showRulers })}
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
