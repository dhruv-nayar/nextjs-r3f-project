'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ImagePair } from '@/types/room'

interface ImageGalleryProps {
  images: ImagePair[]
  thumbnailPath?: string
  isEditing: boolean
  onThumbnailChange?: (url: string) => void
  onImagesAdd?: (newPairs: ImagePair[]) => void
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
  currentThumbnail
}: ImageGalleryProps) {
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

        // Run original upload and background removal in parallel
        const [originalUploadResult, bgRemovalResult] = await Promise.all([
          // Upload original
          (async () => {
            const originalBlob = await base64ToBlob(base64Image)
            const originalFile = new File([originalBlob], `original_${file.name}`, { type: file.type || 'image/png' })

            const originalFormData = new FormData()
            originalFormData.append('files', originalFile)
            originalFormData.append('itemId', `temp-${Date.now()}-original`)

            const res = await fetch('/api/items/upload-images', {
              method: 'POST',
              body: originalFormData
            })
            return res.json()
          })(),

          // Background removal
          fetch('/api/remove_bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64Image })
          }).then(res => res.json()).catch(err => ({ success: false, error: err.message }))
        ])

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
        let processedUrl: string | null = null

        // Upload processed image if background removal succeeded
        if (bgRemovalResult.success) {
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
              processedUrl = processedUploadResult.imagePaths[0]
            }
          } catch (uploadErr) {
            console.warn('Processed image upload error:', uploadErr)
          }
        }

        // Update pending image status
        setPendingImages(prev => {
          const updated = [...prev]
          if (updated[pendingIndex]) {
            updated[pendingIndex].originalUrl = originalUrl
            updated[pendingIndex].processedUrl = processedUrl
            updated[pendingIndex].status = 'completed'
          }
          return updated
        })

        newPairs.push({
          original: originalUrl,
          processed: processedUrl
        })
      }

      if (newPairs.length > 0) {
        onImagesAdd(newPairs)
        // Clear pending images after they've been added
        setPendingImages(prev => prev.filter(img => img.status === 'processing'))
      }

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

  const isUploading = pendingImages.some(img => img.status === 'processing')

  if (allImages.length === 0 && pendingImages.length === 0 && !isEditing) {
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
              <div key={pairIndex} className="space-y-2">
                {images.length > 1 && pairIndex >= 0 && (
                  <div className="text-xs text-taupe/60 font-medium">
                    Image {pairIndex + 1}
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
      {pendingImages.length > 0 && (
        <div className="space-y-4">
          {pendingImages.map((pending, index) => (
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
          {allImages.length > 0 || pendingImages.length > 0 ? 'Click an image to set it as the thumbnail' : 'Add images to this item'}
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
