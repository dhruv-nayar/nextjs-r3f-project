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
