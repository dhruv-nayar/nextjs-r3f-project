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

export function ImageGallery({
  images,
  thumbnailPath,
  isEditing,
  onThumbnailChange,
  onImagesAdd,
  currentThumbnail
}: ImageGalleryProps) {
  const [isUploading, setIsUploading] = useState(false)
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
  if (allImages.length === 0 && thumbnailPath) {
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

    setIsUploading(true)
    setUploadError('')
    const newPairs: ImagePair[] = []

    try {
      for (const file of fileArray) {
        // Convert to base64
        const base64Image = await fileToBase64(file)

        // Upload original
        const originalBlob = await base64ToBlob(base64Image)
        const originalFile = new File([originalBlob], `original_${file.name}`, { type: file.type || 'image/png' })

        const originalFormData = new FormData()
        originalFormData.append('files', originalFile)
        originalFormData.append('itemId', `temp-${Date.now()}-original`)

        const originalUploadRes = await fetch('/api/items/upload-images', {
          method: 'POST',
          body: originalFormData
        })

        const originalUploadResult = await originalUploadRes.json()

        if (!originalUploadResult.success) {
          setUploadError('Failed to upload original image')
          continue
        }

        const originalUrl = originalUploadResult.imagePaths[0]
        let processedUrl: string | null = null

        // Try background removal
        try {
          const bgRemovalRes = await fetch('/api/remove_bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64Image })
          })

          const bgRemovalResult = await bgRemovalRes.json()

          if (bgRemovalResult.success) {
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
          }
        } catch (bgError) {
          console.warn('Background removal error:', bgError)
        }

        newPairs.push({
          original: originalUrl,
          processed: processedUrl
        })
      }

      if (newPairs.length > 0) {
        onImagesAdd(newPairs)
      }

    } catch (error) {
      setUploadError(`Upload failed: ${error}`)
    } finally {
      setIsUploading(false)
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

  if (allImages.length === 0 && !isEditing) {
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

      {isEditing && (
        <p className="text-taupe/60 text-xs font-body">
          {allImages.length > 0 ? 'Click an image to set it as the thumbnail' : 'Add images to this item'}
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
                Uploading...
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
