'use client'

import { useSelection } from '@/lib/selection-context'
import { useRoom } from '@/lib/room-context'
import { useItemLibrary } from '@/lib/item-library-context'
import {
  isRoomSelection,
  isWallSelection,
  isFloorSelection,
  isFurnitureSelection,
} from '@/types/selection'
import {
  RoomProperties,
  WallProperties,
  FloorProperties,
  FurnitureProperties,
} from './properties'

export function PropertiesPanel() {
  const { selection, clearSelection } = useSelection()
  const { rooms } = useRoom()
  const { getItem } = useItemLibrary()

  // If nothing selected, don't render
  if (!selection) return null

  // Find the relevant room based on selection
  const getRoomForSelection = () => {
    if (isRoomSelection(selection)) {
      return rooms.find((r) => r.id === selection.roomId)
    }
    if (isWallSelection(selection)) {
      return rooms.find((r) => r.id === selection.roomId)
    }
    if (isFloorSelection(selection)) {
      return rooms.find((r) => r.id === selection.roomId)
    }
    if (isFurnitureSelection(selection)) {
      return rooms.find((r) => r.id === selection.roomId)
    }
    return null
  }

  // Find the furniture instance if furniture is selected
  const getFurnitureInstance = () => {
    if (!isFurnitureSelection(selection)) return null
    for (const room of rooms) {
      const instance = room.instances?.find((i) => i.id === selection.instanceId)
      if (instance) return instance
    }
    return null
  }

  const room = getRoomForSelection()
  const instance = getFurnitureInstance()
  const item = instance ? getItem(instance.itemId) : null

  // Render appropriate properties based on selection type
  const renderProperties = () => {
    if (isRoomSelection(selection) && room) {
      return <RoomProperties room={room} />
    }

    if (isWallSelection(selection) && room) {
      return <WallProperties room={room} side={selection.side} />
    }

    if (isFloorSelection(selection) && room) {
      return <FloorProperties room={room} />
    }

    if (isFurnitureSelection(selection) && instance && item) {
      return <FurnitureProperties instance={instance} item={item} />
    }

    // Selection exists but data not found
    return (
      <div className="text-white/50 text-sm text-center py-8">
        Selected item not found.
        <br />
        <button
          onClick={clearSelection}
          className="text-orange-400 hover:text-orange-300 underline mt-2"
        >
          Clear selection
        </button>
      </div>
    )
  }

  return (
    <div className="fixed right-6 top-24 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 w-80 max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Properties</h2>
        <button
          onClick={clearSelection}
          className="text-white/50 hover:text-white transition-colors p-1"
          title="Close"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">{renderProperties()}</div>
    </div>
  )
}
