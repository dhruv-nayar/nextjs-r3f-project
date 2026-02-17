'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { SharedWall as SharedWallType } from '@/types/room'

/**
 * Create wall geometry with holes for multiple doors
 * Shape is centered vertically (from -height/2 to +height/2)
 */
function createWallWithDoors(
  wallWidth: number,
  wallHeight: number,
  doors: Array<{ position: number; width: number; height: number }>
): THREE.ShapeGeometry {
  console.log('[SharedWall createWallWithDoors]', { wallWidth, wallHeight, doorCount: doors.length })

  const shape = new THREE.Shape()

  // Create outer rectangle (wall) centered vertically at origin - CCW winding
  shape.moveTo(-wallWidth / 2, -wallHeight / 2)
  shape.lineTo(wallWidth / 2, -wallHeight / 2)
  shape.lineTo(wallWidth / 2, wallHeight / 2)
  shape.lineTo(-wallWidth / 2, wallHeight / 2)
  shape.closePath()

  // Create hole for each door - CW winding (OPPOSITE of outer shape)
  doors.forEach((door, index) => {
    // door.position is in range -0.5 to 0.5 where 0 is center
    const doorX = door.position * wallWidth
    const doorLeft = doorX - door.width / 2
    const doorRight = doorX + door.width / 2
    const doorBottom = -wallHeight / 2
    const doorTop = doorBottom + door.height

    console.log(`[SharedWall] Door ${index}:`, {
      position: door.position,
      width: door.width,
      height: door.height,
      doorX,
      doorLeft,
      doorRight,
      wallRange: [-wallWidth / 2, wallWidth / 2],
      doorBottom,
      doorTop
    })

    // Validate door is within wall bounds with margin
    const MARGIN = 0.05 // 0.05 feet margin from edges
    if (doorLeft < -wallWidth / 2 + MARGIN || doorRight > wallWidth / 2 - MARGIN) {
      console.warn(`[SharedWall] Door ${index} is too close to wall bounds, skipping`)
      return
    }

    // Add small inset to ensure hole doesn't touch outer boundary (critical for triangulation)
    const INSET = 0.01
    const insetLeft = doorLeft + INSET
    const insetRight = doorRight - INSET
    const insetBottom = doorBottom + INSET
    const insetTop = doorTop - INSET

    // Create hole with CW winding (opposite of outer shape) - required by THREE.js
    const hole = new THREE.Path()
    hole.moveTo(insetLeft, insetBottom)
    hole.lineTo(insetLeft, insetTop)      // Go up
    hole.lineTo(insetRight, insetTop)     // Go right
    hole.lineTo(insetRight, insetBottom)  // Go down
    hole.closePath()

    shape.holes.push(hole)
  })

  const geometry = new THREE.ShapeGeometry(shape)
  console.log('[SharedWall] Created geometry, vertices:', geometry.attributes.position.count)

  return geometry
}

/**
 * Create grid texture for wall
 * Same as Room component
 */
function createGridTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 64, 64)

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 64)
  ctx.moveTo(0, 0)
  ctx.lineTo(64, 0)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function SharedWall({ wall }: { wall: SharedWallType }) {
  // Create geometry with door holes
  const geometry = useMemo(() => {
    return createWallWithDoors(wall.width, wall.height, wall.doors)
  }, [wall.width, wall.height, wall.doors])

  // Determine rotation based on orientation
  // For east-west: wall runs along X axis, faces +Z/-Z, no rotation
  // For north-south: wall runs along Z axis, faces +X/-X, rotate 90° around Y
  const rotation: [number, number, number] = wall.orientation === 'north-south'
    ? [0, Math.PI / 2, 0]
    : [0, 0, 0]

  console.log('[SharedWall render]', {
    id: wall.id,
    position: wall.position,
    width: wall.width,
    height: wall.height,
    orientation: wall.orientation,
    doorCount: wall.doors.length
  })

  return (
    <group position={wall.position}>
      <mesh rotation={rotation} position={[0, wall.height / 2, 0]} receiveShadow castShadow>
        <primitive object={geometry} />
        <meshStandardMaterial
          color="#e8e8e8"
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
