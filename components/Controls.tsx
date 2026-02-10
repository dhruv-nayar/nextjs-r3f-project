'use client'

import { useControls } from '@/lib/controls-context'

export function Controls() {
  const { controls } = useControls()

  const handleZoomIn = () => {
    console.log('Zoom in clicked, controls:', controls)
    if (controls) {
      controls.dolly(-2, true)
    }
  }

  const handleZoomOut = () => {
    console.log('Zoom out clicked, controls:', controls)
    if (controls) {
      controls.dolly(2, true)
    }
  }

  const handlePan = (x: number, y: number) => {
    if (controls) {
      controls.truck(x * 0.5, y * 0.5, true)
    }
  }

  const handleReset = () => {
    if (controls) {
      controls.setPosition(0, 0, 18.5, true)
      controls.setTarget(0, 0, 0, true)
    }
  }

  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 bg-black/60 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10">
      <div className="flex flex-col gap-6">
        {/* Zoom Controls */}
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Zoom</p>
          <button
            onClick={handleZoomIn}
            className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white text-xl font-bold"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white text-xl font-bold"
            title="Zoom Out"
          >
            −
          </button>
        </div>

        {/* Pan Controls */}
        <div className="flex flex-col gap-2">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wider mb-1">Pan</p>
          <div className="grid grid-cols-3 gap-1">
            <div></div>
            <button
              onClick={() => handlePan(0, 1)}
              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white"
              title="Pan Up"
            >
              ↑
            </button>
            <div></div>
            <button
              onClick={() => handlePan(-1, 0)}
              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white"
              title="Pan Left"
            >
              ←
            </button>
            <button
              onClick={handleReset}
              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white text-xs"
              title="Reset Position"
            >
              ⌂
            </button>
            <button
              onClick={() => handlePan(1, 0)}
              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white"
              title="Pan Right"
            >
              →
            </button>
            <div></div>
            <button
              onClick={() => handlePan(0, -1)}
              className="w-12 h-12 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors flex items-center justify-center text-white"
              title="Pan Down"
            >
              ↓
            </button>
            <div></div>
          </div>
        </div>
      </div>
    </div>
  )
}
