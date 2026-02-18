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

/**
 * ModelPreview - Renders a 3D model with proper transform hierarchy:
 *
 * Transform order (outside to inside):
 * 1. autoRotateGroup - Y-axis auto-rotation for preview spin
 * 2. groundOffsetGroup - Lifts model so bottom touches Y=0
 * 3. dimensionScaleGroup - World-space dimension proportions (after rotation)
 * 4. tiltGroup - X/Z rotation + uniform scale (rotates around model center)
 * 5. model - Centered at origin
 *
 * Key insight: Model must be centered at origin for rotation to work correctly.
 * Ground offset is applied AFTER rotation so the model sits on the ground.
 */
function ModelPreview({ modelPath, materialOverrides, defaultRotation, dimensions }: {
  modelPath: string
  materialOverrides?: MaterialOverride[]
  defaultRotation?: { x: number; z: number }
  dimensions?: { width: number; height: number; depth: number }
}) {
  const { scene } = useGLTF(modelPath)
  const autoRotateRef = useRef<THREE.Group>(null)
  const groundOffsetRef = useRef<THREE.Group>(null)
  const tiltRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()

  // Serialize for stable dependency tracking
  const overridesKey = materialOverrides ? JSON.stringify(materialOverrides) : 'none'

  // Calculate transforms based on original scene geometry
  // Note: Dimensions are NOT used for scaling - only rotation affects the model
  const sceneTransform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)

    // Uniform scale to fit model in preview
    const uniformScale = 2 / maxDim

    // Scaled half-height (used for ground offset)
    const scaledHalfHeight = (size.y * uniformScale) / 2

    return {
      // Center model at origin (all axes) for proper rotation
      centering: new THREE.Vector3(-center.x, -center.y, -center.z),
      uniformScale,
      // Ground offset: lift the centered model so its bottom is at Y=0
      groundOffset: scaledHalfHeight
    }
  }, [scene])

  // Clone scene and apply centering + material overrides
  const clonedScene = useMemo(() => {
    const freshClone = scene.clone(true)

    // Center the model at origin
    freshClone.position.copy(sceneTransform.centering)

    // Apply material overrides
    if (materialOverrides && materialOverrides.length > 0) {
      applyMaterialOverrides(freshClone, materialOverrides)
    }

    return freshClone
  }, [scene, sceneTransform, overridesKey])

  // Apply uniform scale to tilt group
  useEffect(() => {
    if (tiltRef.current) {
      tiltRef.current.scale.setScalar(sceneTransform.uniformScale)
      invalidate()
    }
  }, [sceneTransform.uniformScale, invalidate])


  // Apply ground offset
  useEffect(() => {
    if (groundOffsetRef.current) {
      groundOffsetRef.current.position.y = sceneTransform.groundOffset
      invalidate()
    }
  }, [sceneTransform.groundOffset, invalidate])

  // Apply tilt rotation
  useEffect(() => {
    if (tiltRef.current) {
      tiltRef.current.rotation.x = defaultRotation?.x || 0
      tiltRef.current.rotation.z = defaultRotation?.z || 0
      invalidate()
    }
  }, [defaultRotation?.x, defaultRotation?.z, invalidate])

  // Auto-rotate on Y axis for preview
  useFrame((state) => {
    if (autoRotateRef.current) {
      autoRotateRef.current.rotation.y = state.clock.elapsedTime * 0.3
      invalidate()
    }
  })

  return (
    <group ref={autoRotateRef}>
      <group ref={groundOffsetRef}>
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

          {/* Model */}
          <ModelPreview
            key={modelPath}
            modelPath={modelPath}
            materialOverrides={materialOverrides}
            defaultRotation={defaultRotation}
            dimensions={dimensions}
          />

          {/* Environment */}
          <Environment preset="city" />
        </Canvas>
      </Suspense>
    </div>
  )
}
