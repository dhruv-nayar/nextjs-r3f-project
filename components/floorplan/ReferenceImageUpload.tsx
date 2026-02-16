'use client'

import { useState, useRef } from 'react'
import { ReferenceImage } from '@/types/floorplan'

interface ReferenceImageUploadProps {
  onUpload: (image: ReferenceImage) => void
}

export function ReferenceImageUpload({ onUpload }: ReferenceImageUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [widthFeet, setWidthFeet] = useState<string>('')
  const [heightFeet, setHeightFeet] = useState<string>('')
  const [error, setError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debug: log when component renders
  console.log('[ReferenceImageUpload] Rendered, preview:', !!preview, 'widthFeet:', widthFeet, 'heightFeet:', heightFeet)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ReferenceImageUpload] handleFileChange triggered')
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) {
      console.log('[ReferenceImageUpload] No file selected')
      return
    }

    console.log('[ReferenceImageUpload] File selected:', selectedFile.name, selectedFile.type)

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setFile(selectedFile)
    setError('')

    // Create preview as data URL
    const reader = new FileReader()
    reader.onload = (loadEvent) => {
      console.log('[ReferenceImageUpload] FileReader onload triggered')
      const result = loadEvent.target?.result as string
      console.log('[ReferenceImageUpload] Preview data URL length:', result?.length)
      setPreview(result)
    }
    reader.onerror = (err) => {
      console.error('[ReferenceImageUpload] FileReader error:', err)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleSubmit = () => {
    console.log('[ReferenceImageUpload] handleSubmit called', { preview: !!preview, widthFeet, heightFeet })

    if (!preview) {
      setError('Please select an image')
      return
    }

    const width = parseFloat(widthFeet)
    const height = parseFloat(heightFeet)

    console.log('[ReferenceImageUpload] Parsed dimensions:', { width, height })

    if (!width || width <= 0) {
      setError('Please enter a valid width')
      return
    }

    if (!height || height <= 0) {
      setError('Please enter a valid height')
      return
    }

    const referenceImage: ReferenceImage = {
      url: preview,
      opacity: 0.5,
      x: 0,
      y: 0,
      width,
      height,
      scale: 1,
      rotation: 0,
      locked: false,
      aspectRatio: width / height
    }

    console.log('[ReferenceImageUpload] Uploading reference image:', {
      urlLength: preview.length,
      width,
      height,
      opacity: referenceImage.opacity
    })

    onUpload(referenceImage)
  }

  return (
    <div className="space-y-4">
      {/* File Upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => {
            console.log('[ReferenceImageUpload] Choose Image button clicked')
            fileInputRef.current?.click()
          }}
          className="w-full px-3 py-2 bg-taupe/10 hover:bg-taupe/20 rounded-lg text-graphite text-sm transition-colors border border-taupe/20 border-dashed"
        >
          {file ? file.name : 'Choose Image...'}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white/50 rounded-lg p-2 border border-taupe/10">
          <img
            src={preview}
            alt="Reference preview"
            className="max-w-full h-auto max-h-32 mx-auto rounded"
          />
        </div>
      )}

      {/* Dimensions */}
      {preview && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-600 font-medium">
            Real-world dimensions (feet)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="number"
                value={widthFeet}
                onChange={(e) => setWidthFeet(e.target.value)}
                placeholder="Width"
                min="1"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="number"
                value={heightFeet}
                onChange={(e) => setHeightFeet(e.target.value)}
                placeholder="Height"
                min="1"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Enter the real-world size of the floorplan
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Submit */}
      {preview && (
        <button
          onClick={() => {
            console.log('[ReferenceImageUpload] Add Reference Image button clicked')
            handleSubmit()
          }}
          disabled={!widthFeet || !heightFeet}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Add Reference Image
        </button>
      )}
    </div>
  )
}
