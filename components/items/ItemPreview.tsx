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
}

function ModelPreview({ modelPath, materialOverrides }: { modelPath: string; materialOverrides?: MaterialOverride[] }) {
  const { scene } = useGLTF(modelPath)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()

  // Center and scale the model to fit in view
  useEffect(() => {
    if (!groupRef.current) return

    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // Center the model
    clonedScene.position.set(-center.x, -box.min.y, -center.z)

    // Scale to fit in view (make largest dimension = 2 units)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2 / maxDim
    groupRef.current.scale.setScalar(scale)

    // Trigger render in demand mode
    invalidate()
  }, [clonedScene, invalidate])

  // Apply material overrides
  useEffect(() => {
    if (materialOverrides && materialOverrides.length > 0) {
      applyMaterialOverrides(clonedScene, materialOverrides)
      invalidate()
    }
  }, [clonedScene, materialOverrides, invalidate])

  // Rotate the model slowly
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3
      invalidate()  // Manually trigger render for each frame
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
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

export function ItemPreview({ modelPath, category, materialOverrides }: ItemPreviewProps) {
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
          <ModelPreview key={modelPath} modelPath={modelPath} materialOverrides={materialOverrides} />

          {/* Environment */}
          <Environment preset="city" />
        </Canvas>
      </Suspense>
    </div>
  )
}
