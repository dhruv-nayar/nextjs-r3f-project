'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ResizeModeContextType {
  isResizeMode: boolean
  setResizeMode: (enabled: boolean) => void
  activeAxis: 'x' | 'y' | 'z' | null
  setActiveAxis: (axis: 'x' | 'y' | 'z' | null) => void
}

const ResizeModeContext = createContext<ResizeModeContextType | null>(null)

export function ResizeModeProvider({ children }: { children: ReactNode }) {
  const [isResizeMode, setIsResizeMode] = useState(false)
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z' | null>(null)

  const setResizeMode = (enabled: boolean) => {
    setIsResizeMode(enabled)
    // Clear active axis when exiting resize mode
    if (!enabled) {
      setActiveAxis(null)
    }
  }

  return (
    <ResizeModeContext.Provider value={{
      isResizeMode,
      setResizeMode,
      activeAxis,
      setActiveAxis,
    }}>
      {children}
    </ResizeModeContext.Provider>
  )
}

export function useResizeMode() {
  const context = useContext(ResizeModeContext)
  if (!context) {
    throw new Error('useResizeMode must be used within a ResizeModeProvider')
  }
  return context
}
