'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface Point2D {
  x: number
  y: number
}

interface ViewportState {
  scale: number
  offsetX: number
  offsetY: number
}

interface ShapeDrawingCanvasProps {
  points: Point2D[]
  onPointsChange: (points: Point2D[]) => void
  isDrawing: boolean
  onDrawingChange: (isDrawing: boolean) => void
  color?: string
}

// Constants matching floorplan editor
const PIXELS_PER_FOOT = 30
const MIN_SCALE = 0.25
const MAX_SCALE = 4.0
const ZOOM_SENSITIVITY = 0.001
const SNAP_DISTANCE = 0.5 // feet - distance to snap to existing vertex
const DEFAULT_VIEWPORT: ViewportState = {
  scale: 1.0,
  offsetX: 5, // Center on 5ft (half of 10ft default grid)
  offsetY: 5,
}

/**
 * Format feet to feet and inches display (e.g., 3'6")
 * Matches the floorplan editor format
 */
function formatFeetInches(feet: number): string {
  const wholeFeet = Math.floor(Math.abs(feet))
  const inches = Math.round((Math.abs(feet) - wholeFeet) * 12)
  const sign = feet < 0 ? '-' : ''

  if (inches === 0) {
    return `${sign}${wholeFeet}'`
  } else if (inches === 12) {
    return `${sign}${wholeFeet + 1}'`
  } else {
    return `${sign}${wholeFeet}'${inches}"`
  }
}

/**
 * 2D Canvas for drawing polygon shapes
 * Works exactly like FloorplanCanvasV2:
 * - Space + drag to pan, scroll wheel to zoom
 * - Shift to snap to 45-degree angles
 * - Click to place vertices
 * - Click first vertex to close shape
 * - Flexible lengths (no forced grid snapping)
 */
export function ShapeDrawingCanvas({
  points,
  onPointsChange,
  isDrawing,
  onDrawingChange,
  color = '#6366f1',
}: ShapeDrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentMousePos, setCurrentMousePos] = useState<Point2D | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 500 })

  // Viewport state for pan/zoom
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT)
  const viewportRef = useRef<ViewportState>(DEFAULT_VIEWPORT)
  const [isPanMode, setIsPanMode] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [viewportStart, setViewportStart] = useState({ x: 0, y: 0 })

  // Track shift key for 45-degree snapping (like floorplan editor)
  const [shiftHeld, setShiftHeld] = useState(false)

  // Keep ref in sync with state
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Track space key for pan mode and shift key for 45-degree snapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track shift key
      if (e.key === 'Shift') {
        setShiftHeld(true)
      }

      // Space key activates pan mode
      if (e.code === 'Space' && !e.repeat) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setIsPanMode(true)
      }

      // Escape to cancel drawing
      if (e.key === 'Escape' && isDrawing && points.length > 0) {
        onPointsChange([])
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftHeld(false)
      }
      if (e.code === 'Space') {
        setIsPanMode(false)
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isDrawing, points.length, onPointsChange])

  // Snap point to nearest 45-degree angle from origin point (like floorplan editor)
  const snapTo45Degrees = useCallback(
    (originX: number, originY: number, targetX: number, targetY: number): { x: number; y: number } => {
      const dx = targetX - originX
      const dy = targetY - originY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance < 0.1) return { x: targetX, y: targetY }

      // Get angle and snap to nearest 45 degrees
      const angle = Math.atan2(dy, dx)
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)

      return {
        x: originX + distance * Math.cos(snappedAngle),
        y: originY + distance * Math.sin(snappedAngle),
      }
    },
    []
  )

  // Convert screen pixels to world coordinates (feet)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      const rect = canvas.getBoundingClientRect()
      const canvasCenterX = canvas.width / 2
      const canvasCenterY = canvas.height / 2

      const cssScaleX = canvas.width / rect.width
      const cssScaleY = canvas.height / rect.height

      const relX = (screenX - rect.left) * cssScaleX - canvasCenterX
      const relY = (screenY - rect.top) * cssScaleY - canvasCenterY

      const worldX = relX / (PIXELS_PER_FOOT * viewport.scale) + viewport.offsetX
      const worldY = relY / (PIXELS_PER_FOOT * viewport.scale) + viewport.offsetY

      return { x: worldX, y: worldY }
    },
    [viewport]
  )

  // Get visible world bounds (in feet)
  const getVisibleBounds = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { minX: 0, maxX: 10, minY: 0, maxY: 10 }

    const halfWidth = canvas.width / 2 / (PIXELS_PER_FOOT * viewport.scale)
    const halfHeight = canvas.height / 2 / (PIXELS_PER_FOOT * viewport.scale)

    return {
      minX: viewport.offsetX - halfWidth,
      maxX: viewport.offsetX + halfWidth,
      minY: viewport.offsetY - halfHeight,
      maxY: viewport.offsetY + halfHeight,
    }
  }, [viewport])

  // Find nearby existing vertex
  const findNearbyVertex = useCallback(
    (x: number, y: number): { index: number; point: Point2D } | null => {
      for (let i = 0; i < points.length; i++) {
        const dist = Math.sqrt(Math.pow(x - points[i].x, 2) + Math.pow(y - points[i].y, 2))
        if (dist < SNAP_DISTANCE) {
          return { index: i, point: points[i] }
        }
      }
      return null
    },
    [points]
  )

  // Handle scroll wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let rafId: number | null = null
    let pendingZoom: ViewportState | null = null

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const currentViewport = viewportRef.current
      const rect = canvas.getBoundingClientRect()
      const canvasCenterX = canvas.width / 2
      const canvasCenterY = canvas.height / 2

      const cssScaleX = canvas.width / rect.width
      const cssScaleY = canvas.height / rect.height

      const relX = (e.clientX - rect.left) * cssScaleX - canvasCenterX
      const relY = (e.clientY - rect.top) * cssScaleY - canvasCenterY

      const mouseWorldX = relX / (PIXELS_PER_FOOT * currentViewport.scale) + currentViewport.offsetX
      const mouseWorldY = relY / (PIXELS_PER_FOOT * currentViewport.scale) + currentViewport.offsetY

      const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, currentViewport.scale * (1 + zoomDelta)))

      const newOffsetX = mouseWorldX - relX / (PIXELS_PER_FOOT * newScale)
      const newOffsetY = mouseWorldY - relY / (PIXELS_PER_FOOT * newScale)

      pendingZoom = {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }

      viewportRef.current = pendingZoom

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          if (pendingZoom) {
            setViewport(pendingZoom)
          }
          rafId = null
        })
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [])

  // Get the snapped mouse position (applying 45-degree snap if shift held)
  // No forced grid snapping - allows flexible lengths like floorplan editor
  const getSnappedMousePos = useCallback(
    (rawX: number, rawY: number): Point2D => {
      let x = rawX
      let y = rawY

      // Apply 45-degree snapping if shift is held and we have points
      if (shiftHeld && points.length > 0) {
        const lastPoint = points[points.length - 1]
        const snapped = snapTo45Degrees(lastPoint.x, lastPoint.y, x, y)
        x = snapped.x
        y = snapped.y
      }

      // Round to reasonable precision (1/10th of an inch = 0.00833 ft)
      // This prevents floating point noise while allowing flexible lengths
      x = Math.round(x * 120) / 120  // 1/10 inch precision
      y = Math.round(y * 120) / 120

      return { x, y }
    },
    [shiftHeld, points, snapTo45Degrees]
  )

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvasSize

    // Clear canvas
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, width, height)

    // Get visible bounds
    const bounds = getVisibleBounds()

    // Save context and apply viewport transform
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.scale(viewport.scale, viewport.scale)
    ctx.translate(-viewport.offsetX * PIXELS_PER_FOOT, -viewport.offsetY * PIXELS_PER_FOOT)

    // Draw grid
    const gridStep = viewport.scale < 0.5 ? 2 : 1
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1 / viewport.scale

    // Vertical lines
    const startX = Math.floor(bounds.minX / gridStep) * gridStep
    const endX = Math.ceil(bounds.maxX / gridStep) * gridStep
    for (let x = startX; x <= endX; x += gridStep) {
      ctx.beginPath()
      ctx.moveTo(x * PIXELS_PER_FOOT, bounds.minY * PIXELS_PER_FOOT)
      ctx.lineTo(x * PIXELS_PER_FOOT, bounds.maxY * PIXELS_PER_FOOT)
      ctx.stroke()
    }

    // Horizontal lines
    const startY = Math.floor(bounds.minY / gridStep) * gridStep
    const endY = Math.ceil(bounds.maxY / gridStep) * gridStep
    for (let y = startY; y <= endY; y += gridStep) {
      ctx.beginPath()
      ctx.moveTo(bounds.minX * PIXELS_PER_FOOT, y * PIXELS_PER_FOOT)
      ctx.lineTo(bounds.maxX * PIXELS_PER_FOOT, y * PIXELS_PER_FOOT)
      ctx.stroke()
    }

    // Draw origin cross (at 0,0)
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 2 / viewport.scale
    ctx.beginPath()
    ctx.moveTo(-0.5 * PIXELS_PER_FOOT, 0)
    ctx.lineTo(0.5 * PIXELS_PER_FOOT, 0)
    ctx.moveTo(0, -0.5 * PIXELS_PER_FOOT)
    ctx.lineTo(0, 0.5 * PIXELS_PER_FOOT)
    ctx.stroke()

    // Draw grid labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = `${12 / viewport.scale}px sans-serif`
    const labelStep = viewport.scale < 0.5 ? 4 : 2
    for (let x = Math.ceil(bounds.minX / labelStep) * labelStep; x <= bounds.maxX; x += labelStep) {
      if (x !== 0) {
        ctx.fillText(`${x}'`, x * PIXELS_PER_FOOT + 3, bounds.minY * PIXELS_PER_FOOT + 15 / viewport.scale)
      }
    }
    for (let y = Math.ceil(bounds.minY / labelStep) * labelStep; y <= bounds.maxY; y += labelStep) {
      if (y !== 0) {
        ctx.fillText(`${y}'`, bounds.minX * PIXELS_PER_FOOT + 3, y * PIXELS_PER_FOOT - 5 / viewport.scale)
      }
    }

    // Draw filled polygon if closed
    if (points.length >= 3 && !isDrawing) {
      ctx.fillStyle = color + '40'
      ctx.beginPath()
      ctx.moveTo(points[0].x * PIXELS_PER_FOOT, points[0].y * PIXELS_PER_FOOT)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * PIXELS_PER_FOOT, points[i].y * PIXELS_PER_FOOT)
      }
      ctx.closePath()
      ctx.fill()
    }

    // Draw polygon edges with length labels
    if (points.length > 0) {
      ctx.strokeStyle = color
      ctx.lineWidth = 2 / viewport.scale
      ctx.beginPath()
      ctx.moveTo(points[0].x * PIXELS_PER_FOOT, points[0].y * PIXELS_PER_FOOT)

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * PIXELS_PER_FOOT, points[i].y * PIXELS_PER_FOOT)
      }

      // Draw line to mouse position while drawing
      if (isDrawing && currentMousePos) {
        ctx.lineTo(currentMousePos.x * PIXELS_PER_FOOT, currentMousePos.y * PIXELS_PER_FOOT)
      }

      // Close shape if not drawing
      if (!isDrawing && points.length >= 3) {
        ctx.closePath()
      }

      ctx.stroke()

      // Draw length labels on completed edges
      for (let i = 0; i < points.length - 1; i++) {
        drawEdgeLengthLabel(ctx, points[i], points[i + 1], color, viewport.scale)
      }

      // Draw closing edge length if shape is closed
      if (!isDrawing && points.length >= 3) {
        drawEdgeLengthLabel(ctx, points[points.length - 1], points[0], color, viewport.scale)
      }
    }

    // Draw preview length label while drawing
    if (isDrawing && points.length > 0 && currentMousePos) {
      const lastPoint = points[points.length - 1]
      drawEdgeLengthLabel(ctx, lastPoint, currentMousePos, '#2196F3', viewport.scale)
    }

    // Draw vertices
    points.forEach((point, index) => {
      // First point is green (close target), others are the shape color
      const isFirstPoint = index === 0
      const isInDrawingPath = isDrawing

      ctx.fillStyle = isFirstPoint ? '#22c55e' : color
      ctx.beginPath()
      ctx.arc(point.x * PIXELS_PER_FOOT, point.y * PIXELS_PER_FOOT, 6 / viewport.scale, 0, Math.PI * 2)
      ctx.fill()

      // White border for visibility
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2 / viewport.scale
      ctx.stroke()
    })

    // Draw hover indicator for closing shape
    if (isDrawing && points.length >= 3 && currentMousePos) {
      const nearVertex = findNearbyVertex(currentMousePos.x, currentMousePos.y)
      if (nearVertex && nearVertex.index === 0) {
        // Highlight first point when hovering to close
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 3 / viewport.scale
        ctx.setLineDash([5 / viewport.scale, 5 / viewport.scale])
        ctx.beginPath()
        ctx.arc(points[0].x * PIXELS_PER_FOOT, points[0].y * PIXELS_PER_FOOT, 12 / viewport.scale, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Draw preview closing line
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2 / viewport.scale
        ctx.setLineDash([5 / viewport.scale, 5 / viewport.scale])
        ctx.beginPath()
        ctx.moveTo(points[points.length - 1].x * PIXELS_PER_FOOT, points[points.length - 1].y * PIXELS_PER_FOOT)
        ctx.lineTo(points[0].x * PIXELS_PER_FOOT, points[0].y * PIXELS_PER_FOOT)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw snap preview point at current mouse position
    if (isDrawing && currentMousePos) {
      ctx.fillStyle = '#FF9800'
      ctx.beginPath()
      ctx.arc(
        currentMousePos.x * PIXELS_PER_FOOT,
        currentMousePos.y * PIXELS_PER_FOOT,
        4 / viewport.scale,
        0,
        Math.PI * 2
      )
      ctx.fill()
    }

    ctx.restore()

    // Draw UI overlay (in screen space)
    ctx.fillStyle = '#6b7280'
    ctx.font = '12px sans-serif'
    ctx.fillText(`${Math.round(viewport.scale * 100)}%`, 10, height - 10)

    // Draw shift indicator
    if (shiftHeld && isDrawing) {
      ctx.fillStyle = '#7c3aed'
      ctx.fillRect(width - 70, 10, 60, 24)
      ctx.fillStyle = 'white'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText('45° snap', width - 65, 26)
    }
  }, [points, isDrawing, currentMousePos, color, canvasSize, viewport, getVisibleBounds, shiftHeld, findNearbyVertex])

  // Helper function to draw edge length label
  function drawEdgeLengthLabel(
    ctx: CanvasRenderingContext2D,
    p1: Point2D,
    p2: Point2D,
    bgColor: string,
    scale: number
  ) {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const length = Math.sqrt(dx * dx + dy * dy)

    if (length < 0.3) return

    const midX = ((p1.x + p2.x) / 2) * PIXELS_PER_FOOT
    const midY = ((p1.y + p2.y) / 2) * PIXELS_PER_FOOT
    const label = formatFeetInches(length)

    const angle = Math.atan2(dy, dx)
    const offsetX = (Math.sin(angle) * 14) / scale
    const offsetY = (-Math.cos(angle) * 14) / scale

    const labelX = midX + offsetX
    const labelY = midY + offsetY

    ctx.font = `bold ${11 / scale}px sans-serif`
    const metrics = ctx.measureText(label)
    const padding = 4 / scale

    // Background pill
    ctx.fillStyle = bgColor
    const bgWidth = metrics.width + padding * 2
    const bgHeight = 16 / scale
    ctx.beginPath()
    ctx.roundRect(labelX - bgWidth / 2, labelY - bgHeight / 2, bgWidth, bgHeight, 8 / scale)
    ctx.fill()

    // Text
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, labelX, labelY)
  }

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanMode || isPanning) return
      if (!isDrawing) return

      const rawPos = screenToWorld(e.clientX, e.clientY)
      const snappedPos = getSnappedMousePos(rawPos.x, rawPos.y)

      // Check if clicking near first point to close shape
      if (points.length >= 3) {
        const nearVertex = findNearbyVertex(snappedPos.x, snappedPos.y)
        if (nearVertex && nearVertex.index === 0) {
          onDrawingChange(false)
          return
        }
      }

      onPointsChange([...points, snappedPos])
    },
    [isPanMode, isPanning, isDrawing, points, screenToWorld, getSnappedMousePos, findNearbyVertex, onPointsChange, onDrawingChange]
  )

  // Handle mouse down (for panning)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanMode) {
        setIsPanning(true)
        setPanStart({ x: e.clientX, y: e.clientY })
        setViewportStart({ x: viewport.offsetX, y: viewport.offsetY })
        e.preventDefault()
      }
    },
    [isPanMode, viewport]
  )

  // Handle mouse move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handle panning
      if (isPanning && isPanMode) {
        const currentScale = viewportRef.current.scale
        const dx = (e.clientX - panStart.x) / (PIXELS_PER_FOOT * currentScale)
        const dy = (e.clientY - panStart.y) / (PIXELS_PER_FOOT * currentScale)

        const newViewport = {
          scale: currentScale,
          offsetX: viewportStart.x - dx,
          offsetY: viewportStart.y - dy,
        }
        viewportRef.current = newViewport
        setViewport(newViewport)
        return
      }

      if (!isDrawing) return

      const rawPos = screenToWorld(e.clientX, e.clientY)
      const snappedPos = getSnappedMousePos(rawPos.x, rawPos.y)
      setCurrentMousePos(snappedPos)
    },
    [isPanning, isPanMode, panStart, viewportStart, isDrawing, screenToWorld, getSnappedMousePos]
  )

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false)
    }
  }, [isPanning])

  // Clear drawing
  const handleClear = () => {
    onPointsChange([])
    onDrawingChange(true)
    setCurrentMousePos(null)
  }

  // Undo last point
  const handleUndo = () => {
    if (points.length > 0) {
      onPointsChange(points.slice(0, -1))
      if (!isDrawing) onDrawingChange(true)
    }
  }

  // Reset view
  const handleResetView = () => {
    setViewport(DEFAULT_VIEWPORT)
    viewportRef.current = DEFAULT_VIEWPORT
  }

  // Get status message (like floorplan editor)
  const getStatusMessage = () => {
    if (!isDrawing) {
      return 'Shape closed. Click "Add Part" or undo to continue editing.'
    }
    if (points.length === 0) {
      return 'Click to place first vertex'
    }
    if (points.length < 3) {
      return `Click to place vertex ${points.length + 1}. Need ${3 - points.length} more to close.`
    }
    return 'Click to add vertices. Click the green point to close the shape.'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{getStatusMessage()}</p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Space</kbd>
          <span>+ drag to pan</span>
          <span className="mx-1">•</span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Shift</kbd>
          <span>for 45° snap</span>
          <span className="mx-1">•</span>
          <span>Scroll to zoom</span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 border border-gray-300 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setCurrentMousePos(null)
            setIsPanning(false)
          }}
          className={isPanMode ? 'cursor-grab' : isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

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
        <button
          onClick={handleResetView}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">
          Points: {points.length} | {isDrawing ? 'Drawing' : 'Closed'}
        </p>
        {shiftHeld && isDrawing && (
          <div className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
            45° snap active
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Export helper to check if roundRect is available (polyfill for older browsers)
 */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number | number[]
  ) {
    const r = typeof radius === 'number' ? radius : radius[0] || 0
    this.moveTo(x + r, y)
    this.arcTo(x + width, y, x + width, y + height, r)
    this.arcTo(x + width, y + height, x, y + height, r)
    this.arcTo(x, y + height, x, y, r)
    this.arcTo(x, y, x + width, y, r)
    this.closePath()
  }
}
