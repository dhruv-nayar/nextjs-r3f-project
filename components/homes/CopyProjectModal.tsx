'use client'

import { useState } from 'react'
import { Home } from '@/types/room'
import { CopyMode } from '@/lib/utils/copy-home'

interface CopyProjectModalProps {
  home: Home
  isOpen: boolean
  onClose: () => void
  onCopy: (mode: CopyMode) => void
}

export function CopyProjectModal({ home, isOpen, onClose, onCopy }: CopyProjectModalProps) {
  const [isCopying, setIsCopying] = useState(false)

  if (!isOpen) return null

  const totalItems = home.rooms.reduce((sum, room) =>
    sum + (room.instances?.length || 0), 0
  )

  const handleCopy = (mode: CopyMode) => {
    setIsCopying(true)
    onCopy(mode)
    // Parent will close modal after success
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isCopying) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-graphite/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-floral-white border border-taupe/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-graphite text-xl font-display font-semibold">
            Copy Project
          </h3>
          <button
            onClick={onClose}
            disabled={isCopying}
            className="text-taupe/60 hover:text-graphite text-2xl leading-none disabled:opacity-50 w-8 h-8 flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-graphite/70 font-body mb-6">
          Create a copy of <strong className="text-graphite">{home.name}</strong>
        </p>

        {/* Options */}
        <div className="space-y-3">
          {/* Floorplan Only */}
          <button
            onClick={() => handleCopy('floorplan-only')}
            disabled={isCopying}
            className="w-full p-4 text-left rounded-xl border-2 border-taupe/20 hover:border-sage hover:bg-sage/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-taupe/10 flex items-center justify-center flex-shrink-0 group-hover:bg-sage/10 transition-colors">
                <svg className="w-5 h-5 text-taupe/70 group-hover:text-sage transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h4 className="font-display font-semibold text-graphite">
                  Floorplan Only
                </h4>
                <p className="text-sm text-taupe/70 font-body mt-0.5">
                  Copy walls, doors, and room layout without furniture
                </p>
              </div>
            </div>
          </button>

          {/* With Furniture */}
          <button
            onClick={() => handleCopy('with-furniture')}
            disabled={isCopying}
            className="w-full p-4 text-left rounded-xl border-2 border-taupe/20 hover:border-sage hover:bg-sage/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-taupe/10 flex items-center justify-center flex-shrink-0 group-hover:bg-sage/10 transition-colors">
                <svg className="w-5 h-5 text-taupe/70 group-hover:text-sage transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h4 className="font-display font-semibold text-graphite">
                  With Furniture
                </h4>
                <p className="text-sm text-taupe/70 font-body mt-0.5">
                  Copy everything including {totalItems} item{totalItems !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={isCopying}
          className="w-full mt-4 px-4 py-2.5 bg-taupe/10 hover:bg-taupe/20 text-graphite rounded-lg font-medium font-body transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
