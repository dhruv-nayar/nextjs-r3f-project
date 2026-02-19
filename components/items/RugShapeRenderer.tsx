'use client'

import { useRef, useEffect, useMemo, Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { RugShape, Vector3 } from '@/types/room'
import { useOptionalSurfaceMesh } from '@/lib/contexts/surface-mesh-context'

interface RugShapeRendererProps {
  shape: RugShape
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
 * Inner component that loads and renders the rug texture
 */
function RugMesh({
  shape,
  instanceId,
  castShadow = false,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  shape: RugShape
  instanceId?: string
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const surfaceMesh = useOptionalSurfaceMesh()

  // Load texture from the uploaded image
  const texture = useLoader(THREE.TextureLoader, shape.texturePath)

  // Configure texture
  useEffect(() => {
    if (texture) {
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
    }
  }, [texture])

  // Register as a placeable surface if instanceId is provided and context exists
  useEffect(() => {
    if (instanceId && meshRef.current && surfaceMesh) {
      surfaceMesh.registerItemSurface(instanceId, meshRef.current)
      return () => surfaceMesh.unregisterItemSurface(instanceId)
    }
  }, [instanceId, surfaceMesh])

  // Create materials
  const materials = useMemo(() => {
    // Top face with texture
    const topMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0
    })

    // Side and bottom faces - darker color derived from texture or default gray
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.8,
      metalness: 0
    })

    // Return materials in order: right, left, top, bottom, front, back
    return [
      sideMaterial, // right (+X)
      sideMaterial, // left (-X)
      topMaterial,  // top (+Y) - the rug surface
      sideMaterial, // bottom (-Y)
      sideMaterial, // front (+Z)
      sideMaterial  // back (-Z)
    ]
  }, [texture])

  return (
    <mesh
      ref={meshRef}
      position={[0, shape.thickness / 2, 0]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <boxGeometry args={[shape.width, shape.thickness, shape.depth]} />
      {materials.map((mat, index) => (
        <primitive key={index} object={mat} attach={`material-${index}`} />
      ))}
    </mesh>
  )
}

/**
 * Fallback component while texture loads
 */
function RugFallback({ shape }: { shape: RugShape }) {
  return (
    <mesh position={[0, shape.thickness / 2, 0]}>
      <boxGeometry args={[shape.width, shape.thickness, shape.depth]} />
      <meshStandardMaterial color="#808080" />
    </mesh>
  )
}

/**
 * Renders a rug shape as a flat textured box on the floor
 * Registers the top surface for item placement if instanceId is provided
 */
export function RugShapeRenderer({
  shape,
  instanceId,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = false,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: RugShapeRendererProps) {
  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      <Suspense fallback={<RugFallback shape={shape} />}>
        <RugMesh
          shape={shape}
          instanceId={instanceId}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      </Suspense>
    </group>
  )
}

/**
 * Calculate the bounding dimensions of a rug shape
 */
export function calculateRugDimensions(shape: RugShape): {
  width: number
  height: number
  depth: number
} {
  return {
    width: shape.width,
    height: shape.thickness,
    depth: shape.depth
  }
}
