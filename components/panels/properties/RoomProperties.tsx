'use client'

import { useState, useEffect } from 'react'
import { Room } from '@/types/room'
import { useRoom } from '@/lib/room-context'
import { PropertySection, MeasurementInput, PropertyRow } from '../shared'

interface RoomPropertiesProps {
  room: Room
}

export function RoomProperties({ room }: RoomPropertiesProps) {
  const { updateRoom } = useRoom()
  const [name, setName] = useState(room.name)

  // Sync name with room changes
  useEffect(() => {
    setName(room.name)
  }, [room.name])

  const handleNameChange = (newName: string) => {
    setName(newName)
    updateRoom(room.id, { name: newName })
  }

  const handleDimensionChange = (
    dimension: 'width' | 'depth' | 'height',
    value: number
  ) => {
    const currentDimensions = room.dimensions || { width: 10, depth: 10, height: 10 }
    updateRoom(room.id, {
      dimensions: {
        ...currentDimensions,
        [dimension]: value,
      },
    })
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
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
            />
          </svg>
          <span className="text-white/50 text-sm">Room</span>
        </div>
      </div>

      {/* Name */}
      <PropertySection title="Name" collapsible={false}>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="w-full bg-white/10 text-white px-3 py-2 rounded-lg border border-white/20 focus:border-orange-500 focus:outline-none text-sm"
          placeholder="Room name"
        />
      </PropertySection>

      {/* Dimensions */}
      <PropertySection title="Dimensions">
        <MeasurementInput
          label="Width"
          value={dimensions.width}
          onChange={(v) => handleDimensionChange('width', v)}
          min={1}
        />
        <MeasurementInput
          label="Depth"
          value={dimensions.depth}
          onChange={(v) => handleDimensionChange('depth', v)}
          min={1}
        />
        <MeasurementInput
          label="Height"
          value={dimensions.height}
          onChange={(v) => handleDimensionChange('height', v)}
          min={1}
        />
      </PropertySection>

      {/* Info */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <PropertyRow label="Doors" labelWidth="w-16">
          <span className="text-white/60 text-sm">{room.doors?.length || 0}</span>
        </PropertyRow>
        <PropertyRow label="Items" labelWidth="w-16">
          <span className="text-white/60 text-sm">{room.instances?.length || 0}</span>
        </PropertyRow>
      </div>
    </div>
  )
}
