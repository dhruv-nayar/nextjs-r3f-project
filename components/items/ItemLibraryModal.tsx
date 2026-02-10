'use client'

import { useState } from 'react'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'
import { useRoom } from '@/lib/room-context'
import { ItemCategory } from '@/types/room'

interface ItemLibraryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ItemLibraryModal({ isOpen, onClose }: ItemLibraryModalProps) {
  const { items } = useItemLibrary()
  const { addInstanceToRoom } = useHome()
  const { currentRoom } = useRoom()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')

  if (!isOpen) return null

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const categories: Array<{ value: ItemCategory | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'seating', label: 'Seating' },
    { value: 'table', label: 'Tables' },
    { value: 'storage', label: 'Storage' },
    { value: 'bed', label: 'Beds' },
    { value: 'decoration', label: 'Decoration' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'other', label: 'Other' }
  ]

  const handlePlaceItem = (itemId: string) => {
    if (!currentRoom) {
      alert('No room selected')
      return
    }

    // Place item at center of room (0, 0, 0)
    const instanceId = addInstanceToRoom(currentRoom.id, itemId, { x: 0, y: 0, z: 0 })

    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 border border-white/20 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Add Items to Room</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
              🔍
            </span>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-white/60 text-lg">
                {searchQuery || selectedCategory !== 'all'
                  ? 'No items match your search'
                  : 'No items in your library'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handlePlaceItem(item.id)}
                  className="bg-black/40 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500 hover:bg-black/60 transition-all group text-left"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden flex items-center justify-center">
                    {item.thumbnailPath ? (
                      <img
                        src={item.thumbnailPath}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-5xl text-white/20">
                        {item.category === 'seating' && '🪑'}
                        {item.category === 'table' && '🪑'}
                        {item.category === 'storage' && '📚'}
                        {item.category === 'bed' && '🛏️'}
                        {item.category === 'decoration' && '🪴'}
                        {item.category === 'lighting' && '💡'}
                        {item.category === 'other' && '📦'}
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-blue-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white font-semibold text-sm px-4 py-2 bg-blue-600 rounded-lg">
                        Place Item
                      </div>
                    </div>
                  </div>

                  {/* Item Info */}
                  <div className="p-3">
                    <h3 className="text-white font-semibold text-sm truncate">
                      {item.name}
                    </h3>
                    <p className="text-white/60 text-xs capitalize">
                      {item.category}
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      {item.dimensions.width.toFixed(1)}' × {item.dimensions.height.toFixed(1)}' × {item.dimensions.depth.toFixed(1)}'
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <p className="text-white/50 text-sm text-center">
            Click an item to place it in the current room
          </p>
        </div>
      </div>
    </div>
  )
}
