'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useItemLibrary } from '@/lib/item-library-context'
import { ItemCategory, GLBUploadResult, ImageUploadResult, ImagePair } from '@/types/room'
import { GLBUpload } from '@/components/items/GLBUpload'
import { ImageUpload } from '@/components/items/ImageUpload'
import { DimensionInput } from '@/components/items/DimensionInput'
import { Dropdown } from '@/components/ui/Dropdown'
import { SearchInput } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/Typography'
import { Navbar } from '@/components/layout/Navbar'
import { CategoryFilterSidebar } from '@/components/items/CategoryFilterSidebar'
import { ItemCard, AddItemCard } from '@/components/items/ItemCard'
import { CustomItemCreator } from '@/components/items/CustomItemCreator'
import Image from 'next/image'

export default function ItemsPage() {
  const router = useRouter()
  const { items, addItem, deleteItem, updateItem } = useItemLibrary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sortBy, setSortBy] = useState('recently-added')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Upload flow state
  const [uploadStep, setUploadStep] = useState<'choose' | 'upload' | 'metadata'>('choose')
  const [uploadMethod, setUploadMethod] = useState<'glb' | 'images' | null>(null)
  const [showCustomCreator, setShowCustomCreator] = useState(false)
  const [uploadedModelPath, setUploadedModelPath] = useState('')
  const [uploadedThumbnailPath, setUploadedThumbnailPath] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedImagePairs, setUploadedImagePairs] = useState<ImagePair[]>([])
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [tempItemId, setTempItemId] = useState('')

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
    // Show items that have: valid model, parametric shape, images, OR are custom items (user-created)
    // Custom items always show since users expect to see items they created
    const hasValidModel = item.modelPath && item.modelPath !== 'placeholder'
    const hasParametricShape = !!item.parametricShape
    const hasImages = item.images && item.images.length > 0
    const isCustomItem = item.isCustom === true

    if (!hasValidModel && !hasParametricShape && !hasImages && !isCustomItem) {
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

  // Calculate item counts per category
  const itemCounts = categories.reduce((acc, cat) => {
    acc[cat.value] = items.filter(item =>
      cat.value === 'all' || item.category === cat.value
    ).length
    return acc
  }, {} as Record<string, number>)

  // Quick create: Creates item immediately and redirects to edit mode
  const handleQuickCreate = async () => {
    const newId = await addItem({
      name: 'New Item',
      description: '',
      dimensions: { width: 2, height: 2, depth: 2 },
      category: 'other',
      tags: [],
      isCustom: true
    })
    // Redirect to the item detail page in edit mode
    router.push(`/items/${newId}?edit=true`)
  }

  // Open item detail page
  const handleOpenItem = (itemId: string) => {
    router.push(`/items/${itemId}`)
  }

  // Delete item
  const handleDeleteItem = (itemId: string) => {
    deleteItem(itemId)
    setShowDeleteConfirm(null)
  }

  // Rename item
  const handleRenameItem = (itemId: string, newName: string) => {
    updateItem(itemId, { name: newName })
  }

  const handleUploadMethodSelect = (method: 'glb' | 'images') => {
    // Generate a temporary item ID for image uploads
    const newTempId = `temp-item-${Date.now()}`
    setTempItemId(newTempId)
    setUploadMethod(method)
    setUploadStep('upload')
  }

  const handleGLBUploadComplete = (result: GLBUploadResult) => {
    setUploadedModelPath(result.modelPath)
    setUploadedThumbnailPath(result.thumbnailPath || '')
    // Use extracted dimensions from GLB if available
    if (result.dimensions) {
      setNewItemDimensions(result.dimensions)
    }
    setUploadStep('metadata')
  }

  const handleImageUploadComplete = (result: ImageUploadResult) => {
    setUploadedImages(result.imagePaths)
    setUploadedImagePairs(result.imagePairs || [])
    setSelectedThumbnailIndex(result.selectedThumbnailIndex || 0)
    // Default to processed image if available, otherwise original
    const firstPair = result.imagePairs?.[0]
    const defaultThumbnail = firstPair?.processed || firstPair?.original || result.imagePaths[0]
    setUploadedThumbnailPath(defaultThumbnail)
    setUploadStep('metadata')
  }

  const handleUploadError = (error: string) => {
    setUploadError(error)
  }

  const handleCreateItem = async () => {
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

    await addItem({
      name: newItemName.trim(),
      description: newItemDescription.trim() || undefined,
      modelPath,
      thumbnailPath: uploadedThumbnailPath.trim() || undefined,
      images: uploadedImagePairs.length > 0 ? uploadedImagePairs : undefined,
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
    setUploadedImagePairs([])
    setSelectedThumbnailIndex(0)
    setUploadMethod(null)
    setUploadStep('choose')
    setUploadError('')
    setTempItemId('')
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
    setUploadedImagePairs([])
    setSelectedThumbnailIndex(0)
    setUploadMethod(null)
    setUploadStep('choose')
    setUploadError('')
    setTempItemId('')
    setShowCreateModal(false)
  }

  return (
    <div className="min-h-screen bg-porcelain">
      {/* Navigation Bar */}
      <Navbar activeTab="inventory" />

      {/* Main Content */}
      <div className="px-6 py-8">
        <div className="flex gap-6 items-start">
          {/* Main Content - Left Side */}
          <main className="flex-1 min-w-0">
            {/* Search Bar & Filters Row */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search inventory..."
                  width="w-80"
                />

                <button className="px-4 py-2 bg-floral-white text-taupe/60 font-body text-sm hover:text-graphite transition-colors flex items-center gap-2 rounded-lg">
                  <span className="text-xs">▼</span>
                  <span>Filters</span>
                </button>
              </div>

              <div className="flex items-baseline gap-6">
                <SectionHeader>Sort by</SectionHeader>
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
                  onClick={handleQuickCreate}
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
                  <ItemCard
                    key={item.id}
                    item={item}
                    onOpen={() => handleOpenItem(item.id)}
                    onDelete={() => setShowDeleteConfirm(item.id)}
                    onRename={(newName) => handleRenameItem(item.id, newName)}
                    canDelete={item.isCustom}
                  />
                ))}

                {/* Add New Item Card */}
                <AddItemCard onClick={handleQuickCreate} />
              </div>
            )}
          </main>

          {/* Right Sidebar - Quick Filters */}
          <CategoryFilterSidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            itemCounts={itemCounts}
            onAddNewClick={handleQuickCreate}
            className="hidden lg:block"
          />
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

                {/* Draw Custom Shape Option */}
                <button
                  onClick={() => {
                    handleCloseModal()
                    setShowCustomCreator(true)
                  }}
                  className="w-full p-6 bg-white border-2 border-taupe/20 hover:border-sage rounded-2xl text-left transition-all group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">✏️</div>
                    <div className="flex-1">
                      <h4 className="text-graphite text-lg font-display font-semibold mb-1 group-hover:text-sage transition-colors">
                        Draw Custom Shape
                      </h4>
                      <p className="text-taupe/70 text-sm font-body">
                        Draw a 2D shape and extrude it into a 3D item
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
                    itemId={tempItemId}
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
                {uploadedImagePairs.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-graphite text-sm font-body font-medium">
                      Select Thumbnail Image
                    </label>
                    <div className="space-y-4">
                      {uploadedImagePairs.map((pair, pairIndex) => (
                        <div key={pairIndex} className="space-y-2">
                          {uploadedImagePairs.length > 1 && (
                            <div className="text-xs text-taupe/60 font-medium">
                              Image {pairIndex + 1}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            {/* Original Image */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedThumbnailIndex(pairIndex * 2)
                                setUploadedThumbnailPath(pair.original)
                              }}
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                uploadedThumbnailPath === pair.original
                                  ? 'border-sage ring-2 ring-sage/30'
                                  : 'border-taupe/20 hover:border-taupe/40'
                              }`}
                            >
                              <Image
                                src={pair.original}
                                alt={`Original ${pairIndex + 1}`}
                                fill
                                className="object-contain bg-floral-white"
                                unoptimized
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-graphite/70 text-white text-xs py-1 text-center">
                                Original
                              </div>
                              {uploadedThumbnailPath === pair.original && (
                                <div className="absolute top-2 right-2 w-6 h-6 bg-sage rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs">✓</span>
                                </div>
                              )}
                            </button>

                            {/* Processed Image (Background Removed) */}
                            {pair.processed ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedThumbnailIndex(pairIndex * 2 + 1)
                                  setUploadedThumbnailPath(pair.processed!)
                                }}
                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                  uploadedThumbnailPath === pair.processed
                                    ? 'border-sage ring-2 ring-sage/30'
                                    : 'border-taupe/20 hover:border-taupe/40'
                                }`}
                              >
                                <div className="absolute inset-0 bg-[url('/checkerboard.svg')] bg-repeat" />
                                <Image
                                  src={pair.processed}
                                  alt={`Processed ${pairIndex + 1}`}
                                  fill
                                  className="object-contain relative"
                                  unoptimized
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-sage/90 text-white text-xs py-1 text-center">
                                  No Background
                                </div>
                                {uploadedThumbnailPath === pair.processed && (
                                  <div className="absolute top-2 right-2 w-6 h-6 bg-sage rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                )}
                              </button>
                            ) : (
                              <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-taupe/10 bg-taupe/5 flex items-center justify-center">
                                <span className="text-taupe/40 text-xs text-center px-2">
                                  Background removal failed
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
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

      {/* Custom Item Creator Modal */}
      <CustomItemCreator
        isOpen={showCustomCreator}
        onClose={() => setShowCustomCreator(false)}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-graphite/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-floral-white border border-scarlet/20 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-graphite text-xl font-display font-semibold mb-4">Delete Item?</h3>
            <p className="text-graphite/70 font-body mb-6">
              Are you sure you want to delete <strong>{items.find(i => i.id === showDeleteConfirm)?.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-taupe/10 hover:bg-taupe/20 text-graphite rounded-lg font-medium font-body transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteItem(showDeleteConfirm)}
                className="flex-1 px-4 py-2.5 bg-scarlet hover:bg-scarlet/90 text-white rounded-lg font-medium font-body transition-colors"
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
