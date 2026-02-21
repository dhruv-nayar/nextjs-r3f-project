'use client'

import { useState, useRef, useCallback } from 'react'

interface TextureUploaderProps {
  texturePath?: string
  onTextureChange: (path: string | undefined) => void
  onUploadStart?: () => void
  onUploadEnd?: () => void
}

/**
 * Component for uploading texture images
 *
 * Features:
 * - Drag & drop or click to upload
 * - Preview of selected texture
 * - Clear texture option
 * - Upload progress indicator
 */
export function TextureUploader({
  texturePath,
  onTextureChange,
  onUploadStart,
  onUploadEnd,
}: TextureUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB')
        return
      }

      setError(null)
      setIsUploading(true)
      onUploadStart?.()

      try {
        const formData = new FormData()
        formData.append('images', file)

        const response = await fetch('/api/items/upload-images', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const data = await response.json()

        // Use the original image path (first in the array)
        if (data.imagePaths && data.imagePaths.length > 0) {
          onTextureChange(data.imagePaths[0])
        } else if (data.imagePairs && data.imagePairs.length > 0) {
          onTextureChange(data.imagePairs[0].original)
        }
      } catch (err) {
        setError('Failed to upload image. Please try again.')
        console.error('Texture upload error:', err)
      } finally {
        setIsUploading(false)
        onUploadEnd?.()
      }
    },
    [onTextureChange, onUploadStart, onUploadEnd]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleClear = () => {
    onTextureChange(undefined)
    setError(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Texture
        </label>
        {texturePath && (
          <button
            onClick={handleClear}
            className="text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {texturePath ? (
        // Preview mode
        <div className="relative">
          <img
            src={texturePath}
            alt="Texture preview"
            className="w-full h-24 object-cover rounded-lg border border-gray-200"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg"
          >
            <span className="text-white text-sm font-medium">Replace</span>
          </button>
        </div>
      ) : (
        // Upload mode
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors
            ${
              isDragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
            ${isUploading ? 'opacity-50 cursor-wait' : ''}
          `}
        >
          {isUploading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Uploading...</span>
            </div>
          ) : (
            <>
              <svg
                className="w-8 h-8 text-gray-400 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-sm text-gray-500">Drop image or click to upload</span>
              <span className="text-xs text-gray-400 mt-1">PNG, JPG up to 10MB</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
