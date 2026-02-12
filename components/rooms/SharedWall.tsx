'use client'

import * as THREE from 'three'
import { useMemo } from 'react'
import { SharedWall as SharedWallType } from '@/types/room'

/**
 * Create wall geometry with holes for multiple doors
 * Similar to createWallWithDoor in Room.tsx, but supports multiple doors
 */
function createWallWithDoors(
  wallWidth: number,
  wallHeight: number,
  doors: Array<{ position: number; width: number; height: number }>
): THREE.ShapeGeometry {
  const shape = new THREE.Shape()

  // Create outer rectangle (wall)
  shape.moveTo(-wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, 0)
  shape.lineTo(wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, wallHeight)
  shape.lineTo(-wallWidth / 2, 0)

  // Create hole for each door
  doors.forEach(door => {
    const hole = new THREE.Path()

    // Convert door position from wall-relative to centered coordinates
    // door.position is the door's CENTER in feet from left edge of wall
    const doorCenterX = -wallWidth / 2 + door.position
    const doorY = 0

    // Create hole centered at doorCenterX (same as Room.tsx)
    hole.moveTo(doorCenterX - door.width / 2, doorY)
    hole.lineTo(doorCenterX + door.width / 2, doorY)
    hole.lineTo(doorCenterX + door.width / 2, doorY + door.height)
    hole.lineTo(doorCenterX - door.width / 2, doorY + door.height)
    hole.lineTo(doorCenterX - door.width / 2, doorY)

    shape.holes.push(hole)
  })

  return new THREE.ShapeGeometry(shape)
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

  // Grid texture
  const gridTexture = useMemo(() => createGridTexture(), [])

  // Determine rotation based on orientation
  // For east-west: wall runs along X axis, faces +Z/-Z, no rotation
  // For north-south: wall runs along Z axis, faces +X/-X, rotate 90° around Y
  const rotation: [number, number, number] = wall.orientation === 'north-south'
    ? [0, Math.PI / 2, 0]
    : [0, 0, 0]

  return (
    <group position={wall.position}>
      <mesh rotation={rotation} receiveShadow>
        <primitive object={geometry} />
        <meshStandardMaterial
          map={gridTexture}
          map-repeat={[wall.width, wall.height]}
          side={THREE.DoubleSide}
          color="#ffffff"  // White to match other walls
        />
      </mesh>
    </group>
  )
}
