'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useHome } from './home-context'

interface FurnitureSelectionContextType {
  selectedFurnitureId: string | null
  setSelectedFurnitureId: (id: string | null) => void
}

const FurnitureSelectionContext = createContext<FurnitureSelectionContextType | undefined>(undefined)

export function FurnitureSelectionProvider({ children }: { children: ReactNode }) {
  const { currentHome } = useHome()
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null)

  // Track home ID to reset selection when switching projects
  const prevHomeIdRef = useRef<string | null>(null)

  // Reset selection when switching to a different home/project
  useEffect(() => {
    const currentHomeId = currentHome?.id || null

    if (prevHomeIdRef.current !== null && prevHomeIdRef.current !== currentHomeId) {
      // Home changed - clear selection to prevent stale references
      console.log('[FurnitureSelectionContext] Home changed, clearing selection')
      setSelectedFurnitureId(null)
    }

    prevHomeIdRef.current = currentHomeId
  }, [currentHome?.id])

  return (
    <FurnitureSelectionContext.Provider value={{ selectedFurnitureId, setSelectedFurnitureId }}>
      {children}
    </FurnitureSelectionContext.Provider>
  )
}

export function useFurnitureSelection() {
  const context = useContext(FurnitureSelectionContext)
  if (context === undefined) {
    throw new Error('useFurnitureSelection must be used within a FurnitureSelectionProvider')
  }
  return context
}
