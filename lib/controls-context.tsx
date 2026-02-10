'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
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

  return (
    <ControlsContext.Provider value={{ controls, setControls }}>
      {children}
    </ControlsContext.Provider>
  )
}

export function useControls() {
  return useContext(ControlsContext)
}
