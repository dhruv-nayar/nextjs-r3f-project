'use client'

import { useControls } from '@/lib/controls-context'
import { useRoom } from '@/lib/room-context'

export function Controls() {
  const { controls } = useControls()
  const { canUndo, canRedo, undo, redo } = useRoom()

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

  const handleReset = () => {
    if (controls) {
      controls.setPosition(0, 0, 18.5, true)
      controls.setTarget(0, 0, 0, true)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-taupe/90 backdrop-blur-md rounded-full px-6 py-3 shadow-xl border border-taupe/20 z-40">
      <div className="flex items-center gap-4">
        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
            canUndo
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Undo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`w-8 h-8 rounded-lg transition-colors flex items-center justify-center ${
            canRedo
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
          }`}
          title="Redo"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Zoom Controls */}
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white text-lg font-bold"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white text-lg font-bold"
          title="Zoom Out"
        >
          −
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Rotation Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRotate('up')}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
            title="Rotate Up"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleRotate('left')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              title="Rotate Left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotate-[-90deg]">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white text-xs"
              title="Reset View"
            >
              ⌂
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleRotate('right')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              title="Rotate Right"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotate-90">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={() => handleRotate('down')}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
              title="Rotate Down"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="rotate-180">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
