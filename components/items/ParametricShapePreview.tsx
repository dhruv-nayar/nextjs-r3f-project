'use client'

import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { ParametricShape } from '@/types/room'

interface ParametricShapePreviewProps {
  shape: ParametricShape
  dimensions: {
    width: number
    height: number
    depth: number
  }
}

function ParametricMesh({ shape }: { shape: ParametricShape }) {
  const geometry = useMemo(() => {
    if (!shape.points || shape.points.length < 3) {
      return new THREE.BoxGeometry(1, shape.height, 1)
    }

    // Create shape from points
    const threeShape = new THREE.Shape()
    threeShape.moveTo(shape.points[0].x, shape.points[0].y)
    for (let i = 1; i < shape.points.length; i++) {
      threeShape.lineTo(shape.points[i].x, shape.points[i].y)
    }
    threeShape.lineTo(shape.points[0].x, shape.points[0].y) // Close the shape

    // Extrude settings
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: shape.height,
      bevelEnabled: false
    }

    const extrudeGeometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings)

    // Rotate to stand upright (extrusion goes along Y axis)
    extrudeGeometry.rotateX(-Math.PI / 2)

    // Center the geometry
    extrudeGeometry.computeBoundingBox()
    const boundingBox = extrudeGeometry.boundingBox!
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
    const centerY = (boundingBox.max.y + boundingBox.min.y) / 2
    const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2
    extrudeGeometry.translate(-centerX, -centerY, -centerZ)

    return extrudeGeometry
  }, [shape])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={shape.color || '#808080'}
        roughness={0.5}
        metalness={0.1}
      />
    </mesh>
  )
}

export function ParametricShapePreview({ shape, dimensions }: ParametricShapePreviewProps) {
  // Calculate camera distance based on shape size
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)
  const cameraDistance = maxDim * 2.5

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
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-5, 10, -5]}
        intensity={0.3}
      />

      {/* The parametric shape */}
      <ParametricMesh shape={shape} />

      {/* Ground plane for shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -dimensions.height / 2 - 0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[maxDim * 4, maxDim * 4]} />
        <shadowMaterial opacity={0.15} />
      </mesh>

      {/* Environment for reflections */}
      <Environment preset="city" />
    </Canvas>
  )
}
