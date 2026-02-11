'use client'

import { useState } from 'react'
import { useItemLibrary } from '@/lib/item-library-context'
import { ItemCategory, GLBUploadResult, ImageUploadResult } from '@/types/room'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'
import { GLBUpload } from '@/components/items/GLBUpload'
import { ImageUpload } from '@/components/items/ImageUpload'
import { DimensionInput } from '@/components/items/DimensionInput'
import Link from 'next/link'
import Image from 'next/image'

export default function ItemsPage() {
  const { items, addItem } = useItemLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Upload flow state
  const [uploadStep, setUploadStep] = useState<'choose' | 'upload' | 'metadata'>('choose')
  const [uploadMethod, setUploadMethod] = useState<'glb' | 'images' | null>(null)
  const [uploadedModelPath, setUploadedModelPath] = useState('')
  const [uploadedThumbnailPath, setUploadedThumbnailPath] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0)
  const [uploadError, setUploadError] = useState('')

  // Create item form state
  const [newItemName, setNewItemName] = useState('')
  const [newItemDescription, setNewItemDescription] = useState('')
  const [newItemCategory, setNewItemCategory] = useState<ItemCategory>('other')
  const [newItemTags, setNewItemTags] = useState('')
  const [newItemDimensions, setNewItemDimensions] = useState({
    width: 3,
    height: 3,
    depth: 3
  })

  // Filter items based on search and category
  const filteredItems = items.filter(item => {
    // Skip items without valid model paths
    if (!item.modelPath || item.modelPath === 'placeholder') {
      return false
    }

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

  const handleUploadMethodSelect = (method: 'glb' | 'images') => {
    setUploadMethod(method)
    setUploadStep('upload')
  }

  const handleGLBUploadComplete = (result: GLBUploadResult) => {
    setUploadedModelPath(result.modelPath)
    setUploadedThumbnailPath(result.thumbnailPath || '')
    setUploadStep('metadata')
  }

  const handleImageUploadComplete = (result: ImageUploadResult) => {
    setUploadedImages(result.imagePaths)
    setSelectedThumbnailIndex(result.selectedThumbnailIndex || 0)
    setUploadedThumbnailPath(result.imagePaths[result.selectedThumbnailIndex || 0])
    setUploadStep('metadata')
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
  }

  const handleCreateItem = () => {
    if (!newItemName.trim()) {
      alert('Please enter an item name')
      return
    }

    // For GLB uploads, require a model path
    if (uploadMethod === 'glb' && !uploadedModelPath.trim()) {
      alert('Please upload a 3D model')
      return
    }

    // For image uploads, use a placeholder model path (will be replaced when 3D generation is implemented)
    const modelPath = uploadMethod === 'glb' ? uploadedModelPath.trim() : 'placeholder'

    const newId = addItem({
      name: newItemName.trim(),
      description: newItemDescription.trim() || undefined,
      modelPath,
      thumbnailPath: uploadedThumbnailPath.trim() || undefined,
      dimensions: newItemDimensions,
      category: newItemCategory,
      tags: newItemTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
      isCustom: true
    })

    // Reset form
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('other')
    setNewItemTags('')
    setNewItemDimensions({ width: 3, height: 3, depth: 3 })
    setUploadedModelPath('')
    setUploadedThumbnailPath('')
    setUploadedImages([])
    setSelectedThumbnailIndex(0)
    setUploadMethod(null)
    setUploadStep('choose')
    setUploadError('')
    setShowCreateModal(false)
  }

  const handleCloseModal = () => {
    // Reset all state
    setNewItemName('')
    setNewItemDescription('')
    setNewItemCategory('other')
    setNewItemTags('')
    setNewItemDimensions({ width: 3, height: 3, depth: 3 })
    setUploadedModelPath('')
    setUploadedThumbnailPath('')
    setUploadedImages([])
    setSelectedThumbnailIndex(0)
    setUploadMethod(null)
    setUploadStep('choose')
    setUploadError('')
    setShowCreateModal(false)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation Bar */}
      <nav className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <h1 className="text-2xl font-bold text-gray-900">3D Home Editor</h1>
              <div className="flex gap-4">
                <Link
                  href="/items"
                  className="px-4 py-2 text-white bg-blue-600 rounded-lg font-medium"
                >
                  Items
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Items Library</h2>
            <p className="text-gray-600">Manage your 3D model collection</p>
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
              className="w-full px-4 py-3 pl-12 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
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
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results Count */}
          <div className="text-gray-600 text-sm">
            Showing {filteredItems.length} of {items.length} items
          </div>
        </div>

        {/* Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 text-lg mb-4">
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
                className="rounded-xl overflow-hidden transition-all hover:shadow-lg group"
              >
                {/* Thumbnail/Preview */}
                <div className="aspect-square relative overflow-hidden">
                  <ItemThumbnail category={item.category} name={item.name} thumbnailPath={item.thumbnailPath} />

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
                    <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded">
                      Built-in
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="pt-3">
                  <h3 className="text-gray-900 font-semibold text-lg mb-1 truncate">
                    {item.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2 capitalize">
                    {item.category}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
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
                          className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="px-2 py-1 text-gray-600 text-xs">
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
              <div>
                <h3 className="text-white text-2xl font-bold">Add New Item</h3>
                <p className="text-white/60 text-sm mt-1">
                  {uploadStep === 'choose' && 'Choose how to add your 3D model'}
                  {uploadStep === 'upload' && 'Upload your file'}
                  {uploadStep === 'metadata' && 'Fill in item details'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-white/60 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Step 1: Choose Upload Method */}
            {uploadStep === 'choose' && (
              <div className="space-y-4">
                {/* GLB Upload Option */}
                <button
                  onClick={() => handleUploadMethodSelect('glb')}
                  className="w-full p-6 bg-black/40 border-2 border-white/20 hover:border-blue-500 rounded-xl text-left transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">📦</div>
                    <div className="flex-1">
                      <h4 className="text-white text-lg font-semibold mb-1 group-hover:text-blue-400">
                        Upload GLB File
                      </h4>
                      <p className="text-white/60 text-sm">
                        Upload a ready-to-use .glb 3D model file directly
                      </p>
                    </div>
                  </div>
                </button>

                {/* Image Upload Option */}
                <button
                  onClick={() => handleUploadMethodSelect('images')}
                  className="w-full p-6 bg-black/40 border-2 border-white/20 hover:border-blue-500 rounded-xl text-left transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">🖼️</div>
                    <div className="flex-1">
                      <h4 className="text-white text-lg font-semibold mb-1 group-hover:text-blue-400">
                        Upload Images
                      </h4>
                      <p className="text-white/60 text-sm">
                        Upload photos with AI background removal
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* Step 2: Upload File */}
            {uploadStep === 'upload' && (
              <div className="space-y-4">
                {uploadError && (
                  <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                    {uploadError}
                  </div>
                )}

                {uploadMethod === 'glb' && (
                  <GLBUpload
                    onUploadComplete={handleGLBUploadComplete}
                    onError={handleUploadError}
                  />
                )}

                {uploadMethod === 'images' && (
                  <ImageUpload
                    onUploadComplete={handleImageUploadComplete}
                    onError={handleUploadError}
                  />
                )}

                <button
                  onClick={() => setUploadStep('choose')}
                  className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  ← Back to Upload Options
                </button>
              </div>
            )}

            {/* Step 3: Fill Metadata */}
            {uploadStep === 'metadata' && (
              <div className="space-y-4">
                {/* Success Message */}
                <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
                  ✓ {uploadMethod === 'glb' ? 'Model uploaded successfully!' : 'Images processed successfully!'} Now add some details.
                </div>

                {/* Image Gallery with Thumbnail Selection */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-white/80 text-sm font-medium">
                      Select Thumbnail Image
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {uploadedImages.map((imagePath, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedThumbnailIndex(index)
                            setUploadedThumbnailPath(imagePath)
                          }}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedThumbnailIndex === index
                              ? 'border-blue-500 ring-2 ring-blue-500/50'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          <Image
                            src={imagePath}
                            alt={`Image ${index + 1}`}
                            fill
                            className="object-contain bg-gray-800"
                            unoptimized
                          />
                          {selectedThumbnailIndex === index && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-white/40 text-xs">
                      The selected image will be used as the thumbnail for this item
                    </p>
                  </div>
                )}

                {/* GLB Thumbnail Preview */}
                {uploadedThumbnailPath && uploadedImages.length === 0 && (
                  <div className="space-y-2">
                    <label className="block text-white/80 text-sm font-medium">
                      Generated Thumbnail
                    </label>
                    <div className="relative w-48 h-48 mx-auto bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border border-white/20">
                      <Image
                        src={uploadedThumbnailPath}
                        alt="Generated thumbnail"
                        fill
                        className="object-contain p-4"
                        unoptimized
                      />
                    </div>
                  </div>
                )}

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
                  <DimensionInput
                    dimensions={newItemDimensions}
                    onChange={setNewItemDimensions}
                  />
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
                <div className="space-y-3 pt-4">
                  {/* Generate Model button (images only - grayed out) */}
                  {uploadMethod === 'images' && (
                    <>
                      <button
                        disabled
                        className="w-full px-4 py-3 bg-gray-600 text-gray-400 rounded-lg font-medium cursor-not-allowed opacity-60"
                      >
                        Generate 3D Model (Coming Soon)
                      </button>
                      <p className="text-white/60 text-xs text-center">
                        3D model generation is required before saving the item
                      </p>
                    </>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setUploadStep('upload')}
                      className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleCreateItem}
                      disabled={uploadMethod === 'images'}
                      className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                        uploadMethod === 'images'
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-60'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {uploadMethod === 'glb' ? 'Create Item' : 'Save Item (Generate Model First)'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
