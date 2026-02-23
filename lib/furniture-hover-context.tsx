'use client'

import { createContext, useContext, useState, useMemo, ReactNode } from 'react'

interface FurnitureHoverContextType {
  hoveredFurnitureId: string | null
  setHoveredFurnitureId: (id: string | null) => void
}

const FurnitureHoverContext = createContext<FurnitureHoverContextType | undefined>(undefined)

export function FurnitureHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredFurnitureId, setHoveredFurnitureId] = useState<string | null>(null)

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ hoveredFurnitureId, setHoveredFurnitureId }), [hoveredFurnitureId])

  return (
    <FurnitureHoverContext.Provider value={value}>
      {children}
    </FurnitureHoverContext.Provider>
  )
}

export function useFurnitureHover() {
  const context = useContext(FurnitureHoverContext)
  if (context === undefined) {
    throw new Error('useFurnitureHover must be used within a FurnitureHoverProvider')
  }
  return context
}
