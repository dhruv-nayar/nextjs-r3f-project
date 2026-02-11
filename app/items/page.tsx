'use client'

import { useState } from 'react'
import { useItemLibrary } from '@/lib/item-library-context'
import { ItemCategory, GLBUploadResult, ImageUploadResult } from '@/types/room'
import { ItemThumbnail } from '@/components/items/ItemThumbnail'
import { GLBUpload } from '@/components/items/GLBUpload'
import { ImageUpload } from '@/components/items/ImageUpload'
import { DimensionInput } from '@/components/items/DimensionInput'
import { Dropdown } from '@/components/ui/Dropdown'
import Link from 'next/link'
import Image from 'next/image'

export default function ItemsPage() {
  const { items, addItem } = useItemLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sortBy, setSortBy] = useState('recently-added')

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
    <div className="min-h-screen bg-porcelain">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-porcelain border-b border-taupe/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <span className="text-taupe text-xl">△</span>
              <h1 className="text-lg font-display font-medium text-graphite">Studio OMHU</h1>
            </div>

            {/* Right Side Navigation */}
            <div className="flex items-center gap-6">
              <div className="flex items-baseline gap-6">
                <Link
                  href="/items"
                  className="text-graphite font-body font-medium relative pb-1 border-b-2 border-graphite text-sm"
                >
                  Inventory
                </Link>
                <Dropdown
                  label="Projects"
                  header="Recent Projects"
                  options={[
                    { label: 'Living Room Design', value: 'living-room' },
                    { label: 'Kitchen Remodel', value: 'kitchen' },
                    { label: 'Bedroom Setup', value: 'bedroom' },
                    { label: 'Office Space', value: 'office' },
                    { label: 'Patio Design', value: 'patio' },
                  ]}
                  showSeparator
                  footerOption={{ label: 'See All', value: 'see-all' }}
                />
              </div>

              {/* Vertical Divider */}
              <div className="w-px h-5 bg-taupe/10"></div>

              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-taupe/5 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-taupe/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </button>
                <button className="p-2 hover:bg-taupe/5 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-taupe/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6 items-start">
          {/* Main Content - Left Side */}
          <main className="flex-1 min-w-0">
            {/* Search Bar & Filters Row */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="relative w-80">
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-9 bg-floral-white text-graphite placeholder:text-taupe/40 font-body text-sm focus:outline-none focus:bg-white transition-colors rounded-lg"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe/30 text-xs">🔍</span>
                </div>

                <button className="px-4 py-2 bg-floral-white text-taupe/60 font-body text-sm hover:text-graphite transition-colors flex items-center gap-2 rounded-lg">
                  <span className="text-xs">▼</span>
                  <span>Filters</span>
                </button>
              </div>

              <Dropdown
                label="Recently Added"
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { label: 'Recently Added', value: 'recently-added' },
                  { label: 'Name A-Z', value: 'name-asc' },
                  { label: 'Name Z-A', value: 'name-desc' },
                  { label: 'Category', value: 'category' },
                ]}
              />
            </div>

            {/* Mobile Category Filter */}
            <div className="lg:hidden mb-6 flex gap-2 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-4 py-2 rounded-xl font-body font-medium transition-colors text-sm ${
                    selectedCategory === cat.value
                      ? 'bg-sage text-white'
                      : 'bg-white text-taupe hover:bg-floral-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 && searchQuery === '' && selectedCategory === 'all' ? (
              <div className="text-center py-20">
                <p className="text-taupe text-lg mb-4 font-body">
                  No items in your library yet
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-taupe hover:bg-taupe/90 text-white font-body font-medium rounded-lg transition-colors"
                >
                  Add Your First Item
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-taupe text-lg font-body">
                  No items match your search criteria
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {/* Item Cards */}
                {filteredItems.map(item => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="group overflow-hidden cursor-pointer"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square relative shadow-sm group-hover:shadow-md transition-shadow duration-200">
                      <ItemThumbnail category={item.category} name={item.name} thumbnailPath={item.thumbnailPath} />
                    </div>

                    {/* Info Section */}
                    <div className="pt-2">
                      <p className="text-taupe/40 text-[10px] font-body font-light uppercase tracking-wider mb-1">
                        {item.category}
                      </p>
                      <h3 className="font-display text-base text-graphite truncate leading-tight">
                        {item.name}
                      </h3>
                    </div>
                  </Link>
                ))}

                {/* Add New Item Card */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="border-2 border-dashed border-taupe/15 rounded-lg aspect-square flex flex-col items-center justify-center gap-3 hover:border-taupe/30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-taupe/30 flex items-center justify-center text-2xl text-taupe/40 group-hover:border-taupe/50 group-hover:text-taupe/60 transition-colors">
                    +
                  </div>
                  <span className="font-body text-sm text-taupe/60 group-hover:text-taupe/80 transition-colors uppercase tracking-wide">
                    Add New Item
                  </span>
                </button>
              </div>
            )}
          </main>

          {/* Right Sidebar - Quick Filters */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 bg-floral-white rounded-2xl p-6 space-y-6">
              {/* Quick Filters */}
              <div>
                <h3 className="text-xs font-body uppercase tracking-wide text-taupe/50 mb-4">
                  Quick Filters
                </h3>
                <div className="space-y-1">
                  {categories.map(cat => {
                    const categoryCount = items.filter(item =>
                      cat.value === 'all' || item.category === cat.value
                    ).length
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`w-full text-left px-3 py-2 transition-colors font-body text-sm ${
                          selectedCategory === cat.value
                            ? 'text-graphite'
                            : 'text-taupe/70 hover:text-graphite'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-4 flex-shrink-0">
                              {selectedCategory === cat.value ? '•' : ''}
                            </span>
                            <span className="truncate">{cat.label}</span>
                          </div>
                          <span className="text-xs text-taupe/40 flex-shrink-0">
                            {categoryCount}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Add New Item Button */}
              <button className="w-full px-4 py-3 bg-taupe hover:bg-taupe/90 text-white font-body text-sm rounded-lg transition-colors shadow-lg">
                Add New Item
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Create Item Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-graphite/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-porcelain rounded-3xl p-8 max-w-2xl w-full my-8 shadow-2xl border border-taupe/10">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-display font-semibold text-graphite">Add New Item</h3>
                <p className="text-taupe/70 font-body text-sm mt-1">
                  {uploadStep === 'choose' && 'Choose how to add your 3D model'}
                  {uploadStep === 'upload' && 'Upload your file'}
                  {uploadStep === 'metadata' && 'Fill in item details'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-taupe/50 hover:text-taupe text-3xl leading-none transition-colors"
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
                  className="w-full p-6 bg-white border-2 border-taupe/20 hover:border-sage rounded-2xl text-left transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">📦</div>
                    <div className="flex-1">
                      <h4 className="text-graphite text-lg font-display font-semibold mb-1 group-hover:text-sage transition-colors">
                        Upload GLB File
                      </h4>
                      <p className="text-taupe/70 text-sm font-body">
                        Upload a ready-to-use .glb 3D model file directly
                      </p>
                    </div>
                  </div>
                </button>

                {/* Image Upload Option */}
                <button
                  onClick={() => handleUploadMethodSelect('images')}
                  className="w-full p-6 bg-white border-2 border-taupe/20 hover:border-sage rounded-2xl text-left transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">🖼️</div>
                    <div className="flex-1">
                      <h4 className="text-graphite text-lg font-display font-semibold mb-1 group-hover:text-sage transition-colors">
                        Upload Images
                      </h4>
                      <p className="text-taupe/70 text-sm font-body">
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
                  <div className="p-4 bg-scarlet/10 border border-scarlet/30 rounded-2xl text-scarlet text-sm font-body">
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
                  className="w-full px-4 py-3 bg-white border border-taupe/20 hover:bg-floral-white text-taupe rounded-xl font-body font-medium transition-colors"
                >
                  ← Back to Upload Options
                </button>
              </div>
            )}

            {/* Step 3: Fill Metadata */}
            {uploadStep === 'metadata' && (
              <div className="space-y-4">
                {/* Success Message */}
                <div className="p-4 bg-sage/10 border border-sage/30 rounded-2xl text-sage text-sm font-body">
                  ✓ {uploadMethod === 'glb' ? 'Model uploaded successfully!' : 'Images processed successfully!'} Now add some details.
                </div>

                {/* Image Gallery with Thumbnail Selection */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-graphite text-sm font-body font-medium">
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
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            selectedThumbnailIndex === index
                              ? 'border-sage ring-2 ring-sage/30'
                              : 'border-taupe/20 hover:border-taupe/40'
                          }`}
                        >
                          <Image
                            src={imagePath}
                            alt={`Image ${index + 1}`}
                            fill
                            className="object-contain bg-floral-white"
                            unoptimized
                          />
                          {selectedThumbnailIndex === index && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-sage rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-taupe/60 text-xs font-body">
                      The selected image will be used as the thumbnail for this item
                    </p>
                  </div>
                )}

                {/* GLB Thumbnail Preview */}
                {uploadedThumbnailPath && uploadedImages.length === 0 && (
                  <div className="space-y-2">
                    <label className="block text-graphite text-sm font-body font-medium">
                      Generated Thumbnail
                    </label>
                    <div className="relative w-48 h-48 mx-auto bg-floral-white rounded-xl overflow-hidden border border-taupe/20">
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
                  <label className="block text-graphite text-sm font-body font-medium mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Modern Office Chair"
                    className="w-full px-4 py-3 bg-white border border-taupe/20 rounded-xl text-graphite placeholder:text-taupe/50 font-body focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50 transition-all"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-graphite text-sm font-body font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    value={newItemDescription}
                    onChange={(e) => setNewItemDescription(e.target.value)}
                    placeholder="Ergonomic mesh back chair with adjustable height"
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-taupe/20 rounded-xl text-graphite placeholder:text-taupe/50 font-body focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50 resize-none transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-graphite text-sm font-body font-medium mb-2">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as ItemCategory)}
                    className="w-full px-4 py-3 bg-white border border-taupe/20 rounded-xl text-graphite font-body focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50 transition-all"
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
                  <label className="block text-graphite text-sm font-body font-medium mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={newItemTags}
                    onChange={(e) => setNewItemTags(e.target.value)}
                    placeholder="modern, office, ergonomic"
                    className="w-full px-4 py-3 bg-white border border-taupe/20 rounded-xl text-graphite placeholder:text-taupe/50 font-body focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50 transition-all"
                  />
                  <p className="text-taupe/60 text-xs mt-1 font-body">
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
                        className="w-full px-4 py-3 bg-taupe/20 text-taupe/50 rounded-xl font-body font-medium cursor-not-allowed"
                      >
                        Generate 3D Model (Coming Soon)
                      </button>
                      <p className="text-taupe/70 text-xs text-center font-body">
                        3D model generation is required before saving the item
                      </p>
                    </>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setUploadStep('upload')}
                      className="flex-1 px-4 py-3 bg-white border border-taupe/20 hover:bg-floral-white text-taupe rounded-xl font-body font-medium transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleCreateItem}
                      disabled={uploadMethod === 'images'}
                      className={`flex-1 px-4 py-3 rounded-xl font-body font-medium transition-colors ${
                        uploadMethod === 'images'
                          ? 'bg-taupe/20 text-taupe/50 cursor-not-allowed'
                          : 'bg-sage hover:bg-sage/90 text-white'
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
