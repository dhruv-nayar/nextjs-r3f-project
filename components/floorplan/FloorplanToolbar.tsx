'use client'

import { EditorMode } from '@/types/floorplan-v2'

interface FloorplanToolbarProps {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
}

export function FloorplanToolbar({ mode, onModeChange }: FloorplanToolbarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Select Tool Button */}
      <button
        onClick={() => onModeChange(EditorMode.SELECT)}
        className={`
          px-4 py-3 rounded-md font-medium font-body text-sm transition-colors
          flex items-center gap-3 w-full justify-start
          ${mode === EditorMode.SELECT
            ? 'bg-sage text-white'
            : 'bg-porcelain text-graphite hover:bg-taupe/10'
          }
        `}
        title="Select (V)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        </svg>
        <span>Select</span>
        <span className="ml-auto text-xs opacity-70">V</span>
      </button>

      {/* Draw Walls Tool Button */}
      <button
        onClick={() => onModeChange(EditorMode.DRAW_WALLS)}
        className={`
          px-4 py-3 rounded-md font-medium font-body text-sm transition-colors
          flex items-center gap-3 w-full justify-start
          ${mode === EditorMode.DRAW_WALLS
            ? 'bg-sage text-white'
            : 'bg-porcelain text-graphite hover:bg-taupe/10'
          }
        `}
        title="Draw Walls (W)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        <span>Draw Walls</span>
        <span className="ml-auto text-xs opacity-70">W</span>
      </button>

      {/* Door placement moved to 3D view */}
    </div>
  )
}
