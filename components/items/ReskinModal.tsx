'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { ImagePair, MaterialOverride } from '@/types/room'
import { MaterialInfo } from '@/lib/material-utils'

interface ReskinModalProps {
  isOpen: boolean
  onClose: () => void
  images: ImagePair[]
  materials: MaterialInfo[]
  currentOverrides: MaterialOverride[]
  onApply: (overrides: MaterialOverride[]) => void
  targetMaterial?: string | null  // null = apply to all materials
  itemId: string  // For uploading new textures
}

type TabType = 'existing' | 'upload'

export function ReskinModal({
  isOpen,
  onClose,
  images,
  materials,
  currentOverrides,
  onApply,
  targetMaterial,
  itemId,
}: ReskinModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('existing')
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [textureMode, setTextureMode] = useState<'stretch' | 'tile'>('stretch')
  const [repeatX, setRepeatX] = useState(1)
  const [repeatY, setRepeatY] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // Collect all available images (both original and processed)
  const availableImages: Array<{ url: string; label: string }> = []
  images.forEach((pair, index) => {
    if (pair.original) {
      availableImages.push({ url: pair.original, label: `Image ${index + 1}` })
    }
    if (pair.processed) {
      availableImages.push({ url: pair.processed, label: `Image ${index + 1} (No BG)` })
    }
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB)')
      return
    }

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('itemId', itemId)

      const res = await fetch('/api/items/upload-images', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()

      if (result.success && result.imagePaths?.[0]) {
        setSelectedImageUrl(result.imagePaths[0])
      } else {
        alert('Failed to upload image')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleApply = () => {
    if (!selectedImageUrl) return

    const textureOverride: Partial<MaterialOverride> = {
      texturePath: selectedImageUrl,
      textureMode,
      textureRepeat: textureMode === 'tile' ? { x: repeatX, y: repeatY } : undefined,
    }

    let newOverrides: MaterialOverride[]

    if (targetMaterial) {
      // Apply to specific material
      const existingOverride = currentOverrides.find(o => o.materialName === targetMaterial)
      if (existingOverride) {
        newOverrides = currentOverrides.map(o =>
          o.materialName === targetMaterial
            ? { ...o, ...textureOverride }
            : o
        )
      } else {
        newOverrides = [
          ...currentOverrides,
          { materialName: targetMaterial, ...textureOverride } as MaterialOverride
        ]
      }
    } else {
      // Apply to all materials
      newOverrides = materials.map(mat => {
        const existing = currentOverrides.find(o => o.materialName === mat.name)
        return {
          materialName: mat.name,
          materialIndex: mat.index,
          ...(existing || {}),
          ...textureOverride,
        } as MaterialOverride
      })
    }

    onApply(newOverrides)
    onClose()
  }

  const handleRemoveTexture = () => {
    let newOverrides: MaterialOverride[]

    if (targetMaterial) {
      // Remove texture from specific material
      newOverrides = currentOverrides.map(o =>
        o.materialName === targetMaterial
          ? { ...o, texturePath: undefined, textureMode: undefined, textureRepeat: undefined }
          : o
      )
    } else {
      // Remove texture from all materials
      newOverrides = currentOverrides.map(o => ({
        ...o,
        texturePath: undefined,
        textureMode: undefined,
        textureRepeat: undefined,
      }))
    }

    onApply(newOverrides)
    onClose()
  }

  // Check if current selection has a texture
  const hasExistingTexture = targetMaterial
    ? currentOverrides.some(o => o.materialName === targetMaterial && o.texturePath)
    : currentOverrides.some(o => o.texturePath)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900/95 border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Reskin Model</h2>
              <p className="text-white/60 text-sm mt-1">
                {targetMaterial
                  ? `Apply texture to: ${targetMaterial}`
                  : 'Apply texture to all surfaces'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('existing')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'existing'
                  ? 'bg-sage text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Existing Images
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-sage text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Upload New
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'existing' ? (
            <div>
              {availableImages.length === 0 ? (
                <p className="text-white/50 text-center py-8">
                  No images available. Add images to this item first, or upload a texture.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {availableImages.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageUrl(img.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageUrl === img.url
                          ? 'border-sage ring-2 ring-sage/50'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      <Image
                        src={img.url}
                        alt={img.label}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                        <span className="text-white text-xs">{img.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full py-12 border-2 border-dashed border-white/30 rounded-lg hover:border-sage transition-colors flex flex-col items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-8 h-8 border-2 border-sage border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/60">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-white/60">Click to upload or drag and drop</span>
                    <span className="text-white/40 text-sm">PNG, JPG up to 10MB</span>
                  </>
                )}
              </button>

              {selectedImageUrl && activeTab === 'upload' && (
                <div className="mt-4 relative aspect-video rounded-lg overflow-hidden border border-white/20">
                  <Image
                    src={selectedImageUrl}
                    alt="Selected texture"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Texture Options */}
          {selectedImageUrl && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h3 className="text-white font-medium mb-4">Texture Options</h3>

              {/* Mode Selection */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setTextureMode('stretch')}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                    textureMode === 'stretch'
                      ? 'bg-sage/20 border-sage text-white'
                      : 'border-white/20 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="font-medium">Stretch</div>
                  <div className="text-sm opacity-60">Fit to surface</div>
                </button>
                <button
                  onClick={() => setTextureMode('tile')}
                  className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                    textureMode === 'tile'
                      ? 'bg-sage/20 border-sage text-white'
                      : 'border-white/20 text-white/70 hover:border-white/40'
                  }`}
                >
                  <div className="font-medium">Tile</div>
                  <div className="text-sm opacity-60">Repeat pattern</div>
                </button>
              </div>

              {/* Repeat Options (for tile mode) */}
              {textureMode === 'tile' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-white/60 text-sm block mb-1">Repeat X</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={repeatX}
                      onChange={(e) => setRepeatX(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-white/60 text-sm block mb-1">Repeat Y</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={repeatY}
                      onChange={(e) => setRepeatY(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-between">
          <div>
            {hasExistingTexture && (
              <button
                onClick={handleRemoveTexture}
                className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors"
              >
                Remove Texture
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedImageUrl}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                selectedImageUrl
                  ? 'bg-sage text-white hover:bg-sage/80'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              Apply Texture
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
