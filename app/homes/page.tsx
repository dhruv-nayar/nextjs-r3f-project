'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useHome } from '@/lib/home-context'

export default function HomesPage() {
  const { homes, createHome, deleteHome, switchHome } = useHome()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Create home form state
  const [newHomeName, setNewHomeName] = useState('')
  const [newHomeDescription, setNewHomeDescription] = useState('')
  const [newRoomName, setNewRoomName] = useState('Living Room')

  const handleCreateHome = () => {
    if (!newHomeName.trim()) {
      alert('Please enter a home name')
      return
    }

    // Create a basic first room
    const firstRoom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim() || 'Living Room',
      homeId: '', // Will be set by context
      instances: [],
      cameraPosition: { x: 20, y: 15, z: 30 },
      cameraTarget: { x: 0, y: 2, z: 0 },
      lighting: {
        ambient: { intensity: Math.PI / 2 }
      }
    }

    createHome(newHomeName.trim(), [firstRoom])

    // Reset form
    setNewHomeName('')
    setNewHomeDescription('')
    setNewRoomName('Living Room')
    setShowCreateModal(false)
  }

  const handleDeleteHome = (homeId: string) => {
    deleteHome(homeId)
    setShowDeleteConfirm(null)
  }

  const handleOpenHome = (homeId: string) => {
    switchHome(homeId)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Navigation Bar */}
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-white">3D Home Editor</h1>
              <div className="flex gap-4">
                <Link
                  href="/items"
                  className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Items
                </Link>
                <Link
                  href="/homes"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium"
                >
                  Homes
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">My Homes</h2>
            <p className="text-white/60">Design and manage your 3D spaces</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Create Home
          </button>
        </div>

        {/* Homes Grid */}
        {homes.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏠</div>
            <p className="text-white/60 text-lg mb-4">No homes yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Create Your First Home
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map(home => {
              const totalInstances = home.rooms.reduce((sum, room) =>
                sum + (room.instances?.length || 0) + (room.furniture?.length || 0), 0
              )

              return (
                <div
                  key={home.id}
                  className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20 group"
                >
                  {/* Thumbnail/Preview */}
                  <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
                    {home.thumbnailPath ? (
                      <img
                        src={home.thumbnailPath}
                        alt={home.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-6xl text-white/20">🏠</div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Link
                        href="/"
                        onClick={() => handleOpenHome(home.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Open Editor
                      </Link>
                      {home.id !== 'example-home' && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            setShowDeleteConfirm(home.id)
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Home Info */}
                  <div className="p-4">
                    <h3 className="text-white font-semibold text-lg mb-1 truncate">
                      {home.name}
                    </h3>
                    {home.description && (
                      <p className="text-white/60 text-sm mb-2 line-clamp-2">
                        {home.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-white/50 mt-3">
                      <span>{home.rooms.length} room{home.rooms.length !== 1 ? 's' : ''}</span>
                      <span>{totalInstances} item{totalInstances !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Metadata */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-white/40">
                        Updated {new Date(home.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Home Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-2xl font-bold">Create New Home</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Home Name */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Home Name *
                </label>
                <input
                  type="text"
                  value={newHomeName}
                  onChange={(e) => setNewHomeName(e.target.value)}
                  placeholder="My Apartment"
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={newHomeDescription}
                  onChange={(e) => setNewHomeDescription(e.target.value)}
                  placeholder="2 bedroom apartment in downtown"
                  rows={2}
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* First Room Name */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  First Room Name
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Living Room"
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateHome}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-white text-xl font-bold mb-4">Delete Home?</h3>
            <p className="text-white/70 mb-6">
              Are you sure you want to delete <strong>{homes.find(h => h.id === showDeleteConfirm)?.name}</strong>? This will remove all rooms and items in this home.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteHome(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
