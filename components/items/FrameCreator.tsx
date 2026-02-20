'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { FrameShape } from '@/types/room'
import { useItemLibrary } from '@/lib/item-library-context'
import { useMobile } from '@/lib/mobile-context'
import { FrameShapeRenderer, calculateFrameDimensions } from './FrameShapeRenderer'

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

interface FrameCreatorProps {
  isOpen: boolean
  onClose: () => void
  editItem?: {
    id: string
    name: string
    parametricShape: FrameShape
  }
  onSave?: (updates: { name: string; parametricShape: FrameShape; dimensions: { width: number; height: number; depth: number }; thumbnailPath?: string }) => void
}

export function FrameCreator({ isOpen, onClose, editItem, onSave }: FrameCreatorProps) {
  const { addItem } = useItemLibrary()
  const { isMobile } = useMobile()

  const isEditMode = !!editItem

  // Frame properties
  const [name, setName] = useState('Picture Frame')

  // Image dimensions (calculated from aspect ratio)
  const [imageWidthInches, setImageWidthInches] = useState(8)
  const [imageHeightInches, setImageHeightInches] = useState(10)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  // Mat properties
  const [matWidthInches, setMatWidthInches] = useState(2)
  const [matColor, setMatColor] = useState('#FFFEF0') // Off-white

  // Frame properties
  const [frameWidthInches, setFrameWidthInches] = useState(1)
  const [frameDepthInches, setFrameDepthInches] = useState(1)
  const [frameColor, setFrameColor] = useState('#2C1810') // Dark brown

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedImagePath, setUploadedImagePath] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [noPicture, setNoPicture] = useState(false)

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
        setImageWidthInches(shape.imageWidth * 12)
        setImageHeightInches(shape.imageHeight * 12)
        setAspectRatio(shape.imagePath ? (shape.imageWidth / shape.imageHeight) : null)
        setMatWidthInches(shape.matWidth * 12)
        setMatColor(shape.matColor)
        setFrameWidthInches(shape.frameWidth * 12)
        setFrameDepthInches(shape.frameDepth * 12)
        setFrameColor(shape.frameColor)
        setImageFile(null)
        setImagePreview(shape.imagePath || null)
        setUploadedImagePath(shape.imagePath || null)
        setIsUploading(false)
        setUploadError(null)
        setNoPicture(!shape.imagePath)
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      } else {
        // Create mode: reset to defaults
        setName('Picture Frame')
        setImageWidthInches(8)
        setImageHeightInches(10)
        setAspectRatio(null)
        setMatWidthInches(2)
        setMatColor('#FFFEF0')
        setFrameWidthInches(1)
        setFrameDepthInches(1)
        setFrameColor('#2C1810')
        setImageFile(null)
        setImagePreview(null)
        setUploadedImagePath(null)
        setIsUploading(false)
        setUploadError(null)
        setNoPicture(false)
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      }
    }
  }, [isOpen, editItem])

  // Clear uploaded image
  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setUploadedImagePath(null)
    setAspectRatio(null)
    setUploadError(null)
  }

  // Convert inches to feet
  const inchesToFeet = (inches: number) => inches / 12

  // Create the frame shape for preview
  const frameShape: FrameShape | null = useMemo(() => {
    // Need either an uploaded image or "no picture" mode
    if (!uploadedImagePath && !noPicture) return null
    return {
      type: 'frame',
      imagePath: noPicture ? '' : (uploadedImagePath || ''),
      imageWidth: inchesToFeet(imageWidthInches),
      imageHeight: inchesToFeet(imageHeightInches),
      matWidth: inchesToFeet(matWidthInches),
      matColor,
      frameWidth: inchesToFeet(frameWidthInches),
      frameDepth: inchesToFeet(frameDepthInches),
      frameColor
    }
  }, [uploadedImagePath, noPicture, imageWidthInches, imageHeightInches, matWidthInches, matColor, frameWidthInches, frameDepthInches, frameColor])

  // Trigger thumbnail capture when frame is ready
  useEffect(() => {
    if (frameShape) {
      const timeoutId = setTimeout(() => {
        setShouldCaptureThumbnail(true)
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [frameShape])

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

    setImageFile(file)
    setUploadError(null)

    // Create local preview and get dimensions
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setImagePreview(dataUrl)

      // Get image dimensions to calculate aspect ratio
      const img = new Image()
      img.onload = () => {
        const ratio = img.width / img.height
        setAspectRatio(ratio)

        // Set initial size based on aspect ratio (fit within 8x10 or 10x8)
        if (ratio > 1) {
          // Landscape
          setImageWidthInches(10)
          setImageHeightInches(Math.round(10 / ratio))
        } else {
          // Portrait or square
          setImageHeightInches(10)
          setImageWidthInches(Math.round(10 * ratio))
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)

    // Upload the file
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('removeBackground', 'false')
      formData.append('itemId', `frame-${Date.now()}`)

      const response = await fetch('/api/items/upload-images', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      if (data.imagePaths && data.imagePaths.length > 0) {
        setUploadedImagePath(data.imagePaths[0])
      }
    } catch (error) {
      setUploadError('Failed to upload image. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle width change (maintain aspect ratio if set)
  const handleWidthChange = (newWidth: number) => {
    setImageWidthInches(newWidth)
    if (aspectRatio) {
      setImageHeightInches(Math.round(newWidth / aspectRatio))
    }
  }

  // Handle height change (maintain aspect ratio if set)
  const handleHeightChange = (newHeight: number) => {
    setImageHeightInches(newHeight)
    if (aspectRatio) {
      setImageWidthInches(Math.round(newHeight * aspectRatio))
    }
  }

  // Handle save
  const handleSave = async () => {
    if (!frameShape) return

    const dimensions = calculateFrameDimensions(frameShape)

    if (isEditMode && onSave) {
      // Edit mode: call the onSave callback
      onSave({
        name,
        parametricShape: frameShape,
        dimensions,
        thumbnailPath: capturedThumbnail || undefined
      })
      onClose()
    } else {
      // Create mode: add new item
      const newItem = {
        name,
        description: 'User-created picture frame',
        parametricShape: frameShape,
        thumbnailPath: capturedThumbnail || undefined,
        dimensions,
        category: 'decoration' as const,
        tags: ['custom', 'frame', 'wall', 'picture'],
        placementType: 'wall' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isCustom: true
      }

      await addItem(newItem)
      onClose()
    }
  }

  // Calculate total dimensions for display
  const totalWidthInches = imageWidthInches + matWidthInches * 2 + frameWidthInches * 2
  const totalHeightInches = imageHeightInches + matWidthInches * 2 + frameWidthInches * 2

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white shadow-xl w-full overflow-hidden flex flex-col ${isMobile ? 'h-full rounded-none' : 'rounded-2xl max-w-4xl mx-4 max-h-[90vh]'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-200 flex-shrink-0 ${isMobile ? 'px-4 py-3' : 'px-6 py-4'}`}>
          <h2 className={`font-semibold text-gray-900 ${isMobile ? 'text-lg' : 'text-xl'}`}>{isEditMode ? 'Edit Picture Frame' : 'Create Picture Frame'}</h2>
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
                {frameShape ? (
                  <Canvas gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <PerspectiveCamera makeDefault position={[0, 0, 2]} />
                    <OrbitControls enablePan={false} />
                    <Suspense fallback={null}>
                      <FrameShapeRenderer shape={frameShape} />
                    </Suspense>
                    {shouldCaptureThumbnail && (
                      <ThumbnailCapture onCapture={handleThumbnailCapture} />
                    )}
                  </Canvas>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm px-4 text-center">
                    Upload a picture or check &quot;No picture&quot; to see preview
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Picture</label>

              {/* No Picture checkbox */}
              <label className={`flex items-center gap-2 mb-2 cursor-pointer ${isMobile ? 'py-1' : ''}`}>
                <input
                  type="checkbox"
                  checked={noPicture}
                  onChange={(e) => {
                    setNoPicture(e.target.checked)
                    if (e.target.checked) {
                      clearImage()
                    }
                  }}
                  className={`rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`}
                />
                <span className={`text-gray-600 ${isMobile ? 'text-base' : 'text-sm'}`}>No picture (solid mat background)</span>
              </label>

              {!noPicture && (
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="frame-image-upload"
                  />
                  <label
                    htmlFor="frame-image-upload"
                    className={`flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isMobile ? 'h-40' : 'h-32'} ${
                      imagePreview ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 active:border-gray-400 bg-gray-50'
                    }`}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-full object-contain rounded" />
                    ) : isUploading ? (
                      <div className="text-gray-500">Uploading...</div>
                    ) : (
                      <>
                        <svg className={`text-gray-400 mb-2 ${isMobile ? 'w-10 h-10' : 'w-8 h-8'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`text-gray-500 ${isMobile ? 'text-base' : 'text-sm'}`}>{isMobile ? 'Tap to upload or take photo' : 'Click to upload picture'}</span>
                      </>
                    )}
                  </label>

                  {/* X button to remove image */}
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        clearImage()
                      }}
                      className={`absolute top-1 right-1 bg-red-500 hover:bg-red-600 active:bg-red-600 text-white rounded-full shadow-md transition-colors ${isMobile ? 'p-2' : 'p-1'}`}
                      title="Remove image"
                    >
                      <svg className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {uploadError && (
                <p className="mt-1 text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            {/* Image Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image Size (inches)</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    min="2"
                    max="36"
                    value={imageWidthInches}
                    onChange={(e) => handleWidthChange(parseInt(e.target.value) || 0)}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                  />
                  <span className="text-xs text-gray-500">Width</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="2"
                    max="36"
                    value={imageHeightInches}
                    onChange={(e) => handleHeightChange(parseInt(e.target.value) || 0)}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                  />
                  <span className="text-xs text-gray-500">Height</span>
                </div>
              </div>
              {aspectRatio && (
                <p className="text-xs text-gray-400 mt-1">Aspect ratio locked from image</p>
              )}
            </div>

            {/* Mat Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mat</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    step="0.5"
                    value={matWidthInches}
                    onChange={(e) => setMatWidthInches(parseFloat(e.target.value) || 0)}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                  />
                  <span className="text-xs text-gray-500">Width (in)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={matColor}
                    onChange={(e) => setMatColor(e.target.value)}
                    className={`rounded border border-gray-300 cursor-pointer ${isMobile ? 'w-12 h-12' : 'w-10 h-10'}`}
                  />
                  {!isMobile && (
                    <input
                      type="text"
                      value={matColor}
                      onChange={(e) => setMatColor(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Frame Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frame</label>
              <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div>
                  <input
                    type="number"
                    min="0.5"
                    max="4"
                    step="0.25"
                    value={frameWidthInches}
                    onChange={(e) => setFrameWidthInches(parseFloat(e.target.value) || 0)}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                  />
                  <span className="text-xs text-gray-500">Width (in)</span>
                </div>
                <div>
                  <input
                    type="number"
                    min="0.5"
                    max="3"
                    step="0.25"
                    value={frameDepthInches}
                    onChange={(e) => setFrameDepthInches(parseFloat(e.target.value) || 0)}
                    className={`w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isMobile ? 'px-3 py-3 text-base' : 'px-3 py-2'}`}
                  />
                  <span className="text-xs text-gray-500">Depth (in)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className={`rounded border border-gray-300 cursor-pointer ${isMobile ? 'w-12 h-12' : 'w-10 h-10'}`}
                  />
                  {isMobile && <span className="text-xs text-gray-500">Color</span>}
                </div>
              </div>
            </div>

            {/* Total dimensions display */}
            <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
              Total size: {totalWidthInches}" × {totalHeightInches}" × {frameDepthInches}" deep
            </div>
          </div>

          {/* Right: 3D Preview - Desktop only (mobile version is at top) */}
          {!isMobile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
              <div className="h-72 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                {frameShape ? (
                  <Canvas gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <PerspectiveCamera makeDefault position={[0, 0, 2]} />
                    <OrbitControls enablePan={false} />
                    <Suspense fallback={null}>
                      <FrameShapeRenderer shape={frameShape} />
                    </Suspense>
                    {shouldCaptureThumbnail && (
                      <ThumbnailCapture onCapture={handleThumbnailCapture} />
                    )}
                  </Canvas>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    Upload a picture or check &quot;No picture&quot; to see preview
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-2">
                This frame will be wall-mounted. You can position it on walls after placing.
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
            disabled={!frameShape || isUploading}
            className={`font-medium text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'w-full px-4 py-4 text-base order-1' : 'px-4 py-2 text-sm'}`}
          >
            {isEditMode ? 'Save Changes' : 'Create Frame'}
          </button>
        </div>
      </div>
    </div>
  )
}
