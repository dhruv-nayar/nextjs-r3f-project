'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { ParametricShape, ExtrusionShape, RugShape, FrameShape, ShelfShape, Vector3 } from '@/types/room'
import { RugShapeRenderer, calculateRugDimensions } from './RugShapeRenderer'
import { FrameShapeRenderer, calculateFrameDimensions } from './FrameShapeRenderer'
import { ShelfShapeRenderer, calculateShelfDimensions } from './ShelfShapeRenderer'

interface ParametricShapeRendererProps {
  shape: ParametricShape
  instanceId?: string         // For surface registration (rugs, shelves)
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
 * Renders an extrusion shape (2D polygon extruded to 3D)
 */
function ExtrusionShapeRenderer({
  shape,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: {
  shape: ExtrusionShape
  position?: Vector3
  rotation?: Vector3
  scale?: Vector3
  castShadow?: boolean
  receiveShadow?: boolean
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}) {
  // Create the extruded geometry from the shape points
  const geometry = useMemo(() => {
    if (!shape.points || shape.points.length < 3) {
      // Fallback to a simple box if not enough points
      return new THREE.BoxGeometry(1, shape.height, 1)
    }

    // Create a 2D shape from the polygon points
    const threeShape = new THREE.Shape()

    // Move to the first point
    threeShape.moveTo(shape.points[0].x, shape.points[0].y)

    // Draw lines to each subsequent point
    for (let i = 1; i < shape.points.length; i++) {
      threeShape.lineTo(shape.points[i].x, shape.points[i].y)
    }

    // Close the shape (back to first point)
    threeShape.lineTo(shape.points[0].x, shape.points[0].y)

    // Extrude settings
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: shape.height,
      bevelEnabled: false
    }

    // Create the extruded geometry
    const extrudeGeometry = new THREE.ExtrudeGeometry(threeShape, extrudeSettings)

    // The extrusion goes along Z-axis by default, but we want it to go up (Y-axis)
    // So we rotate the geometry to have the extrusion go upward
    extrudeGeometry.rotateX(-Math.PI / 2)

    // Center the geometry at its bounding box center
    extrudeGeometry.computeBoundingBox()
    const boundingBox = extrudeGeometry.boundingBox!
    const centerX = (boundingBox.max.x + boundingBox.min.x) / 2
    const centerZ = (boundingBox.max.z + boundingBox.min.z) / 2
    extrudeGeometry.translate(-centerX, 0, -centerZ)

    return extrudeGeometry
  }, [shape])

  // Create the material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: shape.color || '#808080',
      roughness: 0.7,
      metalness: 0.1
    })
  }, [shape.color])

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={[scale.x, scale.y, scale.z]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    />
  )
}

/**
 * Main dispatcher component that renders the appropriate shape type
 * Supports: extrusion, rug, frame, shelf
 */
export function ParametricShapeRenderer({
  shape,
  instanceId,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: ParametricShapeRendererProps) {
  switch (shape.type) {
    case 'rug':
      return (
        <RugShapeRenderer
          shape={shape}
          instanceId={instanceId}
          position={position}
          rotation={rotation}
          scale={scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      )

    case 'frame':
      return (
        <FrameShapeRenderer
          shape={shape}
          position={position}
          rotation={rotation}
          scale={scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      )

    case 'shelf':
      return (
        <ShelfShapeRenderer
          shape={shape}
          instanceId={instanceId}
          position={position}
          rotation={rotation}
          scale={scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      )

    case 'extrusion':
    default:
      return (
        <ExtrusionShapeRenderer
          shape={shape as ExtrusionShape}
          position={position}
          rotation={rotation}
          scale={scale}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      )
  }
}

/**
 * Calculate the bounding dimensions of any parametric shape type
 * Used for item dimensions when creating from parametric shape
 */
export function calculateShapeDimensions(shape: ParametricShape): {
  width: number
  height: number
  depth: number
} {
  switch (shape.type) {
    case 'rug':
      return calculateRugDimensions(shape)

    case 'frame':
      return calculateFrameDimensions(shape)

    case 'shelf':
      return calculateShelfDimensions(shape)

    case 'extrusion':
    default: {
      const extrusionShape = shape as ExtrusionShape
      if (!extrusionShape.points || extrusionShape.points.length < 3) {
        return { width: 1, height: extrusionShape.height, depth: 1 }
      }

      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      for (const point of extrusionShape.points) {
        minX = Math.min(minX, point.x)
        maxX = Math.max(maxX, point.x)
        minY = Math.min(minY, point.y)
        maxY = Math.max(maxY, point.y)
      }

      return {
        width: maxX - minX,
        height: extrusionShape.height,
        depth: maxY - minY  // 2D Y becomes 3D Z (depth)
      }
    }
  }
}
