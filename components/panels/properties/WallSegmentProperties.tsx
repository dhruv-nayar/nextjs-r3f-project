'use client'

import { useState } from 'react'
import type { WallSegment, WallSegmentDoor } from '@/types/wall-segment'
import type { FloorplanRoomV3 } from '@/types/floorplan-v2'
import { PropertySection, MeasurementInput } from '../shared'

interface WallSegmentPropertiesProps {
  segment: WallSegment
  side: 'A' | 'B'
  rooms: FloorplanRoomV3[]
  wallLength: number
  onStyleChange: (updates: { color?: string }) => void
  onAddDoor: (position: number, width?: number, height?: number) => boolean
  onRemoveDoor: (doorId: string) => void
  doorPlacementMode: boolean
  onSetDoorPlacementMode: (mode: boolean) => void
}

/**
 * Get room name for a wall side
 */
function getRoomNameForSide(
  segment: WallSegment,
  side: 'A' | 'B',
  rooms: FloorplanRoomV3[]
): string {
  const roomId = side === 'A' ? segment.sideA.roomId : segment.sideB.roomId

  if (roomId === null) {
    return 'Exterior'
  }

  const room = rooms.find(r => r.id === roomId)
  return room?.name ?? 'Unknown Room'
}

/**
 * Simple color picker with preset colors
 */
const PRESET_COLORS = [
  '#FFFFFF', // White
  '#F5F5F5', // Light gray
  '#E0E0E0', // Gray
  '#FFF8E1', // Cream
  '#FFECB3', // Light yellow
  '#FFE0B2', // Peach
  '#FFCCBC', // Light coral
  '#F8BBD0', // Light pink
  '#E1BEE7', // Light purple
  '#D1C4E9', // Lavender
  '#C5CAE9', // Light indigo
  '#BBDEFB', // Light blue
  '#B3E5FC', // Sky blue
  '#B2EBF2', // Light cyan
  '#B2DFDB', // Light teal
  '#C8E6C9', // Light green
  '#DCEDC8', // Light lime
  '#F0F4C3', // Light yellow-green
]

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value)

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded border border-white/20 shadow-inner"
          style={{ backgroundColor: value }}
          onClick={() => setIsOpen(!isOpen)}
          title="Click to change color"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm font-mono"
          placeholder="#FFFFFF"
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl z-50">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={`w-6 h-6 rounded border ${
                  value === color ? 'border-orange-400' : 'border-white/20'
                }`}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color)
                  setIsOpen(false)
                }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <button
              className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs py-1 px-2 rounded"
              onClick={() => {
                onChange(customColor)
                setIsOpen(false)
              }}
            >
              Apply Custom
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Door list item component
 */
function DoorListItem({
  door,
  index,
  onRemove,
}: {
  door: WallSegmentDoor
  index: number
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2 px-2 bg-white/5 rounded">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-white/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"
          />
        </svg>
        <div>
          <span className="text-white text-sm">Door {index + 1}</span>
          <span className="text-white/40 text-xs ml-2">
            {door.width}ft x {door.height}ft
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-red-400/60 hover:text-red-400 transition-colors p-1"
        title="Remove door"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
      </button>
    </div>
  )
}

/**
 * WallSegmentProperties: Properties panel for V3 two-sided wall segments
 *
 * Shows:
 * - Which side is selected (A or B)
 * - Room name for this side (or "Exterior")
 * - Color picker for the selected side
 * - Wall dimensions (read-only)
 * - Door management
 */
export function WallSegmentProperties({
  segment,
  side,
  rooms,
  wallLength,
  onStyleChange,
  onAddDoor,
  onRemoveDoor,
  doorPlacementMode,
  onSetDoorPlacementMode,
}: WallSegmentPropertiesProps) {
  const sideStyle = side === 'A' ? segment.sideA.style : segment.sideB.style
  const roomName = getRoomNameForSide(segment, side, rooms)
  const isExterior = (side === 'A' ? segment.sideA.roomId : segment.sideB.roomId) === null

  // State for quick door placement (center of wall)
  const [doorWidth, setDoorWidth] = useState(3)
  const [doorHeight, setDoorHeight] = useState(7)

  // Calculate if we can add a door (wall must be long enough)
  const MIN_EDGE_DISTANCE = 0.5
  const minWallLength = doorWidth + 2 * MIN_EDGE_DISTANCE
  const canAddDoor = wallLength >= minWallLength

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
          <span className="text-white font-medium">Wall Surface</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              isExterior
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-green-500/20 text-green-400'
            }`}
          >
            {isExterior ? 'Exterior' : 'Interior'}
          </span>
          <span className="text-white/50 text-xs">
            Side {side} · Facing {roomName}
          </span>
        </div>
      </div>

      {/* Color */}
      <PropertySection title="Wall Color">
        <div className="space-y-2">
          <label className="text-white/60 text-xs">Paint Color</label>
          <ColorPicker
            value={sideStyle.color}
            onChange={(color) => onStyleChange({ color })}
          />
        </div>
      </PropertySection>

      {/* Dimensions (read-only) */}
      <PropertySection title="Dimensions">
        <MeasurementInput
          label="Length"
          value={Math.round(wallLength * 10) / 10}
          onChange={() => {}}
          readonly={true}
        />
        <MeasurementInput
          label="Height"
          value={segment.height}
          onChange={() => {}}
          readonly={true}
        />
      </PropertySection>

      {/* Door Management */}
      <PropertySection title="Doors">
        {/* Existing doors list */}
        {segment.doors.length > 0 ? (
          <div className="space-y-2 mb-3">
            {segment.doors.map((door, index) => (
              <DoorListItem
                key={door.id}
                door={door}
                index={index}
                onRemove={() => onRemoveDoor(door.id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/40 text-xs mb-3">
            No doors on this wall segment.
          </p>
        )}

        {/* Door placement controls */}
        {doorPlacementMode ? (
          <div className="space-y-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-orange-400 text-sm font-medium">
                Click on wall to place door
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/50 text-xs">Width (ft)</label>
                <input
                  type="number"
                  value={doorWidth}
                  onChange={(e) => setDoorWidth(Math.max(1, parseFloat(e.target.value) || 3))}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
                  min={1}
                  max={10}
                  step={0.5}
                />
              </div>
              <div>
                <label className="text-white/50 text-xs">Height (ft)</label>
                <input
                  type="number"
                  value={doorHeight}
                  onChange={(e) => setDoorHeight(Math.max(1, Math.min(segment.height, parseFloat(e.target.value) || 7)))}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
                  min={1}
                  max={segment.height}
                  step={0.5}
                />
              </div>
            </div>
            <button
              onClick={() => onSetDoorPlacementMode(false)}
              className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {canAddDoor ? (
              <>
                <button
                  onClick={() => onSetDoorPlacementMode(true)}
                  className="w-full py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm rounded transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Add Door
                </button>
                <button
                  onClick={() => {
                    // Quick add: place door in center of wall
                    const centerPosition = (wallLength - doorWidth) / 2
                    onAddDoor(centerPosition, doorWidth, doorHeight)
                  }}
                  className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs rounded transition-colors"
                >
                  Quick Add (Center)
                </button>
              </>
            ) : (
              <p className="text-white/40 text-xs">
                Wall is too short for a door. Minimum length: {minWallLength.toFixed(1)}ft
              </p>
            )}
          </div>
        )}
      </PropertySection>

      {/* Info */}
      <PropertySection title="Tips" defaultOpen={false}>
        <div className="text-white/50 text-xs space-y-2">
          <p>
            Each wall has two sides that can be painted independently.
          </p>
          <p>
            Click on the other side of this wall to paint it a different color.
          </p>
          {segment.doors.length > 0 && (
            <p>
              This wall has {segment.doors.length} door opening{segment.doors.length > 1 ? 's' : ''}.
            </p>
          )}
        </div>
      </PropertySection>
    </div>
  )
}
