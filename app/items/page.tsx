'use client'

import { useState } from 'react'
import { useItemLibrary } from '@/lib/item-library-context'
import { ItemCategory } from '@/types/room'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'
import Link from 'next/link'

export default function ItemsPage() {
  const { items, addItem } = useItemLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Create item form state
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('other')
  const [newItemTags, setNewItemTags] = useState('')
  const [newItemWidth, setNewItemWidth] = useState('3')
  const [newItemHeight, setNewItemHeight] = useState('3')
  const [newItemDepth, setNewItemDepth] = useState('3')
  const [newItemModelPath, setNewItemModelPath] = useState('')

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
    { value: 'all', label: 'All Items' },
    { value: 'seating', label: 'Seating' },
    { value: 'table', label: 'Tables' },
    { value: 'storage', label: 'Storage' },
    { value: 'bed', label: 'Beds' },
    { value: 'decoration', label: 'Decoration' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'other', label: 'Other' }
  ]

  const handleCreateItem = () => {
    if (!newItemName.trim()) {
      alert('Please enter an item name')
      return
    }
    if (!newItemModelPath.trim()) {
      alert('Please enter a model path')
      return
    }

    const newId = addItem({
      name: newItemName.trim(),
      description: newItemDescription.trim() || undefined,
      modelPath: newItemModelPath.trim(),
      dimensions: {
        width: parseFloat(newItemWidth) || 1,
        height: parseFloat(newItemHeight) || 1,
        depth: parseFloat(newItemDepth) || 1
      },
      category: newItemCategory,
      tags: newItemTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
      isCustom: true
    })

    // Reset form
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('other')
    setNewItemTags('')
    setNewItemWidth('3')
    setNewItemHeight('3')
    setNewItemDepth('3')
    setNewItemModelPath('')
    setShowCreateModal(false)
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
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium"
                >
                  Items
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
            <h2 className="text-3xl font-bold text-white mb-2">Items Library</h2>
            <p className="text-white/60">Manage your 3D model collection</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add Item
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search items by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50">
              🔍
            </span>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results Count */}
          <div className="text-white/60 text-sm">
            Showing {filteredItems.length} of {items.length} items
          </div>
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/60 text-lg mb-4">
              {searchQuery || selectedCategory !== 'all'
                ? 'No items match your search criteria'
                : 'No items in your library yet'
              }
            </p>
            {!searchQuery && selectedCategory === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Add Your First Item
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/20 group"
              >
                {/* Thumbnail/Preview */}
                <div className="aspect-square relative overflow-hidden">
                  <ItemThumbnail category={item.category} name={item.name} />

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Link
                      href={`/items/${item.id}`}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details
                    </Link>
                  </div>

                  {/* Badge */}
                  {!item.isCustom && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600/80 backdrop-blur-sm text-white text-xs font-medium rounded">
                      Built-in
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-1 truncate">
                    {item.name}
                  </h3>
                  <p className="text-white/60 text-sm mb-2 capitalize">
                    {item.category}
                  </p>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <span>
                      {item.dimensions.width.toFixed(1)}' × {item.dimensions.height.toFixed(1)}' × {item.dimensions.depth.toFixed(1)}'
                    </span>
                  </div>

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {item.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-1 text-white/60 text-xs">
                          +{item.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-white/20 rounded-2xl p-6 max-w-2xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-2xl font-bold">Add New Item</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Modern Office Chair"
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  placeholder="Ergonomic mesh back chair with adjustable height"
                  rows={3}
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Category
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as ItemCategory)}
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="seating">Seating</option>
                  <option value="table">Table</option>
                  <option value="storage">Storage</option>
                  <option value="bed">Bed</option>
                  <option value="decoration">Decoration</option>
                  <option value="lighting">Lighting</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Dimensions */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Dimensions (feet)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-white/60 text-xs mb-1">Width</label>
                    <input
                      type="number"
                      value={newItemWidth}
                      onChange={(e) => setNewItemWidth(e.target.value)}
                      step="0.1"
                      min="0.1"
                      className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1">Height</label>
                    <input
                      type="number"
                      value={newItemHeight}
                      onChange={(e) => setNewItemHeight(e.target.value)}
                      step="0.1"
                      min="0.1"
                      className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1">Depth</label>
                    <input
                      type="number"
                      value={newItemDepth}
                      onChange={(e) => setNewItemDepth(e.target.value)}
                      step="0.1"
                      min="0.1"
                      className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Model Path */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Model Path *
                </label>
                <input
                  type="text"
                  value={newItemModelPath}
                  onChange={(e) => setNewItemModelPath(e.target.value)}
                  placeholder="/models/chair.glb"
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
                <p className="text-white/40 text-xs mt-1">
                  Path to your .glb file in the public folder
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={newItemTags}
                  onChange={(e) => setNewItemTags(e.target.value)}
                  placeholder="modern, office, ergonomic"
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
                <p className="text-white/40 text-xs mt-1">
                  Comma-separated tags for easier searching
                </p>
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
                  onClick={handleCreateItem}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Create Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
