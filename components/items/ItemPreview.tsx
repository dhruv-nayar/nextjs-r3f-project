'use client'

import { Suspense, useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { useGLTF, PerspectiveCamera, Environment, OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { MaterialOverride } from '@/types/room'
import { applyMaterialOverrides, getTexturePathsFromOverrides } from '@/lib/material-utils'
import { DimensionLines } from './DimensionLines'

interface ItemPreviewProps {
  modelPath: string
  category: string
  materialOverrides?: MaterialOverride[]
  defaultRotation?: { x: number; z: number }
  dimensions?: { width: number; height: number; depth: number }
  showDimensionLines?: boolean
}

/**
 * ModelPreview - Renders a 3D model with proper transform hierarchy:
 *
 * Transform order (outside to inside):
 * 1. groundOffsetGroup - Lifts model so bottom touches Y=0
 * 2. tiltGroup - X/Z rotation + uniform scale (rotates around model center)
 * 3. model - Centered at origin
 *
 * Key insight: Model must be centered at origin for rotation to work correctly.
 * Ground offset is applied AFTER rotation so the model sits on the ground.
 * Camera interaction is handled by OrbitControls in the parent Canvas.
 */
function ModelPreview({ modelPath, materialOverrides, defaultRotation, dimensions }: {
  modelPath: string
  materialOverrides?: MaterialOverride[]
  defaultRotation?: { x: number; z: number }
  dimensions?: { width: number; height: number; depth: number }
}) {
  const { scene } = useGLTF(modelPath)
  const groundOffsetRef = useRef<THREE.Group>(null)
  const tiltRef = useRef<THREE.Group>(null)
  const { invalidate } = useThree()

  // Serialize for stable dependency tracking
  const overridesKey = materialOverrides ? JSON.stringify(materialOverrides) : 'none'

  // Extract texture paths that need to be loaded
  const texturePaths = useMemo(() => {
    const paths = getTexturePathsFromOverrides(materialOverrides || [])
    console.log('[ItemPreview] Texture paths to load:', paths, 'from overrides:', materialOverrides)
    return paths
  }, [materialOverrides])

  // Load textures asynchronously and track in state
  const [textureMap, setTextureMap] = useState<Map<string, THREE.Texture>>(() => new Map())

  useEffect(() => {
    if (texturePaths.length === 0) {
      setTextureMap(new Map())
      return
    }

    const loader = new THREE.TextureLoader()
    const newMap = new Map<string, THREE.Texture>()
    let loadedCount = 0

    texturePaths.forEach(path => {
      console.log('[ItemPreview] Loading texture:', path)
      loader.load(
        path,
        (texture) => {
          console.log('[ItemPreview] Texture loaded successfully:', path, texture)
          newMap.set(path, texture)
          loadedCount++
          if (loadedCount === texturePaths.length) {
            console.log('[ItemPreview] All textures loaded, updating textureMap')
            setTextureMap(new Map(newMap))
            invalidate()
          }
        },
        undefined,
        (error) => {
          console.error('[ItemPreview] Failed to load texture:', path, error)
          loadedCount++
          if (loadedCount === texturePaths.length) {
            setTextureMap(new Map(newMap))
          }
        }
      )
    })

    // Cleanup: dispose textures on unmount
    return () => {
      newMap.forEach(texture => texture.dispose())
    }
  }, [texturePaths, invalidate])

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

    // Apply material overrides (with texture support)
    if (materialOverrides && materialOverrides.length > 0) {
      console.log('[ItemPreview] Applying material overrides:', materialOverrides, 'with textureMap size:', textureMap.size)
      applyMaterialOverrides(freshClone, materialOverrides, textureMap)
    }

    return freshClone
  }, [scene, sceneTransform, overridesKey, textureMap])

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

  return (
    <group ref={groundOffsetRef}>
      <group ref={tiltRef}>
        <primitive object={clonedScene} />
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

export function ItemPreview({ modelPath, category, materialOverrides, defaultRotation, dimensions, showDimensionLines }: ItemPreviewProps) {
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
          frameloop="demand"
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

          {/* Camera Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={1}
            maxDistance={10}
            target={[0, 1, 0]}
          />

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

          {/* Dimension Lines - rendered in world space, outside the model rotation */}
          {dimensions && showDimensionLines && (
            <DimensionLines dimensions={dimensions} />
          )}

          {/* Environment */}
          <Environment preset="city" />
        </Canvas>
      </Suspense>
    </div>
  )
}
