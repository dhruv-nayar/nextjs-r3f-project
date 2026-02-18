'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRoom } from '@/lib/room-context'
import { useHome } from '@/lib/home-context'
import { RoomTreeNode } from './hierarchy/RoomTreeNode'
import { ItemLibraryModal } from '../items/ItemLibraryModal'

export function SceneHierarchyPanel() {
  const router = useRouter()
  const { rooms, currentRoomId } = useRoom()
  const { currentHome } = useHome()
  const [showItemLibrary, setShowItemLibrary] = useState(false)

  return (
    <>
      <div className="fixed left-6 top-24 bottom-6 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 w-72 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-semibold text-sm">Scene</h2>
              {/* Add Item Button */}
              <button
                onClick={() => setShowItemLibrary(true)}
                className="w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
                title="Add item to room"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {currentHome && (
              <span className="text-white/50 text-xs truncate max-w-[100px]">
                {currentHome.name}
              </span>
            )}
          </div>
        </div>

      {/* Room Tree */}
      <div className="flex-1 overflow-y-auto p-3">
        {rooms.length === 0 ? (
          <div className="text-white/40 text-sm text-center py-8">
            No rooms yet.
            <br />
            <span className="text-xs">Create rooms in the floorplan editor.</span>
          </div>
        ) : (
          rooms.map((room) => (
            <RoomTreeNode
              key={room.id}
              room={room}
              isCurrentRoom={room.id === currentRoomId}
            />
          ))
        )}
      </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={() => {
              if (currentHome) {
                router.push(`/floorplan?homeId=${currentHome.id}`)
              }
            }}
            disabled={!currentHome}
            className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Edit Floorplan
          </button>
        </div>
      </div>

      {/* Item Library Modal */}
      <ItemLibraryModal
        isOpen={showItemLibrary}
        onClose={() => setShowItemLibrary(false)}
      />
    </>
  )
}
