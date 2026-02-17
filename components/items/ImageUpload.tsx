'use client'

import { useState, useRef, useEffect } from 'react'
import { ImageUploadResult, ImagePair } from '@/types/room'
import Image from 'next/image'
import { useCreateBackgroundJob, useItemJobs } from '@/lib/use-background-jobs'

interface ImageUploadProps {
  itemId: string // The item ID to associate uploads with
  onUploadComplete: (result: ImageUploadResult) => void
  onError: (error: string) => void
}

interface ProcessedImage {
  localPreview: string // Local preview URL (immediate)
  originalUrl: string // Blob storage URL (after upload)
  processedUrl: string | null
  status: 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  jobId?: string // Background job ID for tracking
}

export function ImageUpload({ itemId, onUploadComplete, onError }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createJob = useCreateBackgroundJob()

  // Watch for job updates and update image status
  const { jobs } = useItemJobs(itemId, 1000)

  // Update image statuses based on background jobs
  useEffect(() => {
    if (jobs.length === 0) return

    setImages(prev => {
      const newImages = [...prev]
      let updated = false

      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i]
        if (!img.jobId) continue

        const job = jobs.find(j => j.id === img.jobId)
        if (!job) continue

        // Update based on job status
        if (job.status === 'completed' && job.output?.processedImageUrl) {
          if (img.processedUrl !== job.output.processedImageUrl) {
            newImages[i] = {
              ...img,
              processedUrl: job.output.processedImageUrl,
              status: 'completed'
            }
            updated = true
          }
        } else if (job.status === 'failed') {
          if (img.status !== 'error') {
            newImages[i] = {
              ...img,
              status: 'error',
              error: job.output?.error || 'Processing failed'
            }
            updated = true
          }
        }
      }

      return updated ? newImages : prev
    })
  }, [jobs])

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
      status: 'uploading' as const
    }))
    setImages(initialImages)

    const imagePairs: ImagePair[] = []

    try {
      // Process each image
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        const currentIndex = i

        // Step 2: Upload original image to blob storage IMMEDIATELY
        const formData = new FormData()
        formData.append('files', file)
        formData.append('itemId', itemId)

        const uploadResponse = await fetch('/api/items/upload-images', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json()
          setImages(prev => {
            const newImages = [...prev]
            newImages[currentIndex].status = 'error'
            newImages[currentIndex].error = errorData.error || 'Upload failed'
            return newImages
          })
          continue
        }

        const uploadResult = await uploadResponse.json()

        if (!uploadResult.success) {
          setImages(prev => {
            const newImages = [...prev]
            newImages[currentIndex].status = 'error'
            newImages[currentIndex].error = uploadResult.error || 'Upload failed'
            return newImages
          })
          continue
        }

        const originalUrl = uploadResult.imagePaths[0]

        // Step 3: Update UI with uploaded URL
        setImages(prev => {
          const newImages = [...prev]
          newImages[currentIndex].originalUrl = originalUrl
          newImages[currentIndex].status = 'processing'
          return newImages
        })

        // Step 4: Create background job for rembg processing
        // Convert image to base64 for background processing
        const base64Image = await fileToBase64(file)

        const job = createJob('rembg', itemId, {
          originalImageUrl: originalUrl,
          originalImageBase64: base64Image
        })

        // Track job ID
        setImages(prev => {
          const newImages = [...prev]
          newImages[currentIndex].jobId = job.id
          return newImages
        })

        // Add to results with original URL (processed will be added by background job)
        imagePairs.push({
          original: originalUrl,
          processed: null // Will be updated by background job
        })
      }

      // Step 5: Call completion callback with original images immediately
      // Background processing will update the item later
      if (imagePairs.length > 0) {
        onUploadComplete({
          imagePaths: imagePairs.map(p => p.original),
          imagePairs,
          selectedThumbnailIndex: 0
        })
      } else {
        onError('No images were successfully uploaded')
      }

    } catch (error) {
      onError(`Upload failed: ${error}`)
    } finally {
      setIsProcessing(false)
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
