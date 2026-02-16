'use client'

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { ItemCategory, ParametricShape } from '@/types/room'
import { useItemLibrary } from '@/lib/item-library-context'
import { calculateShapeDimensions, ParametricShapeRenderer } from './ParametricShapeRenderer'
import * as THREE from 'three'

// Component to capture the 3D scene as an image
function ThumbnailCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    // Wait a frame for the scene to render, then capture
    const timeoutId = setTimeout(() => {
      gl.render(scene, camera)
      const dataUrl = gl.domElement.toDataURL('image/png')
      onCapture(dataUrl)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [gl, scene, camera, onCapture])

  return null
}

interface Point2D {
  x: number
  y: number
}

interface CustomItemCreatorProps {
  isOpen: boolean
  onClose: () => void
}

// Canvas size configuration
const CANVAS_SIZE = 300  // pixels
const GRID_SIZE = 10     // feet - the drawing area represents 10ft x 10ft
const SCALE = CANVAS_SIZE / GRID_SIZE  // pixels per foot

export function CustomItemCreator({ isOpen, onClose }: CustomItemCreatorProps) {
  const { addItem } = useItemLibrary()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Drawing state
  const [points, setPoints] = useState<Point2D[]>([])
  const [isDrawing, setIsDrawing] = useState(true)
  const [currentMousePos, setCurrentMousePos] = useState<Point2D | null>(null)

  // Item properties
  const [name, setName] = useState('Custom Item')
  const [category, setCategory] = useState<ItemCategory>('decoration')
  const [height, setHeight] = useState(2)
  const [color, setColor] = useState('#6366f1')

  // Thumbnail capture
  const [capturedThumbnail, setCapturedThumbnail] = useState<string | null>(null)
  const [shouldCaptureThumbnail, setShouldCaptureThumbnail] = useState(false)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setPoints([])
      setIsDrawing(true)
      setCurrentMousePos(null)
      setName('Custom Item')
      setCategory('decoration')
      setHeight(2)
      setColor('#6366f1')
      setCapturedThumbnail(null)
      setShouldCaptureThumbnail(false)
    }
  }, [isOpen])

  // Trigger thumbnail capture when shape is closed or properties change
  useEffect(() => {
    if (!isDrawing && points.length >= 3) {
      // Small delay to let the 3D preview render
      const timeoutId = setTimeout(() => {
        setShouldCaptureThumbnail(true)
      }, 200)
      return () => clearTimeout(timeoutId)
    }
  }, [isDrawing, points.length, height, color])

  // Handle thumbnail capture callback
  const handleThumbnailCapture = useCallback((dataUrl: string) => {
    setCapturedThumbnail(dataUrl)
    setShouldCaptureThumbnail(false)
  }, [])

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * SCALE
      ctx.beginPath()
      ctx.moveTo(pos, 0)
      ctx.lineTo(pos, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, pos)
      ctx.lineTo(CANVAS_SIZE, pos)
      ctx.stroke()
    }

    // Draw grid labels (every 2 feet)
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px sans-serif'
    for (let i = 0; i <= GRID_SIZE; i += 2) {
      ctx.fillText(`${i}ft`, i * SCALE + 2, 12)
      if (i > 0) ctx.fillText(`${i}`, 2, i * SCALE - 2)
    }

    // Draw filled polygon if closed
    if (points.length >= 3 && !isDrawing) {
      ctx.fillStyle = color + '40'  // Semi-transparent
      ctx.beginPath()
      ctx.moveTo(points[0].x * SCALE, points[0].y * SCALE)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * SCALE, points[i].y * SCALE)
      }
      ctx.closePath()
      ctx.fill()
    }

    // Draw polygon edges
    if (points.length > 0) {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(points[0].x * SCALE, points[0].y * SCALE)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * SCALE, points[i].y * SCALE)
      }

      // Draw line to mouse position while drawing
      if (isDrawing && currentMousePos) {
        ctx.lineTo(currentMousePos.x * SCALE, currentMousePos.y * SCALE)
      }

      // Close shape if not drawing
      if (!isDrawing && points.length >= 3) {
        ctx.closePath()
      }

      ctx.stroke()
    }

    // Draw vertices
    points.forEach((point, index) => {
      ctx.fillStyle = index === 0 ? '#22c55e' : color  // First point is green
      ctx.beginPath()
      ctx.arc(point.x * SCALE, point.y * SCALE, 5, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw preview line to close shape
    if (isDrawing && points.length >= 3 && currentMousePos) {
      const distToFirst = Math.sqrt(
        Math.pow(currentMousePos.x - points[0].x, 2) +
        Math.pow(currentMousePos.y - points[0].y, 2)
      )
      if (distToFirst < 0.5) {
        // Show close indicator
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(points[points.length - 1].x * SCALE, points[points.length - 1].y * SCALE)
        ctx.lineTo(points[0].x * SCALE, points[0].y * SCALE)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [points, isDrawing, currentMousePos, color])

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / SCALE
    const y = (e.clientY - rect.top) / SCALE

    // Check if clicking near first point to close shape
    if (points.length >= 3) {
      const distToFirst = Math.sqrt(
        Math.pow(x - points[0].x, 2) + Math.pow(y - points[0].y, 2)
      )
      if (distToFirst < 0.5) {
        setIsDrawing(false)
        return
      }
    }

    // Snap to grid (0.5ft increments)
    const snappedX = Math.round(x * 2) / 2
    const snappedY = Math.round(y * 2) / 2

    setPoints([...points, { x: snappedX, y: snappedY }])
  }, [isDrawing, points])

  // Handle mouse move for preview
  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / SCALE
    const y = (e.clientY - rect.top) / SCALE

    // Snap to grid
    const snappedX = Math.round(x * 2) / 2
    const snappedY = Math.round(y * 2) / 2

    setCurrentMousePos({ x: snappedX, y: snappedY })
  }, [isDrawing])

  // Clear drawing
  const handleClear = () => {
    setPoints([])
    setIsDrawing(true)
    setCurrentMousePos(null)
  }

  // Undo last point
  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1))
      if (!isDrawing) setIsDrawing(true)
    }
  }

  // Create the parametric shape
  const parametricShape: ParametricShape | null = useMemo(() => {
    if (points.length < 3) return null
    return {
      type: 'extrusion',
      points,
      height,
      color
    }
  }, [points, height, color])

  // Calculate dimensions
  const dimensions = useMemo(() => {
    if (!parametricShape) return { width: 1, height: 1, depth: 1 }
    return calculateShapeDimensions(parametricShape)
  }, [parametricShape])

  // Save the item
  const handleSave = () => {
    if (!parametricShape) return

    const newItem = {
      id: `custom-${Date.now()}`,
      name,
      description: 'User-created custom shape',
      parametricShape,
      thumbnailPath: capturedThumbnail || undefined,
      dimensions,
      category,
      tags: ['custom', category],
      placementType: 'floor' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isCustom: true
    }

    addItem(newItem)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Custom Item</h2>
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
          {/* Left: 2D Canvas */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Draw Shape (Top-Down View)</h3>
            <p className="text-xs text-gray-500 mb-3">
              Click to add points. {points.length >= 3 && isDrawing && 'Click the green point to close the shape.'}
            </p>

            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              onMouseLeave={() => setCurrentMousePos(null)}
              className="border border-gray-300 rounded-lg cursor-crosshair"
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleClear}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleUndo}
                disabled={points.length === 0}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Undo
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              Points: {points.length} | Status: {isDrawing ? 'Drawing...' : 'Shape closed'}
            </p>
          </div>

          {/* Right: Properties and Preview */}
          <div className="space-y-4">
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

            {/* Category */}
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

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height: {height}ft
              </label>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-3">
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
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* 3D Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">3D Preview</label>
              <div className="h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                {parametricShape && points.length >= 3 && !isDrawing ? (
                  <Canvas gl={{ preserveDrawingBuffer: true }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 10, 5]} intensity={0.8} />
                    <PerspectiveCamera makeDefault position={[5, 5, 5]} />
                    <OrbitControls enablePan={false} />
                    <Suspense fallback={null}>
                      <ParametricShapeRenderer shape={parametricShape} />
                    </Suspense>
                    <gridHelper args={[10, 10, '#cccccc', '#e5e5e5']} />
                    {/* Capture thumbnail when shape is ready */}
                    {shouldCaptureThumbnail && (
                      <ThumbnailCapture onCapture={handleThumbnailCapture} />
                    )}
                  </Canvas>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    {points.length < 3
                      ? 'Draw at least 3 points'
                      : 'Close the shape to preview'}
                  </div>
                )}
              </div>
            </div>

            {/* Dimensions display */}
            {parametricShape && (
              <div className="text-xs text-gray-500">
                Dimensions: {dimensions.width.toFixed(1)}ft × {dimensions.height.toFixed(1)}ft × {dimensions.depth.toFixed(1)}ft
              </div>
            )}
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
            disabled={!parametricShape || points.length < 3 || isDrawing}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Item
          </button>
        </div>
      </div>
    </div>
  )
}
