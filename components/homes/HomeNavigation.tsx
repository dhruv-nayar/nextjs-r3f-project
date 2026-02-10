'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useHome } from '@/lib/home-context'
import { HomeCreation } from './HomeCreation'

export function HomeNavigation() {
  const { homes, currentHomeId, switchHome, deleteHome } = useHome()
  const [showCreation, setShowCreation] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const currentHome = homes.find(h => h.id === currentHomeId)

  return (
    <>
      <div className="fixed top-6 left-6 z-40">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 px-4 py-3 bg-black/60 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 hover:bg-black/70 transition-colors"
          >
            <span className="text-2xl">🏠</span>
            <div className="text-left">
              <div className="text-white font-semibold text-sm">
                {currentHome?.name || 'No Home Selected'}
              </div>
              <div className="text-white/50 text-xs">
                {currentHome?.rooms.length || 0} room{currentHome?.rooms.length !== 1 ? 's' : ''}
              </div>
            </div>
            <span className="text-white/70 text-sm">{showDropdown ? '▼' : '▶'}</span>
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full mt-2 left-0 w-80 bg-black/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 py-2 max-h-96 overflow-y-auto">
              {/* Back to Homes Link */}
              <Link
                href="/homes"
                className="flex items-center gap-2 px-4 py-3 text-white/70 hover:text-white hover:bg-white/10 transition-colors border-b border-white/10"
              >
                <span>←</span>
                <span>All Homes</span>
              </Link>

              {/* Homes List */}
              {homes.map((home) => (
                <div
                  key={home.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors ${
                    home.id === currentHomeId ? 'bg-white/5' : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      switchHome(home.id)
                      setShowDropdown(false)
                    }}
                    className="flex-1 text-left"
                  >
                    <div className="text-white font-medium">{home.name}</div>
                    <div className="text-white/50 text-xs">
                      {home.rooms.length} room{home.rooms.length !== 1 ? 's' : ''}
                    </div>
                  </button>

                  {home.id !== 'example-home' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${home.name}"?`)) {
                          deleteHome(home.id)
                        }
                      }}
                      className="text-red-400 hover:text-red-300 text-sm px-2"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              {/* Create New Home Button */}
              <button
                onClick={() => {
                  setShowCreation(true)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-3 mt-2 border-t border-white/10 text-blue-400 hover:bg-white/10 transition-colors text-left flex items-center gap-2"
              >
                <span>+</span>
                <span>Create New Home</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {showCreation && <HomeCreation onClose={() => setShowCreation(false)} />}
    </>
  )
}
