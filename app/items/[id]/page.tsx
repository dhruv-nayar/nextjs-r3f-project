'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useItemLibrary } from '@/lib/item-library-context'
import { useHome } from '@/lib/home-context'
import { ItemPreview } from '@/components/items/ItemPreview'
import { ParametricShapePreview } from '@/components/items/ParametricShapePreview'
import Toast from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Dropdown } from '@/components/ui/Dropdown'
import { Navbar } from '@/components/layout/Navbar'
import { cn } from '@/lib/design-system'
import { PlacementType, MaterialOverride, ImagePair } from '@/types/room'
import { ImageGallery } from '@/components/items/ImageGallery'
import { GenerateModelPanel } from '@/components/items/GenerateModelPanel'
import { MaterialInfo } from '@/lib/material-utils'
import { MaterialExtractor } from '@/hooks/useMaterialExtraction'
import { useTrellisJobs } from '@/lib/trellis-job-context'

export default function ItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const itemId = params.id as string

  const { getItem, updateItem, deleteItem } = useItemLibrary()
  const { getInstancesForItem, deleteAllInstancesOfItem, switchHome } = useHome()
  const { toastMessage: trellisToast, toastType: trellisToastType, clearToast: clearTrellisToast } = useTrellisJobs()

  // Check if we should start in edit mode
  const startInEditMode = searchParams.get('edit') === 'true'

  // Parse return context for "Back to Project" navigation
  const returnToParam = searchParams.get('returnTo')
  const returnContext = returnToParam ? (() => {
    try {
      return JSON.parse(decodeURIComponent(returnToParam))
    } catch {
      return null
    }
  })() : null

  const handleBackToProject = () => {
    if (returnContext) {
      // Switch to the correct home and navigate back with selection restoration
      if (returnContext.homeId) {
        switchHome(returnContext.homeId)
      }
      router.push(`/?selectInstance=${returnContext.instanceId}`)
    }
  }

  const item = getItem(itemId)
  const instances = item ? getInstancesForItem(itemId) : []

  const [isEditing, setIsEditing] = useState(startInEditMode)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  // Edit form state
  const [editName, setEditName] = useState(item?.name || '')
  const [editDescription, setEditDescription] = useState(item?.description || '')
  const [editTags, setEditTags] = useState(item?.tags.join(', ') || '')
  const [editProductUrl, setEditProductUrl] = useState(item?.productUrl || '')
  const [editPlacementType, setEditPlacementType] = useState<PlacementType | undefined>(item?.placementType)
  const [editThumbnailPath, setEditThumbnailPath] = useState(item?.thumbnailPath || '')
  const [editImages, setEditImages] = useState<ImagePair[]>(item?.images || [])

  // Dimension state (feet and inches)
  const [widthFeet, setWidthFeet] = useState(Math.floor(item?.dimensions?.width || 0))
  const [widthInches, setWidthInches] = useState(((item?.dimensions?.width || 0) % 1) * 12)
  const [heightFeet, setHeightFeet] = useState(Math.floor(item?.dimensions?.height || 0))
  const [heightInches, setHeightInches] = useState(((item?.dimensions?.height || 0) % 1) * 12)
  const [depthFeet, setDepthFeet] = useState(Math.floor(item?.dimensions?.depth || 0))
  const [depthInches, setDepthInches] = useState(((item?.dimensions?.depth || 0) % 1) * 12)

  // Materials state
  const [extractedMaterials, setExtractedMaterials] = useState<MaterialInfo[]>([])
  const [editMaterialOverrides, setEditMaterialOverrides] = useState<MaterialOverride[]>(item?.materialOverrides || [])
  const [showMaterialsSection, setShowMaterialsSection] = useState(false)

  // Model path state (for when a model is generated)
  const [editModelPath, setEditModelPath] = useState(item?.modelPath || '')

  // Callback for when materials are extracted
  const handleMaterialsExtracted = useCallback((materials: MaterialInfo[]) => {
    setExtractedMaterials(materials)
  }, [])

  // Sync edit state with item when it changes
  useEffect(() => {
    if (item) {
      setEditName(item.name)
      setEditDescription(item.description || '')
      setEditTags(item.tags.join(', '))
      setEditProductUrl(item.productUrl || '')
      setEditPlacementType(item.placementType)
      setEditMaterialOverrides(item.materialOverrides || [])
      setEditThumbnailPath(item.thumbnailPath || '')
      setEditImages(item.images || [])

      // Update dimension state
      setWidthFeet(Math.floor(item.dimensions?.width || 0))
      setWidthInches(((item.dimensions?.width || 0) % 1) * 12)
      setHeightFeet(Math.floor(item.dimensions?.height || 0))
      setHeightInches(((item.dimensions?.height || 0) % 1) * 12)
      setDepthFeet(Math.floor(item.dimensions?.depth || 0))
      setDepthInches(((item.dimensions?.depth || 0) % 1) * 12)
    }
  }, [item])

  if (!item) {
    return (
      <div className="min-h-screen bg-porcelain flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-display font-semibold text-graphite mb-4">Item Not Found</h2>
          <Button variant="primary" onClick={() => router.push('/items')}>
            Back to Items
          </Button>
        </div>
      </div>
    )
  }

  const handleSave = () => {
    // Calculate total feet from feet + inches
    const totalWidth = widthFeet + widthInches / 12
    const totalHeight = heightFeet + heightInches / 12
    const totalDepth = depthFeet + depthInches / 12

    updateItem(itemId, {
      name: editName,
      description: editDescription,
      tags: editTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
      productUrl: editProductUrl,
      placementType: editPlacementType,
      materialOverrides: editMaterialOverrides.length > 0 ? editMaterialOverrides : undefined,
      thumbnailPath: editThumbnailPath || undefined,
      images: editImages.length > 0 ? editImages : undefined,
      dimensions: {
        width: totalWidth,
        height: totalHeight,
        depth: totalDepth
      }
    })
    setIsEditing(false)
    setToastMessage('Item updated successfully!')
    setToastType('success')
    setShowToast(true)
  }

  const handleCancel = () => {
    // Reset to current item values
    if (item) {
      setEditName(item.name)
      setEditDescription(item.description || '')
      setEditTags(item.tags.join(', '))
      setEditProductUrl(item.productUrl || '')
      setEditPlacementType(item.placementType)
      setEditMaterialOverrides(item.materialOverrides || [])
      setEditThumbnailPath(item.thumbnailPath || '')
      setEditImages(item.images || [])

      setWidthFeet(Math.floor(item.dimensions?.width || 0))
      setWidthInches(((item.dimensions?.width || 0) % 1) * 12)
      setHeightFeet(Math.floor(item.dimensions?.height || 0))
      setHeightInches(((item.dimensions?.height || 0) % 1) * 12)
      setDepthFeet(Math.floor(item.dimensions?.depth || 0))
      setDepthInches(((item.dimensions?.depth || 0) % 1) * 12)
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    // First delete all instances of this item across all homes
    deleteAllInstancesOfItem(itemId)
    // Then delete the item from the library
    deleteItem(itemId)
    // Navigate back to items list
    router.push('/items')
  }

  const handleMaterialColorChange = (materialName: string, materialIndex: number, color: string) => {
    setEditMaterialOverrides((prev) => {
      // Find existing override
      const existing = prev.find(
        (o) => o.materialName === materialName || o.materialIndex === materialIndex
      )

      if (existing) {
        // Update existing override
        return prev.map((o) =>
          o.materialName === materialName || o.materialIndex === materialIndex
            ? { ...o, baseColor: color }
            : o
        )
      } else {
        // Add new override
        return [
          ...prev,
          {
            materialName,
            materialIndex,
            baseColor: color
          }
        ]
      }
    })
  }

  const handleResetMaterial = (materialName: string, materialIndex: number) => {
    setEditMaterialOverrides((prev) =>
      prev.filter(
        (o) => o.materialName !== materialName && o.materialIndex !== materialIndex
      )
    )
  }

  const handleResetAllMaterials = () => {
    setEditMaterialOverrides([])
  }

  const handleImagesAdd = (newPairs: ImagePair[]) => {
    const updatedImages = [...editImages, ...newPairs]
    setEditImages(updatedImages)

    // If no thumbnail is set yet, use the first processed or original image
    let newThumbnail = editThumbnailPath
    if (!editThumbnailPath && newPairs.length > 0) {
      newThumbnail = newPairs[0].processed || newPairs[0].original
      setEditThumbnailPath(newThumbnail)
    }

    // Auto-save images immediately so item persists even if user navigates away
    updateItem(itemId, {
      images: updatedImages,
      thumbnailPath: newThumbnail || undefined
    })
  }

  // Handle model generation start - save state so we can recover
  const handleGenerationStart = (selectedImageUrls: string[]) => {
    updateItem(itemId, {
      generationStatus: {
        isGenerating: true,
        startedAt: new Date().toISOString(),
        selectedImageUrls,
      }
    })
  }

  // Handle model generation completion
  const handleModelGenerated = (modelPath: string) => {
    setEditModelPath(modelPath)
    // Update the item with model path and clear generation status
    updateItem(itemId, {
      modelPath,
      generationStatus: undefined, // Clear the generating flag
    })
    setToastMessage('3D model generated and saved!')
    setToastType('success')
    setShowToast(true)
  }

  // Get current color for a material (from override or original)
  const getMaterialColor = (materialName: string, materialIndex: number, originalColor: string): string => {
    const override = editMaterialOverrides.find(
      (o) => o.materialName === materialName || o.materialIndex === materialIndex
    )
    return override?.baseColor || originalColor
  }

  return (
    <div className="min-h-screen bg-porcelain">
      {/* Material Extractor (invisible component that extracts materials from GLB) */}
      {item.modelPath && (
        <MaterialExtractor
          modelPath={item.modelPath}
          onExtracted={handleMaterialsExtracted}
        />
      )}

      {/* Navigation Bar */}
      <Navbar activeTab="inventory" breadcrumb={item.name} />

      {/* Main Content Layout */}
      <div className="flex">
        {/* Left Side - 3D Viewer */}
        <main className="flex-1 p-6">
          <div className="w-full h-[calc(100vh-88px)] bg-porcelain">
            {item.modelPath ? (
              <ItemPreview
                modelPath={item.modelPath}
                category={item.category}
                materialOverrides={isEditing ? editMaterialOverrides : item.materialOverrides}
              />
            ) : item.parametricShape ? (
              <ParametricShapePreview
                shape={item.parametricShape}
                dimensions={item.dimensions}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl text-taupe/20 mb-4">
                    {item.category === 'seating' && '🪑'}
                    {item.category === 'table' && '🪑'}
                    {item.category === 'storage' && '📚'}
                    {item.category === 'bed' && '🛏️'}
                    {item.category === 'decoration' && '🪴'}
                    {item.category === 'lighting' && '💡'}
                    {item.category === 'other' && '📦'}
                  </div>
                  <p className="text-taupe/40 font-body">No 3D model available</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Side - Sidebar Panel */}
        <aside className="w-[480px] flex-shrink-0">
          <div className="fixed right-0 top-[68px] bottom-0 w-[480px] p-6 flex flex-col">
            {/* Back to Project Button - only shown when coming from home editor */}
            {returnContext && (
              <button
                onClick={handleBackToProject}
                className="mb-4 flex items-center gap-2 px-4 py-3 bg-sage/10 hover:bg-sage/20 text-sage rounded-xl border border-sage/20 transition-colors group"
              >
                <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="font-body font-medium">Back to Project</span>
              </button>
            )}
            <div className="bg-floral-white rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)] border border-taupe/[0.03] flex-1 overflow-y-auto space-y-6">
                {/* Item Header Section */}
                <div>
                  {/* Top Actions */}
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs uppercase tracking-wide text-taupe/50 font-body">
                      {item.category}
                    </p>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-taupe/5 rounded-lg transition-colors" aria-label="Add to favorites">
                        <svg className="w-5 h-5 text-taupe/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button className="p-2 hover:bg-taupe/5 rounded-lg transition-colors" aria-label="Share">
                        <svg className="w-5 h-5 text-taupe/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Item Name */}
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-3xl font-display font-semibold text-graphite mb-6"
                    />
                  ) : (
                    <h1 className="text-3xl font-display font-semibold text-graphite mb-6">
                      {item.name}
                    </h1>
                  )}
                </div>

                {/* Description Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Description
                  </h3>
                  {isEditing ? (
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-white text-graphite font-body text-sm rounded-xl border border-taupe/10 focus:outline-none focus:border-taupe/30 transition-colors resize-none"
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-taupe/80 font-body leading-relaxed">
                      {item.description || 'No description provided.'}
                    </p>
                  )}
                </div>

                {/* Images Section */}
                <ImageGallery
                  images={isEditing ? editImages : (item.images || [])}
                  thumbnailPath={item.thumbnailPath}
                  isEditing={isEditing}
                  onThumbnailChange={setEditThumbnailPath}
                  onImagesAdd={handleImagesAdd}
                  currentThumbnail={isEditing ? editThumbnailPath : item.thumbnailPath}
                />

                {/* Generate 3D Model Section - shown when editing and there are images, or if generation was interrupted */}
                {isEditing && (editImages.length > 0 || item.generationStatus?.isGenerating) && !item.modelPath && (
                  <GenerateModelPanel
                    itemId={itemId}
                    imagePairs={editImages}
                    onModelGenerated={handleModelGenerated}
                    onGenerationStart={handleGenerationStart}
                    generationStatus={item.generationStatus}
                  />
                )}

                {/* Metadata Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Metadata
                  </h3>
                  <div className="space-y-3">
                    {/* Placement Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-taupe/70 font-body">Placement:</span>
                      {isEditing ? (
                        <Dropdown
                          label="Select Placement"
                          value={editPlacementType || 'floor'}
                          onChange={(value) => setEditPlacementType(value as PlacementType)}
                          options={[
                            { label: '🔽 Floor', value: 'floor' },
                            { label: '◼️ Wall', value: 'wall' },
                            { label: '🔼 Ceiling', value: 'ceiling' }
                          ]}
                        />
                      ) : (
                        item.placementType ? (
                          <span className="px-3 py-1 bg-white text-graphite text-xs font-body rounded-full border border-taupe/10">
                            {item.placementType === 'floor' && '🔽 Floor'}
                            {item.placementType === 'wall' && '◼️ Wall'}
                            {item.placementType === 'ceiling' && '🔼 Ceiling'}
                          </span>
                        ) : (
                          <span className="text-sm text-taupe/40 font-body">Floor</span>
                        )
                      )}
                    </div>

                    {/* Product URL */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-taupe/70 font-body">Product:</span>
                      {isEditing ? (
                        <Input
                          type="url"
                          value={editProductUrl}
                          onChange={(e) => setEditProductUrl(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 ml-3"
                        />
                      ) : item.productUrl ? (
                        <a
                          href={item.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-sage hover:text-sage/80 font-body flex items-center gap-1 transition-colors"
                        >
                          View Product
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-sm text-taupe/40 font-body">No URL</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dimensions Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Dimensions
                  </h3>
                  {isEditing ? (
                    <div className="space-y-3">
                      {/* Width */}
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-2">Width</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={widthFeet}
                            onChange={(e) => setWidthFeet(parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">ft</span>
                          <input
                            type="number"
                            value={widthInches.toFixed(1)}
                            onChange={(e) => setWidthInches(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="11.9"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">in</span>
                        </div>
                      </div>

                      {/* Height */}
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-2">Height</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={heightFeet}
                            onChange={(e) => setHeightFeet(parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">ft</span>
                          <input
                            type="number"
                            value={heightInches.toFixed(1)}
                            onChange={(e) => setHeightInches(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="11.9"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">in</span>
                        </div>
                      </div>

                      {/* Depth */}
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-2">Depth</p>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={depthFeet}
                            onChange={(e) => setDepthFeet(parseInt(e.target.value) || 0)}
                            min="0"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">ft</span>
                          <input
                            type="number"
                            value={depthInches.toFixed(1)}
                            onChange={(e) => setDepthInches(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            max="11.9"
                            className="w-16 px-2 py-1.5 bg-porcelain text-graphite font-body text-sm rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                          />
                          <span className="text-taupe/50 text-xs font-body">in</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-1">Width</p>
                        <p className="text-sm font-body font-medium text-graphite">
                          {Math.floor(item.dimensions?.width || 0)}' {(((item.dimensions?.width || 0) % 1) * 12).toFixed(1)}"
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-1">Height</p>
                        <p className="text-sm font-body font-medium text-graphite">
                          {Math.floor(item.dimensions?.height || 0)}' {(((item.dimensions?.height || 0) % 1) * 12).toFixed(1)}"
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-taupe/10">
                        <p className="text-xs text-taupe/50 font-body mb-1">Depth</p>
                        <p className="text-sm font-body font-medium text-graphite">
                          {Math.floor(item.dimensions?.depth || 0)}' {(((item.dimensions?.depth || 0) % 1) * 12).toFixed(1)}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Materials & Colors Section */}
                {extractedMaterials.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowMaterialsSection(!showMaterialsSection)}
                      className="w-full flex items-center justify-between font-display font-semibold text-graphite mb-3 hover:text-sage transition-colors"
                    >
                      <span>Materials & Colors</span>
                      <svg
                        className={`w-5 h-5 transition-transform ${showMaterialsSection ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showMaterialsSection && (
                      <div className="space-y-3">
                        {extractedMaterials.map((material, index) => {
                          const currentColor = getMaterialColor(material.name, material.index, material.originalColor)
                          const isOverridden = editMaterialOverrides.some(
                            (o) => o.materialName === material.name || o.materialIndex === material.index
                          )

                          return (
                            <div
                              key={`${material.name}-${material.index}`}
                              className="bg-white rounded-xl p-3 border border-taupe/10"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-body font-medium text-graphite">
                                    {material.name}
                                  </span>
                                  {isOverridden && (
                                    <span className="text-xs text-sage bg-sage/10 px-2 py-0.5 rounded-full">
                                      Modified
                                    </span>
                                  )}
                                </div>
                                {isOverridden && (
                                  <button
                                    onClick={() => handleResetMaterial(material.name, material.index)}
                                    className="text-xs text-taupe/50 hover:text-scarlet transition-colors"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <div
                                    className="w-8 h-8 rounded-lg border border-taupe/20 flex-shrink-0"
                                    style={{ backgroundColor: currentColor }}
                                  />
                                  <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) =>
                                      handleMaterialColorChange(material.name, material.index, e.target.value)
                                    }
                                    disabled={!isEditing}
                                    className="w-16 h-8 rounded-lg border border-taupe/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <input
                                    type="text"
                                    value={currentColor.toUpperCase()}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      if (/^#[0-9A-F]{6}$/i.test(value)) {
                                        handleMaterialColorChange(material.name, material.index, value)
                                      }
                                    }}
                                    disabled={!isEditing}
                                    className="flex-1 px-2 py-1.5 bg-porcelain text-graphite font-mono text-xs rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors disabled:opacity-50"
                                    placeholder="#FFFFFF"
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {editMaterialOverrides.length > 0 && isEditing && (
                          <button
                            onClick={handleResetAllMaterials}
                            className="w-full px-4 py-2 bg-scarlet/10 text-scarlet text-sm font-body font-medium rounded-lg border border-scarlet/20 hover:bg-scarlet/20 transition-colors"
                          >
                            Reset All Materials
                          </button>
                        )}

                        {!isEditing && extractedMaterials.length > 0 && (
                          <p className="text-xs text-taupe/50 font-body text-center">
                            Click "Edit Item" to customize materials
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags Section */}
                <div>
                  <h3 className="font-display font-semibold text-graphite mb-3">
                    Tags
                  </h3>
                  {isEditing ? (
                    <Input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Enter tags separated by commas"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {item.tags.length > 0 ? (
                        item.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-sage/10 text-sage text-xs font-body rounded-full border border-sage/20"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-taupe/50 font-body">No tags</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons - Moved to bottom */}
                <div className="flex gap-3 pt-4 border-t border-taupe/10">
                  {isEditing ? (
                    <>
                      <Button
                        variant="primary"
                        onClick={handleSave}
                        size="lg"
                        fullWidth
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleCancel}
                        size="lg"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="primary"
                        onClick={() => setIsEditing(true)}
                        size="lg"
                        fullWidth
                      >
                        Edit Item
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowDeleteConfirm(true)}
                        size="lg"
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>

              </div>
            </div>
          </aside>
        </div>

        {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-graphite/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-porcelain rounded-3xl p-8 max-w-md w-full shadow-2xl border border-scarlet/20">
            <h3 className="text-2xl font-display font-semibold text-graphite mb-4">
              Delete Item?
            </h3>

            {instances.length > 0 ? (
              <>
                <div className="mb-4 p-4 bg-scarlet/10 border border-scarlet/30 rounded-2xl">
                  <p className="text-scarlet text-sm font-body mb-2">
                    <strong>Warning:</strong> This item is used in {instances.length} placement{instances.length !== 1 ? 's' : ''}.
                  </p>
                  <p className="text-scarlet/70 text-xs font-body">
                    All instances will be removed from your homes.
                  </p>
                </div>
                <p className="text-taupe/80 font-body mb-6">
                  Are you sure you want to delete <strong className="text-graphite">{item.name}</strong>?
                </p>
              </>
            ) : (
              <p className="text-taupe/80 font-body mb-6">
                Are you sure you want to delete <strong className="text-graphite">{item.name}</strong>?
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteConfirm(false)}
                size="lg"
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                size="lg"
                fullWidth
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        show={showToast}
        onClose={() => setShowToast(false)}
      />

      {/* Trellis Job Toast Notification */}
      {trellisToast && (
        <Toast
          message={trellisToast}
          type={trellisToastType}
          show={!!trellisToast}
          onClose={clearTrellisToast}
        />
      )}
    </div>
  )
}
