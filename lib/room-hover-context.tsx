'use client'

import { createContext, useContext, useState, useMemo, ReactNode } from 'react'

interface RoomHoverContextType {
  hoveredRoomId: string | null
  setHoveredRoomId: (id: string | null) => void
}

const RoomHoverContext = createContext<RoomHoverContextType | undefined>(undefined)

export function RoomHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ hoveredRoomId, setHoveredRoomId }), [hoveredRoomId])

  return (
    <RoomHoverContext.Provider value={value}>
      {children}
    </RoomHoverContext.Provider>
  )
}

export function useRoomHover() {
  const context = useContext(RoomHoverContext)
  if (context === undefined) {
    throw new Error('useRoomHover must be used within a RoomHoverProvider')
  }
  return context
}
