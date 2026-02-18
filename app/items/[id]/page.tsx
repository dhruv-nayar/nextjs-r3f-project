'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
import { RotationControls } from '@/components/items/RotationControls'
import { ThumbnailGenerator } from '@/components/items/ThumbnailGenerator'
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

  // Viewer gallery state - 'model' for 3D viewer, or index for which image to show
  const [selectedViewerType, setSelectedViewerType] = useState<'model' | number>('model')

  // Dropdown menu state for add image button
  const [showAddImageMenu, setShowAddImageMenu] = useState(false)

  // Model action menu state
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)

  // Dimension state (feet and inches)
  const [widthFeet, setWidthFeet] = useState(Math.floor(item?.dimensions?.width || 0))
  const [widthInches, setWidthInches] = useState(((item?.dimensions?.width || 0) % 1) * 12)
  const [heightFeet, setHeightFeet] = useState(Math.floor(item?.dimensions?.height || 0))
  const [heightInches, setHeightInches] = useState(((item?.dimensions?.height || 0) % 1) * 12)
  const [depthFeet, setDepthFeet] = useState(Math.floor(item?.dimensions?.depth || 0))
  const [depthInches, setDepthInches] = useState(((item?.dimensions?.depth || 0) % 1) * 12)

  // Rotation state (steps: 0, 1, 2, 3 representing 0, 90, 180, 270 degrees)
  const [editRotationXStep, setEditRotationXStep] = useState(
    Math.round((item?.defaultRotation?.x || 0) / (Math.PI / 2)) % 4
  )
  const [editRotationZStep, setEditRotationZStep] = useState(
    Math.round((item?.defaultRotation?.z || 0) / (Math.PI / 2)) % 4
  )

  // Materials state
  const [extractedMaterials, setExtractedMaterials] = useState<MaterialInfo[]>([])
  const [editMaterialOverrides, setEditMaterialOverrides] = useState<MaterialOverride[]>(item?.materialOverrides || [])
  const [showMaterialsSection, setShowMaterialsSection] = useState(false)

  // Helper to round to 1 decimal place (matches left side panel)
  const round = (v: number) => Math.round(v * 10) / 10

  // Model path state (for when a model is generated)
  const [editModelPath, setEditModelPath] = useState(item?.modelPath || '')

  // Autosave debounce timer ref
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)

  // Ref to trigger image upload from floating gallery
  const triggerUploadRef = useRef<(() => void) | null>(null)

  // State for model thumbnail regeneration
  const [shouldRegenerateThumbnail, setShouldRegenerateThumbnail] = useState(false)
  const prevRotationRef = useRef<{ x: number; z: number } | null>(null)

  // Saving indicator state for navbar
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Autosave function - debounced save
  const triggerAutosave = useCallback(() => {
    if (!isInitializedRef.current) return // Don't save during initial load

    // Clear any existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    // Show saving indicator
    setIsSaving(true)

    // Set new debounced save
    autosaveTimerRef.current = setTimeout(() => {
      // Calculate total feet from feet + inches
      const totalWidth = widthFeet + widthInches / 12
      const totalHeight = heightFeet + heightInches / 12
      const totalDepth = depthFeet + depthInches / 12

      // Calculate rotation in radians from steps
      const rotationX = (editRotationXStep * Math.PI) / 2
      const rotationZ = (editRotationZStep * Math.PI) / 2

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
        },
        defaultRotation: (rotationX !== 0 || rotationZ !== 0)
          ? { x: rotationX, z: rotationZ }
          : undefined
      })

      // Update saving indicator
      setIsSaving(false)
      setLastSavedAt(new Date())
    }, 500) // 500ms debounce
  }, [
    itemId, editName, editDescription, editTags, editProductUrl, editPlacementType,
    editMaterialOverrides, editThumbnailPath, editImages, widthFeet, widthInches,
    heightFeet, heightInches, depthFeet, depthInches, editRotationXStep, editRotationZStep, updateItem
  ])

  // Trigger autosave when form values change (except images which are saved immediately)
  useEffect(() => {
    triggerAutosave()
  }, [
    editName, editDescription, editTags, editProductUrl, editPlacementType,
    editMaterialOverrides, widthFeet, widthInches, heightFeet, heightInches,
    depthFeet, depthInches, editRotationXStep, editRotationZStep
  ])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  // Callback for when materials are extracted
  const handleMaterialsExtracted = useCallback((materials: MaterialInfo[]) => {
    setExtractedMaterials(materials)
  }, [])

  // Trigger thumbnail regeneration when rotation changes (for model-based thumbnails)
  useEffect(() => {
    if (!isInitializedRef.current || !item?.modelPath) return

    const currentRotation = { x: editRotationXStep, z: editRotationZStep }

    // Check if rotation actually changed
    if (prevRotationRef.current &&
        (prevRotationRef.current.x !== currentRotation.x ||
         prevRotationRef.current.z !== currentRotation.z)) {
      // Only regenerate if thumbnail is model-based (no images or thumbnail matches model pattern)
      const hasImageThumbnail = editImages.length > 0 && editImages.some(
        img => editThumbnailPath === img.original || editThumbnailPath === img.processed
      )
      if (!hasImageThumbnail) {
        setShouldRegenerateThumbnail(true)
      }
    }

    prevRotationRef.current = currentRotation
  }, [editRotationXStep, editRotationZStep, item?.modelPath, editImages, editThumbnailPath])

  // Auto-generate thumbnail from model when no image-based thumbnail exists
  useEffect(() => {
    if (!isInitializedRef.current || !item?.modelPath) return

    // Check if we have no images and no thumbnail
    const hasNoImages = editImages.length === 0
    const hasNoThumbnail = !editThumbnailPath

    if (hasNoImages && hasNoThumbnail && !shouldRegenerateThumbnail) {
      // Trigger thumbnail generation from model
      setShouldRegenerateThumbnail(true)
    }
  }, [item?.modelPath, editImages.length, editThumbnailPath, shouldRegenerateThumbnail])

  // Handle generated thumbnail from model
  const handleModelThumbnailGenerated = useCallback(async (blob: Blob) => {
    setShouldRegenerateThumbnail(false)

    try {
      // Upload the thumbnail
      const formData = new FormData()
      const file = new File([blob], `thumbnail-${itemId}.png`, { type: 'image/png' })
      formData.append('files', file)
      formData.append('itemId', itemId)

      const response = await fetch('/api/items/upload-images', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      if (result.success && result.imagePaths?.[0]) {
        setEditThumbnailPath(result.imagePaths[0])
        updateItem(itemId, { thumbnailPath: result.imagePaths[0] })
      }
    } catch (error) {
      console.error('Failed to upload model thumbnail:', error)
    }
  }, [itemId, updateItem])

  // Sync edit state with item when it changes (initial load only)
  useEffect(() => {
    if (item && !isInitializedRef.current) {
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

      // Update rotation state
      setEditRotationXStep(Math.round((item.defaultRotation?.x || 0) / (Math.PI / 2)) % 4)
      setEditRotationZStep(Math.round((item.defaultRotation?.z || 0) / (Math.PI / 2)) % 4)

      // Mark as initialized after a short delay to let state settle
      setTimeout(() => {
        isInitializedRef.current = true
      }, 100)
    }
  }, [item])

  // Handle processed image update (when background removal completes)
  // IMPORTANT: This must be defined before the early return to maintain hook order
  const handleImageUpdate = useCallback((originalUrl: string, processedUrl: string) => {
    console.log('[ItemPage] handleImageUpdate called:', { originalUrl, processedUrl })

    // Get current item from context (fresh, not from closure)
    const currentItem = getItem(itemId)
    const currentImages = currentItem?.images || []
    console.log('[ItemPage] Current item images:', currentImages)

    // Check if the original URL exists in the current images
    const imageExists = currentImages.some(pair => pair.original === originalUrl)
    if (!imageExists) {
      console.warn('[ItemPage] Original URL not found in current images, skipping update')
      return
    }

    const updatedImages = currentImages.map(pair =>
      pair.original === originalUrl
        ? { ...pair, processed: processedUrl }
        : pair
    )
    console.log('[ItemPage] Updated images:', updatedImages)
    setEditImages(updatedImages)

    // Update thumbnail if it was the original and we now have processed
    const currentThumbnail = currentItem?.thumbnailPath || ''
    let newThumbnail = currentThumbnail
    if (currentThumbnail === originalUrl) {
      newThumbnail = processedUrl
      setEditThumbnailPath(newThumbnail)
    }

    // Auto-save the update
    console.log('[ItemPage] Saving updated images to item')
    updateItem(itemId, {
      images: updatedImages,
      thumbnailPath: newThumbnail || undefined
    })
  }, [itemId, getItem, updateItem])

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
    console.log('[ItemPage] handleImagesAdd called with:', newPairs)
    const updatedImages = [...editImages, ...newPairs]
    console.log('[ItemPage] Updated images array:', updatedImages)
    setEditImages(updatedImages)

    // If no thumbnail is set yet, use the first processed or original image
    let newThumbnail = editThumbnailPath
    if (!editThumbnailPath && newPairs.length > 0) {
      newThumbnail = newPairs[0].processed || newPairs[0].original
      setEditThumbnailPath(newThumbnail)
    }

    // Auto-save images immediately so item persists even if user navigates away
    console.log('[ItemPage] Saving to item:', itemId, { images: updatedImages, thumbnailPath: newThumbnail })
    updateItem(itemId, {
      images: updatedImages,
      thumbnailPath: newThumbnail || undefined
    })
  }

  // Handle paste from clipboard
  const handlePasteFromClipboard = async () => {
    setShowAddImageMenu(false)
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File([blob], `pasted-${Date.now()}.png`, { type: imageType })

          // Create a DataTransfer to simulate file input
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(file)

          // Trigger the file input handler through ImageGallery
          if (triggerUploadRef.current) {
            // We need to manually trigger the upload flow
            // For now, let's use a workaround - create a hidden input and trigger it
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.files = dataTransfer.files
            input.dispatchEvent(new Event('change', { bubbles: true }))

            // Actually, let's just call the ImageGallery's handleFileSelect indirectly
            // by using the file input ref
            triggerUploadRef.current()
          }

          setToastMessage('Image pasted from clipboard!')
          setToastType('success')
          setShowToast(true)
          return
        }
      }
      setToastMessage('No image found in clipboard')
      setToastType('error')
      setShowToast(true)
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      setToastMessage('Failed to paste from clipboard. Make sure you have copied an image.')
      setToastType('error')
      setShowToast(true)
    }
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

      {/* Thumbnail Generator (invisible, triggered when rotation changes) */}
      {shouldRegenerateThumbnail && item.modelPath && (
        <ThumbnailGenerator
          modelPath={item.modelPath}
          defaultRotation={{ x: (editRotationXStep * Math.PI) / 2, z: (editRotationZStep * Math.PI) / 2 }}
          onThumbnailGenerated={handleModelThumbnailGenerated}
          onError={(error) => {
            console.error('Thumbnail generation error:', error)
            setShouldRegenerateThumbnail(false)
          }}
        />
      )}

      {/* Navigation Bar */}
      <Navbar activeTab="inventory" breadcrumb={item.name} isSaving={isSaving} lastSavedAt={lastSavedAt} />

      {/* Main Content Layout */}
      <div className="flex">
        {/* Left Side - 3D Viewer / Image Viewer */}
        <main className="flex-1 p-6">
          <div className="w-full h-[calc(100vh-88px)] bg-porcelain relative">
            {/* Main Viewer Content - with bottom padding to avoid floating gallery */}
            {selectedViewerType === 'model' ? (
              // 3D Model Viewer
              item.modelPath ? (
                <div className="w-full h-full pb-24 relative group/canvas">
                <ItemPreview
                  modelPath={item.modelPath}
                  category={item.category}
                  materialOverrides={editMaterialOverrides}
                  defaultRotation={{ x: (editRotationXStep * Math.PI) / 2, z: (editRotationZStep * Math.PI) / 2 }}
                  dimensions={{
                    width: widthFeet + widthInches / 12,
                    height: heightFeet + heightInches / 12,
                    depth: depthFeet + depthInches / 12
                  }}
                />
                {/* Floating regenerate button */}
                {editImages.some(img => img.processed) && (
                  <div className="absolute top-4 right-4 opacity-0 group-hover/canvas:opacity-100 transition-opacity">
                    <button
                      onClick={() => setShowRegenerateModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-graphite hover:bg-sage hover:text-white transition-colors text-sm font-body"
                      title="Regenerate model"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Regenerate
                    </button>
                  </div>
                )}
                </div>
              ) : item.parametricShape ? (
                <ParametricShapePreview
                  shape={item.parametricShape}
                  dimensions={item.dimensions}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center relative">
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
                    <p className="text-taupe/40 font-body mb-4">No 3D model available</p>

                    {/* Add Model Menu */}
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowModelMenu(!showModelMenu)}
                        className="flex items-center gap-2 px-4 py-2 bg-sage text-white rounded-lg hover:bg-sage/90 transition-colors text-sm font-body font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Model
                      </button>

                      {showModelMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowModelMenu(false)}
                          />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 bg-white rounded-xl shadow-lg border border-taupe/10 py-2 min-w-[200px]">
                            {editImages.some(img => img.processed) && (
                              <button
                                onClick={() => {
                                  setShowModelMenu(false)
                                  setShowRegenerateModal(true)
                                }}
                                className="w-full px-4 py-2 text-left text-sm font-body text-graphite hover:bg-porcelain flex items-center gap-3"
                              >
                                <svg className="w-4 h-4 text-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Generate from images
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setShowModelMenu(false)
                                setToastMessage('GLB upload coming soon!')
                                setToastType('info')
                                setShowToast(true)
                              }}
                              className="w-full px-4 py-2 text-left text-sm font-body text-graphite hover:bg-porcelain flex items-center gap-3"
                            >
                              <svg className="w-4 h-4 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Upload GLB file
                            </button>
                            <div className="border-t border-taupe/10 my-1" />
                            <button
                              onClick={() => {
                                setShowModelMenu(false)
                                setToastMessage('Asset library coming soon!')
                                setToastType('info')
                                setShowToast(true)
                              }}
                              className="w-full px-4 py-2 text-left text-sm font-body text-taupe/50 hover:bg-porcelain flex items-center gap-3"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              Select from assets
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : (
              // Image Viewer
              <div className="w-full h-full flex items-center justify-center p-8 pb-24">
                {editImages[selectedViewerType] && (
                  <div className="relative max-w-2xl max-h-full group">
                    <Image
                      src={editImages[selectedViewerType].processed || editImages[selectedViewerType].original}
                      alt={`Image ${selectedViewerType + 1}`}
                      width={800}
                      height={800}
                      className="object-contain max-h-[calc(100vh-200px)]"
                      unoptimized
                    />
                    {/* Floating action buttons on image */}
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Use as thumbnail button */}
                      <button
                        onClick={() => {
                          const currentImage = editImages[selectedViewerType]
                          const newThumbnail = currentImage.processed || currentImage.original
                          setEditThumbnailPath(newThumbnail)
                          updateItem(itemId, { thumbnailPath: newThumbnail })
                        }}
                        className={cn(
                          "p-2 rounded-lg shadow-md transition-colors",
                          editThumbnailPath === (editImages[selectedViewerType].processed || editImages[selectedViewerType].original)
                            ? "bg-sage text-white"
                            : "bg-white/90 backdrop-blur-sm text-graphite hover:bg-sage hover:text-white"
                        )}
                        title="Use as thumbnail"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          const index = selectedViewerType as number
                          const deletedImage = editImages[index]
                          setEditImages(prev => prev.filter((_, i) => i !== index))
                          if (deletedImage && (editThumbnailPath === deletedImage.original || editThumbnailPath === deletedImage.processed)) {
                            setEditThumbnailPath('')
                          }
                          setSelectedViewerType('model')
                        }}
                        className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-scarlet hover:bg-scarlet hover:text-white transition-colors"
                        title="Delete image"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Floating Thumbnail Gallery - only show when there are images or a model */}
            {(item.modelPath || item.parametricShape || editImages.length > 0) && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl p-2 shadow-lg">
                {/* 3D Model Thumbnail */}
                {(item.modelPath || item.parametricShape) && (
                  <button
                    onClick={() => setSelectedViewerType('model')}
                    className={cn(
                      'w-12 h-12 flex items-center justify-center transition-all rounded-lg',
                      selectedViewerType === 'model'
                        ? 'bg-taupe/10'
                        : 'opacity-70 hover:opacity-100'
                    )}
                    title="View 3D Model"
                  >
                    <svg className="w-6 h-6 text-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                    </svg>
                  </button>
                )}

                {/* Image Thumbnails */}
                {editImages.map((pair, index) => (
                  <div
                    key={index}
                    className="relative group"
                  >
                    <button
                      onClick={() => setSelectedViewerType(index)}
                      className={cn(
                        'w-12 h-12 rounded-lg overflow-hidden transition-all',
                        selectedViewerType === index
                          ? 'ring-2 ring-taupe/30 ring-offset-2'
                          : 'opacity-70 hover:opacity-100'
                      )}
                      title={`View Image ${index + 1}`}
                    >
                      <div className="relative w-full h-full">
                        <Image
                          src={pair.processed || pair.original}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    </button>
                    {/* Delete button on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const deletedImage = editImages[index]
                        setEditImages(prev => prev.filter((_, i) => i !== index))
                        if (deletedImage && (editThumbnailPath === deletedImage.original || editThumbnailPath === deletedImage.processed)) {
                          setEditThumbnailPath('')
                        }
                        if (selectedViewerType === index) {
                          setSelectedViewerType('model')
                        } else if (typeof selectedViewerType === 'number' && selectedViewerType > index) {
                          setSelectedViewerType(selectedViewerType - 1)
                        }
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-scarlet rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Delete image"
                    >
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add Image Button with Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowAddImageMenu(!showAddImageMenu)}
                    className="w-12 h-12 rounded-lg flex items-center justify-center transition-all opacity-70 hover:opacity-100"
                    title="Add images"
                  >
                    <svg className="w-6 h-6 text-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {showAddImageMenu && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowAddImageMenu(false)}
                      />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-white rounded-xl shadow-lg border border-taupe/10 py-2 min-w-[180px]">
                        <button
                          onClick={() => {
                            setShowAddImageMenu(false)
                            triggerUploadRef.current?.()
                          }}
                          className="w-full px-4 py-2 text-left text-sm font-body text-graphite hover:bg-porcelain flex items-center gap-3"
                        >
                          <svg className="w-4 h-4 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Upload images
                        </button>
                        <button
                          onClick={handlePasteFromClipboard}
                          className="w-full px-4 py-2 text-left text-sm font-body text-graphite hover:bg-porcelain flex items-center gap-3"
                        >
                          <svg className="w-4 h-4 text-taupe" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Paste from clipboard
                        </button>
                        <div className="border-t border-taupe/10 my-1" />
                        <button
                          onClick={() => {
                            setShowAddImageMenu(false)
                            setToastMessage('Asset library coming soon!')
                            setToastType('info')
                            setShowToast(true)
                          }}
                          className="w-full px-4 py-2 text-left text-sm font-body text-taupe/50 hover:bg-porcelain flex items-center gap-3"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          Select from assets
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Side - Sidebar Panel */}
        <aside className="w-[400px] flex-shrink-0">
          <div className="fixed right-6 top-24 bottom-6 w-[376px] bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col">
            {/* Pinned Header */}
            <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-white font-semibold text-lg bg-transparent border-none p-0 focus:ring-0"
                  />
                  <p className="text-white/50 text-xs capitalize">{item.category}</p>
                </div>
                {/* Back to Project Button - only shown when coming from home editor */}
                {returnContext && (
                  <button
                    onClick={handleBackToProject}
                    className="ml-2 p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Back to Project"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Description Section */}
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">
                    Description
                  </h3>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a description..."
                    className="w-full px-3 py-2 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors resize-none placeholder:text-white/30"
                    rows={3}
                  />
                </div>

                {/* Images Section - Upload only (gallery is in floating bar at bottom of viewer) */}
                <ImageGallery
                  images={editImages}
                  thumbnailPath={item.thumbnailPath}
                  isEditing={true}
                  onThumbnailChange={setEditThumbnailPath}
                  onImagesAdd={handleImagesAdd}
                  onImageUpdate={handleImageUpdate}
                  onImageDelete={(pairIndex) => {
                    const deletedImage = editImages[pairIndex]
                    setEditImages(prev => prev.filter((_, i) => i !== pairIndex))
                    // If the deleted image was the thumbnail, clear the thumbnail
                    if (deletedImage && (editThumbnailPath === deletedImage.original || editThumbnailPath === deletedImage.processed)) {
                      setEditThumbnailPath('')
                    }
                    // Reset viewer if viewing deleted image
                    if (selectedViewerType === pairIndex) {
                      setSelectedViewerType('model')
                    } else if (typeof selectedViewerType === 'number' && selectedViewerType > pairIndex) {
                      setSelectedViewerType(selectedViewerType - 1)
                    }
                  }}
                  currentThumbnail={editThumbnailPath}
                  uploadOnly
                  triggerUploadRef={triggerUploadRef}
                />

                {/* Generate 3D Model Section - shown when there are images, or if generation was interrupted */}
                {(editImages.length > 0 || item.generationStatus?.isGenerating) && !item.modelPath && (
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
                  <h3 className="text-white font-medium text-sm mb-2">
                    Metadata
                  </h3>
                  <div className="space-y-3">
                    {/* Placement Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60 font-body">Placement:</span>
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
                    </div>

                    {/* Product URL */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60 font-body">Product:</span>
                      <Input
                        type="url"
                        value={editProductUrl}
                        onChange={(e) => setEditProductUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 ml-3"
                      />
                    </div>
                  </div>
                </div>

                {/* Dimensions Section */}
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">
                    Dimensions
                  </h3>
                  <div className="space-y-3">
                    {/* Width */}
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-xs text-white/40 font-body mb-2">Width</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={widthFeet || ''}
                          onChange={(e) => setWidthFeet(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">ft</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={round(widthInches) || ''}
                          onChange={(e) => setWidthInches(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">in</span>
                      </div>
                    </div>

                    {/* Height */}
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-xs text-white/40 font-body mb-2">Height</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={heightFeet || ''}
                          onChange={(e) => setHeightFeet(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">ft</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={round(heightInches) || ''}
                          onChange={(e) => setHeightInches(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">in</span>
                      </div>
                    </div>

                    {/* Depth */}
                    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                      <p className="text-xs text-white/40 font-body mb-2">Depth</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={depthFeet || ''}
                          onChange={(e) => setDepthFeet(parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">ft</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={round(depthInches) || ''}
                          onChange={(e) => setDepthInches(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-16 px-2 py-1.5 bg-white/10 text-white font-body text-sm rounded-lg border border-white/20 focus:outline-none focus:border-white/40 transition-colors"
                        />
                        <span className="text-white/40 text-xs font-body">in</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Default Rotation Section */}
                <div>
                  <h3 className="text-white font-medium text-sm mb-2">
                    Default Rotation
                  </h3>
                  <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
                    <RotationControls
                      label="Tilt Forward/Back"
                      axis="X"
                      step={editRotationXStep}
                      onChange={setEditRotationXStep}
                    />
                    <RotationControls
                      label="Roll Left/Right"
                      axis="Z"
                      step={editRotationZStep}
                      onChange={setEditRotationZStep}
                    />
                  </div>
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
                              className="bg-white/5 rounded-lg p-3 border border-white/10"
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
                                    className="text-xs text-white/40 hover:text-scarlet transition-colors"
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
                                    className="w-16 h-8 rounded-lg border border-taupe/10 cursor-pointer"
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
                                    className="flex-1 px-2 py-1.5 bg-porcelain text-graphite font-mono text-xs rounded-lg border border-taupe/10 focus:outline-none focus:border-sage/50 transition-colors"
                                    placeholder="#FFFFFF"
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {editMaterialOverrides.length > 0 && (
                          <button
                            onClick={handleResetAllMaterials}
                            className="w-full px-4 py-2 bg-scarlet/10 text-scarlet text-sm font-body font-medium rounded-lg border border-scarlet/20 hover:bg-scarlet/20 transition-colors"
                          >
                            Reset All Materials
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

            </div>

            {/* Pinned Footer */}
            <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/40 font-body">
                  {isSaving ? 'Saving...' : 'Changes saved'}
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 text-sm font-body text-scarlet hover:bg-scarlet/20 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </aside>
        </div>

        {/* Regenerate Model Modal */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-graphite/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-porcelain rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-sage/20">
            <h3 className="text-2xl font-display font-semibold text-graphite mb-2">
              {item.modelPath ? 'Regenerate Model' : 'Generate Model'}
            </h3>
            <p className="text-taupe/60 font-body text-sm mb-6">
              Select images to generate a new 3D model. {item.modelPath && 'The current model will be replaced.'}
            </p>

            {/* Image Selection */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {editImages.filter(img => img.processed).map((pair, index) => (
                <button
                  key={index}
                  onClick={() => {
                    // Toggle selection using a data attribute approach
                    const btn = document.querySelector(`[data-regen-img="${index}"]`)
                    btn?.classList.toggle('ring-2')
                    btn?.classList.toggle('ring-sage')
                  }}
                  data-regen-img={index}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-taupe/10 hover:border-sage/50 transition-all"
                >
                  <Image
                    src={pair.processed || pair.original}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>

            {editImages.filter(img => img.processed).length === 0 && (
              <p className="text-center text-taupe/50 font-body text-sm py-8">
                No processed images available. Add images with background removed first.
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowRegenerateModal(false)}
                size="lg"
                fullWidth
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowRegenerateModal(false)
                  // Scroll to the generate panel in sidebar
                  const generatePanel = document.querySelector('[data-generate-panel]')
                  if (generatePanel) {
                    generatePanel.scrollIntoView({ behavior: 'smooth' })
                  }
                  setToastMessage('Select images in the sidebar and click Generate to create a new model')
                  setToastType('info')
                  setShowToast(true)
                }}
                size="lg"
                fullWidth
                disabled={editImages.filter(img => img.processed).length === 0}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

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
