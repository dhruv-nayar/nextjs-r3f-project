'use client'

import * as THREE from 'three'
import { useMemo, useCallback } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useSelection } from '@/lib/selection-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useRoomHover } from '@/lib/room-hover-context'
import { RoomGridState, createDefaultRoomGridState } from '@/types/selection'
import { FloorMeasurementGrid } from './MeasurementGrid'

interface PolygonRoomFloorProps {
  // Polygon vertices in room-local coordinates (x = X axis, z = Z axis in 3D)
  polygon: Array<{ x: number; z: number }>
  position?: [number, number, number]
  roomId?: string
  gridSettings?: RoomGridState
}

/**
 * PolygonRoomFloor: Renders only the floor of a polygon-shaped room
 *
 * This is the floor-only version of PolygonRoom, used when walls are
 * rendered separately via WallSegmentRenderer.
 */
export function PolygonRoomFloor({
  polygon,
  position = [0, 0, 0],
  roomId,
  gridSettings,
}: PolygonRoomFloorProps) {
  const effectiveGridSettings = gridSettings || createDefaultRoomGridState()
  // Selection and hover state
  const { selectFloor, isFloorSelected, hoveredItem, setHoveredItem } = useSelection()
  const { setSelectedFurnitureId } = useFurnitureSelection()
  const { hoveredRoomId, setHoveredRoomId } = useRoomHover()

  const isFloorSelectedHere = roomId ? isFloorSelected(roomId) : false
  const isFloorHovered = hoveredItem?.type === 'floor' && hoveredItem.roomId === roomId
  const isHovered = roomId && hoveredRoomId === roomId

  // Click handler for floor
  const handleFloorClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (roomId) {
        setSelectedFurnitureId(null) // Clear furniture selection
        selectFloor(roomId)
      }
    },
    [roomId, selectFloor, setSelectedFurnitureId]
  )

  // Hover handlers for floor
  const handleFloorPointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (roomId) {
        setHoveredItem({ type: 'floor', roomId })
        setHoveredRoomId(roomId)
        document.body.style.cursor = 'pointer'
      }
    },
    [roomId, setHoveredItem, setHoveredRoomId]
  )

  const handleFloorPointerOut = useCallback(() => {
    setHoveredItem(null)
    setHoveredRoomId(null)
    document.body.style.cursor = 'default'
  }, [setHoveredItem, setHoveredRoomId])

  // Get floor material color based on state
  const getFloorColor = () => {
    if (isFloorSelectedHere) return '#ffe4b5' // Light orange when selected
    if (isFloorHovered || isHovered) return '#e0ffff' // Light cyan when hovered
    return '#f5f5f5'
  }

  // Create floor geometry from polygon
  const floorGeometry = useMemo(() => {
    if (polygon.length < 3) return null

    // Shape is in XY plane, will be rotated -90° around X to lay flat
    // After rotation: (x, y, 0) → (x, 0, -y)
    // So we use (x, -z) in shape coords to get (x, 0, z) in world coords
    const shape = new THREE.Shape()
    shape.moveTo(polygon[0].x, -polygon[0].z)
    for (let i = 1; i < polygon.length; i++) {
      shape.lineTo(polygon[i].x, -polygon[i].z)
    }
    shape.closePath()

    return new THREE.ShapeGeometry(shape)
  }, [polygon])

  // Create outline for the floor
  const floorOutline = useMemo(() => {
    if (polygon.length < 3) return null

    const points: THREE.Vector3[] = []
    for (const p of polygon) {
      points.push(new THREE.Vector3(p.x, 0.01, p.z))
    }
    // Close the loop
    points.push(new THREE.Vector3(polygon[0].x, 0.01, polygon[0].z))

    return new THREE.BufferGeometry().setFromPoints(points)
  }, [polygon])

  // Calculate bounding box for the grid
  const boundingBox = useMemo(() => {
    if (polygon.length < 3) return { width: 0, depth: 0 }

    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const p of polygon) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    }

    return {
      width: maxX - minX,
      depth: maxZ - minZ,
    }
  }, [polygon])

  if (!floorGeometry || polygon.length < 3) {
    return null
  }

  return (
    <group position={position}>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={handleFloorClick}
        onPointerOver={handleFloorPointerOver}
        onPointerOut={handleFloorPointerOut}
      >
        <primitive object={floorGeometry} attach="geometry" />
        <meshStandardMaterial color={getFloorColor()} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor outline */}
      {floorOutline && (
        <line>
          <primitive object={floorOutline} attach="geometry" />
          <lineBasicMaterial color="#333333" linewidth={2} />
        </line>
      )}

      {/* Floor Measurement Grid */}
      <FloorMeasurementGrid
        width={boundingBox.width}
        depth={boundingBox.depth}
        settings={effectiveGridSettings.floor}
        roomPosition={position}
      />
    </group>
  )
}
