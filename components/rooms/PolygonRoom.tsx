'use client'

import * as THREE from 'three'
import { useMemo } from 'react'

interface PolygonRoomProps {
  // Polygon vertices in room-local coordinates (x = X axis, z = Z axis in 3D)
  polygon: Array<{ x: number; z: number }>
  height: number  // Wall height in feet
  position?: [number, number, number]
  roomId?: string
}

/**
 * PolygonRoom: Renders a room with arbitrary polygon floor shape
 * Used by the wall-first V2 floorplan editor
 */
export function PolygonRoom({ polygon, height, position = [0, 0, 0], roomId }: PolygonRoomProps) {
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

      // Calculate rotation angle (around Y axis)
      // PlaneGeometry has width along local X axis, we need to rotate so X aligns with (dx, dz)
      // Rotation around Y: X-axis rotates to (cos θ, 0, -sin θ)
      // We want (cos θ, 0, -sin θ) = (dx/len, 0, dz/len)
      // So cos θ = dx/len, -sin θ = dz/len, therefore θ = atan2(-dz, dx)
      const angle = Math.atan2(-dz, dx)

      walls.push({
        geometry: new THREE.PlaneGeometry(wallLength, height),
        position: [centerX, height / 2, centerZ],
        rotation: [0, angle, 0],
      })
    }

    return walls
  }, [polygon, height])

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <primitive object={floorGeometry} attach="geometry" />
        <meshStandardMaterial color="#f5f5f5" side={THREE.DoubleSide} />
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
