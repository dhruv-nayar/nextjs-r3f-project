'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { ParametricShape } from '@/types/room'
import { ParametricShapeRenderer } from './ParametricShapeRenderer'

interface ParametricShapePreviewProps {
  shape: ParametricShape
  dimensions: {
    width: number
    height: number
    depth: number
  }
}

export function ParametricShapePreview({ shape, dimensions }: ParametricShapePreviewProps) {
  // Calculate camera distance based on shape size
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)
  const cameraDistance = maxDim * 2.5

  // Calculate Y position to lift the shape so its bottom is at Y=0
  // This makes the shadow appear correctly under the whole shape
  const shapeY = dimensions.height / 2

  return (
    <Canvas shadows className="w-full h-full">
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance, cameraDistance * 0.8, cameraDistance]}
        fov={50}
      />

      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={cameraDistance * 3}
      />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* The parametric shape - lifted so bottom is at Y=0 */}
      <Suspense fallback={null}>
        <ParametricShapeRenderer
          shape={shape}
          position={{ x: 0, y: shapeY, z: 0 }}
          castShadow
          receiveShadow
        />
      </Suspense>

      {/* Ground plane for shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[maxDim * 4, maxDim * 4]} />
        <shadowMaterial opacity={0.15} />
      </mesh>

    </Canvas>
  )
}
