'use client'

import { useEffect, useState } from 'react'
import { useHome } from '@/lib/home-context'
import { useItemLibrary } from '@/lib/item-library-context'

export function AutoSaveIndicator() {
  const { homes } = useHome()
  const { items } = useItemLibrary()
  const [showSaving, setShowSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Show saving indicator when data changes
  useEffect(() => {
    setShowSaving(true)
    setLastSaved(new Date())

    const timer = setTimeout(() => {
      setShowSaving(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [homes, items])

  if (!showSaving && !lastSaved) return null

  return (
    <div className="fixed top-20 right-6 z-30">
      <div
        className={`px-4 py-2 rounded-lg backdrop-blur-md transition-all ${
          showSaving
            ? 'bg-blue-600/90 border border-blue-400/50'
            : 'bg-black/60 border border-white/10'
        }`}
      >
        <div className="flex items-center gap-2">
          {showSaving ? (
            <>
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-medium">Saving...</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-white/70 text-sm">
                Saved {lastSaved && new Date().getTime() - lastSaved.getTime() < 60000
                  ? 'just now'
                  : 'recently'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
