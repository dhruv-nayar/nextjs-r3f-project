'use client'

import * as THREE from 'three'
import { useMemo, useCallback, useRef, useEffect } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import type { ComputedWallSegment, WallSideStyle, WallSegmentDoor } from '@/types/wall-segment'
import { useWallMesh } from '@/lib/contexts/wall-mesh-context'

/**
 * Surface offset to prevent z-fighting between the two sides
 * 0.01 feet ≈ 3mm - imperceptible visually but enough to prevent flicker
 */
const SURFACE_OFFSET = 0.01

interface TwoSidedWallSegmentProps {
  computed: ComputedWallSegment
  onSideClick?: (segmentId: string, side: 'A' | 'B', event: ThreeEvent<MouseEvent>) => void
  onSideHover?: (segmentId: string, side: 'A' | 'B' | null) => void
  isSelected?: boolean
  selectedSide?: 'A' | 'B'
  hoveredSide?: 'A' | 'B' | null
  // Door placement
  doorPlacementMode?: boolean
  onDoorPlace?: (segmentId: string, position: number) => void
}

/**
 * Create wall geometry with door holes
 * Reuses the same approach as PolygonRoom but with explicit dimensions
 *
 * @param mirrorX - If true, mirror door positions for Side B (which is rotated 180°)
 */
function createWallGeometryWithDoors(
  wallLength: number,
  wallHeight: number,
  doors: WallSegmentDoor[],
  segmentLength: number,
  mirrorX: boolean = false
): THREE.ShapeGeometry {
  const shape = new THREE.Shape()

  // Create outer rectangle (wall) centered at origin - CCW winding
  shape.moveTo(-wallLength / 2, -wallHeight / 2)
  shape.lineTo(wallLength / 2, -wallHeight / 2)
  shape.lineTo(wallLength / 2, wallHeight / 2)
  shape.lineTo(-wallLength / 2, wallHeight / 2)
  shape.closePath()

  // Create hole for each door - CW winding (opposite of outer shape)
  doors.forEach((door, index) => {
    // Convert door position from segment-relative to geometry-relative
    // Door position is in feet from segment start
    // Geometry is centered, so we need to offset by -wallLength/2
    let doorCenterX = (door.position + door.width / 2) - (segmentLength / 2)

    // Mirror X position for Side B (which is rotated 180° around Y)
    // This ensures the door appears at the same world position on both sides
    if (mirrorX) {
      doorCenterX = -doorCenterX
    }

    const doorLeft = doorCenterX - door.width / 2
    const doorRight = doorCenterX + door.width / 2
    const doorBottom = -wallHeight / 2
    const doorTop = doorBottom + door.height

    // Validate door is within wall bounds with margin
    const MARGIN = 0.05
    if (doorLeft < -wallLength / 2 + MARGIN || doorRight > wallLength / 2 - MARGIN) {
      console.warn(`[TwoSidedWallSegment] Door ${index} is too close to wall bounds, skipping`)
      return
    }

    // Add small inset for triangulation
    const INSET = 0.01
    const insetLeft = doorLeft + INSET
    const insetRight = doorRight - INSET
    const insetBottom = doorBottom + INSET
    const insetTop = doorTop - INSET

    // Create hole with CW winding
    const hole = new THREE.Path()
    hole.moveTo(insetLeft, insetBottom)
    hole.lineTo(insetLeft, insetTop)
    hole.lineTo(insetRight, insetTop)
    hole.lineTo(insetRight, insetBottom)
    hole.closePath()

    shape.holes.push(hole)
  })

  return new THREE.ShapeGeometry(shape)
}

/**
 * Get material color with selection/hover state
 */
function getMaterialColor(
  baseColor: string,
  isSelected: boolean,
  isHovered: boolean
): string {
  if (isSelected) return '#ffe4b5' // Light orange for selected
  if (isHovered) return '#e0ffff' // Light cyan for hovered
  return baseColor
}

/**
 * TwoSidedWallSegment: Renders a wall segment with two independently styled sides
 *
 * Architecture:
 * - Two mesh elements, each with FrontSide-only material
 * - Side A at +SURFACE_OFFSET from center (faces positive normal)
 * - Side B at -SURFACE_OFFSET from center, rotated 180° (faces negative normal)
 * - Each side can have different color/material
 * - No z-fighting because surfaces don't overlap
 */
/**
 * Compute closest cardinal direction from a 2D normal
 * Normal is in floorplan space: x = world X, y = world Z
 */
function normalToCardinalDirection(
  normalX: number,
  normalY: number
): 'north' | 'south' | 'east' | 'west' {
  // normalY maps to Z axis in 3D (north/south)
  // normalX maps to X axis in 3D (east/west)
  if (Math.abs(normalY) > Math.abs(normalX)) {
    return normalY > 0 ? 'north' : 'south'
  } else {
    return normalX > 0 ? 'east' : 'west'
  }
}

export function TwoSidedWallSegment({
  computed,
  onSideClick,
  onSideHover,
  isSelected = false,
  selectedSide,
  hoveredSide,
  doorPlacementMode = false,
  onDoorPlace,
}: TwoSidedWallSegmentProps) {
  const { segment, length, normal, position3D, rotation3D } = computed
  const { registerWall, unregisterWall } = useWallMesh()

  // Refs for wall meshes (for raycasting/placement)
  const sideAMeshRef = useRef<THREE.Mesh>(null)
  const sideBMeshRef = useRef<THREE.Mesh>(null)

  // Compute cardinal directions for each side
  const sideADirection = useMemo(() =>
    normalToCardinalDirection(normal.x, normal.y), [normal])
  const sideBDirection = useMemo(() =>
    normalToCardinalDirection(-normal.x, -normal.y), [normal])

  // Get room ID from segment sides (use sideA's roomId, or sideB's, or segment ID as fallback)
  const roomId = segment.sideA.roomId || segment.sideB.roomId || `segment-${segment.id}`

  // Register wall meshes with WallMeshContext
  useEffect(() => {
    if (sideAMeshRef.current) {
      // Set userData for PlacementGhost raycasting
      sideAMeshRef.current.userData.roomId = roomId
      sideAMeshRef.current.userData.wallSide = sideADirection
      sideAMeshRef.current.userData.segmentId = segment.id
      sideAMeshRef.current.userData.wallSegmentSide = 'A'
      sideAMeshRef.current.userData.surfaceType = 'wall'
      registerWall(roomId, sideADirection, sideAMeshRef.current)
    }
    if (sideBMeshRef.current) {
      // Use a unique key for side B to avoid overwriting side A
      const sideBRoomId = `${roomId}-B`
      sideBMeshRef.current.userData.roomId = sideBRoomId
      sideBMeshRef.current.userData.wallSide = sideBDirection
      sideBMeshRef.current.userData.segmentId = segment.id
      sideBMeshRef.current.userData.wallSegmentSide = 'B'
      sideBMeshRef.current.userData.surfaceType = 'wall'
      registerWall(sideBRoomId, sideBDirection, sideBMeshRef.current)
    }

    return () => {
      unregisterWall(roomId, sideADirection)
      unregisterWall(`${roomId}-B`, sideBDirection)
    }
  }, [roomId, segment.id, sideADirection, sideBDirection, registerWall, unregisterWall])

  // Create geometry with door holes - separate instances for each side
  // Side B needs mirrored door positions because it's rotated 180° around Y
  const geometryA = useMemo(() => {
    return createWallGeometryWithDoors(
      length,
      segment.height,
      segment.doors,
      length,
      false // Side A: no mirroring
    )
  }, [length, segment.height, segment.doors])

  const geometryB = useMemo(() => {
    return createWallGeometryWithDoors(
      length,
      segment.height,
      segment.doors,
      length,
      true // Side B: mirror X positions to match Side A in world space
    )
  }, [length, segment.height, segment.doors])

  // Calculate offset positions for each side
  // Normal is in 2D floorplan space (x, y), but we're in 3D (x, z)
  const sideAOffset: [number, number, number] = useMemo(() => [
    normal.x * SURFACE_OFFSET,
    0,
    normal.y * SURFACE_OFFSET, // normal.y maps to 3D Z
  ], [normal])

  const sideBOffset: [number, number, number] = useMemo(() => [
    -normal.x * SURFACE_OFFSET,
    0,
    -normal.y * SURFACE_OFFSET,
  ], [normal])

  // Convert click point to door position along wall
  const calculateDoorPosition = useCallback((e: ThreeEvent<MouseEvent>): number => {
    // Get the local X coordinate on the wall plane
    // The wall geometry is centered, so localX ranges from -length/2 to +length/2
    const localX = e.point.x - position3D[0]

    // We need to project this point onto the wall's local X axis
    // The wall is rotated, so we need to account for that
    const angle = rotation3D[1] // Y rotation
    const cosA = Math.cos(-angle)
    const sinA = Math.sin(-angle)

    // Get the offset from the wall center in world space
    const offsetX = e.point.x - position3D[0]
    const offsetZ = e.point.z - position3D[2]

    // Rotate to get local X position on wall
    const localWallX = offsetX * cosA - offsetZ * sinA

    // Convert from centered coordinates to position from start (0 to length)
    const doorPosition = localWallX + length / 2

    return Math.max(0, Math.min(length, doorPosition))
  }, [position3D, rotation3D, length])

  // Click handlers
  const handleSideAClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    console.log('[TwoSidedWallSegment] Side A clicked, segment:', segment.id, 'doorPlacementMode:', doorPlacementMode)

    // If in door placement mode, place a door instead of selecting
    if (doorPlacementMode && onDoorPlace) {
      const doorPosition = calculateDoorPosition(e)
      console.log('[TwoSidedWallSegment] Door placement click, segment:', segment.id, 'position:', doorPosition)
      onDoorPlace(segment.id, doorPosition)
      return
    }

    onSideClick?.(segment.id, 'A', e)
  }, [segment.id, onSideClick, doorPlacementMode, onDoorPlace, calculateDoorPosition])

  const handleSideBClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    console.log('[TwoSidedWallSegment] Side B clicked, segment:', segment.id, 'doorPlacementMode:', doorPlacementMode)

    // If in door placement mode, place a door instead of selecting
    if (doorPlacementMode && onDoorPlace) {
      const doorPosition = calculateDoorPosition(e)
      console.log('[TwoSidedWallSegment] Door placement click, segment:', segment.id, 'position:', doorPosition)
      onDoorPlace(segment.id, doorPosition)
      return
    }

    onSideClick?.(segment.id, 'B', e)
  }, [segment.id, onSideClick, doorPlacementMode, onDoorPlace, calculateDoorPosition])

  // Hover handlers
  const handleSideAPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = doorPlacementMode ? 'crosshair' : 'pointer'
    onSideHover?.(segment.id, 'A')
  }, [segment.id, onSideHover, doorPlacementMode])

  const handleSideBPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = doorPlacementMode ? 'crosshair' : 'pointer'
    onSideHover?.(segment.id, 'B')
  }, [segment.id, onSideHover, doorPlacementMode])

  const handlePointerOut = useCallback(() => {
    document.body.style.cursor = 'default'
    onSideHover?.(segment.id, null)
  }, [segment.id, onSideHover])

  // Determine colors with selection/hover states
  const sideAColor = getMaterialColor(
    segment.sideA.style.color,
    isSelected && selectedSide === 'A',
    hoveredSide === 'A'
  )

  const sideBColor = getMaterialColor(
    segment.sideB.style.color,
    isSelected && selectedSide === 'B',
    hoveredSide === 'B'
  )

  return (
    <group position={position3D} rotation={rotation3D}>
      {/* Side A - faces positive normal */}
      <mesh
        ref={sideAMeshRef}
        position={sideAOffset}
        onClick={handleSideAClick}
        onPointerOver={handleSideAPointerOver}
        onPointerOut={handlePointerOut}
        receiveShadow
        castShadow
      >
        <primitive object={geometryA} attach="geometry" />
        <meshStandardMaterial
          key={`sideA-${segment.sideA.style.color}`}
          color={sideAColor}
          roughness={segment.sideA.style.roughness ?? 0.8}
          metalness={segment.sideA.style.metalness ?? 0}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Side B - faces negative normal (rotated 180° around local Y) */}
      <mesh
        ref={sideBMeshRef}
        position={sideBOffset}
        rotation={[0, Math.PI, 0]}
        onClick={handleSideBClick}
        onPointerOver={handleSideBPointerOver}
        onPointerOut={handlePointerOut}
        receiveShadow
        castShadow
      >
        <primitive object={geometryB} attach="geometry" />
        <meshStandardMaterial
          key={`sideB-${segment.sideB.style.color}`}
          color={sideBColor}
          roughness={segment.sideB.style.roughness ?? 0.8}
          metalness={segment.sideB.style.metalness ?? 0}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Selection/hover outline for Side A */}
      {(isSelected && selectedSide === 'A') || hoveredSide === 'A' ? (
        <mesh position={sideAOffset}>
          <primitive object={geometryA} attach="geometry" />
          <meshBasicMaterial
            color={isSelected && selectedSide === 'A' ? '#ff8c00' : '#00bfff'}
            wireframe
            transparent
            opacity={0.5}
            side={THREE.FrontSide}
          />
        </mesh>
      ) : null}

      {/* Selection/hover outline for Side B */}
      {(isSelected && selectedSide === 'B') || hoveredSide === 'B' ? (
        <mesh position={sideBOffset} rotation={[0, Math.PI, 0]}>
          <primitive object={geometryB} attach="geometry" />
          <meshBasicMaterial
            color={isSelected && selectedSide === 'B' ? '#ff8c00' : '#00bfff'}
            wireframe
            transparent
            opacity={0.5}
            side={THREE.FrontSide}
          />
        </mesh>
      ) : null}
    </group>
  )
}
