'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, PerspectiveCamera, Environment } from '@react-three/drei'
import * as THREE from 'three'

interface ThumbnailGeneratorProps {
  modelPath: string
  onThumbnailGenerated: (blob: Blob, dimensions?: { width: number; height: number; depth: number }) => void
  onError: (error: string) => void
}

// Conversion factor: GLB units (typically meters) to feet
const METERS_TO_FEET = 3.28084

function ModelForThumbnail({
  modelPath,
  onReady
}: {
  modelPath: string
  onReady: (dimensions: { width: number; height: number; depth: number }) => void
}) {
  const { scene } = useGLTF(modelPath)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  const groupRef = useRef<THREE.Group>(null)
  const [frameCount, setFrameCount] = useState(0)
  const dimensionsRef = useRef<{ width: number; height: number; depth: number } | null>(null)
  const { invalidate } = useThree()

  // Center and scale the model to fit in view
  useEffect(() => {
    if (!groupRef.current) return

    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // Store dimensions in feet (assuming GLB is in meters)
    // Round to 1 decimal place for cleaner values
    dimensionsRef.current = {
      width: Math.round(size.x * METERS_TO_FEET * 10) / 10,
      height: Math.round(size.y * METERS_TO_FEET * 10) / 10,
      depth: Math.round(size.z * METERS_TO_FEET * 10) / 10
    }

    // Center the model
    clonedScene.position.set(-center.x, -box.min.y, -center.z)

    // Scale to fit in view (make largest dimension = 2 units)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2 / maxDim
    groupRef.current.scale.setScalar(scale)

    invalidate()
  }, [clonedScene, invalidate])

  // Wait 10 frames before capturing (ensures stable render)
  useFrame(() => {
    if (frameCount < 10) {
      setFrameCount(prev => prev + 1)
      invalidate()
    } else if (frameCount === 10) {
      setFrameCount(11)
      // Pass dimensions to parent when ready
      onReady(dimensionsRef.current || { width: 2, height: 2, depth: 2 })
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  )
}

export function ThumbnailGenerator({
  modelPath,
  onThumbnailGenerated,
  onError
}: ThumbnailGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasCapture, setHasCaptured] = useState(false)
  const dimensionsRef = useRef<{ width: number; height: number; depth: number } | undefined>(undefined)

  const handleModelReady = (dimensions: { width: number; height: number; depth: number }) => {
    dimensionsRef.current = dimensions
    setIsReady(true)
  }

  useEffect(() => {
    if (isReady && !hasCapture && canvasRef.current) {
      setHasCaptured(true)

      // Capture screenshot
      try {
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            onThumbnailGenerated(blob, dimensionsRef.current)
          } else {
            onError('Failed to capture thumbnail')
          }
        }, 'image/png')
      } catch (error) {
        onError(`Failed to capture thumbnail: ${error}`)
      }
    }
  }, [isReady, hasCapture, onThumbnailGenerated, onError])

  return (
    <div style={{ position: 'absolute', left: -9999, top: -9999 }}>
      <Canvas
        ref={canvasRef}
        style={{ width: 512, height: 512 }}
        frameloop="always"
        gl={{
          preserveDrawingBuffer: true,  // Required for toBlob()
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x1f2937, 0)
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 1, 4]} fov={50} />

        {/* Lighting - same as ItemPreview */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 3, -5]} intensity={0.5} />

        {/* Environment */}
        <Environment preset="city" />

        <ModelForThumbnail
          modelPath={modelPath}
          onReady={handleModelReady}
        />
      </Canvas>
    </div>
  )
}
