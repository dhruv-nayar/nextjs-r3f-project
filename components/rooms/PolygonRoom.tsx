'use client'

import * as THREE from 'three'
import { useMemo, useCallback } from 'react'
import { ThreeEvent } from '@react-three/fiber'
import { useSelection } from '@/lib/selection-context'
import { useFurnitureSelection } from '@/lib/furniture-selection-context'
import { useRoomHover } from '@/lib/room-hover-context'

interface Door {
  wall: 'north' | 'south' | 'east' | 'west'  // Which wall (north=+Z, south=-Z, east=+X, west=-X)
  position: number  // Position along the wall (-0.5 to 0.5, where 0 is center)
  width: number     // Door width in feet
  height: number    // Door height in feet
}

interface PolygonRoomProps {
  // Polygon vertices in room-local coordinates (x = X axis, z = Z axis in 3D)
  polygon: Array<{ x: number; z: number }>
  height: number  // Wall height in feet
  position?: [number, number, number]
  roomId?: string
  doors?: Door[]  // Optional door openings
}

/**
 * Creates a wall geometry with door openings cut out
 * Shape is centered vertically (from -height/2 to +height/2) so positioning at height/2 puts bottom at ground level
 */
function createWallWithDoors(
  wallLength: number,
  wallHeight: number,
  doors: Array<{ width: number; height: number; position: number }>
) {
  console.log('[PolygonRoom createWallWithDoors]', { wallLength, wallHeight, doorCount: doors.length })

  const shape = new THREE.Shape()

  // Create outer rectangle (wall) centered vertically at origin - CCW winding
  shape.moveTo(-wallLength / 2, -wallHeight / 2)
  shape.lineTo(wallLength / 2, -wallHeight / 2)
  shape.lineTo(wallLength / 2, wallHeight / 2)
  shape.lineTo(-wallLength / 2, wallHeight / 2)
  shape.closePath()

  // Create hole for each door - CW winding (OPPOSITE of outer shape)
  doors.forEach((door, index) => {
    const doorX = door.position * wallLength
    const doorLeft = doorX - door.width / 2
    const doorRight = doorX + door.width / 2
    const doorBottom = -wallHeight / 2
    const doorTop = doorBottom + door.height

    console.log(`[PolygonRoom] Door ${index}:`, {
      position: door.position,
      width: door.width,
      height: door.height,
      doorX,
      doorLeft,
      doorRight,
      wallRange: [-wallLength / 2, wallLength / 2],
      doorBottom,
      doorTop
    })

    // Validate door is within wall bounds with margin
    const MARGIN = 0.05 // 0.05 feet margin from edges
    if (doorLeft < -wallLength / 2 + MARGIN || doorRight > wallLength / 2 - MARGIN) {
      console.warn(`[PolygonRoom] Door ${index} is too close to wall bounds, skipping`)
      return
    }

    // Add small inset to ensure hole doesn't touch outer boundary (critical for triangulation)
    const INSET = 0.01
    const insetLeft = doorLeft + INSET
    const insetRight = doorRight - INSET
    const insetBottom = doorBottom + INSET
    const insetTop = doorTop - INSET

    // Create hole with CW winding (opposite of outer shape) - required by THREE.js
    const hole = new THREE.Path()
    hole.moveTo(insetLeft, insetBottom)
    hole.lineTo(insetLeft, insetTop)      // Go up
    hole.lineTo(insetRight, insetTop)     // Go right
    hole.lineTo(insetRight, insetBottom)  // Go down
    hole.closePath()

    shape.holes.push(hole)
  })

  const geometry = new THREE.ShapeGeometry(shape)
  console.log('[PolygonRoom] Created geometry, vertices:', geometry.attributes.position.count)

  return geometry
}

/**
 * PolygonRoom: Renders a room with arbitrary polygon floor shape
 * Used by the wall-first V2 floorplan editor
 */
export function PolygonRoom({ polygon, height, position = [0, 0, 0], roomId, doors = [] }: PolygonRoomProps) {
  console.log(`[PolygonRoom] Rendering ${roomId} with ${doors.length} doors`)

  // Selection and hover state
  const { selectFloor, isFloorSelected, hoveredItem, setHoveredItem } = useSelection()
  const { setSelectedFurnitureId } = useFurnitureSelection()
  const { hoveredRoomId, setHoveredRoomId } = useRoomHover()

  const isFloorSelectedHere = roomId ? isFloorSelected(roomId) : false
  const isFloorHovered = hoveredItem?.type === 'floor' && hoveredItem.roomId === roomId
  const isHovered = roomId && hoveredRoomId === roomId

  // Click handler for floor
  const handleFloorClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setSelectedFurnitureId(null) // Clear furniture selection
      selectFloor(roomId)
    }
  }, [roomId, selectFloor, setSelectedFurnitureId])

  // Hover handlers for floor
  const handleFloorPointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (roomId) {
      setHoveredItem({ type: 'floor', roomId })
      setHoveredRoomId(roomId)
      document.body.style.cursor = 'pointer'
    }
  }, [roomId, setHoveredItem, setHoveredRoomId])

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

  // Calculate bounding box for door direction mapping
  const bounds = useMemo(() => {
    if (polygon.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }

    let minX = polygon[0].x
    let maxX = polygon[0].x
    let minZ = polygon[0].z
    let maxZ = polygon[0].z

    for (const p of polygon) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z)
      maxZ = Math.max(maxZ, p.z)
    }

    return { minX, maxX, minZ, maxZ }
  }, [polygon])

  // Create wall geometries - one for each edge of the polygon
  const wallGeometries = useMemo(() => {
    if (polygon.length < 3) return []

    const walls: Array<{
      geometry: THREE.BufferGeometry
      position: [number, number, number]
      rotation: [number, number, number]
    }> = []

    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i]
      const p2 = polygon[(i + 1) % polygon.length]

      // Calculate wall dimensions
      const dx = p2.x - p1.x
      const dz = p2.z - p1.z
      const wallLength = Math.sqrt(dx * dx + dz * dz)

      if (wallLength < 0.01) continue // Skip zero-length walls

      // Calculate wall center position
      const centerX = (p1.x + p2.x) / 2
      const centerZ = (p1.z + p2.z) / 2

      // Determine which compass direction this edge is closest to
      // This allows us to match doors specified with wall directions
      const distToNorth = Math.abs(centerZ - bounds.maxZ)
      const distToSouth = Math.abs(centerZ - bounds.minZ)
      const distToEast = Math.abs(centerX - bounds.maxX)
      const distToWest = Math.abs(centerX - bounds.minX)

      const minDist = Math.min(distToNorth, distToSouth, distToEast, distToWest)
      let wallDirection: 'north' | 'south' | 'east' | 'west'

      if (minDist === distToNorth) {
        wallDirection = 'north'
      } else if (minDist === distToSouth) {
        wallDirection = 'south'
      } else if (minDist === distToEast) {
        wallDirection = 'east'
      } else {
        wallDirection = 'west'
      }

      // Find doors on this wall
      const wallDoors = doors.filter(door => door.wall === wallDirection)

      // Calculate rotation angle (around Y axis)
      // PlaneGeometry has width along local X axis, we need to rotate so X aligns with (dx, dz)
      // Rotation around Y: X-axis rotates to (cos θ, 0, -sin θ)
      // We want (cos θ, 0, -sin θ) = (dx/len, 0, dz/len)
      // So cos θ = dx/len, -sin θ = dz/len, therefore θ = atan2(-dz, dx)
      const angle = Math.atan2(-dz, dx)

      // Create geometry with or without doors
      const geometry = wallDoors.length > 0
        ? createWallWithDoors(wallLength, height, wallDoors)
        : new THREE.PlaneGeometry(wallLength, height)

      walls.push({
        geometry,
        position: [centerX, height / 2, centerZ],
        rotation: [0, angle, 0],
      })
    }

    return walls
  }, [polygon, height, doors, bounds])

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

      {/* Walls */}
      {wallGeometries.map((wall, index) => (
        <mesh
          key={`wall-${index}`}
          position={wall.position}
          rotation={wall.rotation}
          receiveShadow
        >
          <primitive object={wall.geometry} attach="geometry" />
          <meshStandardMaterial color="#e8e8e8" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
