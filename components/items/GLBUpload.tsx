'use client'

import { useState, useRef } from 'react'
import { GLBUploadResult, UploadProgress } from '@/types/room'
import { UploadProgressBar } from './UploadProgress'
import { ThumbnailGenerator } from './ThumbnailGenerator'

interface GLBUploadProps {
  onUploadComplete: (result: GLBUploadResult) => void
  onError: (error: string) => void
}

export function GLBUpload({ onUploadComplete, onError }: GLBUploadProps) {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading-glb' | 'generating-thumbnail' | 'uploading-thumbnail' | 'complete'>('idle')
  const [modelPath, setModelPath] = useState('')
  const [itemId, setItemId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    // Validate file
    if (!file.name.endsWith('.glb')) {
      onError('File must be a .glb file')
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      onError('File too large. Maximum 50MB.')
      return
    }

    // Prepare upload
    const newItemId = `item-${Date.now()}`
    setItemId(newItemId)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('itemId', newItemId)

    setUploadStage('uploading-glb')
    setProgress({
      fileName: file.name,
      progress: 0,
      status: 'uploading',
      stage: 'model'
    })

    try {
      // Upload with progress tracking
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setProgress(prev => prev ? { ...prev, progress: percentComplete } : null)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText)
          setModelPath(result.modelPath)
          setUploadStage('generating-thumbnail')
          setProgress({
            fileName: file.name,
            progress: 50,
            status: 'processing',
            stage: 'thumbnail'
          })
        } else {
          const error = JSON.parse(xhr.responseText)
          setProgress(prev => prev ? { ...prev, status: 'error', error: error.error } : null)
          onError(error.error || 'Upload failed')
        }
      })

      xhr.addEventListener('error', () => {
        setProgress(prev => prev ? { ...prev, status: 'error', error: 'Network error' } : null)
        onError('Network error during upload')
      })

      xhr.open('POST', '/api/items/upload-glb')
      xhr.send(formData)

    } catch (error) {
      setProgress(prev => prev ? { ...prev, status: 'error', error: String(error) } : null)
      onError(String(error))
    }
  }

  const handleThumbnailGenerated = async (blob: Blob) => {
    setUploadStage('uploading-thumbnail')
    setProgress(prev => prev ? { ...prev, progress: 75, status: 'processing', stage: 'thumbnail' } : null)

    try {
      const formData = new FormData()
      formData.append('file', blob, 'thumbnail.png')
      formData.append('itemId', itemId)

      const response = await fetch('/api/items/upload-thumbnail', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setUploadStage('complete')
        setProgress(prev => prev ? { ...prev, progress: 100, status: 'completed' } : null)
        onUploadComplete({
          modelPath,
          thumbnailPath: result.thumbnailPath
        })
      } else {
        setProgress(prev => prev ? { ...prev, status: 'error', error: result.error } : null)
        onError(result.error || 'Thumbnail upload failed')
      }
    } catch (error) {
      setProgress(prev => prev ? { ...prev, status: 'error', error: String(error) } : null)
      onError('Failed to upload thumbnail')
    }
  }

  const handleThumbnailError = (error: string) => {
    setProgress(prev => prev ? { ...prev, status: 'error', error } : null)
    onError(error)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
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
          accept=".glb"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />

        <div className="space-y-2">
          <div className="text-4xl">📦</div>
          <p className="text-lg font-medium">Upload 3D Model</p>
          <p className="text-sm text-gray-500">
            Drag and drop a .glb file here, or click to browse
          </p>
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose File
          </button>
          <p className="text-xs text-gray-400 mt-2">
            Maximum file size: 50MB
          </p>
        </div>
      </div>

      {progress && <UploadProgressBar {...progress} />}

      {uploadStage === 'generating-thumbnail' && modelPath && (
        <ThumbnailGenerator
          modelPath={modelPath}
          onThumbnailGenerated={handleThumbnailGenerated}
          onError={handleThumbnailError}
        />
      )}
    </div>
  )
}
