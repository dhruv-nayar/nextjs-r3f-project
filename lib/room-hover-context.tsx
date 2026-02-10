'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface RoomHoverContextType {
  hoveredRoomId: string | null
  setHoveredRoomId: (id: string | null) => void
}

const RoomHoverContext = createContext<RoomHoverContextType | undefined>(undefined)

export function RoomHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)

  return (
    <RoomHoverContext.Provider value={{ hoveredRoomId, setHoveredRoomId }}>
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
