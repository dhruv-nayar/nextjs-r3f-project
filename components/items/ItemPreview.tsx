'use client'

import { Suspense, useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, PerspectiveCamera, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { MaterialOverride } from '@/types/room'
import { applyMaterialOverrides } from '@/lib/material-utils'

interface ItemPreviewProps {
  modelPath: string
  category: string
  materialOverrides?: MaterialOverride[]
  defaultRotation?: { x: number; z: number }
  dimensions?: { width: number; height: number; depth: number }
}

function ModelPreview({ modelPath, materialOverrides, defaultRotation, dimensions }: { modelPath: string; materialOverrides?: MaterialOverride[]; defaultRotation?: { x: number; z: number }; dimensions?: { width: number; height: number; depth: number } }) {
  const { scene } = useGLTF(modelPath)
  const autoRotateRef = useRef<THREE.Group>(null) // Outermost: Y auto-rotation for preview
  const dimensionScaleRef = useRef<THREE.Group>(null) // World-space dimension scaling (after tilt)
  const tiltRef = useRef<THREE.Group>(null) // Tilt rotation (X, Z)
  const { invalidate } = useThree()

  // Serialize dimensions for stable dependency tracking
  const dimensionsKey = dimensions ? JSON.stringify(dimensions) : 'none'

  // Calculate centering and scaling based on original scene
  // Separate: uniform fit (applied before rotation) vs dimension proportions (applied after rotation)
  const sceneTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // Uniform scale to fit model in preview (applied before rotation)
    const uniformScale = 2 / maxDim

    // If dimensions provided, calculate world-space dimension proportions
    // These are applied AFTER rotation so width=X, height=Y, depth=Z in world space
    if (dimensions && dimensions.width > 0 && dimensions.height > 0 && dimensions.depth > 0) {
      const maxTargetDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)

      // Dimension proportions normalized so max = 1
      const dimensionScale = new THREE.Vector3(
        dimensions.width / maxTargetDim,
        dimensions.height / maxTargetDim,
        dimensions.depth / maxTargetDim
      )

      return {
        position: new THREE.Vector3(-center.x, -center.y, -center.z),
        uniformScale,
        dimensionScale
      }
    }

    // Default: no dimension adjustment
    return {
      position: new THREE.Vector3(-center.x, -center.y, -center.z),
      uniformScale,
      dimensionScale: new THREE.Vector3(1, 1, 1)
    }
  }, [scene, dimensionsKey])

  // Serialize materialOverrides for stable dependency tracking
  const overridesKey = materialOverrides ? JSON.stringify(materialOverrides) : 'none'

  // Re-clone scene whenever materialOverrides changes to start fresh
  const clonedScene = useMemo(() => {
    const freshClone = scene.clone(true)

    // Apply the fixed centering to the clone
    freshClone.position.copy(sceneTransform.position)

    // Apply overrides immediately after cloning
    if (materialOverrides && materialOverrides.length > 0) {
      applyMaterialOverrides(freshClone, materialOverrides)
    }

    return freshClone
  }, [scene, sceneTransform, overridesKey])

  // Apply uniform scale to tilt group (fits model to preview, before rotation)
  useEffect(() => {
    if (tiltRef.current) {
      tiltRef.current.scale.setScalar(sceneTransform.uniformScale)
      invalidate()
    }
  }, [sceneTransform.uniformScale, invalidate])

  // Apply dimension scale to dimension group (world-space, after rotation)
  useEffect(() => {
    if (dimensionScaleRef.current) {
      dimensionScaleRef.current.scale.copy(sceneTransform.dimensionScale)
      invalidate()
    }
  }, [sceneTransform.dimensionScale, invalidate])

  // Apply default rotation to tilt group
  useEffect(() => {
    if (tiltRef.current) {
      tiltRef.current.rotation.x = defaultRotation?.x || 0
      tiltRef.current.rotation.z = defaultRotation?.z || 0
      invalidate()
    }
  }, [defaultRotation?.x, defaultRotation?.z, invalidate])

  // Auto-rotate on world Y axis (outer group) - doesn't affect the tilt
  useFrame((state) => {
    if (autoRotateRef.current) {
      autoRotateRef.current.rotation.y = state.clock.elapsedTime * 0.3
      invalidate()
    }
  })

  return (
    <group ref={autoRotateRef}>
      <group ref={dimensionScaleRef}>
        <group ref={tiltRef}>
          <primitive object={clonedScene} />
        </group>
      </group>
    </group>
  )
}

function Placeholder({ category }: { category: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-6xl text-white/20">
        {category === 'seating' && '🪑'}
        {category === 'table' && '🪑'}
        {category === 'storage' && '📚'}
        {category === 'bed' && '🛏️'}
        {category === 'decoration' && '🪴'}
        {category === 'lighting' && '💡'}
        {category === 'other' && '📦'}
      </div>
    </div>
  )
}

export function ItemPreview({ modelPath, category, materialOverrides, defaultRotation, dimensions }: ItemPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      console.log('WebGL context lost, attempting to restore...')
    }

    const handleContextRestored = () => {
      console.log('WebGL context restored')
    }

    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [])

  return (
    <div className="w-full h-full" style={{ minHeight: '300px' }}>
      <Suspense fallback={<Placeholder category={category} />}>
        <Canvas
          ref={canvasRef}
          frameloop="always"
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
          }}
          dpr={[1, 1.5]}
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x1f2937, 0)
          }}
        >
          <PerspectiveCamera makeDefault position={[0, 1, 4]} fov={50} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <directionalLight position={[-5, 3, -5]} intensity={0.5} />

          {/* Model switches dynamically without Canvas remount */}
          <ModelPreview key={modelPath} modelPath={modelPath} materialOverrides={materialOverrides} defaultRotation={defaultRotation} dimensions={dimensions} />

          {/* Environment */}
          <Environment preset="city" />
        </Canvas>
      </Suspense>
    </div>
  )
}
