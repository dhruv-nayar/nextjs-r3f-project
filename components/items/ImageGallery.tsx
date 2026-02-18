'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ImagePair } from '@/types/room'

interface ImageGalleryProps {
  images: ImagePair[]
  thumbnailPath?: string
  isEditing: boolean
  onThumbnailChange?: (url: string) => void
  onImagesAdd?: (newPairs: ImagePair[]) => void
  onImageUpdate?: (originalUrl: string, processedUrl: string) => void
  onImageDelete?: (pairIndex: number) => void
  currentThumbnail?: string
}

interface PendingImage {
  localPreview: string
  originalUrl: string | null
  processedUrl: string | null
  status: 'processing' | 'completed' | 'error'
  error?: string
}

export function ImageGallery({
  images,
  thumbnailPath,
  isEditing,
  onThumbnailChange,
  onImagesAdd,
  onImageUpdate,
  onImageDelete,
  currentThumbnail
}: ImageGalleryProps) {
  const [hoveredPairIndex, setHoveredPairIndex] = useState<number | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [uploadError, setUploadError] = useState('')
  const [processingOriginals, setProcessingOriginals] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use refs to always have the latest callbacks available in async code
  const onImageUpdateRef = useRef(onImageUpdate)
  const onImagesAddRef = useRef(onImagesAdd)

  useEffect(() => {
    onImageUpdateRef.current = onImageUpdate
    onImagesAddRef.current = onImagesAdd
  }, [onImageUpdate, onImagesAdd])

  // Combine thumbnailPath with images for display
  const allImages: Array<{ url: string; type: 'original' | 'processed' | 'thumbnail'; pairIndex: number }> = []

  // Add images from pairs
  images.forEach((pair, index) => {
    allImages.push({ url: pair.original, type: 'original', pairIndex: index })
    if (pair.processed) {
      allImages.push({ url: pair.processed, type: 'processed', pairIndex: index })
    }
  })

  // If no images but we have a thumbnail, show it
  if (allImages.length === 0 && thumbnailPath && pendingImages.length === 0) {
    allImages.push({ url: thumbnailPath, type: 'thumbnail', pairIndex: -1 })
  }

  const selectedThumbnail = currentThumbnail || thumbnailPath

  const handleFileSelect = async (files: FileList) => {
    if (!onImagesAdd) return

    const fileArray = Array.from(files)

    // Validate files
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        setUploadError('All files must be images')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`${file.name} is too large. Maximum 10MB per image.`)
        return
      }
    }

    setUploadError('')

    // Step 1: Immediately show local previews for all new images
    const newPendingImages: PendingImage[] = fileArray.map(file => ({
      localPreview: URL.createObjectURL(file),
      originalUrl: null,
      processedUrl: null,
      status: 'processing' as const
    }))
    setPendingImages(prev => [...prev, ...newPendingImages])

    // Force render before starting heavy async work
    await new Promise(resolve => setTimeout(resolve, 0))

    const newPairs: ImagePair[] = []
    const startIndex = pendingImages.length

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const pendingIndex = startIndex + i

        // Convert to base64
        const base64Image = await fileToBase64(file)

        // Step 1: Upload original image FIRST (don't wait for rembg)
        const originalBlob = await base64ToBlob(base64Image)
        const originalFile = new File([originalBlob], `original_${file.name}`, { type: file.type || 'image/png' })

        const originalFormData = new FormData()
        originalFormData.append('files', originalFile)
        originalFormData.append('itemId', `temp-${Date.now()}-original`)

        const originalRes = await fetch('/api/items/upload-images', {
          method: 'POST',
          body: originalFormData
        })
        const originalUploadResult = await originalRes.json()

        if (!originalUploadResult.success) {
          setPendingImages(prev => {
            const updated = [...prev]
            if (updated[pendingIndex]) {
              updated[pendingIndex].status = 'error'
              updated[pendingIndex].error = 'Failed to upload original'
            }
            return updated
          })
          continue
        }

        const originalUrl = originalUploadResult.imagePaths[0]
        console.log('[ImageGallery] Original uploaded:', originalUrl)

        // Step 2: IMMEDIATELY save original image (before starting rembg)
        // This ensures image persists even if user navigates away
        console.log('[ImageGallery] Calling onImagesAdd with:', { original: originalUrl, processed: null })
        // Use ref to call the latest callback
        onImagesAddRef.current?.([{ original: originalUrl, processed: null }])

        // Track that this original is being processed
        setProcessingOriginals(prev => new Set(prev).add(originalUrl))

        // Update pending status to show original is uploaded
        setPendingImages(prev => {
          const updated = [...prev]
          if (updated[pendingIndex]) {
            updated[pendingIndex].originalUrl = originalUrl
          }
          return updated
        })

        // Step 3: Start background removal (don't await - let it run async)
        // This runs in background and updates when complete
        fetch('/api/remove_bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64Image })
        })
          .then(res => res.json())
          .then(async (bgRemovalResult) => {
            if (!bgRemovalResult.success) {
              console.warn('Background removal failed:', bgRemovalResult.error)
              // Remove from processing set
              setProcessingOriginals(prev => {
                const next = new Set(prev)
                next.delete(originalUrl)
                return next
              })
              return
            }

            // Upload processed image
            try {
              const processedBase64 = bgRemovalResult.processedImageData
              const processedBlob = await base64ToBlob(processedBase64)
              const processedFile = new File([processedBlob], `processed_${file.name.replace(/\.[^/.]+$/, '')}.png`, { type: 'image/png' })

              const processedFormData = new FormData()
              processedFormData.append('files', processedFile)
              processedFormData.append('itemId', `temp-${Date.now()}-processed`)

              const processedUploadRes = await fetch('/api/items/upload-images', {
                method: 'POST',
                body: processedFormData
              })

              const processedUploadResult = await processedUploadRes.json()

              if (processedUploadResult.success) {
                const processedUrl = processedUploadResult.imagePaths[0]
                console.log('[ImageGallery] Processed image uploaded:', processedUrl)

                // Update the existing image pair with processed URL
                // Use ref to call the latest callback (avoids stale closure)
                if (onImageUpdateRef.current) {
                  console.log('[ImageGallery] Calling onImageUpdate via ref')
                  onImageUpdateRef.current(originalUrl, processedUrl)
                }
              }

              // Remove from processing set (success or not)
              setProcessingOriginals(prev => {
                const next = new Set(prev)
                next.delete(originalUrl)
                return next
              })
            } catch (uploadErr) {
              console.warn('Processed image upload error:', uploadErr)
              // Remove from processing set on error
              setProcessingOriginals(prev => {
                const next = new Set(prev)
                next.delete(originalUrl)
                return next
              })
            }
          })
          .catch(err => {
            console.warn('Background removal error:', err)
            // Remove from processing set on error
            setProcessingOriginals(prev => {
              const next = new Set(prev)
              next.delete(originalUrl)
              return next
            })
          })
      }

      // Note: We don't clear pending images here anymore
      // They will be filtered out in the render based on whether
      // the URL exists in the actual images prop (see pendingToShow below)

    } catch (error) {
      setUploadError(`Upload failed: ${error}`)
    } finally {
      // Clean up object URLs for completed images
      newPendingImages.forEach(img => {
        if (img.localPreview.startsWith('blob:')) {
          URL.revokeObjectURL(img.localPreview)
        }
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const base64ToBlob = async (base64: string): Promise<Blob> => {
    const res = await fetch(base64)
    return res.blob()
  }

  // Filter pending images to only show ones not yet in the actual images prop
  const existingOriginalUrls = new Set(images.map(img => img.original))
  const pendingToShow = pendingImages.filter(img => !img.originalUrl || !existingOriginalUrls.has(img.originalUrl))

  const isUploading = pendingToShow.some(img => img.status === 'processing')

  if (allImages.length === 0 && pendingToShow.length === 0 && !isEditing) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display font-semibold text-graphite">
        Images
      </h3>

      {uploadError && (
        <div className="p-3 bg-scarlet/10 border border-scarlet/30 rounded-xl text-scarlet text-sm font-body">
          {uploadError}
        </div>
      )}

      {/* Existing Images */}
      {allImages.length > 0 && (
        <div className="space-y-4">
          {/* Group images by pair index */}
          {Array.from(new Set(allImages.map(img => img.pairIndex))).map(pairIndex => {
            const pairImages = allImages.filter(img => img.pairIndex === pairIndex)
            const hasBothVersions = pairImages.length > 1

            return (
              <div
                key={pairIndex}
                className="space-y-2 relative"
                onMouseEnter={() => setHoveredPairIndex(pairIndex)}
                onMouseLeave={() => setHoveredPairIndex(null)}
              >
                {/* Processing indicator - shows when image has original but no processed yet */}
                {pairIndex >= 0 && images[pairIndex] && images[pairIndex].original && !images[pairIndex].processed && (
                  <div className="flex items-center gap-2 text-xs text-sage mb-1">
                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Removing background...</span>
                  </div>
                )}
                {images.length > 1 && pairIndex >= 0 && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-taupe/60 font-medium">
                      Image {pairIndex + 1}
                    </div>
                    {/* Delete button - shows on hover in edit mode */}
                    {isEditing && onImageDelete && hoveredPairIndex === pairIndex && pairIndex >= 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onImageDelete(pairIndex)
                        }}
                        className="p-1 bg-scarlet/10 hover:bg-scarlet/20 rounded-lg transition-colors group"
                        title="Delete this image"
                      >
                        <svg
                          className="w-4 h-4 text-scarlet"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                {/* Delete button for single image (no header) */}
                {images.length === 1 && isEditing && onImageDelete && hoveredPairIndex === pairIndex && pairIndex >= 0 && (
                  <div className="flex justify-end mb-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onImageDelete(pairIndex)
                      }}
                      className="p-1 bg-scarlet/10 hover:bg-scarlet/20 rounded-lg transition-colors group"
                      title="Delete this image"
                    >
                      <svg
                        className="w-4 h-4 text-scarlet"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className={`grid ${hasBothVersions ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  {pairImages.map((img, imgIndex) => (
                    <button
                      key={imgIndex}
                      type="button"
                      onClick={() => isEditing && onThumbnailChange?.(img.url)}
                      disabled={!isEditing}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        selectedThumbnail === img.url
                          ? 'border-sage ring-2 ring-sage/30'
                          : 'border-taupe/20 hover:border-taupe/40'
                      } ${!isEditing ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {img.type === 'processed' ? (
                        <div className="absolute inset-0 bg-[url('/checkerboard.svg')] bg-repeat" />
                      ) : (
                        <div className="absolute inset-0 bg-floral-white" />
                      )}
                      <Image
                        src={img.url}
                        alt={`${img.type} image`}
                        fill
                        className="object-contain relative"
                        unoptimized
                      />
                      <div className={`absolute bottom-0 left-0 right-0 ${
                        img.type === 'processed' ? 'bg-sage/90' : 'bg-graphite/70'
                      } text-white text-xs py-1 text-center`}>
                        {img.type === 'processed' ? 'No Background' : img.type === 'thumbnail' ? 'Thumbnail' : 'Original'}
                      </div>
                      {selectedThumbnail === img.url && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-sage rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pending Images (being uploaded/processed) */}
      {pendingToShow.length > 0 && (
        <div className="space-y-4">
          {pendingToShow.map((pending, index) => (
            <div key={`pending-${index}`} className="space-y-2">
              <div className="text-xs text-taupe/60 font-medium">
                {pending.status === 'processing' ? 'Processing...' : pending.status === 'error' ? 'Error' : 'Ready'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {/* Original Image - Show immediately with local preview */}
                <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-taupe/20">
                  <div className="absolute inset-0 bg-floral-white" />
                  <Image
                    src={pending.originalUrl || pending.localPreview}
                    alt="Original"
                    fill
                    className="object-contain relative"
                    unoptimized
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-graphite/70 text-white text-xs py-1 text-center">
                    Original
                  </div>
                </div>

                {/* Processed Image - Show skeleton while processing */}
                <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-taupe/20">
                  {pending.processedUrl ? (
                    <>
                      <div className="absolute inset-0 bg-[url('/checkerboard.svg')] bg-repeat" />
                      <Image
                        src={pending.processedUrl}
                        alt="Processed"
                        fill
                        className="object-contain relative"
                        unoptimized
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-sage/90 text-white text-xs py-1 text-center">
                        No Background
                      </div>
                    </>
                  ) : pending.status === 'processing' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                      {/* Pulsing skeleton */}
                      <div className="w-12 h-12 rounded-lg bg-gray-300 animate-pulse mb-2" />
                      <span className="text-xs text-gray-500 animate-pulse">Removing background...</span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <span className="text-gray-400 text-xs">Failed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <p className="text-taupe/60 text-xs font-body">
          {allImages.length > 0 || pendingToShow.length > 0 ? 'Click an image to set it as the thumbnail' : 'Add images to this item'}
        </p>
      )}

      {/* Add More Images Button (Edit Mode Only) */}
      {isEditing && onImagesAdd && (
        <div className="pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFileSelect(e.target.files)
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-full px-4 py-3 border-2 border-dashed rounded-xl text-sm font-body font-medium transition-colors ${
              isUploading
                ? 'border-taupe/20 text-taupe/40 cursor-not-allowed'
                : 'border-sage/30 text-sage hover:bg-sage/5 hover:border-sage/50'
            }`}
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-sage border-t-transparent rounded-full" />
                Processing images...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add More Images
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
