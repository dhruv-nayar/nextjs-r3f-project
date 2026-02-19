'use client'

import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { ShelfShape, Vector3 } from '@/types/room'
import { useOptionalSurfaceMesh } from '@/lib/contexts/surface-mesh-context'

interface ShelfShapeRendererProps {
  shape: ShelfShape
  instanceId?: string         // For surface registration
  position?: Vector3
  rotation?: Vector3
  scale?: Vector3
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}

/**
 * Renders a floating shelf as a simple colored box
 * Registers the top surface for item placement if instanceId is provided
 */
export function ShelfShapeRenderer({
  shape,
  instanceId,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: ShelfShapeRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const surfaceMeshRef = useRef<THREE.Mesh>(null)
  const surfaceMesh = useOptionalSurfaceMesh()

  // Register the top surface as a placeable surface if instanceId is provided and context exists
  useEffect(() => {
    if (instanceId && surfaceMeshRef.current && surfaceMesh) {
      surfaceMesh.registerItemSurface(instanceId, surfaceMeshRef.current)
      return () => surfaceMesh.unregisterItemSurface(instanceId)
    }
  }, [instanceId, surfaceMesh])

  // Create the material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shape.color || '#8B4513',
      roughness: 0.6,
      metalness: 0.1
    })
  }, [shape.color])

  // The shelf is positioned so its bottom is at Y=0 (origin)
  // This makes wall placement easier - the height from floor is the Y position
  const shelfY = shape.height / 2

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      {/* Main shelf body */}
      <mesh
        ref={meshRef}
        position={[0, shelfY, 0]}
        material={material}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <boxGeometry args={[shape.width, shape.height, shape.depth]} />
      </mesh>

      {/* Invisible surface mesh for item placement registration */}
      {/* This is a thin plane on top of the shelf */}
      <mesh
        ref={surfaceMeshRef}
        position={[0, shape.height, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <planeGeometry args={[shape.width, shape.depth]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

/**
 * Calculate the bounding dimensions of a shelf shape
 */
export function calculateShelfDimensions(shape: ShelfShape): {
  width: number
  height: number
  depth: number
} {
  return {
    width: shape.width,
    height: shape.height,
    depth: shape.depth
  }
}
