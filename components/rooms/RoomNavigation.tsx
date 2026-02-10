'use client'

import { useState } from 'react'
import { useRoom } from '@/lib/room-context'
import { FloorplanUpload } from '../floorplan/FloorplanUpload'
import { FloorplanConfig } from '@/types/room'

export function RoomNavigation() {
  const { rooms, currentRoomId, switchRoom, addRoom, updateRoom } = useRoom()
  const [showFloorplanUpload, setShowFloorplanUpload] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)

  const handleFloorplanUpload = (config: FloorplanConfig) => {
    if (editingRoomId) {
      // Update existing room
      updateRoom(editingRoomId, { floorplan: config })
    }
    setShowFloorplanUpload(false)
    setEditingRoomId(null)
  }

  const handleAddRoom = () => {
    const newRoom = {
      id: `room-${Date.now()}`,
      name: `Room ${rooms.length + 1}`,
      furniture: [],
      cameraPosition: { x: 0, y: 5.5, z: 20 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }
    addRoom(newRoom)
    switchRoom(newRoom.id)
  }

  const handleUploadFloorplan = (roomId: string) => {
    setEditingRoomId(roomId)
    setShowFloorplanUpload(true)
  }

  return (
    <>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Room Selector */}
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm font-medium">Room:</span>
              <select
                value={currentRoomId || ''}
                onChange={(e) => switchRoom(e.target.value)}
                className="bg-white/10 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:border-white/30 focus:outline-none"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id} className="bg-gray-900">
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-white/20" />

            {/* Add Room Button */}
            <button
              onClick={handleAddRoom}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
              title="Add New Room"
            >
              + Add Room
            </button>
          </div>
        </div>
      </div>

      {/* Floorplan Upload Modal */}
      {showFloorplanUpload && (
        <FloorplanUpload
          onUpload={handleFloorplanUpload}
          onCancel={() => {
            setShowFloorplanUpload(false)
            setEditingRoomId(null)
          }}
        />
      )}
    </>
  )
}
