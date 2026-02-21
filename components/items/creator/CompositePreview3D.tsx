'use client'

import { Suspense, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { CompositeShape, ExtrusionFaceId } from '@/types/room'
import { CompositeShapeRenderer, calculateCompositeDimensions } from '../CompositeShapeRenderer'

interface CompositePreview3DProps {
  shape: CompositeShape
  selectedPartId: string | null
  highlightedFace: { partId: string; faceId: ExtrusionFaceId } | null
  onPartClick?: (partId: string, faceId: ExtrusionFaceId) => void
  onPartHover?: (partId: string | null, faceId: ExtrusionFaceId | null) => void
  onCaptureThumbnail?: (dataUrl: string) => void
  shouldCaptureThumbnail?: boolean
}

/**
 * Component to capture the 3D scene as an image
 */
function ThumbnailCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    // Wait a frame for the scene to render, then capture
    const timeoutId = setTimeout(() => {
      gl.render(scene, camera)
      const dataUrl = gl.domElement.toDataURL('image/png')
      onCapture(dataUrl)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [gl, scene, camera, onCapture])

  return null
}

/**
 * 3D Preview of a composite shape with face selection support
 *
 * Features:
 * - Orbit controls for viewing
 * - Click faces to select them
 * - Hover highlighting
 * - Auto-fitting camera to shape
 * - Thumbnail capture
 */
export function CompositePreview3D({
  shape,
  selectedPartId,
  highlightedFace,
  onPartClick,
  onPartHover,
  onCaptureThumbnail,
  shouldCaptureThumbnail,
}: CompositePreview3DProps) {
  const [captureReady, setCaptureReady] = useState(false)

  // Reset capture when shouldCaptureThumbnail changes
  useEffect(() => {
    if (shouldCaptureThumbnail) {
      // Small delay to let scene render
      const timer = setTimeout(() => setCaptureReady(true), 200)
      return () => clearTimeout(timer)
    } else {
      setCaptureReady(false)
    }
  }, [shouldCaptureThumbnail])

  // Calculate camera position based on shape dimensions
  const dimensions = calculateCompositeDimensions(shape)
  const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.depth)
  const cameraDistance = Math.max(5, maxDim * 2)

  const handleCapture = (dataUrl: string) => {
    setCaptureReady(false)
    onCaptureThumbnail?.(dataUrl)
  }

  if (shape.parts.length === 0) {
    return (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm border border-gray-300">
        Add parts to preview
      </div>
    )
  }

  return (
    <div className="h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
      <Canvas gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        <PerspectiveCamera
          makeDefault
          position={[cameraDistance, cameraDistance * 0.8, cameraDistance]}
        />
        <OrbitControls enablePan={false} />

        <Suspense fallback={null}>
          <CompositeShapeRenderer
            shape={shape}
            selectedPartId={selectedPartId}
            highlightedFace={highlightedFace}
            onPartClick={onPartClick}
            onPartHover={onPartHover}
          />
        </Suspense>

        <gridHelper args={[10, 10, '#cccccc', '#e5e5e5']} />

        {/* Capture thumbnail when ready */}
        {captureReady && onCaptureThumbnail && <ThumbnailCapture onCapture={handleCapture} />}
      </Canvas>
    </div>
  )
}

/**
 * Simplified preview for a single ExtrusionShapeV2 (during part creation)
 */
export function SingleShapePreview3D({
  shape,
  onCaptureThumbnail,
  shouldCaptureThumbnail,
}: {
  shape: { points: Array<{ x: number; y: number }>; height: number; color: string } | null
  onCaptureThumbnail?: (dataUrl: string) => void
  shouldCaptureThumbnail?: boolean
}) {
  const [captureReady, setCaptureReady] = useState(false)

  useEffect(() => {
    if (shouldCaptureThumbnail) {
      const timer = setTimeout(() => setCaptureReady(true), 200)
      return () => clearTimeout(timer)
    } else {
      setCaptureReady(false)
    }
  }, [shouldCaptureThumbnail])

  const handleCapture = (dataUrl: string) => {
    setCaptureReady(false)
    onCaptureThumbnail?.(dataUrl)
  }

  if (!shape || shape.points.length < 3) {
    return (
      <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm border border-gray-300">
        {shape && shape.points.length > 0
          ? `${3 - shape.points.length} more points needed`
          : 'Draw a shape to preview'}
      </div>
    )
  }

  // Import and use the legacy extrusion renderer for simple preview
  // We'll convert to ExtrusionShapeV2 when adding as a part
  return (
    <div className="h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
      <Canvas gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls enablePan={false} />

        <Suspense fallback={null}>
          <SimpleExtrusionMesh
            points={shape.points}
            height={shape.height}
            color={shape.color}
          />
        </Suspense>

        <gridHelper args={[10, 10, '#cccccc', '#e5e5e5']} />

        {captureReady && onCaptureThumbnail && <ThumbnailCapture onCapture={handleCapture} />}
      </Canvas>
    </div>
  )
}

/**
 * Simple extrusion mesh for preview (uses legacy single-color material)
 */
import { useMemo } from 'react'
import * as THREE from 'three'

function SimpleExtrusionMesh({
  points,
  height,
  color,
}: {
  points: Array<{ x: number; y: number }>
  height: number
  color: string
}) {
  const geometry = useMemo(() => {
    const threeShape = new THREE.Shape()
    threeShape.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      threeShape.lineTo(points[i].x, points[i].y)
    }
    threeShape.lineTo(points[0].x, points[0].y)

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: false,
    }
    const extrudeGeometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings)
    extrudeGeometry.rotateX(-Math.PI / 2)

    // Center the geometry
    extrudeGeometry.computeBoundingBox()
    const boundingBox = extrudeGeometry.boundingBox!
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
    const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2
    extrudeGeometry.translate(-centerX, 0, -centerZ)

    return extrudeGeometry
  }, [points, height])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1,
    })
  }, [color])

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}
