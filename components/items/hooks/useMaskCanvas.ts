'use client'

import { useRef, useState, useEffect, useCallback, RefObject } from 'react'
import {
  extractMaskFromProcessed,
  loadImageToCanvas,
  applyMaskToOriginal,
  cloneImageData,
  imageDataToBlob,
  createEmptyMask
} from '@/lib/mask-utils'
import { useMaskHistory, UseMaskHistoryReturn } from './useMaskHistory'
import type { CanvasState } from '@/types/mask-correction'

// Constants
const MIN_ZOOM = 0.1
const MAX_ZOOM = 8
const ZOOM_SENSITIVITY = 0.002
const DEFAULT_BRUSH_SIZE = 20
const MASK_OVERLAY_COLOR = { r: 76, g: 175, b: 80 } // Green (sage)
const MASK_OVERLAY_ALPHA = 0.5

interface UseMaskCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  originalImageUrl: string
  processedImageUrl: string | null
}

interface UseMaskCanvasReturn {
  // State
  isLoading: boolean
  error: string | null
  imageDimensions: { width: number; height: number } | null

  // Canvas state
  brushSize: number
  setBrushSize: (size: number) => void
  tool: 'brush' | 'eraser'
  setTool: (tool: 'brush' | 'eraser') => void
  zoom: number
  pan: { x: number; y: number }

  // History
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  resetMask: () => void

  // Event handlers
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void
  handleMouseUp: () => void
  handleMouseLeave: () => void
  handleWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void

  // Export
  getMaskBlob: () => Promise<Blob>
  getProcessedBlob: () => Promise<Blob>
}

/**
 * Hook for managing the mask correction canvas
 * Handles image loading, brush painting, pan/zoom, and export
 */
export function useMaskCanvas({
  canvasRef,
  originalImageUrl,
  processedImageUrl
}: UseMaskCanvasProps): UseMaskCanvasReturn {
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Image data
  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

  // Initial mask (extracted from processed image or empty)
  const initialMaskRef = useRef<ImageData | null>(null)

  // Canvas state
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE)
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hasInitializedView, setHasInitializedView] = useState(false)

  // Interaction state
  const [isDrawing, setIsDrawing] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Mask history (for undo/redo)
  const history = useMaskHistory(null)

  // Live mask data (modified during drawing, snapshotted on mouseup)
  const liveMaskRef = useRef<ImageData | null>(null)

  // Cursor position for preview
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Load images and extract initial mask
  useEffect(() => {
    let cancelled = false

    async function loadImages() {
      setIsLoading(true)
      setError(null)

      try {
        // Load original image
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load original image'))
          img.src = originalImageUrl
        })

        if (cancelled) return

        originalImageRef.current = img
        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })

        // Extract mask from processed image or create empty mask
        let initialMask: ImageData

        if (processedImageUrl) {
          try {
            initialMask = await extractMaskFromProcessed(processedImageUrl)
          } catch (err) {
            console.warn('Failed to extract mask from processed image, using empty mask:', err)
            initialMask = createEmptyMask(img.naturalWidth, img.naturalHeight)
          }
        } else {
          initialMask = createEmptyMask(img.naturalWidth, img.naturalHeight)
        }

        if (cancelled) return

        initialMaskRef.current = cloneImageData(initialMask)
        liveMaskRef.current = cloneImageData(initialMask)
        history.reset(initialMask)

        // Reset view initialization flag so zoom gets calculated
        setHasInitializedView(false)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load images')
          setIsLoading(false)
        }
      }
    }

    loadImages()

    return () => {
      cancelled = true
    }
  }, [originalImageUrl, processedImageUrl])

  // Calculate initial fit zoom when image and canvas are ready
  useEffect(() => {
    if (hasInitializedView || isLoading) return

    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return

    // Wait for canvas to have actual dimensions (set by ResizeObserver)
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    if (canvasWidth < 100 || canvasHeight < 100) return

    const padding = 60 // Leave padding around the image
    const scaleX = (canvasWidth - padding * 2) / img.naturalWidth
    const scaleY = (canvasHeight - padding * 2) / img.naturalHeight
    const fitZoom = Math.min(scaleX, scaleY, 1) // Don't zoom in beyond 100%

    setZoom(Math.max(MIN_ZOOM, fitZoom))
    setPan({ x: 0, y: 0 }) // Center the image
    setHasInitializedView(true)
  })

  // Sync live mask with history
  useEffect(() => {
    if (history.maskData && !isDrawing) {
      liveMaskRef.current = cloneImageData(history.maskData)
      renderCanvas()
    }
  }, [history.maskData])

  // Space key for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setSpacePressed(true)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
        setIsPanning(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const img = originalImageRef.current
    const mask = liveMaskRef.current

    if (!canvas || !ctx || !img || !mask) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context state
    ctx.save()

    // Apply pan and zoom
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    ctx.translate(centerX + pan.x, centerY + pan.y)
    ctx.scale(zoom, zoom)
    ctx.translate(-img.width / 2, -img.height / 2)

    // Draw original image
    ctx.drawImage(img, 0, 0)

    // Draw mask overlay
    // Create temporary canvas for mask overlay
    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = mask.width
    maskCanvas.height = mask.height
    const maskCtx = maskCanvas.getContext('2d')

    if (maskCtx) {
      const overlayData = new ImageData(mask.width, mask.height)

      for (let i = 0; i < mask.data.length; i += 4) {
        const maskValue = mask.data[i] // R channel = mask value
        if (maskValue > 0) {
          overlayData.data[i] = MASK_OVERLAY_COLOR.r
          overlayData.data[i + 1] = MASK_OVERLAY_COLOR.g
          overlayData.data[i + 2] = MASK_OVERLAY_COLOR.b
          overlayData.data[i + 3] = Math.round(maskValue * MASK_OVERLAY_ALPHA)
        }
      }

      maskCtx.putImageData(overlayData, 0, 0)
      ctx.drawImage(maskCanvas, 0, 0)
    }

    // Restore context state
    ctx.restore()

    // Draw brush cursor preview (in screen space)
    if (cursorPos && !isPanning) {
      const cursorRadius = (brushSize * zoom) / 2
      const brushColor = tool === 'brush' ? '#4CAF50' : '#FF5722'

      ctx.save()

      // Draw circle outline (white shadow for visibility on any background)
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cursorPos.x, cursorPos.y, cursorRadius, 0, Math.PI * 2)
      ctx.stroke()

      // Draw colored circle outline on top
      ctx.strokeStyle = brushColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cursorPos.x, cursorPos.y, cursorRadius, 0, Math.PI * 2)
      ctx.stroke()

      ctx.restore()
    }
  }, [canvasRef, pan, zoom, brushSize, tool, cursorPos, isPanning])

  // Render on state changes
  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback((screenX: number, screenY: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    const img = originalImageRef.current
    if (!canvas || !img) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    // Mouse position relative to canvas (in CSS pixels)
    const mouseX = screenX - rect.left
    const mouseY = screenY - rect.top

    // Scale to canvas internal resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = mouseX * scaleX
    const canvasY = mouseY * scaleY

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    // Reverse the transform
    const imgX = (canvasX - centerX - pan.x) / zoom + img.width / 2
    const imgY = (canvasY - centerY - pan.y) / zoom + img.height / 2

    return { x: imgX, y: imgY }
  }, [canvasRef, pan, zoom])

  // Draw brush stroke at position
  const drawBrushAt = useCallback((imgX: number, imgY: number) => {
    const mask = liveMaskRef.current
    if (!mask) return

    const radius = brushSize / 2
    const value = tool === 'brush' ? 255 : 0

    // Draw filled circle on mask
    const minX = Math.max(0, Math.floor(imgX - radius))
    const maxX = Math.min(mask.width - 1, Math.ceil(imgX + radius))
    const minY = Math.max(0, Math.floor(imgY - radius))
    const maxY = Math.min(mask.height - 1, Math.ceil(imgY + radius))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dist = Math.sqrt((x - imgX) ** 2 + (y - imgY) ** 2)
        if (dist <= radius) {
          const idx = (y * mask.width + x) * 4
          mask.data[idx] = value     // R
          mask.data[idx + 1] = value // G
          mask.data[idx + 2] = value // B
          // Alpha stays 255 for display
        }
      }
    }
  }, [brushSize, tool])

  // Interpolate brush stroke between two points
  const drawBrushLine = useCallback((fromX: number, fromY: number, toX: number, toY: number) => {
    const dist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2)
    const steps = Math.max(1, Math.ceil(dist / (brushSize / 4))) // Step every 1/4 brush size

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = fromX + (toX - fromX) * t
      const y = fromY + (toY - fromY) * t
      drawBrushAt(x, y)
    }
  }, [brushSize, drawBrushAt])

  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (spacePressed) {
      // Start panning
      setIsPanning(true)
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y
      }
    } else {
      // Start drawing
      setIsDrawing(true)
      const { x, y } = screenToImage(e.clientX, e.clientY)
      lastPosRef.current = { x, y }
      drawBrushAt(x, y)
      renderCanvas()
    }
  }, [canvasRef, spacePressed, pan, screenToImage, drawBrushAt, renderCanvas])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Mouse position relative to canvas (in CSS pixels)
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Scale to canvas internal resolution
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = mouseX * scaleX
    const canvasY = mouseY * scaleY

    setCursorPos({ x: canvasX, y: canvasY })

    if (isPanning) {
      // Update pan
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      })
    } else if (isDrawing) {
      // Continue drawing
      const { x, y } = screenToImage(e.clientX, e.clientY)
      drawBrushLine(lastPosRef.current.x, lastPosRef.current.y, x, y)
      lastPosRef.current = { x, y }
      renderCanvas()
    }
  }, [canvasRef, isPanning, isDrawing, screenToImage, drawBrushLine, renderCanvas])

  const handleMouseUp = useCallback(() => {
    if (isDrawing && liveMaskRef.current) {
      // Snapshot for undo/redo
      history.snapshot(liveMaskRef.current)
    }
    setIsDrawing(false)
    setIsPanning(false)
  }, [isDrawing, history])

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null)
    if (isDrawing && liveMaskRef.current) {
      history.snapshot(liveMaskRef.current)
    }
    setIsDrawing(false)
    setIsPanning(false)
  }, [isDrawing, history])

  // Store zoom/pan in refs so the wheel handler always has current values
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // Attach wheel event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()

      // Mouse position relative to canvas (in CSS pixels)
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      // Scale mouse coords to canvas internal resolution
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const canvasMouseX = mouseX * scaleX
      const canvasMouseY = mouseY * scaleY

      // Calculate new zoom
      const currentZoom = zoomRef.current
      const currentPan = panRef.current
      const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom * (1 + zoomDelta * 5)))

      // Zoom towards mouse position
      const zoomRatio = newZoom / currentZoom
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2

      const newPanX = canvasMouseX - centerX - (canvasMouseX - centerX - currentPan.x) * zoomRatio
      const newPanY = canvasMouseY - centerY - (canvasMouseY - centerY - currentPan.y) * zoomRatio

      setZoom(newZoom)
      setPan({ x: newPanX, y: newPanY })
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [isLoading]) // Re-attach when loading completes (canvas becomes available)

  // Dummy handler for React (actual handling done via useEffect above)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    // Handled by native event listener above
  }, [])

  // Reset mask to initial state
  const resetMask = useCallback(() => {
    if (initialMaskRef.current) {
      const resetData = cloneImageData(initialMaskRef.current)
      liveMaskRef.current = resetData
      history.reset(resetData)
      renderCanvas()
    }
  }, [history, renderCanvas])

  // Export mask as blob
  const getMaskBlob = useCallback(async (): Promise<Blob> => {
    const mask = liveMaskRef.current
    if (!mask) {
      throw new Error('No mask data available')
    }
    return imageDataToBlob(mask)
  }, [])

  // Export processed image (original with mask applied)
  const getProcessedBlob = useCallback(async (): Promise<Blob> => {
    const mask = liveMaskRef.current
    if (!mask) {
      throw new Error('No mask data available')
    }
    return applyMaskToOriginal(originalImageUrl, mask)
  }, [originalImageUrl])

  return {
    // State
    isLoading,
    error,
    imageDimensions,

    // Canvas state
    brushSize,
    setBrushSize,
    tool,
    setTool,
    zoom,
    pan,

    // History
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    resetMask,

    // Event handlers
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,

    // Export
    getMaskBlob,
    getProcessedBlob
  }
}

export type { UseMaskCanvasReturn }
