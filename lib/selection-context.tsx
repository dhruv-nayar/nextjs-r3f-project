'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import {
  Selection,
  WallSide,
  isRoomSelection,
  isWallSelection,
  isFloorSelection,
  isFurnitureSelection,
} from '@/types/selection'

interface SelectionContextType {
  // Current selection state
  selection: Selection
  setSelection: (selection: Selection) => void
  clearSelection: () => void

  // Convenience methods for setting specific selection types
  selectRoom: (roomId: string) => void
  selectWall: (roomId: string, side: WallSide) => void
  selectFloor: (roomId: string) => void
  selectFurniture: (instanceId: string, roomId: string) => void

  // Type-specific selection checkers
  isRoomSelected: (roomId: string) => boolean
  isWallSelected: (roomId: string, side: WallSide) => boolean
  isFloorSelected: (roomId: string) => boolean
  isFurnitureSelected: (instanceId: string) => boolean

  // Get selected room ID (works for any selection type)
  getSelectedRoomId: () => string | null

  // Hover state for visual feedback
  hoveredItem: Selection
  setHoveredItem: (item: Selection) => void
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<Selection>(null)
  const [hoveredItem, setHoveredItem] = useState<Selection>(null)

  const setSelection = useCallback((newSelection: Selection) => {
    setSelectionState(newSelection)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectionState(null)
  }, [])

  // Convenience methods
  const selectRoom = useCallback((roomId: string) => {
    setSelectionState({ type: 'room', roomId })
  }, [])

  const selectWall = useCallback((roomId: string, side: WallSide) => {
    setSelectionState({ type: 'wall', roomId, side })
  }, [])

  const selectFloor = useCallback((roomId: string) => {
    setSelectionState({ type: 'floor', roomId })
  }, [])

  const selectFurniture = useCallback((instanceId: string, roomId: string) => {
    setSelectionState({ type: 'furniture', instanceId, roomId })
  }, [])

  // Type-specific checkers
  const isRoomSelectedFn = useCallback(
    (roomId: string) => {
      return isRoomSelection(selection) && selection.roomId === roomId
    },
    [selection]
  )

  const isWallSelectedFn = useCallback(
    (roomId: string, side: WallSide) => {
      return isWallSelection(selection) && selection.roomId === roomId && selection.side === side
    },
    [selection]
  )

  const isFloorSelectedFn = useCallback(
    (roomId: string) => {
      return isFloorSelection(selection) && selection.roomId === roomId
    },
    [selection]
  )

  const isFurnitureSelectedFn = useCallback(
    (instanceId: string) => {
      return isFurnitureSelection(selection) && selection.instanceId === instanceId
    },
    [selection]
  )

  const getSelectedRoomId = useCallback(() => {
    if (!selection) return null
    if (isRoomSelection(selection)) return selection.roomId
    if (isWallSelection(selection)) return selection.roomId
    if (isFloorSelection(selection)) return selection.roomId
    if (isFurnitureSelection(selection)) return selection.roomId
    return null
  }, [selection])

  const value: SelectionContextType = {
    selection,
    setSelection,
    clearSelection,
    selectRoom,
    selectWall,
    selectFloor,
    selectFurniture,
    isRoomSelected: isRoomSelectedFn,
    isWallSelected: isWallSelectedFn,
    isFloorSelected: isFloorSelectedFn,
    isFurnitureSelected: isFurnitureSelectedFn,
    getSelectedRoomId,
    hoveredItem,
    setHoveredItem,
  }

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

export function useSelection() {
  const context = useContext(SelectionContext)
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}

/**
 * Compatibility hook that mimics the old useFurnitureSelection API
 * Use this during migration, then switch to useSelection directly
 */
export function useFurnitureSelectionCompat() {
  const { selection, selectFurniture, clearSelection, isFurnitureSelected } = useSelection()

  const selectedFurnitureId = isFurnitureSelection(selection) ? selection.instanceId : null

  const setSelectedFurnitureId = useCallback(
    (id: string | null) => {
      if (id === null) {
        clearSelection()
      } else {
        // Note: This requires knowing the roomId, which we don't have here
        // For backwards compat, we'll set a placeholder that will be updated
        // when the furniture is actually selected via click
        selectFurniture(id, '')
      }
    },
    [clearSelection, selectFurniture]
  )

  return { selectedFurnitureId, setSelectedFurnitureId }
}
