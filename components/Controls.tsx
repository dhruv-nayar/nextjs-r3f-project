'use client'

import { useControls } from '@/lib/controls-context'
import { useRoom } from '@/lib/room-context'
import { useMobile } from '@/lib/mobile-context'
import { usePermissions } from '@/lib/hooks/use-permissions'

export function Controls() {
  const { controls } = useControls()
  const { canUndo, canRedo, undo, redo } = useRoom()
  const { isMobile } = useMobile()
  const { canModifyProject } = usePermissions()

  const handleZoomIn = () => {
    if (controls) {
      controls.dolly(-2, true)
    }
  }

  const handleZoomOut = () => {
    if (controls) {
      controls.dolly(2, true)
    }
  }

  const handleRotate = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (controls) {
      switch (direction) {
        case 'up':
          controls.rotate(0, -0.2, true)
          break
        case 'down':
          controls.rotate(0, 0.2, true)
          break
        case 'left':
          controls.rotate(0.2, 0, true)
          break
        case 'right':
          controls.rotate(-0.2, 0, true)
          break
      }
    }
  }

  const handlePan = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (controls) {
      switch (direction) {
        case 'up':
          controls.truck(0, 1, true)
          break
        case 'down':
          controls.truck(0, -1, true)
          break
        case 'left':
          controls.truck(-1, 0, true)
          break
        case 'right':
          controls.truck(1, 0, true)
          break
      }
    }
  }

  const handleReset = () => {
    if (controls) {
      controls.setPosition(0, 0, 18.5, true)
      controls.setTarget(0, 0, 0, true)
    }
  }

  // Mobile: Simplified controls with larger touch targets (44x44px)
  // Desktop: Full controls
  if (isMobile) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-floral-white rounded-2xl px-4 py-3 shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)] border border-taupe/[0.03] z-40">
        <div className="flex items-center gap-4">
          {/* Zoom Controls - Larger for touch */}
          <button
            onClick={handleZoomIn}
            className="w-11 h-11 rounded-xl bg-taupe/10 active:bg-taupe/30 transition-colors flex items-center justify-center text-graphite text-xl font-semibold font-body"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-11 h-11 rounded-xl bg-taupe/10 active:bg-taupe/30 transition-colors flex items-center justify-center text-graphite text-xl font-semibold font-body"
            title="Zoom Out"
          >
            −
          </button>

          <div className="w-px h-8 bg-taupe/10" />

          {/* Reset View */}
          <button
            onClick={handleReset}
            className="w-11 h-11 rounded-xl bg-taupe/10 active:bg-taupe/30 transition-colors flex items-center justify-center text-graphite text-lg"
            title="Reset View"
          >
            ⌂
          </button>
        </div>
      </div>
    )
  }

  // Desktop: Full controls
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-floral-white rounded-2xl px-4 py-2.5 shadow-[0_2px_12px_-2px_rgba(72,57,42,0.06)] border border-taupe/[0.03] z-40">
      <div className="flex items-center gap-3">
        {/* Undo/Redo - Only show if can modify project */}
        {canModifyProject && (
          <>
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center ${
                canUndo
                  ? 'bg-taupe/10 text-graphite hover:bg-taupe/20'
                  : 'bg-taupe/5 text-taupe/30 cursor-not-allowed'
              }`}
              title="Undo"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`w-7 h-7 rounded-lg transition-colors flex items-center justify-center ${
                canRedo
                  ? 'bg-taupe/10 text-graphite hover:bg-taupe/20'
                  : 'bg-taupe/5 text-taupe/30 cursor-not-allowed'
              }`}
              title="Redo"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
              </svg>
            </button>

            <div className="w-px h-5 bg-taupe/10" />
          </>
        )}

        {/* Zoom Controls */}
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite text-base font-semibold font-body"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite text-base font-semibold font-body"
          title="Zoom Out"
        >
          −
        </button>

        <div className="w-px h-5 bg-taupe/10" />

        {/* Pan Controls */}
        <button
          onClick={() => handlePan('left')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Pan Left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => handlePan('up')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Pan Up"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        <button
          onClick={() => handlePan('down')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Pan Down"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => handlePan('right')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Pan Right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div className="w-px h-5 bg-taupe/10" />

        {/* Rotation Controls */}
        <button
          onClick={() => handleRotate('left')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Rotate Left"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          onClick={() => handleRotate('right')}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite"
          title="Rotate Right"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotate-180">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        <div className="w-px h-5 bg-taupe/10" />

        {/* Reset View */}
        <button
          onClick={handleReset}
          className="w-7 h-7 rounded-lg bg-taupe/10 hover:bg-taupe/20 transition-colors flex items-center justify-center text-graphite text-sm"
          title="Reset View"
        >
          ⌂
        </button>
      </div>
    </div>
  )
}
