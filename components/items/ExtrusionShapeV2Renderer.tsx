'use client'

import { useMemo, useEffect, useState, Suspense } from 'react'
import { useLoader, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { ExtrusionShapeV2, ExtrusionFaceId, Vector3 } from '@/types/room'
import { createPerFaceExtrusionGeometry, materialIndexToFaceId } from '@/lib/three/extrusion-geometry'
import { createAllFaceMaterials, collectTexturePaths, disposeMaterials } from '@/lib/three/face-materials'

interface ExtrusionShapeV2RendererProps {
  shape: ExtrusionShapeV2
  position?: Vector3
  rotation?: Vector3
  scale?: Vector3
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
  onFaceClick?: (faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => void
  onFaceHover?: (faceId: ExtrusionFaceId | null, event?: ThreeEvent<PointerEvent>) => void
  highlightedFace?: ExtrusionFaceId | null
  userData?: Record<string, unknown>
}

/**
 * Inner component that loads textures and renders the mesh
 */
function ExtrusionV2Mesh({
  shape,
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut,
  onFaceClick,
  onFaceHover,
  highlightedFace,
  userData,
}: {
  shape: ExtrusionShapeV2
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
  onFaceClick?: (faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => void
  onFaceHover?: (faceId: ExtrusionFaceId | null, event?: ThreeEvent<PointerEvent>) => void
  highlightedFace?: ExtrusionFaceId | null
  userData?: Record<string, unknown>
}) {
  const numPoints = shape.points.length

  // Collect all texture paths that need to be loaded
  const texturePaths = useMemo(() => {
    const paths = collectTexturePaths(shape)
    return Array.from(paths)
  }, [shape])

  // Load all textures
  // Note: useLoader expects a non-empty array, so we use a placeholder if no textures
  const loadedTextures = useLoader(
    THREE.TextureLoader,
    texturePaths.length > 0 ? texturePaths : ['/placeholder-texture.png']
  )

  // Build texture map
  const textureMap = useMemo(() => {
    const map = new Map<string, THREE.Texture>()
    if (texturePaths.length > 0) {
      const textureArray = Array.isArray(loadedTextures) ? loadedTextures : [loadedTextures]
      texturePaths.forEach((path, index) => {
        if (textureArray[index]) {
          map.set(path, textureArray[index])
        }
      })
    }
    return map
  }, [texturePaths, loadedTextures])

  // Create the geometry with per-face material groups
  const geometry = useMemo(() => {
    return createPerFaceExtrusionGeometry(shape)
  }, [shape])

  // Create materials for each face
  const materials = useMemo(() => {
    return createAllFaceMaterials(shape, textureMap)
  }, [shape, textureMap])

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      disposeMaterials(materials)
    }
  }, [materials])

  // Apply highlight to the highlighted face
  const materialsWithHighlight = useMemo(() => {
    if (!highlightedFace) return materials

    return materials.map((mat, index) => {
      const faceId = materialIndexToFaceId(index, numPoints)
      if (faceId === highlightedFace) {
        const highlightMat = mat.clone()
        highlightMat.emissive = new THREE.Color(0x00ffff)
        highlightMat.emissiveIntensity = 0.3
        return highlightMat
      }
      return mat
    })
  }, [materials, highlightedFace, numPoints])

  // Handle click to detect which face was clicked
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onClick?.(event)

    if (onFaceClick && event.face) {
      // Get material index from the face
      const materialIndex = event.face.materialIndex
      const faceId = materialIndexToFaceId(materialIndex, numPoints)
      onFaceClick(faceId, event)
    }
  }

  // Handle pointer over
  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    onPointerOver?.(event)

    if (onFaceHover && event.face) {
      const materialIndex = event.face.materialIndex
      const faceId = materialIndexToFaceId(materialIndex, numPoints)
      onFaceHover(faceId, event)
    }
  }

  // Handle pointer out
  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    onPointerOut?.(event)
    onFaceHover?.(null, event)
  }

  return (
    <mesh
      geometry={geometry}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={userData}
    >
      {materialsWithHighlight.map((mat, index) => (
        <primitive key={index} object={mat} attach={`material-${index}`} />
      ))}
    </mesh>
  )
}

/**
 * Fallback component while textures load
 */
function ExtrusionV2Fallback({ shape }: { shape: ExtrusionShapeV2 }) {
  const geometry = useMemo(() => {
    return createPerFaceExtrusionGeometry(shape)
  }, [shape])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={shape.defaultMaterial.color} />
    </mesh>
  )
}

/**
 * Renders an ExtrusionShapeV2 with per-face materials and texture support
 *
 * Features:
 * - Per-face colors and textures
 * - Texture stretch/tile modes
 * - Face click detection for material editing
 * - Face hover highlighting
 */
export function ExtrusionShapeV2Renderer({
  shape,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut,
  onFaceClick,
  onFaceHover,
  highlightedFace,
  userData,
}: ExtrusionShapeV2RendererProps) {
  // Check if we have any textures to load
  const hasTextures = useMemo(() => {
    return collectTexturePaths(shape).size > 0
  }, [shape])

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      {hasTextures ? (
        <Suspense fallback={<ExtrusionV2Fallback shape={shape} />}>
          <ExtrusionV2Mesh
            shape={shape}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            onFaceClick={onFaceClick}
            onFaceHover={onFaceHover}
            highlightedFace={highlightedFace}
            userData={userData}
          />
        </Suspense>
      ) : (
        <ExtrusionV2MeshNoTextures
          shape={shape}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onFaceClick={onFaceClick}
          onFaceHover={onFaceHover}
          highlightedFace={highlightedFace}
          userData={userData}
        />
      )}
    </group>
  )
}

/**
 * Mesh component for shapes without textures (no Suspense needed)
 */
function ExtrusionV2MeshNoTextures({
  shape,
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut,
  onFaceClick,
  onFaceHover,
  highlightedFace,
  userData,
}: {
  shape: ExtrusionShapeV2
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void
  onFaceClick?: (faceId: ExtrusionFaceId, event: ThreeEvent<MouseEvent>) => void
  onFaceHover?: (faceId: ExtrusionFaceId | null, event?: ThreeEvent<PointerEvent>) => void
  highlightedFace?: ExtrusionFaceId | null
  userData?: Record<string, unknown>
}) {
  const numPoints = shape.points.length

  // Create the geometry with per-face material groups
  const geometry = useMemo(() => {
    return createPerFaceExtrusionGeometry(shape)
  }, [shape])

  // Create materials for each face (no textures)
  const materials = useMemo(() => {
    return createAllFaceMaterials(shape, new Map())
  }, [shape])

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      disposeMaterials(materials)
    }
  }, [materials])

  // Apply highlight to the highlighted face
  const materialsWithHighlight = useMemo(() => {
    if (!highlightedFace) return materials

    return materials.map((mat, index) => {
      const faceId = materialIndexToFaceId(index, numPoints)
      if (faceId === highlightedFace) {
        const highlightMat = mat.clone()
        highlightMat.emissive = new THREE.Color(0x00ffff)
        highlightMat.emissiveIntensity = 0.3
        return highlightMat
      }
      return mat
    })
  }, [materials, highlightedFace, numPoints])

  // Handle click to detect which face was clicked
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onClick?.(event)

    if (onFaceClick && event.face) {
      const materialIndex = event.face.materialIndex
      const faceId = materialIndexToFaceId(materialIndex, numPoints)
      onFaceClick(faceId, event)
    }
  }

  // Handle pointer over
  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    onPointerOver?.(event)

    if (onFaceHover && event.face) {
      const materialIndex = event.face.materialIndex
      const faceId = materialIndexToFaceId(materialIndex, numPoints)
      onFaceHover(faceId, event)
    }
  }

  // Handle pointer out
  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    onPointerOut?.(event)
    onFaceHover?.(null, event)
  }

  return (
    <mesh
      geometry={geometry}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      userData={userData}
    >
      {materialsWithHighlight.map((mat, index) => (
        <primitive key={index} object={mat} attach={`material-${index}`} />
      ))}
    </mesh>
  )
}

/**
 * Calculate the bounding dimensions of an ExtrusionShapeV2
 */
export function calculateExtrusionV2Dimensions(shape: ExtrusionShapeV2): {
  width: number
  height: number
  depth: number
} {
  if (!shape.points || shape.points.length < 3) {
    return { width: 1, height: shape.height, depth: 1 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of shape.points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return {
    width: maxX - minX,
    height: shape.height,
    depth: maxY - minY, // 2D Y becomes 3D Z (depth)
  }
}
