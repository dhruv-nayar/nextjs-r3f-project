'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Vector3 } from '@/types/room'

export type InteractionMode =
  | 'idle'           // Nothing happening - default state
  | 'camera'         // Panning/rotating camera (Space held)
  | 'dragging'       // Dragging furniture
  | 'resizing'       // Dragging resize handle
  | 'placing'        // Placing new item (ghost follows cursor)

export interface PlacementState {
  itemId: string | null
  previewPosition: Vector3
}

interface InteractionModeContextType {
  // Current mode
  mode: InteractionMode
  setMode: (mode: InteractionMode) => void

  // Placement state (for adding new items)
  placementState: PlacementState
  startPlacing: (itemId: string) => void
  updatePlacementPosition: (position: Vector3) => void
  confirmPlacement: () => { itemId: string; position: Vector3 } | null
  cancelPlacement: () => void

  // Convenience helpers
  isDraggingObject: boolean
  isCameraActive: boolean
  isPlacing: boolean
}

const InteractionModeContext = createContext<InteractionModeContextType | null>(null)

export function InteractionModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeInternal] = useState<InteractionMode>('idle')
  const [placementState, setPlacementState] = useState<PlacementState>({
    itemId: null,
    previewPosition: { x: 0, y: 0, z: 0 }
  })

  const setMode = useCallback((newMode: InteractionMode) => {
    setModeInternal(newMode)
  }, [])

  const startPlacing = useCallback((itemId: string) => {
    setPlacementState({
      itemId,
      previewPosition: { x: 0, y: 0, z: 0 }
    })
    setModeInternal('placing')
  }, [])

  const updatePlacementPosition = useCallback((position: Vector3) => {
    setPlacementState(prev => ({
      ...prev,
      previewPosition: position
    }))
  }, [])

  const confirmPlacement = useCallback(() => {
    if (!placementState.itemId) return null

    const result = {
      itemId: placementState.itemId,
      position: placementState.previewPosition
    }

    // Reset placement state
    setPlacementState({
      itemId: null,
      previewPosition: { x: 0, y: 0, z: 0 }
    })
    setModeInternal('idle')

    return result
  }, [placementState])

  const cancelPlacement = useCallback(() => {
    setPlacementState({
      itemId: null,
      previewPosition: { x: 0, y: 0, z: 0 }
    })
    setModeInternal('idle')
  }, [])

  // Convenience helpers
  const isDraggingObject = mode === 'dragging' || mode === 'resizing'
  const isCameraActive = mode === 'camera'
  const isPlacing = mode === 'placing'

  return (
    <InteractionModeContext.Provider value={{
      mode,
      setMode,
      placementState,
      startPlacing,
      updatePlacementPosition,
      confirmPlacement,
      cancelPlacement,
      isDraggingObject,
      isCameraActive,
      isPlacing,
    }}>
      {children}
    </InteractionModeContext.Provider>
  )
}

export function useInteractionMode() {
  const context = useContext(InteractionModeContext)
  if (!context) {
    throw new Error('useInteractionMode must be used within an InteractionModeProvider')
  }
  return context
}
