'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  ItemCategory,
  CompositeShape,
  CompositeShapePart,
  ExtrusionShapeV2,
  ExtrusionFaceId,
  FaceMaterial,
} from '@/types/room'
import { useItemLibrary } from '@/lib/item-library-context'
import { parseMeasurement, formatFeetForDisplay } from '@/lib/utils/measurements'
import { calculateShapeDimensions } from './ParametricShapeRenderer'
import { ShapeDrawingCanvas, Point2D } from './creator/ShapeDrawingCanvas'
import { ShapePartList } from './creator/ShapePartList'
import { PartTransformControls } from './creator/PartTransformControls'
import { FaceMaterialEditor } from './creator/FaceMaterialEditor'
import { CompositePreview3D, SingleShapePreview3D } from './creator/CompositePreview3D'
import { createCompositeShapePart, togglePartLocked, togglePartVisibility, removePart, addPart, updatePartPosition, updatePartRotation } from './CompositeShapeRenderer'
import { getEffectiveFaceMaterial, updateShapeFaceMaterial } from '@/lib/three/face-materials'

interface CustomItemCreatorV2Props {
  isOpen: boolean
  onClose: () => void
  editItem?: {
    id: string
    name: string
    category?: ItemCategory
    parametricShape: CompositeShape
  }
  onSave?: (updates: {
    name: string
    category: ItemCategory
    parametricShape: CompositeShape
    dimensions: { width: number; height: number; depth: number }
    thumbnailPath?: string
  }) => void
}

type EditorMode = 'parts' | 'drawing' | 'materials'

/**
 * Enhanced Custom Item Creator with multi-shape composition and per-face materials
 */
export function CustomItemCreatorV2({ isOpen, onClose, editItem, onSave }: CustomItemCreatorV2Props) {
  const { addItem } = useItemLibrary()
  const isEditMode = !!editItem

  // Editor state
  const [mode, setMode] = useState<EditorMode>('parts')

  // Item properties
  const [name, setName] = useState('Custom Item')
  const [category, setCategory] = useState<ItemCategory>('decoration')

  // Composite shape
  const [compositeShape, setCompositeShape] = useState<CompositeShape>({
    type: 'composite',
    parts: [],
  })

  // Selection state
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [selectedFace, setSelectedFace] = useState<{ partId: string; faceId: ExtrusionFaceId } | null>(null)

  // Drawing state (for creating/editing parts)
  const [drawingPoints, setDrawingPoints] = useState<Point2D[]>([])
  const [isDrawing, setIsDrawing] = useState(true)
  const [newPartHeight, setNewPartHeight] = useState(2)
  const [newPartHeightInput, setNewPartHeightInput] = useState("2'") // Local input state for flexible editing
  const [newPartColor, setNewPartColor] = useState('#6366f1')
  const [newPartName, setNewPartName] = useState('Part')
  const [editingPartId, setEditingPartId] = useState<string | null>(null) // Track which part is being edited

  // Thumbnail
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)
  const [shouldCaptureThumbnail, setShouldCaptureThumbnail] = useState(false)

  // Reset or load when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('parts')
      if (editItem) {
        // Load existing item data
        setName(editItem.name)
        setCategory(editItem.category || 'decoration')
        setCompositeShape(editItem.parametricShape)
      } else {
        // Reset for new item
        setName('Custom Item')
        setCategory('decoration')
        setCompositeShape({ type: 'composite', parts: [] })
      }
      setSelectedPartId(null)
      setSelectedFace(null)
      resetDrawingState()
      setCapturedThumbnail(null)
    }
  }, [isOpen, editItem])

  // Trigger thumbnail capture when composite shape changes
  useEffect(() => {
    if (compositeShape.parts.length > 0) {
      const timer = setTimeout(() => setShouldCaptureThumbnail(true), 300)
      return () => clearTimeout(timer)
    }
  }, [compositeShape])

  const resetDrawingState = () => {
    setDrawingPoints([])
    setIsDrawing(true)
    setNewPartHeight(2)
    setNewPartHeightInput("2'")
    setNewPartColor('#6366f1')
    setNewPartName(`Part ${compositeShape.parts.length + 1}`)
    setEditingPartId(null)
  }

  // Handle height input with flexible formats (like floorplan editor)
  const handleHeightInputChange = (value: string) => {
    setNewPartHeightInput(value)
  }

  const commitHeightValue = () => {
    const result = parseMeasurement(newPartHeightInput)
    if (result.success) {
      const clampedValue = Math.max(0.25, Math.min(20, result.feet)) // 3" to 20' range
      setNewPartHeight(clampedValue)
      setNewPartHeightInput(formatFeetForDisplay(clampedValue))
    } else {
      // Revert to last valid value
      setNewPartHeightInput(formatFeetForDisplay(newPartHeight))
    }
  }

  // Get the selected part
  const selectedPart = useMemo(() => {
    if (!selectedPartId) return null
    return compositeShape.parts.find((p) => p.id === selectedPartId) || null
  }, [selectedPartId, compositeShape.parts])

  // Get the selected face material
  const selectedFaceMaterial = useMemo(() => {
    if (!selectedFace) return null
    const part = compositeShape.parts.find((p) => p.id === selectedFace.partId)
    if (!part) return null
    return getEffectiveFaceMaterial(part.shape, selectedFace.faceId)
  }, [selectedFace, compositeShape.parts])

  // Handlers for part management
  const handleAddPartClick = () => {
    resetDrawingState()
    setMode('drawing')
  }

  // Edit an existing part - load its data into drawing mode
  const handleEditPart = (partId: string) => {
    const part = compositeShape.parts.find((p) => p.id === partId)
    if (!part || part.locked) return

    // Load the part's shape data into drawing state
    setDrawingPoints(part.shape.points)
    setIsDrawing(false) // Shape is already complete
    setNewPartHeight(part.shape.height)
    setNewPartHeightInput(formatFeetForDisplay(part.shape.height))
    setNewPartColor(part.shape.defaultMaterial?.color || '#6366f1')
    setNewPartName(part.name)
    setEditingPartId(partId)
    setMode('drawing')
  }

  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length < 3 || isDrawing) return

    const newShape: ExtrusionShapeV2 = {
      type: 'extrusion-v2',
      points: drawingPoints,
      height: newPartHeight,
      defaultMaterial: {
        color: newPartColor,
        roughness: 0.7,
        metalness: 0.1,
      },
    }

    if (editingPartId) {
      // Update existing part
      setCompositeShape((prev) => ({
        ...prev,
        parts: prev.parts.map((p) =>
          p.id === editingPartId
            ? {
                ...p,
                name: newPartName,
                shape: {
                  ...newShape,
                  // Preserve existing face materials
                  faceMaterials: p.shape.faceMaterials,
                },
              }
            : p
        ),
      }))
      setSelectedPartId(editingPartId)
    } else {
      // Create new part
      const newPart = createCompositeShapePart(newShape, newPartName)
      setCompositeShape((prev) => addPart(prev, newPart))
      setSelectedPartId(newPart.id)
    }

    setMode('parts')
    resetDrawingState()
  }, [drawingPoints, isDrawing, newPartHeight, newPartColor, newPartName, editingPartId])

  const handleCancelDrawing = () => {
    setMode('parts')
    resetDrawingState()
  }

  const handleToggleLocked = (partId: string) => {
    setCompositeShape((prev) => togglePartLocked(prev, partId))
  }

  const handleToggleVisible = (partId: string) => {
    setCompositeShape((prev) => togglePartVisibility(prev, partId))
  }

  const handleRemovePart = (partId: string) => {
    setCompositeShape((prev) => removePart(prev, partId))
    if (selectedPartId === partId) {
      setSelectedPartId(null)
    }
    if (selectedFace?.partId === partId) {
      setSelectedFace(null)
    }
  }

  const handleRenamePart = (partId: string, newName: string) => {
    setCompositeShape((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => (p.id === partId ? { ...p, name: newName } : p)),
    }))
  }

  const handlePositionChange = (position: { x?: number; y?: number; z?: number }) => {
    if (!selectedPartId) return
    setCompositeShape((prev) => updatePartPosition(prev, selectedPartId, position))
  }

  const handleRotationChange = (rotation: { x?: number; y?: number; z?: number }) => {
    if (!selectedPartId) return
    setCompositeShape((prev) => updatePartRotation(prev, selectedPartId, rotation))
  }

  // Face selection handlers
  const handlePartClick = (partId: string, faceId: ExtrusionFaceId) => {
    setSelectedPartId(partId)
    setSelectedFace({ partId, faceId })
    setMode('materials')
  }

  const handlePartHover = (partId: string | null, faceId: ExtrusionFaceId | null) => {
    // Optionally track hover state for highlighting
  }

  const handleFaceMaterialChange = (updates: Partial<FaceMaterial>) => {
    if (!selectedFace) return

    setCompositeShape((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => {
        if (part.id !== selectedFace.partId) return part
        return {
          ...part,
          shape: updateShapeFaceMaterial(part.shape, selectedFace.faceId, updates),
        }
      }),
    }))
  }

  // Thumbnail capture
  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCapturedThumbnail(dataUrl)
    setShouldCaptureThumbnail(false)
  }, [])

  // Calculate dimensions
  const dimensions = useMemo(() => {
    if (compositeShape.parts.length === 0) {
      return { width: 1, height: 1, depth: 1 }
    }
    return calculateShapeDimensions(compositeShape)
  }, [compositeShape])

  // Save the item
  const handleSave = () => {
    if (compositeShape.parts.length === 0) return

    if (isEditMode && onSave) {
      // Edit mode: call onSave callback
      onSave({
        name,
        category,
        parametricShape: compositeShape,
        dimensions,
        thumbnailPath: capturedThumbnail || undefined,
      })
    } else {
      // Create mode: add new item
      const newItem = {
        id: `custom-${Date.now()}`,
        name,
        description: 'User-created composite shape',
        parametricShape: compositeShape,
        thumbnailPath: capturedThumbnail || undefined,
        dimensions,
        category,
        tags: ['custom', category, 'composite'],
        placementType: 'floor' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isCustom: true,
      }

      addItem(newItem)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={`bg-white rounded-2xl shadow-xl w-full mx-4 overflow-hidden flex flex-col ${
        mode === 'drawing' ? 'max-w-7xl h-[95vh]' : 'max-w-5xl max-h-[90vh]'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'drawing' ? (editingPartId ? 'Edit Part Shape' : 'Draw Part Shape') : isEditMode ? 'Edit Custom Item' : 'Create Custom Item'}
          </h2>
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
        <div className="flex-1 overflow-hidden min-h-0">
          {mode === 'drawing' ? (
            // Drawing mode: Create new part - Large canvas layout
            <div className="flex h-full">
              {/* Main: Drawing canvas - takes most of the space */}
              <div className="flex-1 p-4 flex flex-col min-w-0">
                <ShapeDrawingCanvas
                  points={drawingPoints}
                  onPointsChange={setDrawingPoints}
                  isDrawing={isDrawing}
                  onDrawingChange={setIsDrawing}
                  color={newPartColor}
                />
              </div>

              {/* Right sidebar: Part properties */}
              <div className="w-72 border-l border-gray-200 p-4 overflow-y-auto shrink-0">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Part Name</label>
                    <input
                      type="text"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Height
                    </label>
                    <input
                      type="text"
                      value={newPartHeightInput}
                      onChange={(e) => handleHeightInputChange(e.target.value)}
                      onBlur={commitHeightValue}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitHeightValue()
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      placeholder="2' or 2ft or 24&quot;"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Examples: 2'6", 2ft 6in, 30", 2.5
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={newPartColor}
                        onChange={(e) => setNewPartColor(e.target.value)}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={newPartColor}
                        onChange={(e) => setNewPartColor(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
                    <SingleShapePreview3D
                      shape={
                        drawingPoints.length >= 3 && !isDrawing
                          ? { points: drawingPoints, height: newPartHeight, color: newPartColor }
                          : null
                      }
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCancelDrawing}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFinishDrawing}
                      disabled={drawingPoints.length < 3 || isDrawing}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {editingPartId ? 'Update Part' : 'Add Part'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Parts/Materials mode
            <div className="grid grid-cols-3 gap-0 h-full">
              {/* Left panel: Parts list & transform */}
              <div className="p-4 border-r border-gray-200 overflow-y-auto">
                <ShapePartList
                  parts={compositeShape.parts}
                  selectedPartId={selectedPartId}
                  onSelectPart={(id) => {
                    setSelectedPartId(id)
                    setSelectedFace(null)
                    setMode('parts')
                  }}
                  onToggleLocked={handleToggleLocked}
                  onToggleVisible={handleToggleVisible}
                  onRemovePart={handleRemovePart}
                  onRenamePart={handleRenamePart}
                  onAddPart={handleAddPartClick}
                  onEditPart={handleEditPart}
                />

                {selectedPart && !selectedPart.locked && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <PartTransformControls
                      part={selectedPart}
                      onPositionChange={handlePositionChange}
                      onRotationChange={handleRotationChange}
                    />
                  </div>
                )}
              </div>

              {/* Center: 3D Preview */}
              <div className="p-4 flex flex-col">
                <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
                <p className="text-xs text-gray-500 mb-2">Click faces to edit materials</p>
                <div className="flex-1">
                  <CompositePreview3D
                    shape={compositeShape}
                    selectedPartId={selectedPartId}
                    highlightedFace={selectedFace}
                    onPartClick={handlePartClick}
                    onPartHover={handlePartHover}
                    onCaptureThumbnail={handleThumbnailCapture}
                    shouldCaptureThumbnail={shouldCaptureThumbnail}
                  />
                </div>

                {/* Item properties */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ItemCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="seating">Seating</option>
                      <option value="table">Table</option>
                      <option value="storage">Storage</option>
                      <option value="bed">Bed</option>
                      <option value="decoration">Decoration</option>
                      <option value="lighting">Lighting</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <p className="text-xs text-gray-400">
                    Dimensions: {dimensions.width.toFixed(1)}ft × {dimensions.height.toFixed(1)}ft ×{' '}
                    {dimensions.depth.toFixed(1)}ft
                  </p>
                </div>
              </div>

              {/* Right panel: Material editor */}
              <div className="p-4 border-l border-gray-200 overflow-y-auto bg-gray-50">
                {selectedFace && selectedFaceMaterial ? (
                  <FaceMaterialEditor
                    faceId={selectedFace.faceId}
                    material={selectedFaceMaterial}
                    onMaterialChange={handleFaceMaterialChange}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    {compositeShape.parts.length === 0
                      ? 'Add parts to start'
                      : 'Click a face in the preview to edit its material'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <p className="text-sm text-gray-500">
            {compositeShape.parts.length} part{compositeShape.parts.length !== 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={compositeShape.parts.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditMode ? 'Update Item' : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
