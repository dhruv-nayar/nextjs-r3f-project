'use client'

import { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import type CameraControlsImpl from 'camera-controls'

const ControlsContext = createContext<{
  controls: CameraControlsImpl | null
  setControls: (controls: CameraControlsImpl | null) => void
}>({
  controls: null,
  setControls: () => {}
})

export function ControlsProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<CameraControlsImpl | null>(null)

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ controls, setControls }), [controls])

  return (
    <ControlsContext.Provider value={value}>
      {children}
    </ControlsContext.Provider>
  )
}

export function useControls() {
  return useContext(ControlsContext)
}
