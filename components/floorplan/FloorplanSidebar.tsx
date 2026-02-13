'use client'

import { useFloorplan } from '@/lib/contexts/floorplan-context'
import { MIN_DOOR_CORNER_DISTANCE } from '@/types/floorplan'
import { useState, useEffect } from 'react'

export function FloorplanSidebar() {
  const {
    floorplanData,
    selectedRoomId,
    selectedDoorId,
    getRoom,
    getDoor,
    updateRoom,
    updateDoor,
    deleteRoom,
    deleteDoor
  } = useFloorplan()

  const selectedRoom = selectedRoomId ? getRoom(selectedRoomId) : null
  const selectedDoorInfo = selectedDoorId ? getDoor(selectedDoorId) : null

  return (
    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4">
        {selectedRoom && (
          <RoomPropertiesPanel
            room={selectedRoom}
            onUpdate={(updates) => updateRoom(selectedRoom.id, updates)}
            onDelete={() => deleteRoom(selectedRoom.id)}
          />
        )}

        {selectedDoorInfo && (
          <DoorPropertiesPanel
            room={selectedDoorInfo.room}
            door={selectedDoorInfo.door}
            onUpdate={(updates) => updateDoor(selectedDoorInfo.room.id, selectedDoorInfo.door.id, updates)}
            onDelete={() => deleteDoor(selectedDoorInfo.room.id, selectedDoorInfo.door.id)}
          />
        )}

        {!selectedRoom && !selectedDoorInfo && (
          <CanvasPropertiesPanel floorplanData={floorplanData} />
        )}
      </div>
    </div>
  )
}

interface RoomPropertiesPanelProps {
  room: any
  onUpdate: (updates: any) => void
  onDelete: () => void
}

function RoomPropertiesPanel({ room, onUpdate, onDelete }: RoomPropertiesPanelProps) {
  const [name, setName] = useState(room.name)
  const [width, setWidth] = useState(room.width)
  const [height, setHeight] = useState(room.height)
  const [wallHeight, setWallHeight] = useState(room.wallHeight)

  const handleUpdate = () => {
    onUpdate({ name, width, height, wallHeight })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Room Properties</h3>
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Room Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleUpdate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Dimensions
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="3"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Depth (ft)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="3"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Wall Height */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wall Height (ft)
          </label>
          <input
            type="number"
            value={wallHeight}
            onChange={(e) => setWallHeight(parseFloat(e.target.value))}
            onBlur={handleUpdate}
            min="6"
            max="15"
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Standard ceiling: 8-10ft</p>
        </div>

        {/* Doors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Doors
          </label>
          {room.doors.length === 0 ? (
            <p className="text-sm text-gray-500">No doors. Use the "Place Door" tool.</p>
          ) : (
            <div className="space-y-2">
              {room.doors.map((door: any, index: number) => (
                <div key={door.id} className="text-sm bg-gray-50 p-2 rounded">
                  Door {index + 1}: {door.wallSide} wall, {door.width}ft × {door.height}ft
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DoorPropertiesPanelProps {
  room: any
  door: any
  onUpdate: (updates: any) => void
  onDelete: () => void
}

function DoorPropertiesPanel({ room, door, onUpdate, onDelete }: DoorPropertiesPanelProps) {
  const [width, setWidth] = useState(door.width)
  const [height, setHeight] = useState(door.height)
  const [position, setPosition] = useState(door.position)

  // Sync local state with prop changes
  useEffect(() => {
    setWidth(door.width)
    setHeight(door.height)
    setPosition(door.position)
  }, [door.id, door.width, door.height, door.position])

  const handleUpdate = () => {
    console.log('[DoorPropertiesPanel] handleUpdate called:', { width, height, position })
    onUpdate({ width, height, position })
  }

  const wallLength = door.wallSide === 'top' || door.wallSide === 'bottom'
    ? room.width
    : room.height

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Door Properties</h3>
        <button
          onClick={onDelete}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          Delete
        </button>
      </div>

      <div className="space-y-4">
        {/* Wall */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Wall
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 capitalize">
            {door.wallSide} wall ({wallLength.toFixed(1)}ft long)
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Position from wall start (ft)
          </label>
          <input
            type="number"
            value={position}
            onChange={(e) => setPosition(parseFloat(e.target.value))}
            onBlur={handleUpdate}
            min={MIN_DOOR_CORNER_DISTANCE}
            max={wallLength - width - MIN_DOOR_CORNER_DISTANCE}
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Left edge of {width}ft door. Range: {MIN_DOOR_CORNER_DISTANCE.toFixed(1)} - {(wallLength - width - MIN_DOOR_CORNER_DISTANCE).toFixed(1)}ft
          </p>
        </div>

        {/* Dimensions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Door Size
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Width (ft)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="2"
                max="6"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Height (ft)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                onBlur={handleUpdate}
                min="6"
                max="8"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Standard: 3ft × 7ft</p>
        </div>
      </div>
    </div>
  )
}

interface CanvasPropertiesPanelProps {
  floorplanData: any
}

function CanvasPropertiesPanel({ floorplanData }: CanvasPropertiesPanelProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Floorplan Info</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Canvas Size
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
            {floorplanData?.canvasWidth || 50}ft × {floorplanData?.canvasHeight || 50}ft
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rooms
          </label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">
            {floorplanData?.rooms.length || 0} room(s)
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Instructions</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Use <strong>Draw Room</strong> to create rectangles</li>
            <li>• Use <strong>Place Door</strong> to click on walls</li>
            <li>• Use <strong>Select</strong> to move/resize rooms</li>
            <li>• Press <strong>Delete</strong> to remove selections</li>
            <li>• Use <strong>Cmd+Z/Y</strong> to undo/redo</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
