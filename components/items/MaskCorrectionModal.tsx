'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useMaskCanvas } from './hooks/useMaskCanvas'
import type { MaskCorrectionModalProps, MaskCorrectionMetadata } from '@/types/mask-correction'

// Icons
const BrushIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
  </svg>
)

const EraserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
)

const UndoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
)

const RedoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 7v6h-6" />
    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
  </svg>
)

const ResetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

export function MaskCorrectionModal({
  isOpen,
  onClose,
  imagePair,
  itemId,
  imageIndex,
  onCorrectionSaved
}: MaskCorrectionModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const startTimeRef = useRef<number>(Date.now())
  const brushSizesUsedRef = useRef<Set<number>>(new Set())
  const toolsUsedRef = useRef<Set<'brush' | 'eraser'>>(new Set())

  const {
    isLoading,
    error,
    imageDimensions,
    brushSize,
    setBrushSize,
    tool,
    setTool,
    zoom,
    canUndo,
    canRedo,
    undo,
    redo,
    resetMask,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    getMaskBlob,
    getProcessedBlob
  } = useMaskCanvas({
    canvasRef,
    originalImageUrl: imagePair.original,
    processedImageUrl: imagePair.processed
  })

  // Track brush sizes and tools used
  useEffect(() => {
    brushSizesUsedRef.current.add(brushSize)
  }, [brushSize])

  useEffect(() => {
    toolsUsedRef.current.add(tool)
  }, [tool])

  // Track changes when undo/redo state changes
  useEffect(() => {
    if (canUndo) {
      setHasChanges(true)
    }
  }, [canUndo])

  // Set canvas size to fill container
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return

    const updateCanvasSize = () => {
      const container = containerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }

    updateCanvasSize()

    const resizeObserver = new ResizeObserver(updateCanvasSize)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [isOpen])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }

      // B for brush
      if (e.key === 'b' || e.key === 'B') {
        setTool('brush')
      }

      // E for eraser
      if (e.key === 'e' || e.key === 'E') {
        setTool('eraser')
      }

      // [ and ] for brush size
      if (e.key === '[') {
        setBrushSize(Math.max(5, brushSize - 5))
      }
      if (e.key === ']') {
        setBrushSize(Math.min(100, brushSize + 5))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, undo, redo, setTool, brushSize, setBrushSize])

  // Handle save
  const handleSave = useCallback(async () => {
    if (isSaving) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const [maskBlob, processedBlob] = await Promise.all([
        getMaskBlob(),
        getProcessedBlob()
      ])

      // Prepare metadata
      const metadata: MaskCorrectionMetadata = {
        brushSizes: Array.from(brushSizesUsedRef.current),
        toolsUsed: Array.from(toolsUsedRef.current),
        correctionDuration: Date.now() - startTimeRef.current,
        imageWidth: imageDimensions?.width || 0,
        imageHeight: imageDimensions?.height || 0
      }

      // Create form data
      const formData = new FormData()
      formData.append('maskFile', maskBlob, 'mask.png')
      formData.append('processedFile', processedBlob, 'processed.png')
      formData.append('itemId', itemId)
      formData.append('imageIndex', String(imageIndex))
      formData.append('originalUrl', imagePair.original)
      if (imagePair.processed) {
        formData.append('originalProcessedUrl', imagePair.processed)
      }
      formData.append('metadata', JSON.stringify(metadata))

      // Save to API
      const response = await fetch('/api/mask-correction/save', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save correction')
      }

      const result = await response.json()

      if (result.success && result.correctedProcessedUrl) {
        onCorrectionSaved(result.correctedProcessedUrl)
      } else {
        throw new Error('No processed URL returned')
      }
    } catch (err) {
      console.error('Failed to save mask correction:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save correction')
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, getMaskBlob, getProcessedBlob, itemId, imageIndex, imagePair, imageDimensions, onCorrectionSaved])

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges && !isSaving) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?')
      if (!confirmed) return
    }
    onClose()
  }, [hasChanges, isSaving, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900/95 border border-white/20 rounded-2xl w-full h-full max-w-[95vw] max-h-[95vh] m-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Correct Background Mask</h2>
            <p className="text-sm text-white/50">
              Paint to mark foreground (keep), erase to mark background (remove)
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/60 hover:text-white text-3xl leading-none px-2"
            disabled={isSaving}
          >
            ×
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas area */}
          <div ref={containerRef} className="flex-1 relative bg-gray-950">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <LoadingSpinner />
                  <p className="text-white/60 mt-2">Loading image...</p>
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-red-400">
                  <p>Failed to load image</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                className="absolute inset-0 w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
              />
            )}

            {/* Zoom indicator */}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-white/80 text-sm">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Controls panel */}
          <div className="w-64 shrink-0 border-l border-white/10 p-4 flex flex-col gap-6 bg-gray-900/50">
            {/* Brush Size */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-green-500"
              />
              <div className="flex justify-between text-xs text-white/50 mt-1">
                <span>5</span>
                <span>100</span>
              </div>
            </div>

            {/* Tool selection */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Tool</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTool('brush')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                    tool === 'brush'
                      ? 'bg-green-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                  title="Brush (B) - Mark as foreground"
                >
                  <BrushIcon />
                  <span>Brush</span>
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                    tool === 'eraser'
                      ? 'bg-orange-600 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                  title="Eraser (E) - Mark as background"
                >
                  <EraserIcon />
                  <span>Eraser</span>
                </button>
              </div>
            </div>

            {/* History controls */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">History</label>
              <div className="flex gap-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    canUndo
                      ? 'bg-white/10 text-white/70 hover:bg-white/20'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                  title="Undo (Ctrl+Z)"
                >
                  <UndoIcon />
                  <span>Undo</span>
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                    canRedo
                      ? 'bg-white/10 text-white/70 hover:bg-white/20'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                  title="Redo (Ctrl+Shift+Z)"
                >
                  <RedoIcon />
                  <span>Redo</span>
                </button>
              </div>
              <button
                onClick={resetMask}
                className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                title="Reset to original mask"
              >
                <ResetIcon />
                <span>Reset to Original</span>
              </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Error message */}
            {saveError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                {saveError}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-colors ${
                isSaving || isLoading
                  ? 'bg-green-600/50 text-white/50 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <SaveIcon />
                  <span>Save Correction</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 text-center text-sm text-white/50 shrink-0">
          <span className="mr-6">Scroll to zoom</span>
          <span className="mr-6">Space + drag to pan</span>
          <span className="mr-6">B = Brush</span>
          <span className="mr-6">E = Eraser</span>
          <span>[ ] = Brush size</span>
        </div>
      </div>
    </div>
  )
}
