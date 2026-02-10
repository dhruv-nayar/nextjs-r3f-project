'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface FurnitureSelectionContextType {
  selectedFurnitureId: string | null
  setSelectedFurnitureId: (id: string | null) => void
}

const FurnitureSelectionContext = createContext<FurnitureSelectionContextType | undefined>(undefined)

export function FurnitureSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null)

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
