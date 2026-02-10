'use client'

import { useState } from 'react'
import { useRoom } from '@/lib/room-context'
import { useFurnitureHover } from '@/lib/furniture-hover-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useRoomHover } from '@/lib/room-hover-context'
import { useItemLibrary } from '@/lib/item-library-context'
import { ItemLibraryModal } from '@/components/items/ItemLibraryModal'

export function FurnitureSidebar() {
  const { rooms, currentRoomId, switchRoom } = useRoom()
  const { hoveredFurnitureId, setHoveredFurnitureId } = useFurnitureHover()
  const { selectedFurnitureId, setSelectedFurnitureId } = useFurnitureSelection()
  const { hoveredRoomId, setHoveredRoomId } = useRoomHover()
  const { getItem } = useItemLibrary()
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set([currentRoomId || '']))
  const [showItemLibrary, setShowItemLibrary] = useState(false)

  const toggleRoom = (roomId: string) => {
    const newExpanded = new Set(expandedRooms)
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId)
    } else {
      newExpanded.add(roomId)
    }
    setExpandedRooms(newExpanded)
  }

  return (
    <>
      <div className="fixed right-6 top-24 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 w-80 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-lg">Furniture</h2>
            <button
              onClick={() => setShowItemLibrary(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Items</span>
            </button>
          </div>

        {rooms.map((room) => {
          const isExpanded = expandedRooms.has(room.id)
          const isCurrentRoom = room.id === currentRoomId
          const isRoomHovered = hoveredRoomId === room.id

          // Combine furniture and instances for display
          const furniture = room.furniture || []
          const instances = room.instances || []
          const totalCount = furniture.length + instances.length

          return (
            <div key={room.id} className="mb-3">
              {/* Room Header */}
              <button
                onClick={() => toggleRoom(room.id)}
                onMouseEnter={() => setHoveredRoomId(room.id)}
                onMouseLeave={() => setHoveredRoomId(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  isRoomHovered
                    ? 'bg-cyan-500/30 border-2 border-cyan-400 text-white'
                    : isCurrentRoom
                    ? 'bg-blue-600 text-white border-2 border-transparent'
                    : 'bg-white/10 text-white hover:bg-white/20 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{room.name}</span>
                  <span className="text-xs opacity-70">({totalCount})</span>
                </div>
                <span className="text-xs">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>

              {/* Furniture List */}
              {isExpanded && (
                <div className="mt-2 ml-4 space-y-1">
                  {totalCount === 0 ? (
                    <p className="text-white/50 text-sm py-2 px-3">No furniture</p>
                  ) : (
                    <>
                      {/* Legacy furniture items */}
                      {furniture.map((item) => {
                        const isItemHovered = hoveredFurnitureId === item.id
                        const isItemSelected = selectedFurnitureId === item.id
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                              isItemSelected
                                ? 'bg-orange-500/30 border-2 border-orange-400 text-white'
                                : isItemHovered
                                ? 'bg-cyan-500/30 border-2 border-cyan-400 text-white'
                                : 'bg-white/5 text-white/90 hover:bg-white/10 border-2 border-transparent'
                            }`}
                            onMouseEnter={() => setHoveredFurnitureId(item.id)}
                            onMouseLeave={() => setHoveredFurnitureId(null)}
                            onClick={() => setSelectedFurnitureId(item.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-white/60">
                                  {item.category || 'uncategorized'}
                                </p>
                              </div>
                              <div className="text-xs text-white/50">
                                <p>x: {item.position.x.toFixed(1)}</p>
                                <p>z: {item.position.z.toFixed(1)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* New item instances */}
                      {instances.map((instance) => {
                        const item = getItem(instance.itemId)
                        if (!item) return null

                        const isItemHovered = hoveredFurnitureId === instance.id
                        const isItemSelected = selectedFurnitureId === instance.id
                        const displayName = instance.customName || item.name

                        return (
                          <div
                            key={instance.id}
                            className={`rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                              isItemSelected
                                ? 'bg-orange-500/30 border-2 border-orange-400 text-white'
                                : isItemHovered
                                ? 'bg-cyan-500/30 border-2 border-cyan-400 text-white'
                                : 'bg-white/5 text-white/90 hover:bg-white/10 border-2 border-transparent'
                            }`}
                            onMouseEnter={() => setHoveredFurnitureId(instance.id)}
                            onMouseLeave={() => setHoveredFurnitureId(null)}
                            onClick={() => setSelectedFurnitureId(instance.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{displayName}</p>
                                <p className="text-xs text-white/60">
                                  {item.category || 'uncategorized'}
                                </p>
                              </div>
                              <div className="text-xs text-white/50">
                                <p>x: {instance.position.x.toFixed(1)}</p>
                                <p>z: {instance.position.z.toFixed(1)}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>

    {/* Item Library Modal */}
    <ItemLibraryModal isOpen={showItemLibrary} onClose={() => setShowItemLibrary(false)} />
    </>
  )
}
