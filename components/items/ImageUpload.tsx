'use client'

import { useState, useRef } from 'react'
import { ImageUploadResult } from '@/types/room'
import Image from 'next/image'

interface ImageUploadProps {
  onUploadComplete: (result: ImageUploadResult) => void
  onError: (error: string) => void
}

interface ProcessedImage {
  originalUrl: string
  processedUrl: string
  status: 'uploading' | 'completed' | 'error'
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
    const processedImages: string[] = []

    try {
      // Process each image
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]

        // Initialize status
        const imageEntry: ProcessedImage = {
          originalUrl: '',
          processedUrl: '',
          status: 'uploading'
        }

        setImages(prev => [...prev, imageEntry])
        const currentIndex = i

        // Step 1: Convert image to base64
        const base64Image = await fileToBase64(file)

        // Step 2: Remove background
        const bgRemovalRes = await fetch('/api/remove_bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: base64Image })
        })

        const bgRemovalResult = await bgRemovalRes.json()

        if (!bgRemovalResult.success) {
          console.warn('Background removal failed, using original image:', bgRemovalResult.error)
          // Continue with original image if background removal fails
        }

        const processedBase64 = bgRemovalResult.success
          ? bgRemovalResult.processedImageData
          : base64Image

        // Step 3: Convert processed base64 back to blob
        const processedBlob = await base64ToBlob(processedBase64)
        const processedFile = new File([processedBlob], file.name, { type: 'image/png' })

        // Step 4: Upload processed image to Vercel Blob
        const formData = new FormData()
        formData.append('files', processedFile)
        formData.append('itemId', `temp-${Date.now()}`)

        const uploadRes = await fetch('/api/items/upload-images', {
          method: 'POST',
          body: formData
        })

        const uploadResult = await uploadRes.json()

        if (!uploadResult.success) {
          setImages(prev => {
            const newImages = [...prev]
            newImages[currentIndex].status = 'error'
            newImages[currentIndex].error = uploadResult.error
            return newImages
          })
          continue
        }

        const uploadedUrl = uploadResult.imagePaths[0]

        // Update with uploaded URL and mark as completed
        setImages(prev => {
          const newImages = [...prev]
          newImages[currentIndex].originalUrl = uploadedUrl
          newImages[currentIndex].processedUrl = uploadedUrl
          newImages[currentIndex].status = 'completed'
          return newImages
        })

        processedImages.push(uploadedUrl)
      }

      // All images processed, call completion callback
      if (processedImages.length > 0) {
        onUploadComplete({
          imagePaths: processedImages,
          selectedThumbnailIndex: 0 // Default to first image
        })
      } else {
        onError('No images were successfully processed')
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
            Processing {images.length} image{images.length > 1 ? 's' : ''}...
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {images.map((img, index) => (
              <div key={index} className="space-y-2">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                  {img.processedUrl && (
                    <Image
                      src={img.processedUrl}
                      alt={`Processed ${index + 1}`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  )}
                  {!img.processedUrl && img.originalUrl && (
                    <Image
                      src={img.originalUrl}
                      alt={`Original ${index + 1}`}
                      fill
                      className="object-contain opacity-50"
                      unoptimized
                    />
                  )}
                </div>

                <div className="text-xs text-center">
                  {img.status === 'uploading' && (
                    <span className="text-blue-600">Uploading...</span>
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
