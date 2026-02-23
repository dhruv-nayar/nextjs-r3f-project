'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useHome } from './home-context'

// Multi-drag state for coordinating movement of multiple items
interface MultiDragState {
  anchorId: string
  startPositions: Map<string, { x: number; z: number }>
  currentDelta: { x: number; z: number }
}

interface FurnitureSelectionContextType {
  // Multi-select state
  selectedInstanceIds: string[]

  // Multi-select methods
  selectInstance: (id: string, addToSelection?: boolean) => void
  toggleInstanceSelection: (id: string) => void
  clearInstanceSelection: () => void
  isInstanceSelected: (id: string) => boolean

  // Multi-drag coordination
  multiDragState: MultiDragState | null
  startMultiDrag: (anchorId: string, startPositions: Map<string, { x: number; z: number }>) => void
  updateMultiDragDelta: (deltaX: number, deltaZ: number) => void
  endMultiDrag: () => Map<string, { x: number; z: number }> | null
  getMultiDragPosition: (instanceId: string) => { x: number; z: number } | null

  // Backwards compatibility - returns first selected or null
  selectedFurnitureId: string | null
  setSelectedFurnitureId: (id: string | null) => void
}

const FurnitureSelectionContext = createContext<FurnitureSelectionContextType | undefined>(undefined)

export function FurnitureSelectionProvider({ children }: { children: ReactNode }) {
  const { currentHome } = useHome()
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([])

  // Multi-drag state - using ref for performance (updates every frame during drag)
  const multiDragStateRef = useRef<MultiDragState | null>(null)
  // Force re-render trigger for when drag starts/ends
  const [, setDragVersion] = useState(0)

  // Track home ID to reset selection when switching projects
  const prevHomeIdRef = useRef<string | null>(null)

  // Reset selection when switching to a different home/project
  useEffect(() => {
    const currentHomeId = currentHome?.id || null

    if (prevHomeIdRef.current !== null && prevHomeIdRef.current !== currentHomeId) {
      // Home changed - clear selection to prevent stale references
      console.log('[FurnitureSelectionContext] Home changed, clearing selection')
      setSelectedInstanceIds([])
    }

    prevHomeIdRef.current = currentHomeId
  }, [currentHome?.id])

  // Select an instance - optionally add to existing selection
  const selectInstance = useCallback((id: string, addToSelection = false) => {
    setSelectedInstanceIds(prev => {
      if (addToSelection) {
        // Add to selection if not already selected
        if (prev.includes(id)) return prev
        return [...prev, id]
      }
      // Replace selection with just this item
      return [id]
    })
  }, [])

  // Toggle selection state of an instance
  const toggleInstanceSelection = useCallback((id: string) => {
    setSelectedInstanceIds(prev => {
      if (prev.includes(id)) {
        // Remove from selection
        return prev.filter(existingId => existingId !== id)
      }
      // Add to selection
      return [...prev, id]
    })
  }, [])

  // Clear all instance selection
  const clearInstanceSelection = useCallback(() => {
    setSelectedInstanceIds([])
  }, [])

  // Check if an instance is selected
  const isInstanceSelected = useCallback((id: string) => {
    return selectedInstanceIds.includes(id)
  }, [selectedInstanceIds])

  // Multi-drag methods
  const startMultiDrag = useCallback((anchorId: string, startPositions: Map<string, { x: number; z: number }>) => {
    multiDragStateRef.current = {
      anchorId,
      startPositions,
      currentDelta: { x: 0, z: 0 }
    }
    setDragVersion(v => v + 1) // Trigger re-render so items know drag started
  }, [])

  const updateMultiDragDelta = useCallback((deltaX: number, deltaZ: number) => {
    if (multiDragStateRef.current) {
      multiDragStateRef.current.currentDelta = { x: deltaX, z: deltaZ }
    }
  }, [])

  const endMultiDrag = useCallback((): Map<string, { x: number; z: number }> | null => {
    const state = multiDragStateRef.current
    if (!state) return null

    // Calculate final positions for all items
    const finalPositions = new Map<string, { x: number; z: number }>()
    state.startPositions.forEach((startPos, instanceId) => {
      finalPositions.set(instanceId, {
        x: startPos.x + state.currentDelta.x,
        z: startPos.z + state.currentDelta.z
      })
    })

    multiDragStateRef.current = null
    setDragVersion(v => v + 1) // Trigger re-render so items know drag ended
    return finalPositions
  }, [])

  // Get current position for an instance during multi-drag (used by non-anchor items in useFrame)
  const getMultiDragPosition = useCallback((instanceId: string): { x: number; z: number } | null => {
    const state = multiDragStateRef.current
    if (!state) return null

    const startPos = state.startPositions.get(instanceId)
    if (!startPos) return null

    return {
      x: startPos.x + state.currentDelta.x,
      z: startPos.z + state.currentDelta.z
    }
  }, [])

  // Expose multiDragState for reading (components check if drag is active)
  const multiDragState = multiDragStateRef.current

  // Backwards compatibility: get first selected ID or null
  const selectedFurnitureId = selectedInstanceIds.length > 0 ? selectedInstanceIds[0] : null

  // Backwards compatibility: set single selection
  const setSelectedFurnitureId = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedInstanceIds([])
    } else {
      setSelectedInstanceIds([id])
    }
  }, [])

  return (
    <FurnitureSelectionContext.Provider value={{
      selectedInstanceIds,
      selectInstance,
      toggleInstanceSelection,
      clearInstanceSelection,
      isInstanceSelected,
      multiDragState,
      startMultiDrag,
      updateMultiDragDelta,
      endMultiDrag,
      getMultiDragPosition,
      selectedFurnitureId,
      setSelectedFurnitureId
    }}>
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
