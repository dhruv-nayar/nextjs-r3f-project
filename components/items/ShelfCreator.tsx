'use client'

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { ShelfShape } from '@/types/room'
import { useItemLibrary } from '@/lib/item-library-context'
import { ShelfShapeRenderer, calculateShelfDimensions } from './ShelfShapeRenderer'

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

interface ShelfCreatorProps {
  isOpen: boolean
  onClose: () => void
  editItem?: {
    id: string
    name: string
    parametricShape: ShelfShape
  }
  onSave?: (updates: { name: string; parametricShape: ShelfShape; dimensions: { width: number; height: number; depth: number }; thumbnailPath?: string }) => void
}

// Common wood colors
const WOOD_COLORS = [
  { name: 'Oak', color: '#C19A6B' },
  { name: 'Walnut', color: '#5D432C' },
  { name: 'Maple', color: '#E8D4B8' },
  { name: 'Cherry', color: '#7B3F00' },
  { name: 'White', color: '#F5F5F5' },
  { name: 'Black', color: '#2C2C2C' },
  { name: 'Gray', color: '#808080' },
  { name: 'Espresso', color: '#3C2415' },
]

export function ShelfCreator({ isOpen, onClose, editItem, onSave }: ShelfCreatorProps) {
  const { addItem } = useItemLibrary()

  const isEditMode = !!editItem

  // Shelf properties
  const [name, setName] = useState('Floating Shelf')

  // Dimensions in feet and inches
  const [widthFeet, setWidthFeet] = useState(2)
  const [widthInches, setWidthInches] = useState(0)
  const [heightInches, setHeightInches] = useState(1) // Shelf thickness, usually just inches
  const [depthInches, setDepthInches] = useState(8)

  // Color
  const [color, setColor] = useState('#5D432C') // Walnut default

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
        setHeightInches(shape.height * 12)
        setDepthInches(shape.depth * 12)
        setColor(shape.color)
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      } else {
        // Create mode: reset to defaults
        setName('Floating Shelf')
        setWidthFeet(2)
        setWidthInches(0)
        setHeightInches(1)
        setDepthInches(8)
        setColor('#5D432C')
        setCapturedThumbnail(null)
        setShouldCaptureThumbnail(false)
      }
    }
  }, [isOpen, editItem])

  // Calculate total dimensions in feet
  const width = widthFeet + widthInches / 12
  const height = heightInches / 12
  const depth = depthInches / 12

  // Create the shelf shape for preview
  const shelfShape: ShelfShape = useMemo(() => ({
    type: 'shelf',
    width,
    height,
    depth,
    color
  }), [width, height, depth, color])

  // Trigger thumbnail capture when shape changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setShouldCaptureThumbnail(true)
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [width, height, depth, color])

  // Handle thumbnail capture
  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCapturedThumbnail(dataUrl)
    setShouldCaptureThumbnail(false)
  }, [])

  // Handle save
  const handleSave = async () => {
    const dimensions = calculateShelfDimensions(shelfShape)

    if (isEditMode && onSave) {
      // Edit mode: call the onSave callback
      onSave({
        name,
        parametricShape: shelfShape,
        dimensions,
        thumbnailPath: capturedThumbnail || undefined
      })
      onClose()
    } else {
      // Create mode: add new item
      const newItem = {
        name,
        description: 'User-created floating shelf',
        parametricShape: shelfShape,
        thumbnailPath: capturedThumbnail || undefined,
        dimensions,
        category: 'storage' as const,
        tags: ['custom', 'shelf', 'wall', 'storage'],
        placementType: 'wall' as const,
        isSurface: true, // Shelves can have items placed on them
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{isEditMode ? 'Edit Floating Shelf' : 'Create Floating Shelf'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Left: Form */}
          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={widthFeet}
                    onChange={(e) => setWidthFeet(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-xs text-gray-500">in</span>
                </div>
              </div>
            </div>

            {/* Thickness (Height) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thickness</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  max="3"
                  step="0.25"
                  value={heightInches}
                  onChange={(e) => setHeightInches(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500">inches</span>
              </div>
            </div>

            {/* Depth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Depth</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="4"
                  max="24"
                  value={depthInches}
                  onChange={(e) => setDepthInches(parseInt(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-sm text-gray-500">inches</span>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {WOOD_COLORS.map((wood) => (
                  <button
                    key={wood.name}
                    onClick={() => setColor(wood.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === wood.color ? 'border-blue-500 scale-110' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: wood.color }}
                    title={wood.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="#hexcode"
                />
              </div>
            </div>

            {/* Dimensions display */}
            <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
              Final size: {width.toFixed(1)}ft wide × {depthInches}" deep × {heightInches}" thick
            </div>
          </div>

          {/* Right: 3D Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
            <div className="h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
              <Canvas gl={{ preserveDrawingBuffer: true }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 5]} intensity={0.8} />
                <PerspectiveCamera makeDefault position={[width * 0.8, height * 5, depth * 3]} />
                <OrbitControls enablePan={false} />
                <Suspense fallback={null}>
                  <ShelfShapeRenderer shape={shelfShape} />
                </Suspense>
                <gridHelper args={[5, 5, '#cccccc', '#e5e5e5']} position={[0, -0.01, 0]} />
                {shouldCaptureThumbnail && (
                  <ThumbnailCapture onCapture={handleThumbnailCapture} />
                )}
              </Canvas>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              This shelf will be wall-mounted. Items can be placed on top of it.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {isEditMode ? 'Save Changes' : 'Create Shelf'}
          </button>
        </div>
      </div>
    </div>
  )
}
