'use client'

import { useMemo, useCallback, useState, useEffect } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import type { FloorplanVertex } from '@/types/floorplan-v2'
import type { WallSegment, WallSegmentDoor, ComputedWallSegment } from '@/types/wall-segment'
import { computeWallSegment, computeGlobalCenter, pointToSegmentDistance, projectPointOntoSegment } from '@/lib/wall-segment-utils'
import { TwoSidedWallSegment } from './TwoSidedWallSegment'

/**
 * Door with world-space coordinates for cross-segment matching
 */
interface WorldDoor {
  door: WallSegmentDoor
  worldMidpoint: { x: number; y: number } // 2D floorplan coords of door center
  sourceSegmentId: string
}

interface WallSegmentRendererProps {
  segments: WallSegment[]
  vertices: FloorplanVertex[]
  selectedSegmentId?: string | null
  selectedSide?: 'A' | 'B' | null
  onSegmentSideClick?: (segmentId: string, side: 'A' | 'B') => void
  // Door placement
  doorPlacementMode?: boolean
  onDoorPlace?: (segmentId: string, position: number) => void
}

/**
 * WallSegmentRenderer: Renders all wall segments with two-sided materials
 *
 * This component bridges the floorplan data model with 3D rendering:
 * 1. Computes 3D positions/rotations for each segment
 * 2. Manages hover state for individual wall sides
 * 3. Passes selection state to TwoSidedWallSegment components
 */
export function WallSegmentRenderer({
  segments,
  vertices,
  selectedSegmentId,
  selectedSide,
  onSegmentSideClick,
  doorPlacementMode = false,
  onDoorPlace,
}: WallSegmentRendererProps) {
  // Log doorPlacementMode
  useEffect(() => {
    console.log('[WallSegmentRenderer] doorPlacementMode:', doorPlacementMode)
  }, [doorPlacementMode])
  // Local hover state: { segmentId, side } or null
  const [hovered, setHovered] = useState<{ segmentId: string; side: 'A' | 'B' } | null>(null)

  // Compute 3D data for all segments with OVERLAPPING SEGMENT DOOR SHARING
  // If two segments overlap (same wall), they share ALL doors
  const computedSegments = useMemo(() => {
    const results: ComputedWallSegment[] = []

    // Compute global center once for all segments (matches convertV2To3D)
    const globalCenter = computeGlobalCenter(vertices, segments)

    console.log('[WallSegmentRenderer] Computing segments, count:', segments.length)

    for (const segment of segments) {
      const computed = computeWallSegment(segment, vertices, globalCenter)
      if (computed) {
        results.push(computed)
      }
    }

    // STEP 1: Find overlapping segments (same position & length = same wall)
    // Use 3D position for matching since that's what determines visual overlap
    const POSITION_TOLERANCE = 2.0 // feet
    const LENGTH_TOLERANCE = 1.0 // feet

    const overlapGroups: ComputedWallSegment[][] = []
    const assignedToGroup = new Set<string>()

    for (let i = 0; i < results.length; i++) {
      const segA = results[i]
      if (assignedToGroup.has(segA.segment.id)) continue

      const group: ComputedWallSegment[] = [segA]
      assignedToGroup.add(segA.segment.id)

      for (let j = i + 1; j < results.length; j++) {
        const segB = results[j]
        if (assignedToGroup.has(segB.segment.id)) continue

        // Check if segments overlap (same 3D position and similar length)
        const dx = segA.position3D[0] - segB.position3D[0]
        const dy = segA.position3D[1] - segB.position3D[1]
        const dz = segA.position3D[2] - segB.position3D[2]
        const posDist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const lenDiff = Math.abs(segA.length - segB.length)

        if (posDist < POSITION_TOLERANCE && lenDiff < LENGTH_TOLERANCE) {
          group.push(segB)
          assignedToGroup.add(segB.segment.id)
          console.log(`[WallSegmentRenderer] Found overlap: ${segA.segment.id} <-> ${segB.segment.id} (dist: ${posDist.toFixed(2)}, lenDiff: ${lenDiff.toFixed(2)})`)
        }
      }

      if (group.length > 1) {
        overlapGroups.push(group)
      }
    }

    console.log(`[WallSegmentRenderer] Found ${overlapGroups.length} overlap groups`)

    // STEP 2: For each overlap group, collect ALL doors and give them to ALL segments in the group
    for (const group of overlapGroups) {
      // Collect all doors from all segments in this group
      const allDoorsInGroup: WallSegmentDoor[] = []
      const doorSourceMap = new Map<string, string>() // doorId -> sourceSegmentId

      for (const computed of group) {
        for (const door of computed.segment.doors) {
          // Avoid duplicates (same door ID)
          if (!allDoorsInGroup.some(d => d.id === door.id)) {
            allDoorsInGroup.push(door)
            doorSourceMap.set(door.id, computed.segment.id)
          }
        }
      }

      console.log(`[WallSegmentRenderer] Overlap group has ${allDoorsInGroup.length} total doors from ${group.length} segments`)

      // Give all doors to all segments in the group
      for (const computed of group) {
        const additionalDoors: WallSegmentDoor[] = []

        for (const door of allDoorsInGroup) {
          // Skip if this segment already has this door
          if (computed.segment.doors.some(d => d.id === door.id)) continue

          // Add a copy of the door with a unique ID
          additionalDoors.push({
            ...door,
            id: `${door.id}-shared-${computed.segment.id}`,
          })
          console.log(`[WallSegmentRenderer] Shared door ${door.id} to segment ${computed.segment.id}`)
        }

        if (additionalDoors.length > 0) {
          computed.segment = {
            ...computed.segment,
            doors: [...computed.segment.doors, ...additionalDoors],
          }
        }
      }
    }

    // Log segment details for debugging
    console.log('[WallSegmentRenderer] Final segments:',
      results.map(r => ({
        id: r.segment.id,
        pos: r.position3D.map(p => Math.round(p * 100) / 100),
        len: Math.round(r.length * 100) / 100,
        doors: r.segment.doors.length,
      }))
    )

    return results
  }, [segments, vertices])

  // Handle click on a wall side
  const handleSideClick = useCallback(
    (segmentId: string, side: 'A' | 'B', event: ThreeEvent<MouseEvent>) => {
      onSegmentSideClick?.(segmentId, side)
    },
    [onSegmentSideClick]
  )

  // Handle hover on a wall side
  const handleSideHover = useCallback(
    (segmentId: string, side: 'A' | 'B' | null) => {
      if (side === null) {
        setHovered(null)
      } else {
        setHovered({ segmentId, side })
      }
    },
    []
  )

  return (
    <group name="wall-segments">
      {computedSegments.map(computed => {
        const isSelected = computed.segment.id === selectedSegmentId
        const isHovered = hovered?.segmentId === computed.segment.id

        // Use style colors and door count in key to force re-render when colors or doors change
        const styleKey = `${computed.segment.id}-${computed.segment.sideA.style.color}-${computed.segment.sideB.style.color}-doors${computed.segment.doors.length}`

        return (
          <TwoSidedWallSegment
            key={styleKey}
            computed={computed}
            onSideClick={handleSideClick}
            onSideHover={handleSideHover}
            isSelected={isSelected}
            selectedSide={isSelected ? selectedSide ?? undefined : undefined}
            hoveredSide={isHovered ? hovered?.side : undefined}
            // Pass doorPlacementMode to ALL segments so clicks work even on overlapping walls
            doorPlacementMode={doorPlacementMode}
            onDoorPlace={onDoorPlace}
          />
        )
      })}
    </group>
  )
}

/**
 * Hook to use wall segment selection in a component
 * Provides selection state and handlers
 */
export function useWallSegmentSelection() {
  const [selection, setSelection] = useState<{
    segmentId: string
    side: 'A' | 'B'
  } | null>(null)

  const selectWallSide = useCallback((segmentId: string, side: 'A' | 'B') => {
    setSelection({ segmentId, side })
  }, [])

  const clearSelection = useCallback(() => {
    setSelection(null)
  }, [])

  const isSelected = useCallback(
    (segmentId: string, side?: 'A' | 'B') => {
      if (!selection) return false
      if (selection.segmentId !== segmentId) return false
      if (side && selection.side !== side) return false
      return true
    },
    [selection]
  )

  return {
    selection,
    selectWallSide,
    clearSelection,
    isSelected,
    selectedSegmentId: selection?.segmentId ?? null,
    selectedSide: selection?.side ?? null,
  }
}
