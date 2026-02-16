'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { ParametricShape, Vector3 } from '@/types/room'

interface ParametricShapeRendererProps {
  shape: ParametricShape
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
 * Renders a parametric shape (extruded 2D polygon) as a 3D mesh
 * Used for user-created custom items
 */
export function ParametricShapeRenderer({
  shape,
  position = { x: 0, y: 0, z: 0 },
  rotation = { x: 0, y: 0, z: 0 },
  scale = { x: 1, y: 1, z: 1 },
  castShadow = true,
  receiveShadow = true,
  onClick,
  onPointerOver,
  onPointerOut
}: ParametricShapeRendererProps) {
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
 * Calculate the bounding dimensions of a parametric shape
 * Used for item dimensions when creating from parametric shape
 */
export function calculateShapeDimensions(shape: ParametricShape): {
  width: number
  height: number
  depth: number
} {
  if (!shape.points || shape.points.length < 3) {
    return { width: 1, height: shape.height, depth: 1 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const point of shape.points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }

  return {
    width: maxX - minX,
    height: shape.height,
    depth: maxY - minY  // 2D Y becomes 3D Z (depth)
  }
}
