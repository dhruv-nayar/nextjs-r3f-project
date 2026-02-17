'use client'

import { useState, useRef } from 'react'
import { ImageUploadResult, ImagePair } from '@/types/room'
import Image from 'next/image'

interface ImageUploadProps {
  onUploadComplete: (result: ImageUploadResult) => void
  onError: (error: string) => void
}

interface ProcessedImage {
  localPreview: string // Local preview URL (immediate)
  originalUrl: string // Blob storage URL (after upload)
  processedUrl: string | null
  status: 'processing' | 'completed' | 'error'
  error?: string
}

export function ImageUpload({ onUploadComplete, onError }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList) => {
    const fileArray = Array.from(files)

    // Validate number of files
    if (fileArray.length === 0 || fileArray.length > 10) {
      onError('Please upload 1-10 images')
      return
    }

    // Validate each file
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        onError('All files must be images')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        onError(`${file.name} is too large. Maximum 10MB per image.`)
        return
      }
    }

    setIsProcessing(true)

    // Step 1: Immediately show local previews for all images
    const initialImages: ProcessedImage[] = fileArray.map(file => ({
      localPreview: URL.createObjectURL(file),
      originalUrl: '',
      processedUrl: null,
      status: 'processing' as const
    }))
    setImages(initialImages)

    // Force React to render before starting heavy async work
    await new Promise(resolve => setTimeout(resolve, 0))

    const allImagePaths: string[] = []
    const imagePairs: ImagePair[] = []

    try {
      // Process each image
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const currentIndex = i

        // Step 2: Convert image to base64
        const base64Image = await fileToBase64(file)

        // Step 3: Start background removal AND original upload in parallel
        const [bgRemovalResult, originalUploadResult] = await Promise.all([
          // Background removal
          fetch('/api/remove_bg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64Image })
          }).then(res => res.json()).catch(err => ({ success: false, error: err.message })),

          // Original image upload
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
          })()
        ])

        // Handle original upload result
        if (!originalUploadResult.success) {
          setImages(prev => {
            const newImages = [...prev]
            newImages[currentIndex].status = 'error'
            newImages[currentIndex].error = originalUploadResult.error
            return newImages
          })
          continue
        }

        const originalUrl = originalUploadResult.imagePaths[0]

        // Handle background removal result
        let processedUrl: string | null = null

        if (bgRemovalResult.success) {
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
              processedUrl = processedUploadResult.imagePaths[0]
            }
          } catch (uploadErr) {
            console.warn('Processed image upload error:', uploadErr)
          }
        } else {
          console.warn('Background removal failed:', bgRemovalResult.error)
        }

        // Update with both URLs and mark as completed
        setImages(prev => {
          const newImages = [...prev]
          newImages[currentIndex].originalUrl = originalUrl
          newImages[currentIndex].processedUrl = processedUrl
          newImages[currentIndex].status = 'completed'
          return newImages
        })

        // Add to results
        allImagePaths.push(originalUrl)
        if (processedUrl) {
          allImagePaths.push(processedUrl)
        }

        imagePairs.push({
          original: originalUrl,
          processed: processedUrl
        })
      }

      // All images processed, call completion callback
      if (imagePairs.length > 0) {
        onUploadComplete({
          imagePaths: allImagePaths,
          imagePairs,
          selectedThumbnailIndex: 0 // Default to first image (processed if available, else original)
        })
      } else {
        onError('No images were successfully processed')
      }

    } catch (error) {
      onError(`Upload failed: ${error}`)
    } finally {
      setIsProcessing(false)
      // Clean up object URLs
      initialImages.forEach(img => {
        if (img.localPreview.startsWith('blob:')) {
          URL.revokeObjectURL(img.localPreview)
        }
      })
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {images.length === 0 && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
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

          <div className="space-y-2">
            <div className="text-4xl">🖼️</div>
            <p className="text-lg font-medium">Upload Images</p>
            <p className="text-sm text-gray-500">
              Drag and drop up to 10 images here, or click to browse
            </p>
            <button
              type="button"
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              Choose Images
            </button>
            <p className="text-xs text-gray-400 mt-2">
              JPG, PNG, or WebP • Max 10MB per image
            </p>
          </div>
        </div>
      )}

      {/* Processing Images */}
      {images.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {images.every(img => img.status === 'completed')
              ? `${images.length} image${images.length > 1 ? 's' : ''} ready`
              : `Processing ${images.length} image${images.length > 1 ? 's' : ''}...`
            }
          </p>

          <div className="space-y-4">
            {images.map((img, index) => (
              <div key={index} className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  {/* Original Image - Show immediately with local preview */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 font-medium">Original</div>
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative border border-gray-200">
                      <Image
                        src={img.originalUrl || img.localPreview}
                        alt={`Original ${index + 1}`}
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>

                  {/* Processed Image - Show skeleton while processing */}
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 font-medium">Background Removed</div>
                    <div className="aspect-square bg-[url('/checkerboard.svg')] bg-repeat rounded-lg overflow-hidden relative border border-gray-200">
                      {img.processedUrl && (
                        <Image
                          src={img.processedUrl}
                          alt={`Processed ${index + 1}`}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      )}
                      {!img.processedUrl && img.status === 'processing' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                          {/* Pulsing skeleton */}
                          <div className="w-16 h-16 rounded-lg bg-gray-300 animate-pulse mb-3" />
                          <span className="text-xs text-gray-500 animate-pulse">Removing background...</span>
                        </div>
                      )}
                      {!img.processedUrl && img.status === 'completed' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
                          <span className="text-gray-400 text-xs">Failed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-center">
                  {img.status === 'processing' && (
                    <span className="text-blue-600">Removing background...</span>
                  )}
                  {img.status === 'completed' && (
                    <span className="text-green-600">✓ Complete</span>
                  )}
                  {img.status === 'error' && (
                    <span className="text-red-600">✗ {img.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
