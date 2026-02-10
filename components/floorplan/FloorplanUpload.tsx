'use client'

import { useState, useRef } from 'react'
import { FloorplanConfig } from '@/types/room'
import { validateFloorplanDimensions, calculatePixelsPerFoot } from '@/lib/utils/floorplan'
import { FLOORPLAN } from '@/lib/constants'

interface FloorplanUploadProps {
  onUpload: (config: FloorplanConfig) => void
  onCancel: () => void
}

export function FloorplanUpload({ onUpload, onCancel }: FloorplanUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [widthFeet, setWidthFeet] = useState<string>('')
  const [heightFeet, setHeightFeet] = useState<string>('')
  const [widthInches, setWidthInches] = useState<string>('')
  const [heightInches, setHeightInches] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setFile(selectedFile)
    setError('')

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setPreview(result)

      // Get image dimensions
      const img = new Image()
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
      }
      img.src = result
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleSubmit = () => {
    if (!file || !preview || !imageDimensions) {
      setError('Please select a floorplan image')
      return
    }

    const wFeet = parseFloat(widthFeet) || 0
    const hFeet = parseFloat(heightFeet) || 0
    const wInches = parseFloat(widthInches) || 0
    const hInches = parseFloat(heightInches) || 0

    // Convert to total feet
    const totalWidthFeet = wFeet + wInches / 12
    const totalHeightFeet = hFeet + hInches / 12

    const validation = validateFloorplanDimensions(
      totalWidthFeet,
      totalHeightFeet,
      FLOORPLAN.MAX_WIDTH_FEET,
      FLOORPLAN.MAX_HEIGHT_FEET
    )

    if (!validation.valid) {
      setError(validation.error || 'Invalid dimensions')
      return
    }

    // Calculate pixels per foot
    const pixelsPerFoot = calculatePixelsPerFoot(
      imageDimensions.width,
      imageDimensions.height,
      totalWidthFeet,
      totalHeightFeet
    )

    // Save file to public/floorplans
    const imagePath = `/floorplans/${file.name}`

    const config: FloorplanConfig = {
      imagePath,
      widthFeet: totalWidthFeet,
      heightFeet: totalHeightFeet,
      pixelsPerFoot
    }

    onUpload(config)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2">Upload Floorplan</h2>
          <p className="text-gray-400 text-sm mb-6">
            Upload your floorplan image and specify its real-world dimensions
          </p>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-white text-sm font-medium mb-2">
              Floorplan Image
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors border border-white/10"
            >
              {file ? file.name : 'Choose Image'}
            </button>
          </div>

          {/* Preview */}
          {preview && imageDimensions && (
            <div className="mb-6">
              <label className="block text-white text-sm font-medium mb-2">
                Preview ({imageDimensions.width} × {imageDimensions.height} px)
              </label>
              <div className="bg-black/50 rounded-lg p-4 border border-white/10">
                <img
                  src={preview}
                  alt="Floorplan preview"
                  className="max-w-full h-auto max-h-64 mx-auto"
                />
              </div>
            </div>
          )}

          {/* Dimensions Input */}
          <div className="mb-6">
            <label className="block text-white text-sm font-medium mb-3">
              Real-World Dimensions
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Width */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Width</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={widthFeet}
                      onChange={(e) => setWidthFeet(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white/10 rounded-lg text-white border border-white/10 focus:border-white/30 focus:outline-none"
                    />
                    <span className="text-gray-500 text-xs mt-1 block">feet</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={widthInches}
                      onChange={(e) => setWidthInches(e.target.value)}
                      placeholder="0"
                      max="11"
                      className="w-full px-3 py-2 bg-white/10 rounded-lg text-white border border-white/10 focus:border-white/30 focus:outline-none"
                    />
                    <span className="text-gray-500 text-xs mt-1 block">inches</span>
                  </div>
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="block text-gray-400 text-xs mb-2">Height</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={heightFeet}
                      onChange={(e) => setHeightFeet(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-white/10 rounded-lg text-white border border-white/10 focus:border-white/30 focus:outline-none"
                    />
                    <span className="text-gray-500 text-xs mt-1 block">feet</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={heightInches}
                      onChange={(e) => setHeightInches(e.target.value)}
                      placeholder="0"
                      max="11"
                      className="w-full px-3 py-2 bg-white/10 rounded-lg text-white border border-white/10 focus:border-white/30 focus:outline-none"
                    />
                    <span className="text-gray-500 text-xs mt-1 block">inches</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scale Info */}
          {imageDimensions && widthFeet && heightFeet && (
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-300 text-sm">
                <strong>Scale:</strong> {(
                  calculatePixelsPerFoot(
                    imageDimensions.width,
                    imageDimensions.height,
                    parseFloat(widthFeet) + (parseFloat(widthInches) || 0) / 12,
                    parseFloat(heightFeet) + (parseFloat(heightInches) || 0) / 12
                  )
                ).toFixed(2)} pixels per foot
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || !widthFeet || !heightFeet}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              Upload Floorplan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
