'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { RugShape } from '@/types/room'
import { useItemLibrary } from '@/lib/item-library-context'
import { useMobile } from '@/lib/mobile-context'
import { RugShapeRenderer, calculateRugDimensions } from './RugShapeRenderer'

// Component to capture the 3D scene as an image
function ThumbnailCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      gl.render(scene, camera)
      const dataUrl = gl.domElement.toDataURL('image/png')
      onCapture(dataUrl)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [gl, scene, camera, onCapture])

  return null
}

interface RugCreatorProps {
  isOpen: boolean
  onClose: () => void
  editItem?: {
    id: string
    name: string
    parametricShape: RugShape
  }
  onSave?: (updates: { name: string; parametricShape: RugShape; dimensions: { width: number; height: number; depth: number }; thumbnailPath?: string }) => void
}

export function RugCreator({ isOpen, onClose, editItem, onSave }: RugCreatorProps) {
  const { addItem } = useItemLibrary()
  const { isMobile } = useMobile()

  const isEditMode = !!editItem

  // Rug properties
  const [name, setName] = useState('Custom Rug')
  const [widthFeet, setWidthFeet] = useState(6)
  const [widthInches, setWidthInches] = useState(0)
  const [depthFeet, setDepthFeet] = useState(4)
  const [depthInches, setDepthInches] = useState(0)
  const [thickness, setThickness] = useState(0.08) // ~1 inch default

  // Image upload state
  const [textureFile, setTextureFile] = useState<File | null>(null)
  const [texturePreview, setTexturePreview] = useState<string | null>(null)
  const [uploadedTexturePath, setUploadedTexturePath] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Thumbnail capture
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)
  const [shouldCaptureThumbnail, setShouldCaptureThumbnail] = useState(false)

  // Reset when modal opens (or initialize from editItem)
  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        // Edit mode: initialize from existing item
        const shape = editItem.parametricShape
        setName(editItem.name)
        setWidthFeet(Math.floor(shape.width))
        setWidthInches((shape.width % 1) * 12)
        setDepthFeet(Math.floor(shape.depth))
        setDepthInches((shape.depth % 1) * 12)
        setThickness(shape.thickness)
        setTextureFile(null)
        setTexturePreview(shape.texturePath)
        setUploadedTexturePath(shape.texturePath)
        setIsUploading(false)
        setUploadError(null)
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      } else {
        // Create mode: reset to defaults
        setName('Custom Rug')
        setWidthFeet(6)
        setWidthInches(0)
        setDepthFeet(4)
        setDepthInches(0)
        setThickness(0.08)
        setTextureFile(null)
        setTexturePreview(null)
        setUploadedTexturePath(null)
        setIsUploading(false)
        setUploadError(null)
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      }
    }
  }, [isOpen, editItem])

  // Calculate total dimensions in feet
  const width = widthFeet + widthInches / 12
  const depth = depthFeet + depthInches / 12

  // Create the rug shape for preview
  const rugShape: RugShape | null = useMemo(() => {
    if (!uploadedTexturePath) return null
    return {
      type: 'rug',
      width,
      depth,
      thickness,
      texturePath: uploadedTexturePath
    }
  }, [uploadedTexturePath, width, depth, thickness])

  // Trigger thumbnail capture when rug is ready
  useEffect(() => {
    if (rugShape) {
      const timeoutId = setTimeout(() => {
        setShouldCaptureThumbnail(true)
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [rugShape, width, depth, thickness])

  // Handle thumbnail capture
  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCapturedThumbnail(dataUrl)
    setShouldCaptureThumbnail(false)
  }, [])

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file')
      return
    }

    setTextureFile(file)
    setUploadError(null)

    // Create local preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setTexturePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload the file
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('removeBackground', 'false')
      formData.append('itemId', `rug-${Date.now()}`)

      const response = await fetch('/api/items/upload-images', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      if (data.imagePaths && data.imagePaths.length > 0) {
        setUploadedTexturePath(data.imagePaths[0])
      }
    } catch (error) {
      setUploadError('Failed to upload image. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle save
  const handleSave = async () => {
    if (!rugShape) return

    const dimensions = calculateRugDimensions(rugShape)

    if (isEditMode && onSave) {
      // Edit mode: call the onSave callback
      onSave({
        name,
        parametricShape: rugShape,
        dimensions,
        thumbnailPath: capturedThumbnail || undefined
      })
      onClose()
    } else {
      // Create mode: add new item
      const newItem = {
        name,
        description: 'User-created rug',
        parametricShape: rugShape,
        thumbnailPath: capturedThumbnail || undefined,
        dimensions,
        category: 'decoration' as const,
        tags: ['custom', 'rug', 'floor'],
        placementType: 'floor' as const,
        isSurface: true, // Rugs can have items placed on them
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isCustom: true
      }

      await addItem(newItem)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${isMobile ? '' : ''}`}>
      <div className={`bg-white shadow-xl w-full overflow-hidden flex flex-col ${isMobile ? 'h-full rounded-none' : 'rounded-2xl max-w-3xl mx-4 max-h-[90vh]'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>{isEditMode ? 'Edit Rug' : 'Create Rug'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 active:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className={`text-gray-500 ${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-4' : 'p-6 grid grid-cols-2 gap-6'}`}>
          {/* 3D Preview - Show at top on mobile */}
          {isMobile && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
              <div className="h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                {rugShape ? (
                  <Canvas gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <PerspectiveCamera makeDefault position={[width * 0.8, width * 0.6, depth * 0.8]} />
                    <OrbitControls enablePan={false} />
                    <Suspense fallback={null}>
                      <RugShapeRenderer shape={rugShape} />
                    </Suspense>
                    <gridHelper args={[10, 10, '#cccccc', '#e5e5e5']} />
                    {shouldCaptureThumbnail && (
                      <ThumbnailCapture onCapture={handleThumbnailCapture} />
                    )}
                  </Canvas>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Upload an image to see preview
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <div className={isMobile ? 'space-y-4' : 'space-y-5'}>
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2'}`}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rug Image</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                  id="rug-texture-upload"
                />
                <label
                  htmlFor="rug-texture-upload"
                  className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isMobile ? 'h-40' : 'h-32'} ${
                    texturePreview ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 active:border-gray-400 bg-gray-50'
                  }`}
                >
                  {texturePreview ? (
                    <img src={texturePreview} alt="Preview" className="h-full object-contain rounded" />
                  ) : isUploading ? (
                    <div className="text-gray-500">Uploading...</div>
                  ) : (
                    <>
                      <svg className={`text-gray-400 mb-2 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className={`text-gray-500 ${isMobile ? 'text-base' : 'text-sm'}`}>{isMobile ? 'Tap to upload or take photo' : 'Click to upload rug texture'}</span>
                    </>
                  )}
                </label>
              </div>
              {uploadError && (
                <p className="mt-1 text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={widthFeet}
                      onChange={(e) => setWidthFeet(parseInt(e.target.value) || 0)}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                    />
                    <span className="text-xs text-gray-500">ft</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={widthInches}
                      onChange={(e) => setWidthInches(parseInt(e.target.value) || 0)}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                    />
                    <span className="text-xs text-gray-500">in</span>
                  </div>
                </div>
              </div>

              {/* Depth */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Depth</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={depthFeet}
                      onChange={(e) => setDepthFeet(parseInt(e.target.value) || 0)}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                    />
                    <span className="text-xs text-gray-500">ft</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={depthInches}
                      onChange={(e) => setDepthInches(parseInt(e.target.value) || 0)}
                      className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                    />
                    <span className="text-xs text-gray-500">in</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Thickness */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Thickness: {(thickness * 12).toFixed(1)} inches
              </label>
              <input
                type="range"
                min="0.04"
                max="0.25"
                step="0.01"
                value={thickness}
                onChange={(e) => setThickness(parseFloat(e.target.value))}
                className={`w-full bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 ${isMobile ? 'h-3' : 'h-2'}`}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0.5"</span>
                <span>3"</span>
              </div>
            </div>

            {/* Dimensions display */}
            <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
              Final size: {width.toFixed(1)}ft × {depth.toFixed(1)}ft × {(thickness * 12).toFixed(1)}"
            </div>
          </div>

          {/* Right: 3D Preview - Desktop only (mobile version is at top) */}
          {!isMobile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
              <div className="h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                {rugShape ? (
                  <Canvas gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <PerspectiveCamera makeDefault position={[width * 0.8, width * 0.6, depth * 0.8]} />
                    <OrbitControls enablePan={false} />
                    <Suspense fallback={null}>
                      <RugShapeRenderer shape={rugShape} />
                    </Suspense>
                    <gridHelper args={[10, 10, '#cccccc', '#e5e5e5']} />
                    {shouldCaptureThumbnail && (
                      <ThumbnailCapture onCapture={handleThumbnailCapture} />
                    )}
                  </Canvas>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Upload an image to see preview
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-2">
                The image will be displayed on the top surface of the rug.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center gap-3 border-t border-gray-200 bg-gray-50 flex-shrink-0 ${isMobile ? 'flex-col p-4' : 'justify-end px-6 py-4'}`}>
          <button
            onClick={onClose}
            className={`font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-200 rounded-lg transition-colors ${isMobile ? 'w-full px-4 py-4 text-base order-2' : 'px-4 py-2 text-sm'}`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!rugShape || isUploading}
            className={`font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'w-full px-4 py-4 text-base order-1' : 'px-4 py-2 text-sm'}`}
          >
            {isEditMode ? 'Save Changes' : 'Create Rug'}
          </button>
        </div>
      </div>
    </div>
  )
}
