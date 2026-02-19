'use client'

/**
 * WallSegmentsContext
 *
 * Shared context for V3 wall segment data and selection state.
 * Automatically migrates V2 data to V3 format.
 */

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react'
import { useHome } from './home-context'
import type { FloorplanDataV3, FloorplanRoomV3 } from '@/types/floorplan-v2'
import type { WallSideStyle, WallSegmentDoor } from '@/types/wall-segment'
import { migrateV2ToV3, updateSegmentStyle, getRoomNameForSide } from './wall-migration'
import {
  getSegmentLength,
  canPlaceDoor,
  addDoorToSegment,
  removeDoorFromSegment,
  findValidDoorPosition,
  DEFAULT_DOOR_WIDTH,
  DEFAULT_DOOR_HEIGHT,
} from './wall-segment-utils'

interface WallSegmentsContextType {
  // V3 floorplan data (migrated or loaded)
  floorplanV3: FloorplanDataV3 | null

  // Whether we're using V3 wall rendering
  useV3Rendering: boolean

  // Selection state for wall sides
  selectedSegmentId: string | null
  selectedSide: 'A' | 'B' | null

  // Door placement mode
  doorPlacementMode: boolean
  setDoorPlacementMode: (mode: boolean) => void

  // Actions
  selectWallSide: (segmentId: string, side: 'A' | 'B') => void
  clearWallSelection: () => void
  updateWallStyle: (segmentId: string, side: 'A' | 'B', updates: Partial<WallSideStyle>) => void

  // Door actions
  addDoor: (segmentId: string, position: number, width?: number, height?: number) => boolean
  removeDoor: (segmentId: string, doorId: string) => void
  canAddDoor: (segmentId: string, position: number, width?: number, height?: number) => { valid: boolean; message: string | null }
  findValidDoorPosition: (segmentId: string, requestedPosition: number, width?: number, height?: number) => number | null

  // Helpers
  getRoomName: (segmentId: string, side: 'A' | 'B') => string
  getSegmentLength: (segmentId: string) => number
}

const WallSegmentsContext = createContext<WallSegmentsContextType | undefined>(undefined)

export function WallSegmentsProvider({ children }: { children: ReactNode }) {
  const { currentHome, setFloorplanDataV3 } = useHome()

  // Local state for V3 data (synced to home context for persistence)
  const [localV3Data, setLocalV3Data] = useState<FloorplanDataV3 | null>(null)

  // Track the V2 data to detect when it changes (new floorplan)
  const prevV2DataRef = useRef<string | null>(null)

  // Reset local V3 data when V2 data changes (user created/edited floorplan)
  useEffect(() => {
    // Create a simple hash of the V2 data to detect changes
    const v2DataHash = currentHome?.floorplanDataV2
      ? JSON.stringify({
          walls: currentHome.floorplanDataV2.walls.length,
          vertices: currentHome.floorplanDataV2.vertices.length,
          rooms: currentHome.floorplanDataV2.rooms.length,
          // Include a sample of IDs to detect structural changes
          wallIds: currentHome.floorplanDataV2.walls.slice(0, 3).map(w => w.id),
        })
      : null

    if (prevV2DataRef.current !== null && prevV2DataRef.current !== v2DataHash) {
      // V2 data changed - reset local V3 data to trigger re-migration
      console.log('[WallSegmentsContext] V2 data changed, resetting local V3 data')
      setLocalV3Data(null)
      setSelectedSegmentId(null)
      setSelectedSide(null)
    }

    prevV2DataRef.current = v2DataHash
  }, [currentHome?.floorplanDataV2])

  // Load V3 data from home context on mount/home change
  useEffect(() => {
    if (currentHome?.floorplanDataV3 && !localV3Data) {
      console.log('[WallSegmentsContext] Loading V3 data from home context')
      setLocalV3Data(currentHome.floorplanDataV3)
    }
  }, [currentHome?.floorplanDataV3, currentHome?.id])

  // Sync local V3 data changes to home context (for persistence/auto-save)
  useEffect(() => {
    if (localV3Data && currentHome?.id) {
      console.log('[WallSegmentsContext] Syncing V3 data to home context for auto-save')
      setFloorplanDataV3(currentHome.id, localV3Data)
    }
  }, [localV3Data, currentHome?.id, setFloorplanDataV3])

  // Selection state - SHARED across all consumers
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [selectedSide, setSelectedSide] = useState<'A' | 'B' | null>(null)

  // Door placement mode
  const [doorPlacementMode, setDoorPlacementModeInternal] = useState(false)

  // Wrap setter with logging
  const setDoorPlacementMode = useCallback((mode: boolean) => {
    console.log('[WallSegmentsContext] setDoorPlacementMode:', mode)
    setDoorPlacementModeInternal(mode)
  }, [])

  // Get or migrate V3 data
  const floorplanV3 = useMemo(() => {
    // If we have local V3 data (with style updates), use it
    if (localV3Data) {
      return localV3Data
    }

    // If home has V2 data, migrate it
    if (currentHome?.floorplanDataV2) {
      console.log('[WallSegmentsContext] Migrating V2 data to V3')
      const migrated = migrateV2ToV3(currentHome.floorplanDataV2)
      return migrated
    }

    return null
  }, [currentHome?.floorplanDataV2, localV3Data])

  // Determine if we should use V3 rendering
  const useV3Rendering = useMemo(() => {
    return floorplanV3 !== null && floorplanV3.wallSegments.length > 0
  }, [floorplanV3])

  // Select a wall side
  const selectWallSide = useCallback((segmentId: string, side: 'A' | 'B') => {
    console.log('[WallSegmentsContext] Selecting wall side:', segmentId, side)
    setSelectedSegmentId(segmentId)
    setSelectedSide(side)
  }, [])

  // Clear wall selection
  const clearWallSelection = useCallback(() => {
    console.log('[WallSegmentsContext] Clearing wall selection')
    setSelectedSegmentId(null)
    setSelectedSide(null)
  }, [])

  // Update wall style
  const updateWallStyle = useCallback(
    (segmentId: string, side: 'A' | 'B', updates: Partial<WallSideStyle>) => {
      console.log('[WallSegmentsContext] updateWallStyle called:', segmentId, side, updates)

      // Use functional update to ensure we have the latest data
      setLocalV3Data(prevData => {
        // Get current data - either from prev state or from floorplanV3
        const currentData = prevData || floorplanV3
        if (!currentData) {
          console.warn('[WallSegmentsContext] No floorplan data available')
          return prevData
        }

        console.log('[WallSegmentsContext] Using prevData?', !!prevData, 'segments:', currentData.wallSegments.length)

        // Find the segment being updated
        const targetSegment = currentData.wallSegments.find(s => s.id === segmentId)
        if (!targetSegment) {
          console.warn('[WallSegmentsContext] Segment not found:', segmentId)
          console.log('[WallSegmentsContext] Available segment IDs:', currentData.wallSegments.map(s => s.id))
          return prevData
        }

        // Log BOTH sides before update
        console.log('[WallSegmentsContext] BEFORE update - Segment', segmentId, {
          sideA: targetSegment.sideA.style.color,
          sideB: targetSegment.sideB.style.color,
          updatingSide: side,
          newColor: updates.color,
        })

        const updatedSegments = updateSegmentStyle(
          currentData.wallSegments,
          segmentId,
          side,
          updates
        )

        // Verify BOTH sides after update
        const updatedSegment = updatedSegments.find(s => s.id === segmentId)
        if (updatedSegment) {
          console.log('[WallSegmentsContext] AFTER update - Segment', segmentId, {
            sideA: updatedSegment.sideA.style.color,
            sideB: updatedSegment.sideB.style.color,
          })
        }

        const newData = {
          ...currentData,
          wallSegments: updatedSegments,
          updatedAt: new Date().toISOString(),
        }
        return newData
      })
    },
    [floorplanV3]
  )

  // Get room name for a wall side
  const getRoomName = useCallback(
    (segmentId: string, side: 'A' | 'B'): string => {
      if (!floorplanV3) return 'Unknown'

      const segment = floorplanV3.wallSegments.find(s => s.id === segmentId)
      if (!segment) return 'Unknown'

      return getRoomNameForSide(segment, side, floorplanV3.rooms)
    },
    [floorplanV3]
  )

  // Get segment length
  const getSegmentLengthCb = useCallback(
    (segmentId: string): number => {
      if (!floorplanV3) return 0

      const segment = floorplanV3.wallSegments.find(s => s.id === segmentId)
      if (!segment) return 0

      return getSegmentLength(segment, floorplanV3.vertices)
    },
    [floorplanV3]
  )

  // Check if a door can be placed at a position
  const canAddDoorCb = useCallback(
    (segmentId: string, position: number, width = DEFAULT_DOOR_WIDTH, height = DEFAULT_DOOR_HEIGHT): { valid: boolean; message: string | null } => {
      if (!floorplanV3) return { valid: false, message: 'No floorplan data' }

      const segment = floorplanV3.wallSegments.find(s => s.id === segmentId)
      if (!segment) return { valid: false, message: 'Segment not found' }

      const length = getSegmentLength(segment, floorplanV3.vertices)
      const result = canPlaceDoor(segment, length, position, width, height)

      return { valid: result.valid, message: result.message }
    },
    [floorplanV3]
  )

  // Find a valid door position near requested position
  const findValidDoorPositionCb = useCallback(
    (segmentId: string, requestedPosition: number, width = DEFAULT_DOOR_WIDTH, height = DEFAULT_DOOR_HEIGHT): number | null => {
      if (!floorplanV3) return null

      const segment = floorplanV3.wallSegments.find(s => s.id === segmentId)
      if (!segment) return null

      const length = getSegmentLength(segment, floorplanV3.vertices)
      return findValidDoorPosition(segment, length, requestedPosition, width, height)
    },
    [floorplanV3]
  )

  // Add a door to a segment
  const addDoorCb = useCallback(
    (segmentId: string, position: number, width = DEFAULT_DOOR_WIDTH, height = DEFAULT_DOOR_HEIGHT): boolean => {
      console.log('[WallSegmentsContext] addDoor called:', segmentId, position, width, height)

      setLocalV3Data(prevData => {
        const currentData = prevData || floorplanV3
        if (!currentData) {
          console.warn('[WallSegmentsContext] No floorplan data for addDoor')
          return prevData
        }

        const segmentIndex = currentData.wallSegments.findIndex(s => s.id === segmentId)
        if (segmentIndex === -1) {
          console.warn('[WallSegmentsContext] Segment not found:', segmentId)
          return prevData
        }

        const segment = currentData.wallSegments[segmentIndex]
        const length = getSegmentLength(segment, currentData.vertices)

        const updatedSegment = addDoorToSegment(segment, length, position, width, height)
        if (!updatedSegment) {
          console.warn('[WallSegmentsContext] Failed to add door - validation failed')
          return prevData
        }

        const updatedSegments = [...currentData.wallSegments]
        updatedSegments[segmentIndex] = updatedSegment

        console.log('[WallSegmentsContext] Door added successfully')
        return {
          ...currentData,
          wallSegments: updatedSegments,
          updatedAt: new Date().toISOString(),
        }
      })

      return true
    },
    [floorplanV3]
  )

  // Remove a door from a segment
  const removeDoorCb = useCallback(
    (segmentId: string, doorId: string) => {
      console.log('[WallSegmentsContext] removeDoor called:', segmentId, doorId)

      setLocalV3Data(prevData => {
        const currentData = prevData || floorplanV3
        if (!currentData) {
          console.warn('[WallSegmentsContext] No floorplan data for removeDoor')
          return prevData
        }

        const segmentIndex = currentData.wallSegments.findIndex(s => s.id === segmentId)
        if (segmentIndex === -1) {
          console.warn('[WallSegmentsContext] Segment not found:', segmentId)
          return prevData
        }

        const segment = currentData.wallSegments[segmentIndex]
        const updatedSegment = removeDoorFromSegment(segment, doorId)

        const updatedSegments = [...currentData.wallSegments]
        updatedSegments[segmentIndex] = updatedSegment

        console.log('[WallSegmentsContext] Door removed successfully')
        return {
          ...currentData,
          wallSegments: updatedSegments,
          updatedAt: new Date().toISOString(),
        }
      })
    },
    [floorplanV3]
  )

  const value: WallSegmentsContextType = {
    floorplanV3,
    useV3Rendering,
    selectedSegmentId,
    selectedSide,
    doorPlacementMode,
    setDoorPlacementMode,
    selectWallSide,
    clearWallSelection,
    updateWallStyle,
    addDoor: addDoorCb,
    removeDoor: removeDoorCb,
    canAddDoor: canAddDoorCb,
    findValidDoorPosition: findValidDoorPositionCb,
    getRoomName,
    getSegmentLength: getSegmentLengthCb,
  }

  return (
    <WallSegmentsContext.Provider value={value}>
      {children}
    </WallSegmentsContext.Provider>
  )
}

/**
 * Hook to access wall segments context
 */
export function useWallSegments(): WallSegmentsContextType {
  const context = useContext(WallSegmentsContext)
  if (context === undefined) {
    throw new Error('useWallSegments must be used within a WallSegmentsProvider')
  }
  return context
}
