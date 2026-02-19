'use client'

import { useMemo, Suspense } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { FrameShape, Vector3 } from '@/types/room'

interface FrameShapeRendererProps {
  shape: FrameShape
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
 * Inner component that loads and renders the frame with image
 * Uses simple layered boxes to create the frame effect
 */
function FrameMeshWithImage({
  shape,
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  shape: FrameShape
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}) {
  // Load the image texture
  const texture = useLoader(THREE.TextureLoader, shape.imagePath)

  // Calculate dimensions
  const totalWidth = shape.imageWidth + shape.matWidth * 2 + shape.frameWidth * 2
  const totalHeight = shape.imageHeight + shape.matWidth * 2 + shape.frameWidth * 2
  const matOuterWidth = shape.imageWidth + shape.matWidth * 2
  const matOuterHeight = shape.imageHeight + shape.matWidth * 2

  // Create materials
  const materials = useMemo(() => ({
    back: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.9 }),
    image: new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 }),
    mat: new THREE.MeshStandardMaterial({ color: shape.matColor, roughness: 0.8 }),
    frame: new THREE.MeshStandardMaterial({ color: shape.frameColor, roughness: 0.4, metalness: 0.1 })
  }), [texture, shape.matColor, shape.frameColor])

  // Layer depths (total depth = frameDepth)
  const backDepth = 0.01
  const matDepth = 0.02
  const frameDepth = shape.frameDepth

  // Z positions - frame is at back, layers build forward
  // Center everything so front of frame is at Z=0
  const frameZ = -frameDepth / 2
  const matZ = frameZ + frameDepth / 2 + matDepth / 2  // In front of frame
  const imageZ = matZ + matDepth / 2 + 0.001  // Slightly in front of mat
  const backZ = frameZ - frameDepth / 2 - backDepth / 2  // Behind frame

  return (
    <group
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Back panel - behind everything (no shadow casting to avoid internal shadows) */}
      <mesh position={[0, 0, backZ]} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, totalHeight, backDepth]} />
        <primitive object={materials.back} attach="material" />
      </mesh>

      {/* Frame - outer border, positioned at back with depth going forward */}
      {/* Top frame bar */}
      <mesh position={[0, (totalHeight - shape.frameWidth) / 2, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, shape.frameWidth, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Bottom frame bar */}
      <mesh position={[0, -(totalHeight - shape.frameWidth) / 2, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, shape.frameWidth, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Left frame bar */}
      <mesh position={[-(totalWidth - shape.frameWidth) / 2, 0, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.frameWidth, totalHeight - shape.frameWidth * 2, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Right frame bar */}
      <mesh position={[(totalWidth - shape.frameWidth) / 2, 0, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.frameWidth, totalHeight - shape.frameWidth * 2, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>

      {/* Mat - border around image */}
      {/* Top mat bar */}
      <mesh position={[0, (matOuterHeight - shape.matWidth) / 2, matZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[matOuterWidth, shape.matWidth, matDepth]} />
        <primitive object={materials.mat} attach="material" />
      </mesh>
      {/* Bottom mat bar */}
      <mesh position={[0, -(matOuterHeight - shape.matWidth) / 2, matZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[matOuterWidth, shape.matWidth, matDepth]} />
        <primitive object={materials.mat} attach="material" />
      </mesh>
      {/* Left mat bar */}
      <mesh position={[-(matOuterWidth - shape.matWidth) / 2, 0, matZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.matWidth, matOuterHeight - shape.matWidth * 2, matDepth]} />
        <primitive object={materials.mat} attach="material" />
      </mesh>
      {/* Right mat bar */}
      <mesh position={[(matOuterWidth - shape.matWidth) / 2, 0, matZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.matWidth, matOuterHeight - shape.matWidth * 2, matDepth]} />
        <primitive object={materials.mat} attach="material" />
      </mesh>

      {/* Image - in the center (using thin box for proper shadow casting) */}
      <mesh position={[0, 0, imageZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.imageWidth, shape.imageHeight, 0.005]} />
        <primitive object={materials.image} attach="material" />
      </mesh>
    </group>
  )
}

/**
 * Inner component for frames without images (solid mat color background)
 */
function FrameMeshNoImage({
  shape,
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  shape: FrameShape
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}) {
  // Calculate dimensions
  const totalWidth = shape.imageWidth + shape.matWidth * 2 + shape.frameWidth * 2
  const totalHeight = shape.imageHeight + shape.matWidth * 2 + shape.frameWidth * 2
  const matOuterWidth = shape.imageWidth + shape.matWidth * 2
  const matOuterHeight = shape.imageHeight + shape.matWidth * 2

  // Create materials (no image texture - mat covers the whole inner area)
  const materials = useMemo(() => ({
    back: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.9 }),
    mat: new THREE.MeshStandardMaterial({ color: shape.matColor, roughness: 0.8 }),
    frame: new THREE.MeshStandardMaterial({ color: shape.frameColor, roughness: 0.4, metalness: 0.1 })
  }), [shape.matColor, shape.frameColor])

  // Layer depths (total depth = frameDepth)
  const backDepth = 0.01
  const matDepth = 0.02
  const frameDepth = shape.frameDepth

  // Z positions - frame is at back, layers build forward
  const frameZ = -frameDepth / 2
  const matZ = frameZ + frameDepth / 2 + matDepth / 2
  const backZ = frameZ - frameDepth / 2 - backDepth / 2

  return (
    <group
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Back panel - behind everything (no shadow casting to avoid internal shadows) */}
      <mesh position={[0, 0, backZ]} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, totalHeight, backDepth]} />
        <primitive object={materials.back} attach="material" />
      </mesh>

      {/* Frame - outer border */}
      {/* Top frame bar */}
      <mesh position={[0, (totalHeight - shape.frameWidth) / 2, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, shape.frameWidth, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Bottom frame bar */}
      <mesh position={[0, -(totalHeight - shape.frameWidth) / 2, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[totalWidth, shape.frameWidth, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Left frame bar */}
      <mesh position={[-(totalWidth - shape.frameWidth) / 2, 0, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.frameWidth, totalHeight - shape.frameWidth * 2, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>
      {/* Right frame bar */}
      <mesh position={[(totalWidth - shape.frameWidth) / 2, 0, frameZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[shape.frameWidth, totalHeight - shape.frameWidth * 2, frameDepth]} />
        <primitive object={materials.frame} attach="material" />
      </mesh>

      {/* Mat - solid color filling the entire inner area */}
      <mesh position={[0, 0, matZ]} castShadow={castShadow} receiveShadow={receiveShadow}>
        <boxGeometry args={[matOuterWidth, matOuterHeight, matDepth]} />
        <primitive object={materials.mat} attach="material" />
      </mesh>
    </group>
  )
}

/**
 * Fallback component while texture loads
 */
function FrameFallback({ shape }: { shape: FrameShape }) {
  const totalWidth = shape.imageWidth + shape.matWidth * 2 + shape.frameWidth * 2
  const totalHeight = shape.imageHeight + shape.matWidth * 2 + shape.frameWidth * 2

  return (
    <mesh>
      <boxGeometry args={[totalWidth, totalHeight, shape.frameDepth]} />
      <meshStandardMaterial color={shape.frameColor} />
    </mesh>
  )
}

/**
 * Renders a picture frame with image, mat, and frame layers
 * Designed for wall mounting - the frame faces the +Z direction
 * Supports frames without images (solid mat color background)
 */
export function FrameShapeRenderer({
  shape,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: FrameShapeRendererProps) {
  const hasImage = shape.imagePath && shape.imagePath.length > 0

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
    >
      <Suspense fallback={<FrameFallback shape={shape} />}>
        {hasImage ? (
          <FrameMeshWithImage
            shape={shape}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          />
        ) : (
          <FrameMeshNoImage
            shape={shape}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
          />
        )}
      </Suspense>
    </group>
  )
}

/**
 * Calculate the bounding dimensions of a frame shape
 */
export function calculateFrameDimensions(shape: FrameShape): {
  width: number
  height: number
  depth: number
} {
  return {
    width: shape.imageWidth + shape.matWidth * 2 + shape.frameWidth * 2,
    height: shape.imageHeight + shape.matWidth * 2 + shape.frameWidth * 2,
    depth: shape.frameDepth
  }
}
