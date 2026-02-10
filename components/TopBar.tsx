'use client'

import { useRoom } from '@/lib/room-context'

export function TopBar() {
  const { canUndo, canRedo, undo, redo } = useRoom()

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 px-4 py-2 flex items-center gap-2 z-50">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          canUndo
            ? 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
            : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z / Cmd+Z)"
      >
        <span className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
          Undo
        </span>
      </button>

      <div className="w-px h-6 bg-white/20" />

      <button
        onClick={redo}
        disabled={!canRedo}
        className={`px-4 py-2 rounded-lg font-medium transition-all ${
          canRedo
            ? 'bg-white/10 text-white hover:bg-white/20 hover:scale-105'
            : 'bg-white/5 text-white/30 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y)"
      >
        <span className="flex items-center gap-2">
          Redo
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </span>
      </button>
    </div>
  )
}
